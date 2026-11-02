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
    if (status) filter.status = status;
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: expression }, { email: expression }, { phone: expression }];
    }

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate("assignedTo", "name email")
        .populate("createdBy", "name")
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
  let uploadedVideoPath: string | undefined;
  let keepUploadedVideo = false;
  try {
    const submission = await readLeadSubmission(request);
    uploadedVideoPath = submission.file?.path;
    const body =
      typeof submission.body === "object" &&
      submission.body !== null &&
      !Array.isArray(submission.body)
        ? {
            ...submission.body,
            ...(submission.file ? { videoUrl: submission.file.videoUrl } : {}),
          }
        : submission.body;
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid lead data.", details: parsed.error.flatten() },
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
    const { assignedTo, ...leadData } = parsed.data;
    const canAssign = user.isSuperAdmin || user.role.permissions.includes("leads:edit");
    if (assignedTo && !canAssign) {
      return NextResponse.json(
        { error: "The leads:edit permission is required to assign a lead." },
        { status: 403 },
      );
    }
    if (assignedTo) {
      const assignee = await User.findOne({ _id: assignedTo, isActive: true }).select("_id");
      if (!assignee) {
        return NextResponse.json({ error: "Assignee not found or inactive." }, { status: 400 });
      }
    }

    const lead = await Lead.create({
      ...leadData,
      finalPrice: getLeadTotalPrice({ basePrice: leadData.basePrice, topUps: [] }),
      assignedTo: assignedTo || null,
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
    if (uploadedVideoPath && !keepUploadedVideo) {
      try {
        await removeUploadedLeadVideo(uploadedVideoPath);
      } catch (error) {
        console.error("Could not remove an unsuccessful lead video upload.", error);
      }
    }
  }
});
