import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Campaign from "@/models/Campaign";
import Lead from "@/models/Lead";
import User from "@/models/User";
import { campaignSchema } from "@/lib/validations/campaign.schema";
import Role from "@/models/Role";

export const PUT = withAuth("campaigns:edit", async (request, context, user) => {
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid campaign identifier." }, { status: 400 });
    const parsed = campaignSchema.safeParse(await request.json());
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const pathKey = issue.path.join(".");
        if (pathKey && !fieldErrors[pathKey]) {
          fieldErrors[pathKey] = issue.message;
        }
      }
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid campaign data.", fieldErrors, details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    await connectToDatabase();
    const clientRoles = await Role.find({ type: "client" }).select("_id").lean().exec();
    const clients = await User.find({ _id: { $in: parsed.data.clientIds }, role: { $in: clientRoles.map((role) => role._id) }, isActive: true }).select("_id").lean().exec();
    if (clients.length !== parsed.data.clientIds.length) {
      return NextResponse.json(
        { error: "Choose only active clients.", fieldErrors: { clientIds: "Choose only active clients." } },
        { status: 400 },
      );
    }
    const campaign = await Campaign.findByIdAndUpdate(id, parsed.data, { new: true, runValidators: true });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    await User.updateMany({ role: { $in: clientRoles.map((role) => role._id) } }, { $pull: { campaignIds: campaign._id } });
    await User.updateMany({ _id: { $in: parsed.data.clientIds } }, { $addToSet: { campaignIds: campaign._id } });
    return NextResponse.json(campaign);
  } catch (error) {
    return apiError(error);
  }
});

export const DELETE = withAuth("campaigns:delete", async (_request, context, user) => {
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid campaign identifier." }, { status: 400 });
    await connectToDatabase();
    const campaign = await Campaign.findByIdAndDelete(id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    await Promise.all([
      Lead.updateMany({ campaign: id }, { $set: { campaign: null } }),
      User.updateMany({ campaignIds: id }, { $pull: { campaignIds: id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
});
