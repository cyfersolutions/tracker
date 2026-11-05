import Link from "next/link";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import Role from "@/models/Role";
import User from "@/models/User";
import Campaign from "@/models/Campaign";
import { Types } from "mongoose";
import { ClientDashboardControls } from "@/components/dashboard/ClientCampaignNav";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const user = await requirePermission();
  const canViewLeads = user.isSuperAdmin || user.role.permissions.includes("leads:view");
  const canViewUsers = user.isSuperAdmin || user.role.permissions.includes("users:view");
  const canViewRoles = user.isSuperAdmin || user.role.permissions.includes("roles:view");
  await connectToDatabase();
  const assignedCampaignIds = user.role.type === "client" ? (user.campaignIds ?? []) : [];
  const query = await searchParams;
  const selectedCampaign = user.role.type === "client" && Types.ObjectId.isValid(query.campaign ?? "") && assignedCampaignIds.some((id: unknown) => String(id) === query.campaign)
    ? query.campaign
    : undefined;
  const leadCampaignIds = user.role.type === "client" ? (selectedCampaign ? [selectedCampaign] : assignedCampaignIds) : undefined;
  const leadFilter = user.role.type === "client" ? { campaign: { $in: leadCampaignIds } } : {};
  const campaigns = user.role.type === "client"
    ? await Campaign.find({ _id: { $in: assignedCampaignIds } }).select("name").sort({ name: 1 }).lean().exec()
    : [];
  const selectedCampaignName = selectedCampaign
    ? campaigns.find((campaign) => String(campaign._id) === selectedCampaign)?.name
    : undefined;
  const comparison = user.role.type === "client"
    ? await Lead.aggregate<{ _id: string; total: number; new: number }>([
        { $match: { campaign: { $in: assignedCampaignIds } } },
        { $group: { _id: "$campaign", total: { $sum: 1 }, new: { $sum: { $cond: [{ $eq: ["$status", "NEW"] }, 1, 0] } } } },
      ])
    : [];
  const comparisonByCampaign = new Map(comparison.map((row) => [String(row._id), row]));
  const [leadCount, newLeadCount, userCount, roleCount] = await Promise.all([
    canViewLeads ? Lead.countDocuments(leadFilter) : Promise.resolve(null),
    canViewLeads ? Lead.countDocuments({ ...leadFilter, status: "NEW" }) : Promise.resolve(null),
    canViewUsers ? User.countDocuments({ isActive: true }) : Promise.resolve(null),
    canViewRoles ? Role.countDocuments() : Promise.resolve(null),
  ]);

  return (
    <div className="page-wrap">
      <header className="page-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Good to see you, {user.name.split(" ")[0]}</h1>
          <p className="muted">{selectedCampaignName ? `Showing the ${selectedCampaignName} campaign.` : "Here is a snapshot of your lead workspace."}</p>
        </div>
        {user.role.type === "client" && <ClientDashboardControls />}
      </header>
      <section className={`stat-grid${user.role.type === "client" ? " client-stat-grid" : ""}`} aria-label="Workspace statistics">
        {user.role.type === "client" && <article className="stat-card"><span>Campaigns</span><strong>{campaigns.length}</strong><small>Assigned to you</small></article>}
        <article className="stat-card"><span>Total leads</span><strong>{leadCount ?? "—"}</strong><small>{canViewLeads ? "Across all statuses" : "No access to lead data"}</small></article>
        <article className="stat-card"><span>New leads</span><strong>{newLeadCount ?? "—"}</strong><small>{canViewLeads ? "Waiting for first contact" : "No access to lead data"}</small></article>
        {canViewUsers && <article className="stat-card"><span>Active users</span><strong>{userCount}</strong><small>With workspace access</small></article>}
        {canViewRoles && <article className="stat-card"><span>Roles</span><strong>{roleCount}</strong><small>Configured access groups</small></article>}
      </section>
      {user.role.type === "client" && <section className="campaign-overview">
        <div className="section-heading"><div><p className="eyebrow">CAMPAIGN COMPARISON</p><h2>Campaign performance</h2><p className="muted">Compare lead volume and new lead activity across every assigned campaign.</p></div></div>
        {campaigns.length ? <div className="table-scroll"><table className="campaign-comparison"><thead><tr><th>Campaign</th><th>Total leads</th><th>New leads</th><th>New lead rate</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
          {campaigns.map((campaign) => {
            const row = comparisonByCampaign.get(String(campaign._id));
            const isSelected = selectedCampaign === String(campaign._id);
            const total = row?.total ?? 0;
            const newLeads = row?.new ?? 0;
            return <tr className={isSelected ? "campaign-row-selected" : undefined} key={String(campaign._id)}>
              <td><strong>{campaign.name}</strong>{isSelected && <span className="table-subtext">Currently selected</span>}</td>
              <td><strong>{total}</strong></td>
              <td><strong>{newLeads}</strong></td>
              <td>{total ? `${Math.round((newLeads / total) * 100)}%` : "0%"}</td>
              <td><Link className="text-link" href={`/dashboard?campaign=${campaign._id}`}>{isSelected ? "Selected" : "Compare"}</Link></td>
            </tr>;
          })}
        </tbody></table></div> : <div className="empty-state"><h2>No campaigns assigned</h2><p>Your campaign comparison will appear here when campaigns are assigned to your account.</p></div>}
      </section>}
      {user.role.type !== "client" && <section className="welcome-panel">
        <div>
          <p className="eyebrow">GET STARTED</p>
          <h2>Your sales workspace is ready</h2>
          <p className="muted">Use the navigation to manage leads and access settings available to your role.</p>
        </div>
        {canViewLeads && <Link href={selectedCampaign ? `/leads?campaign=${selectedCampaign}` : "/leads"} className="text-link">Open lead management →</Link>}
      </section>}
    </div>
  );
}
