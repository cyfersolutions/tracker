import Link from "next/link";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import User from "@/models/User";

export default async function NewCampaignPage() {
  const user = await requirePermission("campaigns:create");
  if (!user.isSuperAdmin) return null;
  await connectToDatabase();
  const clientRoles = await Role.find({ type: "client" }).select("_id").lean().exec();
  const clients = await User.find({ role: { $in: clientRoles.map((role) => role._id) }, isActive: true }).select("name email").sort({ name: 1 }).lean().exec();
  return <div className="page-wrap narrow-page"><header className="page-heading"><div><p className="eyebrow">LEAD MANAGEMENT</p><h1>Add campaign</h1></div><Link className="text-link" href="/campaigns">Back to campaigns</Link></header><CampaignForm clients={clients.map((client) => ({ _id: String(client._id), name: client.name, email: client.email }))} /></div>;
}
