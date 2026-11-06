import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import Role from "@/models/Role";
import User from "@/models/User";
import Campaign from "@/models/Campaign";
import { Types } from "mongoose";
import { ClientDashboardControls } from "@/components/dashboard/ClientCampaignNav";
import { DashboardCampaignSelector } from "@/components/dashboard/DashboardCampaignSelector";
import { Icon } from "@/components/ui/Icon";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const user = await requirePermission();
  const canViewLeads = user.isSuperAdmin || user.role.permissions.includes("leads:view");
  const canViewUsers = user.isSuperAdmin || user.role.permissions.includes("users:view");
  const canViewRoles = user.isSuperAdmin || user.role.permissions.includes("roles:view");
  const isClient = user.role.type === "client";

  await connectToDatabase();
  const query = await searchParams;
  const assignedCampaignIds = isClient ? (user.campaignIds ?? []) : [];

  // Determine campaign selection for clients and admins
  let selectedCampaign = isClient
    ? Types.ObjectId.isValid(query.campaign ?? "") &&
      assignedCampaignIds.some((id: unknown) => String(id) === query.campaign)
      ? query.campaign
      : undefined
    : Types.ObjectId.isValid(query.campaign ?? "")
      ? query.campaign
      : undefined;

  // For client users, immediately redirect to their primary campaign if none is specified in the URL
  if (isClient && assignedCampaignIds.length > 0 && !selectedCampaign) {
    const firstActiveCampaign = await Campaign.findOne({
      _id: { $in: assignedCampaignIds },
      isActive: true,
    })
      .select("_id")
      .sort({ name: 1 })
      .lean();
    const defaultCampaignId = firstActiveCampaign?._id || assignedCampaignIds[0];
    if (defaultCampaignId) {
      redirect(`/dashboard?campaign=${defaultCampaignId}`);
    }
  }

  // Construct query filter
  const leadFilter: Record<string, unknown> = {};
  if (isClient) {
    leadFilter.campaign = { $in: selectedCampaign ? [selectedCampaign] : assignedCampaignIds };
  } else if (selectedCampaign) {
    leadFilter.campaign = selectedCampaign;
  }

  // Fetch campaigns list
  const campaigns = isClient
    ? await Campaign.find({ _id: { $in: assignedCampaignIds } })
        .select("name")
        .sort({ name: 1 })
        .lean()
        .exec()
    : await Campaign.find({ isActive: true })
        .select("name")
        .sort({ name: 1 })
        .lean()
        .exec();

  const selectedCampaignName = selectedCampaign
    ? campaigns.find((campaign) => String(campaign._id) === selectedCampaign)?.name
    : undefined;

  // Fetch stats and comparison
  const comparison = isClient
    ? await Lead.aggregate<{ _id: string; total: number; new: number }>([
        { $match: { campaign: { $in: assignedCampaignIds } } },
        {
          $group: {
            _id: "$campaign",
            total: { $sum: 1 },
            new: { $sum: { $cond: [{ $eq: ["$status", "WARM"] }, 1, 0] } },
          },
        },
      ])
    : [];
  const comparisonByCampaign = new Map(comparison.map((row) => [String(row._id), row]));

  const [leadCount, newLeadCount, userCount, roleCount] = await Promise.all([
    canViewLeads ? Lead.countDocuments(leadFilter) : Promise.resolve(null),
    canViewLeads ? Lead.countDocuments({ ...leadFilter, status: "WARM" }) : Promise.resolve(null),
    canViewUsers ? User.countDocuments({ isActive: true }) : Promise.resolve(null),
    canViewRoles ? Role.countDocuments() : Promise.resolve(null),
  ]);

  const campaignQuery = selectedCampaign ? `?campaign=${selectedCampaign}` : "";

  return (
    <div className="page-wrap">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{isClient ? "CLIENT DASHBOARD" : "OVERVIEW"}</p>
          <h1>Good to see you, {user.name.split(" ")[0]}</h1>
          <p className="muted">
            {selectedCampaignName
              ? `Showing the ${selectedCampaignName} campaign overview.`
              : isClient
                ? "Here is a snapshot of your lead workspace."
                : "Here is a snapshot of your sales and lead workspace."}
          </p>
        </div>

        <div className="heading-actions">
          {isClient ? (
            <ClientDashboardControls />
          ) : (
            campaigns.length > 0 && (
              <DashboardCampaignSelector
                campaigns={campaigns.map((c) => ({ id: String(c._id), name: c.name }))}
                selectedId={selectedCampaign ?? ""}
              />
            )
          )}

          {canViewLeads && (
            <Link className="button button-secondary" href={`/leads${campaignQuery}`}>
              <Icon name="leads" size={14} />
              <span>Leads</span>
            </Link>
          )}

          {(user.isSuperAdmin || user.role.permissions.includes("leads:create")) && (
            <Link className="button button-primary" href={`/leads/new${campaignQuery}`}>
              <Icon name="plus" size={14} />
              <span>Add lead</span>
            </Link>
          )}
        </div>
      </header>

      {/* Workspace Statistics */}
      <section
        className={`stat-grid${isClient ? " client-stat-grid" : ""}`}
        aria-label="Workspace statistics"
      >
        {isClient && (
          <article className="stat-card">
            <span>Campaigns</span>
            <strong>{campaigns.length}</strong>
            <small>Assigned to you</small>
          </article>
        )}
        <article className="stat-card">
          <span>Total leads</span>
          <strong>{leadCount ?? "—"}</strong>
          <small>{canViewLeads ? "Across this view" : "No access to lead data"}</small>
        </article>
        <article className="stat-card">
          <span>Warm leads</span>
          <strong>{newLeadCount ?? "—"}</strong>
          <small>{canViewLeads ? "Waiting for a decision" : "No access to lead data"}</small>
        </article>
        {canViewUsers && (
          <article className="stat-card">
            <span>Active users</span>
            <strong>{userCount}</strong>
            <small>With workspace access</small>
          </article>
        )}
        {canViewRoles && (
          <article className="stat-card">
            <span>Roles</span>
            <strong>{roleCount}</strong>
            <small>Configured access groups</small>
          </article>
        )}
      </section>

      {/* Client Campaign Performance Comparison */}
      {isClient && (
        <section className="campaign-overview">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CAMPAIGN COMPARISON</p>
              <h2>Campaign performance</h2>
              <p className="muted">
                Compare lead volume and new lead activity across every assigned campaign.
              </p>
            </div>
          </div>
          {campaigns.length ? (
            <div className="table-scroll">
              <table className="campaign-comparison">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Total leads</th>
                    <th>Warm leads</th>
                    <th>Warm lead rate</th>
                    <th>
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => {
                    const row = comparisonByCampaign.get(String(campaign._id));
                    const isSelected = selectedCampaign === String(campaign._id);
                    const total = row?.total ?? 0;
                    const newLeads = row?.new ?? 0;
                    return (
                      <tr
                        className={isSelected ? "campaign-row-selected" : undefined}
                        key={String(campaign._id)}
                      >
                        <td>
                          <strong>{campaign.name}</strong>
                          {isSelected && (
                            <span className="table-subtext">Currently selected</span>
                          )}
                        </td>
                        <td>
                          <strong>{total}</strong>
                        </td>
                        <td>
                          <strong>{newLeads}</strong>
                        </td>
                        <td>{total ? `${Math.round((newLeads / total) * 100)}%` : "0%"}</td>
                        <td>
                          <Link
                            className="text-link"
                            href={`/dashboard?campaign=${campaign._id}`}
                          >
                            {isSelected ? "Selected" : "Compare"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <h2>No campaigns assigned</h2>
              <p>
                Your campaign comparison will appear here when campaigns are assigned to your
                account.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Admin Quick Pipeline Access */}
      {!isClient && canViewLeads && (
        <section className="welcome-panel">
          <div>
            <p className="eyebrow">PIPELINE SHORTCUT</p>
            <h2>Manage leads and pipeline workflow</h2>
            <p className="muted">
              Use the dedicated board to drag and drop leads through stages or browse the full table.
            </p>
          </div>
          <div>
            <Link
              href={`/leads${campaignQuery}`}
              className="button button-primary"
            >
              <Icon name="leads" size={14} />
              <span>Open Leads Pipeline →</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
