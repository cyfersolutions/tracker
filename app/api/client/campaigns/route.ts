import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Campaign from "@/models/Campaign";

export const GET = withAuth("leads:view", async (_request, _context, user) => {
  await connectToDatabase();
  const campaigns = user.role.type === "client"
    ? await Campaign.find({ _id: { $in: user.campaignIds ?? [] } }).select("name").sort({ name: 1 }).lean().exec()
    : [];
  return NextResponse.json({ campaigns: campaigns.map((campaign) => ({ id: String(campaign._id), name: campaign.name })) });
});
