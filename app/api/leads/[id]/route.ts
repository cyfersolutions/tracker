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
    return NextResponse.json(canManageLeadPrice(user) ? lead : omitLeadPrices(lead));
  } catch (error) {
    return apiError(error);
  }
});

export const PUT = withAuth("leads:edit", async (request, context, user) => {
  let uploadedVideoPath: string | undefined;
  let keepUploadedVideo = false;
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lead identifier." }, { status: 400 });
    }
    const submission = await readLeadSubmission(request);
    uploadedVideoPath = submission.file?.path;
    const body =
      submission.file &&
      typeof submission.body === "object" &&
      submission.body !== null &&
      !Array.isArray(submission.body)
        ? { ...submission.body, videoUrl: submission.file.videoUrl }
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
        { error: "Only Super Admins and clients can change lead prices." },
        { status: 403 },
      );
    }
    await connectToDatabase();
    const { assignedTo, ...leadData } = parsed.data;
    const editableLeadData = {
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      videoUrl: leadData.videoUrl,
      address: leadData.address,
      roofSize: leadData.roofSize,
      notes: leadData.notes,
      status: leadData.status,
    };
    if (assignedTo) {
      const assignee = await User.findOne({ _id: assignedTo, isActive: true }).select("_id");
      if (!assignee) {
        return NextResponse.json({ error: "Assignee not found or inactive." }, { status: 400 });
      }
    }
    const existing = await Lead.findById(id).select("status basePrice finalPrice topUps videoUrl");
    if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    if (!submission.file && parsed.data.videoUrl !== existing.videoUrl) {
      return NextResponse.json(
        { error: "Upload a video file to change the lead video." },
        { status: 400 },
      );
    }
    const previousBasePrice = existing.basePrice ?? 10;
    const nextBasePrice = canManageLeadPrice(user) ? parsed.data.basePrice : previousBasePrice;
    if (
      existing.status === "CLOSED" &&
      (parsed.data.status !== "CLOSED" || nextBasePrice !== previousBasePrice)
    ) {
      return NextResponse.json(
        { error: "Closed leads cannot be reopened or have their price changed." },
        { status: 409 },
      );
    }
    const previousPriceAdjustment =
      existing.status === "CLOSED"
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
      finalPrice: getLeadTotalPrice({
        basePrice: nextBasePrice,
        topUps: priceHistory,
      }),
    };
    if (parsed.data.status === "CLOSED" && existing.status !== "CLOSED") {
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
      existing.status === "CLOSED"
        ? {
            _id: id,
            status: "CLOSED",
            basePrice: existing.basePrice ?? null,
            finalPrice: existing.finalPrice ?? null,
          }
        : {
            _id: id,
            status: { $ne: "CLOSED" },
            basePrice: existing.basePrice ?? null,
            finalPrice: existing.finalPrice ?? null,
          },
      update,
      { returnDocument: "after", runValidators: true },
    );
    if (!lead) {
      const current = await Lead.findById(id).select("status");
      if (!current) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      if (current.status === "CLOSED") {
        return NextResponse.json({ error: "Closed leads cannot be reopened." }, { status: 409 });
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
    if (uploadedVideoPath && !keepUploadedVideo) {
      try {
        await removeUploadedLeadVideo(uploadedVideoPath);
      } catch (error) {
        console.error("Could not remove an unsuccessful lead video upload.", error);
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
