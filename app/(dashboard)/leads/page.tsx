import Link from "next/link";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import { leadQuerySchema } from "@/lib/validations/lead.schema";
import { LeadStatusFilter } from "@/components/leads/LeadStatusFilter";
import { Types } from "mongoose";
import {
  canManageLeadPrice,
  formatUsd,
  getLeadTotalPrice,
} from "@/lib/lead-pricing";

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; campaign?: string }>;
}) {
  const user = await requirePermission("leads:view");
  const query = await searchParams;
  const parsed = leadQuerySchema.safeParse(query);
  const filters = parsed.success ? parsed.data : leadQuerySchema.parse({});
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  const assignedCampaignIds = user.role.type === "client" ? (user.campaignIds ?? []) : [];
  const selectedCampaign = user.role.type === "client" && Types.ObjectId.isValid(query.campaign ?? "") && assignedCampaignIds.some((id: unknown) => String(id) === query.campaign)
    ? query.campaign
    : undefined;
  if (user.role.type === "client") filter.campaign = { $in: selectedCampaign ? [selectedCampaign] : assignedCampaignIds };
  if (filters.status) filter.status = filters.status;
  if (filters.search) {
    const term = new RegExp(escaped(filters.search), "i");
    filter.$or = [{ name: term }, { email: term }, { phone: term }];
  }
  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .populate("assignedTo", "name")
      .populate("campaign", "name")
      .sort({ createdAt: -1, _id: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .lean()
      .exec(),
    Lead.countDocuments(filter),
  ]);
  const pages = Math.ceil(total / filters.limit);
  const canCreate = user.isSuperAdmin || user.role.permissions.includes("leads:create");
  const canExport = user.isSuperAdmin || user.role.permissions.includes("leads:export");
  const canViewFinalPrice = canManageLeadPrice(user);
  const makePageUrl = (page: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (selectedCampaign) params.set("campaign", selectedCampaign);
    params.set("page", String(page));
    return `/leads?${params}`;
  };

  return (
    <div className="page-wrap">
      <header className="page-heading">
        <div><p className="eyebrow">PIPELINE</p><h1>Leads</h1><p className="muted">{total} lead{total === 1 ? "" : "s"}{selectedCampaign ? " in the selected campaign" : " in your workspace"}</p></div>
        <div className="heading-actions">
          {canExport && <a className="button button-secondary" href={`/api/leads/export?${new URLSearchParams({ ...(filters.search ? { search: filters.search } : {}), ...(filters.status ? { status: filters.status } : {}), ...(selectedCampaign ? { campaign: selectedCampaign } : {}) })}`}>Export CSV</a>}
          {canCreate && <Link className="button button-primary" href="/leads/new">Add lead</Link>}
        </div>
      </header>
      <form className="filter-bar" action="/leads">
        <label className="search-field">Search leads<input name="search" defaultValue={filters.search} placeholder="Name, email or phone" /></label>
        <label>Status
          <LeadStatusFilter value={filters.status ?? ""} />
        </label>
        <button className="button button-secondary">Filter</button>
      </form>
      <div className="table-card">
        {leads.length ? (
          <div className="table-scroll"><table>
            <thead><tr><th>Name</th><th>Contact</th><th>Campaign</th><th>Status</th>{canViewFinalPrice && <th>Price</th>}<th>Call Transfered To</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{leads.map((lead) => (
              <tr key={String(lead._id)}>
                <td><Link className="table-primary-link" href={`/leads/${lead._id}`}>{lead.name}</Link><span className="table-subtext">{lead.address.city}, {lead.address.country}</span></td>
                <td>{lead.email}<span className="table-subtext">{lead.phone}</span></td>
                <td>{typeof lead.campaign === "object" && lead.campaign ? lead.campaign.name : "None"}</td>
                <td><span className={`status-badge status-${lead.status}`}>{lead.status}</span></td>
                {canViewFinalPrice && (
                  <td>
                    <strong>
                      {formatUsd(
                        lead.finalPrice ??
                          getLeadTotalPrice({ basePrice: lead.basePrice ?? 50, topUps: lead.topUps ?? [] }),
                      )}
                    </strong>
                  </td>
                )}
                <td>{typeof lead.assignedTo === "object" && lead.assignedTo ? lead.assignedTo.name : "—"}</td>
                <td>{new Date(lead.createdAt).toLocaleDateString()}</td>
                <td><Link className="text-link" href={`/leads/${lead._id}`}>View</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty-state"><h2>No leads found</h2><p>Change your filters or add a new lead.</p></div>}
      </div>
      {pages > 1 && <nav className="pagination" aria-label="Lead pages">
        {filters.page > 1 && <Link className="button button-secondary" href={makePageUrl(filters.page - 1)}>Previous</Link>}
        <span>Page {filters.page} of {pages}</span>
        {filters.page < pages && <Link className="button button-secondary" href={makePageUrl(filters.page + 1)}>Next</Link>}
      </nav>}
    </div>
  );
}
