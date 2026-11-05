import Link from "next/link";
import { LeadForm } from "@/components/leads/LeadForm";
import { requirePermission } from "@/lib/server/permissions";
import { getDefaultLeadPrice } from "@/lib/settings";
import { connectToDatabase } from "@/lib/db/connect";
import Campaign from "@/models/Campaign";

export default async function NewLeadPage() {
  const user = await requirePermission("leads:create");
  const canManagePrice = user.isSuperAdmin || user.role.type === "client";
  const defaultLeadPrice = await getDefaultLeadPrice();
  await connectToDatabase();
  const campaigns = await Campaign.find({ isActive: true }).select("_id name").sort({ name: 1 }).lean().exec();
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading"><div><p className="eyebrow">LEAD MANAGEMENT</p><h1>Add a lead</h1><p className="muted">Capture contact and property details.</p></div><Link href="/leads" className="text-link">Back to leads</Link></header>
      <LeadForm
        canManagePrice={canManagePrice}
        defaultLeadPrice={defaultLeadPrice}
        campaigns={campaigns.map((campaign) => ({ _id: String(campaign._id), name: campaign.name }))}
      />
    </div>
  );
}
