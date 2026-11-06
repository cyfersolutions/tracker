import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { DeleteLeadButton } from "@/components/leads/DeleteLeadButton";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import { LeadTopUpForm } from "@/components/leads/LeadTopUpForm";
import {
  canManageLeadPrice,
  formatStatusLabel,
  formatUsd,
  getLeadTotalPrice,
} from "@/lib/lead-pricing";
import User from "@/models/User";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("leads:view");
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectToDatabase();
  const lead = await Lead.findById(id)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name")
    .populate("campaign", "name type")
    .lean();
  if (!lead) notFound();
  const leadCampaignId = typeof lead.campaign === "object" && lead.campaign ? String((lead.campaign as { _id?: unknown })._id) : String(lead.campaign ?? "");
  if (user.role.type === "client" && (!leadCampaignId || !(user.campaignIds ?? []).some((campaignId: unknown) => String(campaignId) === leadCampaignId))) notFound();
  const creatorIds = [
    ...new Set(
      ((lead.topUps ?? []) as Array<{ addedBy: Types.ObjectId | null }>).map(
        (topUp) => String(topUp.addedBy),
      ),
    ),
  ];
  const creators = creatorIds.length
    ? await User.find({ _id: { $in: creatorIds } }).select("name").lean().exec()
    : [];
  const creatorNames = new Map(creators.map((creator) => [String(creator._id), creator.name]));
  const campaignQuery = user.role.type === "client" && lead.campaign ? `?campaign=${String(lead.campaign)}` : "";
  const canEdit = user.isSuperAdmin || user.role.permissions.includes("leads:edit");
  const canDelete = user.isSuperAdmin || user.role.permissions.includes("leads:delete");
  const canViewFinalPrice = canManageLeadPrice(user);
  const canAddTopUp =
    canViewFinalPrice &&
    (user.isSuperAdmin ||
      user.role.permissions.includes("leads:edit") ||
      user.role.permissions.includes("leads:topup")) &&
    lead.status !== "WON";
  const totalPrice =
    lead.finalPrice ??
    getLeadTotalPrice({ basePrice: lead.basePrice ?? 50, topUps: lead.topUps ?? [] });

  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading">
        <div><p className="eyebrow">LEAD DETAILS</p><h1>{lead.name}</h1><p className="muted">{lead.email} · {lead.phone}</p></div>
        <div className="heading-actions">
          {canEdit && <Link className="button button-secondary" href={`/leads/${id}/edit${campaignQuery}`}>Edit lead</Link>}
          {canDelete && <DeleteLeadButton id={id} />}
          <Link className="text-link" href={`/leads${campaignQuery}`}>Back</Link>
        </div>
      </header>
      <section className="detail-card">
        <h2>Lead information</h2>
        <dl className="detail-grid">
          <div><dt>Status</dt><dd><span className={`status-badge status-${lead.status}`}>{formatStatusLabel(lead.status)}</span></dd></div>
          <div><dt>Campaign</dt><dd>{typeof lead.campaign === "object" && lead.campaign ? `${lead.campaign.name} (${(lead.campaign as { type?: string }).type || "Roofing"})` : "None"}</dd></div>
          <div><dt>Lead Type</dt><dd><span className="status-badge" style={{ textTransform: "none" }}>{lead.leadType || "Roofing"}</span></dd></div>
          {lead.status === "LOST" && <div className="span-two"><dt>Lost reason</dt><dd>{lead.lostReason || "No reason recorded"}</dd></div>}
          {canViewFinalPrice && <div><dt>Final price</dt><dd className="price-total">{formatUsd(totalPrice)}</dd></div>}
          {canViewFinalPrice && <div><dt>Starting price</dt><dd>{formatUsd(lead.basePrice ?? 50)}</dd></div>}
          {lead.leadType === "Trucking" ? (
            <>
              <div><dt>MC Number</dt><dd><strong style={{ color: "var(--primary)", fontSize: "15px" }}>{lead.mcNumber || "—"}</strong></dd></div>
              <div><dt>State</dt><dd>{lead.address?.state || "—"}</dd></div>
              <div><dt>OTR (Over The Road)</dt><dd>{lead.otr || "Yes"}</dd></div>
              <div><dt>Truck Type</dt><dd>{lead.truckType || "—"}</dd></div>
              <div><dt>Trucks</dt><dd>{lead.trucks ?? "—"}</dd></div>
              <div><dt>Revenue</dt><dd>{lead.revenue ? formatUsd(lead.revenue) : "—"}</dd></div>
            </>
          ) : (
            <>
              <div><dt>Roof size</dt><dd>{lead.roofSize.toLocaleString()} sq ft</dd></div>
              <div><dt>Street</dt><dd>{lead.address.street}</dd></div>
              <div><dt>City</dt><dd>{lead.address.city}</dd></div>
              <div><dt>State</dt><dd>{lead.address.state}</dd></div>
              <div><dt>Country</dt><dd>{lead.address.country}</dd></div>
              <div><dt>Postal code</dt><dd>{lead.address.postalCode}</dd></div>
            </>
          )}
          {lead.leadType === "Trucking" ? (
            <div className="span-two">
              <dt>Documents ({lead.documents?.length ?? 0})</dt>
              <dd>
                {lead.documents && lead.documents.length > 0 ? (
                  <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "grid", gap: "8px" }}>
                    {lead.documents.map((doc: { _id?: unknown; name: string; url: string; size?: number }, idx: number) => (
                      <li key={String(doc._id || idx)} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>📄</span>
                        <a className="text-link" href={doc.url} target="_blank" rel="noopener noreferrer">
                          {doc.name || `Document ${idx + 1}`}
                        </a>
                        {doc.size ? <span className="muted" style={{ fontSize: "11px" }}>({Math.round(doc.size / 1024)} KB)</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted">No documents uploaded</span>
                )}
              </dd>
            </div>
          ) : (
            <div className="span-two">
              <dt>Voice recording (Audio)</dt>
              <dd style={{ display: "grid", gap: "8px", marginTop: "4px" }}>
                {lead.videoUrl ? (
                  <>
                    <audio controls preload="metadata" style={{ width: "100%", maxWidth: "480px" }}>
                      <source src={lead.videoUrl} />
                      Your browser does not support audio playback.
                    </audio>
                    <div>
                      <a className="text-link" href={lead.videoUrl} target="_blank" rel="noopener noreferrer">
                        Open audio in new tab
                      </a>
                    </div>
                  </>
                ) : (
                  <span className="muted">No recording uploaded</span>
                )}
              </dd>
            </div>
          )}
          <div><dt>Call Transfered To</dt><dd>{typeof lead.assignedTo === "object" && lead.assignedTo ? lead.assignedTo.name : "Unassigned"}</dd></div>
          <div><dt>Created</dt><dd>{new Date(lead.createdAt).toLocaleString()}</dd></div>
          <div className="span-two"><dt>Notes</dt><dd>{lead.notes || "No notes"}</dd></div>
        </dl>
      </section>
      <section className="detail-card pricing-card">
        <div className="pricing-heading">
          <div><p className="eyebrow">PRICE HISTORY</p><h2>Price changes and top-ups</h2></div>
          {canViewFinalPrice && <strong className="price-total">{formatUsd(totalPrice)}</strong>}
        </div>
        {canViewFinalPrice && (
          <div className="price-line">
            <span>Starting price</span>
            <strong>{formatUsd(lead.basePrice ?? 50)}</strong>
          </div>
        )}
        {canViewFinalPrice && (lead.topUps ?? []).map((topUp: {
          _id: Types.ObjectId;
          description: string;
          amount: number;
          addedAt: Date;
          addedBy: Types.ObjectId | null;
        }) => {
          const addedByName = topUp.addedBy
            ? creatorNames.get(String(topUp.addedBy)) ?? "Former user"
            : "Internal user";
          return (
            <div className="topup-row" key={String(topUp._id)}>
              <div className="topup-description">
                <strong>{topUp.description}</strong>
                <span>{addedByName} · {new Date(topUp.addedAt).toLocaleString()}</span>
              </div>
              <strong>+{formatUsd(topUp.amount)}</strong>
            </div>
          );
        })}
        {canViewFinalPrice && (lead.topUps ?? []).length === 0 && (
          <p className="muted price-empty">No price changes or top-ups have been added.</p>
        )}
        {canAddTopUp && (
          <LeadTopUpForm
            leadId={id}
            currentPrice={canViewFinalPrice ? totalPrice : 0}
            canSeeFinalPrice={canViewFinalPrice}
          />
        )}
        {lead.status === "WON" && (
          <p className="closed-notice">This lead is won. Further price changes and top-ups are disabled.</p>
        )}
      </section>
    </div>
  );
}
