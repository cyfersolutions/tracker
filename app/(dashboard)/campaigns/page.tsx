import Link from "next/link";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Campaign from "@/models/Campaign";
import Lead from "@/models/Lead";
import { DeleteCampaignButton } from "@/components/campaigns/DeleteCampaignButton";

export default async function CampaignsPage() {
  const user = await requirePermission("campaigns:view");
  await connectToDatabase();
  const campaigns = await Campaign.find().sort({ name: 1 }).lean().exec();
  const counts = await Lead.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$campaign", count: { $sum: 1 } } }]);
  const countByCampaign = new Map(counts.map((row) => [String(row._id), row.count]));
  return <div className="page-wrap">
    <header className="page-heading"><div><p className="eyebrow">LEAD MANAGEMENT</p><h1>Campaigns</h1><p className="muted">Organize leads and control which campaigns each client can access.</p></div>{user.isSuperAdmin && <Link href="/campaigns/new" className="button button-primary">Add campaign</Link>}</header>
    <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Campaign</th><th>Type</th><th>Description</th><th>Dates</th><th>Leads</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
      {campaigns.map((campaign) => <tr key={String(campaign._id)}><td><strong>{campaign.name}</strong></td><td><span className="status-badge" style={{ textTransform: "none" }}>{campaign.type || "Roofing"}</span></td><td>{campaign.description || "—"}</td><td>{campaign.startDate?.toLocaleDateString()} – {campaign.endDate?.toLocaleDateString()}</td><td>{countByCampaign.get(String(campaign._id)) ?? 0}</td><td><span className={`status-badge ${campaign.isActive ? "status-converted" : "status-lost"}`}>{campaign.isActive ? "Active" : "Inactive"}</span></td><td><div className="row-actions">{user.isSuperAdmin && <Link className="text-link" href={`/campaigns/${campaign._id}/edit`}>Edit</Link>}{user.isSuperAdmin && <DeleteCampaignButton id={String(campaign._id)} />}</div></td></tr>)}
    </tbody></table></div>{campaigns.length === 0 && <div className="empty-state"><h2>No campaigns yet</h2><p>Create a campaign before assigning it to leads or clients.</p></div>}</div>
  </div>;
}
