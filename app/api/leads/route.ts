import { NextResponse, type NextRequest } from "next/server";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import User from "@/models/User";
import { leadQuerySchema, leadSchema } from "@/lib/validations/lead.schema";
import {
  canManageLeadPrice,
  getLeadTotalPrice,
  omitLeadPrices,
} from "@/lib/lead-pricing";
import {
  LeadVideoUploadError,
  readLeadSubmission,
  removeUploadedLeadVideo,
} from "@/lib/server/lead-video";
import { getDefaultLeadPrice } from "@/lib/settings";
import Campaign from "@/models/Campaign";

export const runtime = "nodejs";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const GET = withAuth("leads:view", async (request: NextRequest, _context, user) => {
  try {
    const parsed = leadQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query parameters." }, { status: 400 });
    }

    await connectToDatabase();
    const { page, limit, search, status } = parsed.data;
    const filter: Record<string, unknown> = {};
    if (user.role.type === "client") filter.campaign = { $in: user.campaignIds ?? [] };
    if (status) filter.status = status;
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: expression }, { email: expression }, { phone: expression }];
    }

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name")
        .populate("campaign", "name")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      Lead.countDocuments(filter),
    ]);

    const visibleLeads = canManageLeadPrice(user) ? leads : leads.map(omitLeadPrices);
    return NextResponse.json({
      leads: visibleLeads,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return apiError(error);
  }
});

export const POST = withAuth("leads:create", async (request, _context, user) => {
  const uploadedFilePaths: string[] = [];
  let keepUploadedVideo = false;
  try {
    const canAssign =
      user.isSuperAdmin ||
      user.role.permissions.includes("leads:edit") ||
      user.role.permissions.includes("leads:create");
    const submission = await readLeadSubmission(request);
    if (submission.file?.path) uploadedFilePaths.push(submission.file.path);
    if (submission.documentFiles) {
      uploadedFilePaths.push(...submission.documentFiles.map((doc) => doc.path));
    }

    const newDocuments = (submission.documentFiles ?? []).map((doc) => ({
      name: doc.originalName,
      url: doc.url,
      size: doc.size,
      uploadedAt: new Date(),
    }));

    const rawDocs =
      typeof submission.body === "object" &&
      submission.body !== null &&
      "documents" in submission.body &&
      Array.isArray((submission.body as { documents?: unknown }).documents)
        ? ((submission.body as { documents: unknown[] }).documents)
        : [];
    const submittedDocs: unknown[] = rawDocs;

    const submittedBody =
      typeof submission.body === "object" &&
      submission.body !== null &&
      !Array.isArray(submission.body)
        ? {
            ...submission.body,
            ...(submission.file ? { videoUrl: submission.file.videoUrl } : {}),
            documents: [...submittedDocs, ...newDocuments],
          }
        : submission.body;
    const body = submittedBody;
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const pathKey = issue.path.join(".");
        if (pathKey && !fieldErrors[pathKey]) {
          fieldErrors[pathKey] = issue.message;
        }
      }
      const firstErrorMessage = parsed.error.issues[0]?.message || "Invalid lead data.";
      return NextResponse.json(
        { error: firstErrorMessage, fieldErrors, details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.status === "INSPECTION_AWAITING" || parsed.data.status === "LOST") {
      return NextResponse.json(
        {
          error: "Leads cannot be created as Inspection Awaiting or Lost.",
          fieldErrors: { status: "Leads cannot be created as Inspection Awaiting or Lost." },
        },
        { status: 400 },
      );
    }

    if (
      !canManageLeadPrice(user) &&
      typeof body === "object" &&
      body !== null &&
      "basePrice" in body
    ) {
      return NextResponse.json(
        { error: "Only Super Admins and clients can set lead prices." },
        { status: 403 },
      );
    }

    await connectToDatabase();
    const { assignedTo, campaign, ...leadData } = parsed.data;
    let campaignRecord: { _id: unknown; type?: "Roofing" | "Trucking"; clientIds?: unknown[] } | null = null;
    if (campaign) {
      campaignRecord = await Campaign.findOne({ _id: campaign, isActive: true }).select("_id type clientIds").lean();
      if (!campaignRecord) {
        return NextResponse.json(
          { error: "Campaign not found or inactive.", fieldErrors: { campaign: "Campaign not found or inactive." } },
          { status: 400 },
        );
      }
      if (campaignRecord.type) {
        leadData.leadType = campaignRecord.type;
      }
    }
    if (
      typeof body !== "object" ||
      body === null ||
      !("basePrice" in body)
    ) {
      leadData.basePrice = await getDefaultLeadPrice();
    }
    if (assignedTo && !canAssign) {
      return NextResponse.json(
        {
          error: "The leads:create or leads:edit permission is required to assign a lead.",
          fieldErrors: { assignedTo: "Permission required to assign a lead." },
        },
        { status: 403 },
      );
    }
    if (assignedTo) {
      const assignee = await User.findOne({ _id: assignedTo, isActive: true })
        .populate("role", "type")
        .select("_id role campaignIds")
        .lean();
      if (!assignee) {
        return NextResponse.json(
          { error: "Client not found or inactive.", fieldErrors: { assignedTo: "Client not found or inactive." } },
          { status: 400 },
        );
      }
      if (
        !assignee.role ||
        typeof assignee.role !== "object" ||
        !("type" in assignee.role) ||
        assignee.role.type !== "client"
      ) {
        return NextResponse.json(
          {
            error: "Calls can only be transferred to client users, not internal users.",
            fieldErrors: { assignedTo: "Calls can only be transferred to client users, not internal users." },
          },
          { status: 400 },
        );
      }
      if (campaignRecord) {
        const isClientInCampaign =
          (campaignRecord.clientIds ?? []).some((id) => String(id) === String(assignedTo)) ||
          ((assignee as { campaignIds?: unknown[] }).campaignIds ?? []).some(
            (id: unknown) => String(id) === String(campaign),
          );
        if (!isClientInCampaign) {
          return NextResponse.json(
            {
              error: "The selected client is not assigned to this campaign.",
              fieldErrors: { assignedTo: "The selected client is not assigned to this campaign." },
            },
            { status: 400 },
          );
        }
      }
    }

    const lead = await Lead.create({
      ...leadData,
      finalPrice: getLeadTotalPrice({ basePrice: leadData.basePrice, topUps: [] }),
      assignedTo: assignedTo || null,
      campaign: campaign || null,
      createdBy: user._id,
    });
    keepUploadedVideo = true;
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    if (error instanceof LeadVideoUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  } finally {
    if (!keepUploadedVideo && uploadedFilePaths.length > 0) {
      for (const filePath of uploadedFilePaths) {
        try {
          await removeUploadedLeadVideo(filePath);
        } catch (error) {
          console.error("Could not remove an unsuccessful file upload.", error);
        }
      }
    }
  }
});
