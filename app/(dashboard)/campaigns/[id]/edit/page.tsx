import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Campaign from "@/models/Campaign";
import Role from "@/models/Role";
import User from "@/models/User";

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("campaigns:edit");
  if (!user.isSuperAdmin) return null;
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectToDatabase();
  const campaign = await Campaign.findById(id).lean();
  if (!campaign) notFound();
  const clientRoles = await Role.find({ type: "client" }).select("_id").lean().exec();
  const clients = await User.find({ role: { $in: clientRoles.map((role) => role._id) }, isActive: true }).select("name email").sort({ name: 1 }).lean().exec();
  return <div className="page-wrap narrow-page"><header className="page-heading"><div><p className="eyebrow">LEAD MANAGEMENT</p><h1>Edit campaign</h1></div><Link className="text-link" href="/campaigns">Cancel</Link></header><CampaignForm clients={clients.map((client) => ({ _id: String(client._id), name: client.name, email: client.email }))} initial={{ _id: String(campaign._id), name: campaign.name, description: campaign.description, isActive: campaign.isActive, startDate: campaign.startDate ? campaign.startDate.toISOString().slice(0, 10) : "", endDate: campaign.endDate ? campaign.endDate.toISOString().slice(0, 10) : "", clientIds: (campaign.clientIds ?? []).map(String) }} /></div>;
}
