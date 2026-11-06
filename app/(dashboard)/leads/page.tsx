import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import Campaign from "@/models/Campaign";
import { leadQuerySchema } from "@/lib/validations/lead.schema";
import { LeadStatusFilter } from "@/components/leads/LeadStatusFilter";
import { LeadBoard, type BoardLead } from "@/components/leads/LeadBoard";
import { Icon } from "@/components/ui/Icon";
import { Types } from "mongoose";
import { normalizeLeadStatus } from "@/lib/permissions";
import {
  canManageLeadPrice,
  formatStatusLabel,
  formatUsd,
  getLeadTotalPrice,
} from "@/lib/lead-pricing";

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    campaign?: string;
    view?: string;
  }>;
}) {
  const user = await requirePermission("leads:view");
  const query = await searchParams;
  const parsed = leadQuerySchema.safeParse(query);
  const filters = parsed.success ? parsed.data : leadQuerySchema.parse({});
  await connectToDatabase();
  const filter: Record<string, unknown> = {};
  const assignedCampaignIds = user.role.type === "client" ? (user.campaignIds ?? []) : [];
  let selectedCampaign =
    user.role.type === "client" &&
    Types.ObjectId.isValid(query.campaign ?? "") &&
    assignedCampaignIds.some((id: unknown) => String(id) === query.campaign)
      ? query.campaign
      : undefined;

  // Instant server-side redirect if client has assigned campaigns but none in query string
  if (user.role.type === "client" && assignedCampaignIds.length > 0 && !selectedCampaign) {
    const firstActiveCampaign = await Campaign.findOne({
      _id: { $in: assignedCampaignIds },
      isActive: true,
    })
      .select("_id")
      .sort({ name: 1 })
      .lean();
    const defaultCampaignId = firstActiveCampaign?._id || assignedCampaignIds[0];
    if (defaultCampaignId) {
      const params = new URLSearchParams(query as Record<string, string>);
      params.set("campaign", String(defaultCampaignId));
      redirect(`/leads?${params.toString()}`);
    }
  }

  if (user.role.type === "client") {
    filter.campaign = { $in: selectedCampaign ? [selectedCampaign] : assignedCampaignIds };
  }
  if (filters.status) filter.status = filters.status;
  if (filters.search) {
    const term = new RegExp(escaped(filters.search), "i");
    filter.$or = [{ name: term }, { email: term }, { phone: term }];
  }

  const isBoardView = query.view === "board";
  const isClient = user.role.type === "client";
  const canCreate = user.isSuperAdmin || user.role.permissions.includes("leads:create");
  const canExport = user.isSuperAdmin || user.role.permissions.includes("leads:export");
  const canViewFinalPrice = canManageLeadPrice(user);
  const canMove = isClient || user.isSuperAdmin || user.role.permissions.includes("leads:edit");
  const canApprove = isClient || user.isSuperAdmin;
  const campaignQuery = selectedCampaign ? `?campaign=${selectedCampaign}` : "";

  function makeViewUrl(view: "list" | "board") {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (selectedCampaign) params.set("campaign", selectedCampaign);
    if (view === "board") params.set("view", "board");
    return `/leads${params.toString() ? `?${params.toString()}` : ""}`;
  }

  const makePageUrl = (page: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (selectedCampaign) params.set("campaign", selectedCampaign);
    if (isBoardView) params.set("view", "board");
    params.set("page", String(page));
    return `/leads?${params}`;
  };

  // When in board view, load leads up to 500
  let boardLeads: BoardLead[] = [];
  let leads: Array<Record<string, unknown>> = [];
  let total = 0;

  if (isBoardView) {
    const [docs, count] = await Promise.all([
      Lead.find(filter)
        .populate("assignedTo", "name")
        .populate("campaign", "name type")
        .sort({ updatedAt: -1, _id: -1 })
        .limit(500)
        .lean()
        .exec(),
      Lead.countDocuments(filter),
    ]);
    total = count;
    boardLeads = docs.map((lead) => ({
      id: String(lead._id),
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      location:
        lead.leadType === "Trucking"
          ? `State: ${lead.address?.state || "—"}${lead.mcNumber ? ` · MC: ${lead.mcNumber}` : ""}`
          : [lead.address?.city, lead.address?.country].filter(Boolean).join(", "),
      campaign: typeof lead.campaign === "object" && lead.campaign ? (lead.campaign as { name: string }).name : "",
      status: normalizeLeadStatus(lead.status),
      leadType: lead.leadType as "Roofing" | "Trucking",
      mcNumber: lead.mcNumber,
      truckType: lead.truckType,
      revenue: lead.revenue,
      assignedToName: typeof lead.assignedTo === "object" && lead.assignedTo ? (lead.assignedTo as { name: string }).name : undefined,
      lostReason: lead.lostReason || "",
      price: canViewFinalPrice
        ? lead.finalPrice ??
          getLeadTotalPrice({ basePrice: lead.basePrice ?? 50, topUps: lead.topUps ?? [] })
        : null,
      createdAt: lead.createdAt,
    }));
  } else {
    const [docs, count] = await Promise.all([
      Lead.find(filter)
        .populate("assignedTo", "name")
        .populate("campaign", "name type")
        .sort({ createdAt: -1, _id: -1 })
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit)
        .lean()
        .exec(),
      Lead.countDocuments(filter),
    ]);
    leads = docs as unknown as Array<Record<string, unknown>>;
    total = count;
  }

  const pages = Math.ceil(total / filters.limit);

  return (
    <div className={`page-wrap ${isBoardView ? "page-wrap-board" : ""}`}>
      <header className="page-heading">
        <div>
          <p className="eyebrow">PIPELINE MANAGEMENT</p>
          <h1>Leads</h1>
          <p className="muted">
            {total} lead{total === 1 ? "" : "s"}
            {selectedCampaign ? " in the selected campaign" : " in your workspace"}
          </p>
        </div>

        <div className="heading-actions">
          {/* Linear-Style Unified View Switcher */}
          <div className="view-switcher" role="tablist" aria-label="Pipeline view layout">
            <Link
              href={makeViewUrl("list")}
              className={`view-switcher-btn ${!isBoardView ? "is-active" : ""}`}
              role="tab"
              aria-selected={!isBoardView}
              title="List view"
            >
              <Icon name="list" size={14} />
              <span>List</span>
            </Link>
            <Link
              href={makeViewUrl("board")}
              className={`view-switcher-btn ${isBoardView ? "is-active" : ""}`}
              role="tab"
              aria-selected={isBoardView}
              title="Board view"
            >
              <Icon name="board" size={14} />
              <span>Board</span>
            </Link>
          </div>

          {canExport && (
            <a
              className="button button-secondary"
              href={`/api/leads/export?${new URLSearchParams({
                ...(filters.search ? { search: filters.search } : {}),
                ...(filters.status ? { status: filters.status } : {}),
                ...(selectedCampaign ? { campaign: selectedCampaign } : {}),
              })}`}
            >
              <Icon name="download" size={14} />
              <span>Export CSV</span>
            </a>
          )}

          {canCreate && (
            <Link className="button button-primary" href={`/leads/new${campaignQuery}`}>
              <Icon name="plus" size={14} />
              <span>Add lead</span>
            </Link>
          )}
        </div>
      </header>

      {/* Filter and Search Bar */}
      <form className="filter-bar" action="/leads">
        {isBoardView && <input type="hidden" name="view" value="board" />}
        {selectedCampaign && <input type="hidden" name="campaign" value={selectedCampaign} />}
        <label className="search-field">
          Search leads
          <input
            name="search"
            defaultValue={filters.search}
            placeholder="Search by name, email or phone..."
          />
        </label>
        {!isBoardView && (
          <label>
            Status
            <LeadStatusFilter value={filters.status ?? ""} />
          </label>
        )}
        <button className="button button-secondary" type="submit">
          <Icon name="filter" size={14} />
          <span>Filter</span>
        </button>
      </form>

      {/* Main Content: Board vs List */}
      {isBoardView ? (
        <LeadBoard
          initialLeads={boardLeads}
          canApprove={canApprove}
          canMove={canMove}
          campaignId={selectedCampaign}
        />
      ) : (
        <>
          <div className="table-card">
            {leads.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Campaign</th>
                      <th>Status</th>
                      {canViewFinalPrice && <th>Price</th>}
                      <th>Call Transferred To</th>
                      <th>Created</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => {
                      const id = String(lead._id);
                      const leadType = lead.leadType as string | undefined;
                      const address = lead.address as Record<string, string> | undefined;
                      const campaign = lead.campaign as { name: string } | undefined;
                      const assignedTo = lead.assignedTo as { name: string } | undefined;
                      const status = lead.status as string;

                      return (
                        <tr key={id}>
                          <td>
                            <Link
                              className="table-primary-link"
                              href={`/leads/${id}${campaignQuery}`}
                            >
                              {String(lead.name)}
                            </Link>
                            <span className="table-subtext">
                              {leadType === "Trucking"
                                ? `State: ${address?.state || "—"}${lead.mcNumber ? ` · MC: ${lead.mcNumber}` : ""}`
                                : [address?.city, address?.country].filter(Boolean).join(", ")}
                            </span>
                          </td>
                          <td>
                            {String(lead.email || "—")}
                            <span className="table-subtext">{String(lead.phone)}</span>
                          </td>
                          <td>
                            {campaign ? campaign.name : "None"}
                            {leadType === "Trucking" && (
                              <span
                                className="status-badge"
                                style={{ marginLeft: "6px", textTransform: "none" }}
                              >
                                Trucking
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge status-${status}`}>
                              {formatStatusLabel(status as BoardLead["status"])}
                            </span>
                          </td>
                          {canViewFinalPrice && (
                            <td>
                              <strong>
                                {formatUsd(
                                  (lead.finalPrice as number | undefined) ??
                                    getLeadTotalPrice({
                                      basePrice: (lead.basePrice as number | undefined) ?? 50,
                                      topUps: (lead.topUps as Array<{ amount: number }> | undefined) ?? [],
                                    }),
                                )}
                              </strong>
                            </td>
                          )}
                          <td>{assignedTo ? assignedTo.name : "—"}</td>
                          <td>{new Date(lead.createdAt as string).toLocaleDateString()}</td>
                          <td>
                            <Link className="text-link" href={`/leads/${id}${campaignQuery}`}>
                              View
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
                <h2>No leads found</h2>
                <p>Change your search filters or add a new lead.</p>
              </div>
            )}
          </div>

          {pages > 1 && (
            <nav className="pagination" aria-label="Lead pages">
              {filters.page > 1 && (
                <Link className="button button-secondary" href={makePageUrl(filters.page - 1)}>
                  Previous
                </Link>
              )}
              <span>
                Page {filters.page} of {pages}
              </span>
              {filters.page < pages && (
                <Link className="button button-secondary" href={makePageUrl(filters.page + 1)}>
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
