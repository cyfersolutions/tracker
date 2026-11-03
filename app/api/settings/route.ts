import { NextResponse } from "next/server";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import Settings from "@/models/Settings";
import { settingsSchema } from "@/lib/validations/settings.schema";

export const GET = withAuth(null, async (_request, _context, user) => {
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await connectToDatabase();
    const settings = await Settings.findOne({ key: "global" }).select("defaultLeadPrice").lean();
    return NextResponse.json({
      defaultLeadPrice: settings?.defaultLeadPrice ?? 50,
    });
  } catch (error) {
    return apiError(error);
  }
});

export const PUT = withAuth(null, async (request, _context, user) => {
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid settings data.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    await connectToDatabase();
    const settings = await Settings.findOneAndUpdate(
      { key: "global" },
      { $set: { defaultLeadPrice: parsed.data.defaultLeadPrice, updatedBy: user._id } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, runValidators: true },
    ).lean();
    const { defaultLeadPrice } = parsed.data;
    const updatedLeads = await Lead.updateMany(
      { status: { $ne: "CLOSED" } },
      [
        {
          $set: {
            basePrice: { $literal: defaultLeadPrice },
            finalPrice: {
              $add: [
                { $literal: defaultLeadPrice },
                { $sum: { $ifNull: ["$topUps.amount", []] } },
              ],
            },
          },
        },
      ],
    );
    return NextResponse.json({
      defaultLeadPrice: settings.defaultLeadPrice,
      updatedLeads: updatedLeads.modifiedCount,
    });
  } catch (error) {
    return apiError(error);
  }
});
