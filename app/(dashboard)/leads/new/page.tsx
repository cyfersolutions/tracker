import Link from "next/link";
import { LeadForm } from "@/components/leads/LeadForm";
import { requirePermission } from "@/lib/server/permissions";
import { getDefaultLeadPrice } from "@/lib/settings";
import { connectToDatabase } from "@/lib/db/connect";
import Campaign from "@/models/Campaign";
import Role from "@/models/Role";
import User from "@/models/User";

export default async function NewLeadPage() {
  const user = await requirePermission("leads:create");
  const canManagePrice = user.isSuperAdmin || user.role.type === "client";
  const defaultLeadPrice = await getDefaultLeadPrice();
  await connectToDatabase();
  const [campaigns, clientRoles] = await Promise.all([
    Campaign.find({ isActive: true })
      .populate({
        path: "clientIds",
        match: { isActive: true },
        select: "_id name email",
      })
      .select("_id name type clientIds")
      .sort({ name: 1 })
      .lean()
      .exec(),
    Role.find({ type: "client" }).select("_id").lean().exec(),
  ]);
  const allClients = await User.find({
    isActive: true,
    role: { $in: clientRoles.map((r) => r._id) },
  })
    .select("_id name email")
    .sort({ name: 1 })
    .lean()
    .exec();

  const formattedCampaigns = campaigns.map((campaign) => ({
    _id: String(campaign._id),
    name: campaign.name,
    type: (campaign.type as "Roofing" | "Trucking") || "Roofing",
    clients: (
      (campaign.clientIds ?? []) as unknown as Array<{ _id: unknown; name: string; email: string }>
    )
      .filter(Boolean)
      .map((c) => ({
        _id: String(c._id),
        name: c.name,
        email: c.email,
      })),
  }));

  const formattedClients = allClients.map((client) => ({
    _id: String(client._id),
    name: client.name,
    email: client.email,
  }));

  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading"><div><p className="eyebrow">LEAD MANAGEMENT</p><h1>Add a lead</h1><p className="muted">Capture contact and campaign details.</p></div><Link href="/leads" className="text-link">Back to leads</Link></header>
      <LeadForm
        canManagePrice={canManagePrice}
        defaultLeadPrice={defaultLeadPrice}
        campaigns={formattedCampaigns}
        allClients={formattedClients}
      />
    </div>
  );
}
