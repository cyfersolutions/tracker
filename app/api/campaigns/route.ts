import { NextResponse } from "next/server";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Campaign from "@/models/Campaign";
import { campaignSchema } from "@/lib/validations/campaign.schema";
import Role from "@/models/Role";
import User from "@/models/User";

export const GET = withAuth("campaigns:view", async () => {
  try {
    await connectToDatabase();
    return NextResponse.json({ campaigns: await Campaign.find().sort({ name: 1 }).lean().exec() });
  } catch (error) {
    return apiError(error);
  }
});

export const POST = withAuth("campaigns:create", async (request, _context, user) => {
  if (!user.isSuperAdmin) return NextResponse.json({ error: "Only the Super Admin can manage campaigns." }, { status: 403 });
  try {
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
    const campaign = await Campaign.create(parsed.data);
    await User.updateMany({ _id: { $in: parsed.data.clientIds } }, { $addToSet: { campaignIds: campaign._id } });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
});
