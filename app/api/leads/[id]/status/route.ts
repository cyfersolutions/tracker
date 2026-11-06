import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import {
  canManageLeadPrice,
  getLeadTotalPrice,
  isApprovableStatus,
  requiresApproval,
} from "@/lib/lead-pricing";
import { leadMoveSchema } from "@/lib/validations/lead.schema";
import Lead from "@/models/Lead";

export const PATCH = withAuth("leads:view", async (request, context, user) => {
  try {
    const isClient = user.role.type === "client";
    if (!isClient && !user.isSuperAdmin && !user.role.permissions.includes("leads:edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lead identifier." }, { status: 400 });
    }
    const parsed = leadMoveSchema.safeParse(await request.json());
    if (!parsed.success) {
      const reasonError = parsed.error.issues.find((issue) => issue.path[0] === "reason");
      return NextResponse.json(
        { error: reasonError?.message ?? "Invalid status." },
        { status: 400 },
      );
    }
    const target = parsed.data.status;
    await connectToDatabase();

    const accessFilter = isClient
      ? { _id: id, campaign: { $in: user.campaignIds ?? [] } }
      : { _id: id };
    const existing = await Lead.findOne(accessFilter).select(
      "status basePrice finalPrice topUps lostReason",
    );
    if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

    if (existing.status === target && (!parsed.data.reason || existing.lostReason === parsed.data.reason)) {
      return NextResponse.json({ success: true, status: target, approved: false });
    }
    if (existing.status === "WON") {
      return NextResponse.json(
        { error: "Won leads cannot be moved." },
        { status: 409 },
      );
    }

    const set: Record<string, unknown> = {
      status: target,
      lostReason:
        target === "LOST" || target === "FOLLOWUP"
          ? (parsed.data.reason?.trim() || existing.lostReason || "")
          : "",
    };
    const update: Record<string, unknown> = { $set: set };
    let approved = false;
    let finalPrice: number | undefined;

    if (target === "INSPECTION_AWAITING" && !isApprovableStatus(existing.status)) {
      return NextResponse.json(
        { error: "Only Warm leads can be accepted for inspection." },
        { status: 409 },
      );
    }
    if (requiresApproval(existing.status, target)) {
      if (!canManageLeadPrice(user)) {
        return NextResponse.json(
          { error: "Only clients and Super Admins can approve moving a Warm lead forward." },
          { status: 403 },
        );
      }
      approved = true;
    }
    if (existing.status === "CONTRACT_SIGNING" && target === "WON") {
      if (!canManageLeadPrice(user)) {
        return NextResponse.json(
          { error: "Only clients and Super Admins can mark a lead as won." },
          { status: 403 },
        );
      }
      const amount = parsed.data.topUpAmount;
      if (amount === undefined) {
        return NextResponse.json(
          { error: "Enter the top-up amount to mark this lead as won." },
          { status: 400 },
        );
      }
      const current =
        existing.finalPrice ??
        getLeadTotalPrice({ basePrice: existing.basePrice ?? 50, topUps: existing.topUps ?? [] });
      finalPrice = Math.round((current + amount + Number.EPSILON) * 100) / 100;
      set.finalPrice = finalPrice;
      update.$push = {
        topUps: {
          _id: new Types.ObjectId(),
          description: "Top-up when moved from Contract Signing to Won",
          amount,
          addedBy: user._id,
          addedAt: new Date(),
          source: "WON_TOPUP",
        },
      };
    }
    if (target === "WON") set.closedAt = new Date();

    const lead = await Lead.findOneAndUpdate(
      {
        _id: id,
        status: existing.status,
        finalPrice: existing.finalPrice ?? null,
      },
      update,
      { returnDocument: "after", runValidators: true },
    );
    if (!lead) {
      return NextResponse.json(
        { error: "This lead changed while you were moving it. Reload and try again." },
        { status: 409 },
      );
    }
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    revalidatePath("/leads/board");
    return NextResponse.json({
      success: true,
      status: lead.status,
      approved,
      ...(canManageLeadPrice(user) && finalPrice !== undefined ? { finalPrice } : {}),
    });
  } catch (error) {
    return apiError(error);
  }
});
