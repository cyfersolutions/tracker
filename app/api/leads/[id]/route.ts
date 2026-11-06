import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import User from "@/models/User";
import { leadSchema } from "@/lib/validations/lead.schema";
import {
  canManageLeadPrice,
  getLeadTotalPrice,
  getPreviousBasePriceAdjustment,
  omitLeadPrices,
} from "@/lib/lead-pricing";
import {
  getManagedLeadVideoPath,
  LeadVideoUploadError,
  readLeadSubmission,
  removeUploadedLeadVideo,
} from "@/lib/server/lead-video";
import Campaign from "@/models/Campaign";

export const runtime = "nodejs";

export const GET = withAuth("leads:view", async (_request, context, user) => {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lead identifier." }, { status: 400 });
    }
    await connectToDatabase();
    const lead = await Lead.findById(id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name")
      .lean();
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    if (user.role.type === "client" && (!lead.campaign || !(user.campaignIds ?? []).some((campaignId: unknown) => String(campaignId) === String(lead.campaign)))) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }
    return NextResponse.json(canManageLeadPrice(user) ? lead : omitLeadPrices(lead));
  } catch (error) {
    return apiError(error);
  }
});

export const PUT = withAuth("leads:edit", async (request, context, user) => {
  const uploadedFilePaths: string[] = [];
  let keepUploadedVideo = false;
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lead identifier." }, { status: 400 });
    }
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

    const body =
      typeof submission.body === "object" && submission.body !== null && !Array.isArray(submission.body)
        ? {
            ...submission.body,
            ...(submission.file ? { videoUrl: submission.file.videoUrl } : {}),
            documents: [...submittedDocs, ...newDocuments],
          }
        : submission.body;
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
    if (
      !canManageLeadPrice(user) &&
      typeof body === "object" &&
      body !== null &&
      "basePrice" in body
    ) {
      return NextResponse.json(
        { error: "Only Super Admins and clients can change lead prices." },
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
    const editableLeadData = {
      leadType: leadData.leadType,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      videoUrl: leadData.videoUrl,
      address: leadData.address,
      roofSize: leadData.roofSize,
      mcNumber: leadData.mcNumber,
      truckType: leadData.truckType,
      trucks: leadData.trucks,
      revenue: leadData.revenue,
      otr: leadData.otr,
      documents: leadData.documents,
      notes: leadData.notes,
      status: leadData.status,
    };
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
    const existing = await Lead.findById(id).select("status basePrice finalPrice topUps videoUrl");
    if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    if (
      parsed.data.leadType !== "Trucking" &&
      !submission.file &&
      parsed.data.videoUrl !== existing.videoUrl
    ) {
      return NextResponse.json(
        { error: "Upload a video file to change the lead video." },
        { status: 400 },
      );
    }
    if (
      (parsed.data.status === "INSPECTION_AWAITING" || parsed.data.status === "LOST") &&
      existing.status !== parsed.data.status
    ) {
      return NextResponse.json(
        { error: "Use the lead board to accept a Warm lead for inspection or to mark a lead as lost with a reason." },
        { status: 400 },
      );
    }
    const previousBasePrice = existing.basePrice ?? 50;
    const nextBasePrice = canManageLeadPrice(user) ? parsed.data.basePrice : previousBasePrice;
    if (
      existing.status === "WON" &&
      (parsed.data.status !== "WON" || nextBasePrice !== previousBasePrice)
    ) {
      return NextResponse.json(
        { error: "Won leads cannot be reopened or have their price changed." },
        { status: 409 },
      );
    }
    const previousPriceAdjustment =
      existing.status === "WON"
        ? null
        : getPreviousBasePriceAdjustment(previousBasePrice, nextBasePrice);
    const priceHistory = [
      ...(existing.topUps ?? []),
      ...(previousPriceAdjustment === null ? [] : [{ amount: previousPriceAdjustment }]),
    ];
    const set: Record<string, unknown> = {
      ...editableLeadData,
      basePrice: nextBasePrice,
      assignedTo: assignedTo || null,
      campaign: campaign || null,
      finalPrice: getLeadTotalPrice({
        basePrice: nextBasePrice,
        topUps: priceHistory,
      }),
    };
    if (parsed.data.status === "WON" && existing.status !== "WON") {
      set.closedAt = new Date();
    }
    const update: Record<string, unknown> = { $set: set };
    if (previousPriceAdjustment !== null) {
      update.$push = {
        topUps: {
          _id: new Types.ObjectId(),
          description: "Previous starting price before admin price change",
          amount: previousPriceAdjustment,
          addedBy: user._id,
          addedAt: new Date(),
        },
      };
    }
    const lead = await Lead.findOneAndUpdate(
      existing.status === "WON"
        ? {
            _id: id,
            status: "WON",
            basePrice: existing.basePrice ?? null,
            finalPrice: existing.finalPrice ?? null,
          }
        : {
            _id: id,
            status: { $ne: "WON" },
            basePrice: existing.basePrice ?? null,
            finalPrice: existing.finalPrice ?? null,
          },
      update,
      { returnDocument: "after", runValidators: true },
    );
    if (!lead) {
      const current = await Lead.findById(id).select("status");
      if (!current) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      if (current.status === "WON") {
        return NextResponse.json({ error: "Won leads cannot be reopened." }, { status: 409 });
      }
      return NextResponse.json(
        { error: "This lead changed while you were editing it. Reload and try again." },
        { status: 409 },
      );
    }
    keepUploadedVideo = true;
    if (submission.file && existing.videoUrl !== submission.file.videoUrl) {
      const previousVideoPath = getManagedLeadVideoPath(existing.videoUrl);
      if (previousVideoPath) {
        const previousVideoStillUsed = await Lead.exists({ videoUrl: existing.videoUrl });
        if (!previousVideoStillUsed) await removeUploadedLeadVideo(previousVideoPath);
      }
    }
    const responseLead = lead.toObject();
    return NextResponse.json(
      canManageLeadPrice(user) ? responseLead : omitLeadPrices(responseLead),
    );
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

export const DELETE = withAuth("leads:delete", async (_request, context) => {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lead identifier." }, { status: 400 });
    }
    await connectToDatabase();
    const lead = await Lead.findByIdAndDelete(id);
    if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
});
