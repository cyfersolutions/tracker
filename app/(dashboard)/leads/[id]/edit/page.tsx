import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { LeadForm } from "@/components/leads/LeadForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import Campaign from "@/models/Campaign";
import Role from "@/models/Role";
import User from "@/models/User";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("leads:edit");
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectToDatabase();
  const [lead, campaigns, clientRoles] = await Promise.all([
    Lead.findById(id).populate("assignedTo", "name email").lean(),
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
  if (!lead) notFound();
  const canManagePrice = user.isSuperAdmin || user.role.type === "client";
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

  const initial = JSON.parse(
    JSON.stringify({
      ...lead,
      leadType: lead.leadType || "Roofing",
      mcNumber: lead.mcNumber ?? "",
      truckType: lead.truckType ?? "",
      trucks: lead.trucks ?? 0,
      revenue: lead.revenue ?? 0,
      otr: lead.otr ?? "Yes",
      basePrice: canManagePrice ? lead.basePrice : 10,
      finalPrice: canManagePrice ? lead.finalPrice : 10,
      topUps: canManagePrice ? lead.topUps : [],
    }),
  );
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading"><div><p className="eyebrow">LEAD MANAGEMENT</p><h1>Edit lead</h1><p className="muted">Update contact and campaign details.</p></div><Link href={`/leads/${id}`} className="text-link">Cancel</Link></header>
      <LeadForm
        initial={initial}
        canManagePrice={canManagePrice}
        campaigns={formattedCampaigns}
        allClients={formattedClients}
      />
    </div>
  );
}
