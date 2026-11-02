import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import { canManageLeadPrice, getLeadTotalPrice } from "@/lib/lead-pricing";
import { leadTopUpSchema } from "@/lib/validations/lead.schema";
import Lead from "@/models/Lead";

export const POST = withAuth("leads:edit", async (request, context, user) => {
  if (!canManageLeadPrice(user)) {
    return NextResponse.json(
      { error: "Only Super Admins and clients can add lead price top-ups." },
      { status: 403 },
    );
  }

  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lead identifier." }, { status: 400 });
    }
    const parsed = leadTopUpSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid top-up.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    await connectToDatabase();
    const topUp = {
      _id: new Types.ObjectId(),
      ...parsed.data,
      addedBy: user._id,
      addedAt: new Date(),
    };
    const existing = await Lead.findOne({
      _id: id,
      status: { $ne: "CLOSED" },
    }).select("basePrice finalPrice topUps");
    if (!existing) {
      const exists = await Lead.exists({ _id: id });
      if (!exists) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      return NextResponse.json(
        { error: "Closed leads cannot receive price top-ups." },
        { status: 409 },
      );
    }

    if (existing.finalPrice == null) {
      await Lead.updateOne(
        { _id: id, status: { $ne: "CLOSED" }, finalPrice: { $exists: false } },
        {
          $set: {
            finalPrice: getLeadTotalPrice({
              basePrice: existing.basePrice ?? 10,
              topUps: existing.topUps ?? [],
            }),
          },
        },
      );
    }

    const lead = await Lead.findOneAndUpdate(
      { _id: id, status: { $ne: "CLOSED" } },
      {
        $push: { topUps: topUp },
        $inc: { finalPrice: parsed.data.amount },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!lead) {
      const exists = await Lead.exists({ _id: id });
      if (!exists) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      return NextResponse.json(
        { error: "Closed leads cannot receive price top-ups." },
        { status: 409 },
      );
    }
    if (
      !lead.topUps.some(
        (savedTopUp: { _id: Types.ObjectId }) =>
          String(savedTopUp._id) === String(topUp._id),
      )
    ) {
      console.error(`Lead ${id} top-up update returned without the new top-up entry.`);
      return NextResponse.json(
        { error: "The price top-up was not saved. Please try again." },
        { status: 500 },
      );
    }
    const finalPrice =
      lead.finalPrice ??
      getLeadTotalPrice({ basePrice: lead.basePrice ?? 10, topUps: lead.topUps ?? [] });
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    return NextResponse.json({
      success: true,
      ...(canManageLeadPrice(user) ? { finalPrice } : {}),
    });
  } catch (error) {
    return apiError(error);
  }
});
