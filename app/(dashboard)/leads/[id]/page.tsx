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
    .lean();
  if (!lead) notFound();
  if (user.role.type === "client" && (!lead.campaign || !(user.campaignIds ?? []).some((campaignId: unknown) => String(campaignId) === String(lead.campaign)))) notFound();
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
  const canEdit = user.isSuperAdmin || user.role.permissions.includes("leads:edit");
  const canDelete = user.isSuperAdmin || user.role.permissions.includes("leads:delete");
  const canViewFinalPrice = canManageLeadPrice(user);
  const canAddTopUp =
    canViewFinalPrice &&
    (user.isSuperAdmin ||
      user.role.permissions.includes("leads:edit") ||
      user.role.permissions.includes("leads:topup")) &&
    lead.status !== "CLOSED";
  const totalPrice =
    lead.finalPrice ??
    getLeadTotalPrice({ basePrice: lead.basePrice ?? 50, topUps: lead.topUps ?? [] });

  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading">
        <div><p className="eyebrow">LEAD DETAILS</p><h1>{lead.name}</h1><p className="muted">{lead.email} · {lead.phone}</p></div>
        <div className="heading-actions">
          {canEdit && <Link className="button button-secondary" href={`/leads/${id}/edit`}>Edit lead</Link>}
          {canDelete && <DeleteLeadButton id={id} />}
          <Link className="text-link" href="/leads">Back</Link>
        </div>
      </header>
      <section className="detail-card">
        <h2>Lead information</h2>
        <dl className="detail-grid">
          <div><dt>Status</dt><dd><span className={`status-badge status-${lead.status}`}>{lead.status}</span></dd></div>
          {canViewFinalPrice && <div><dt>Final price</dt><dd className="price-total">{formatUsd(totalPrice)}</dd></div>}
          {canViewFinalPrice && <div><dt>Starting price</dt><dd>{formatUsd(lead.basePrice ?? 50)}</dd></div>}
          <div className="span-two"><dt>Video</dt><dd>{lead.videoUrl ? <a className="text-link" href={lead.videoUrl} target="_blank" rel="noopener noreferrer">Open video</a> : "No file uploaded"}</dd></div>
          <div><dt>Roof size</dt><dd>{lead.roofSize.toLocaleString()} sq ft</dd></div>
          <div><dt>Street</dt><dd>{lead.address.street}</dd></div>
          <div><dt>City</dt><dd>{lead.address.city}</dd></div>
          <div><dt>State</dt><dd>{lead.address.state}</dd></div>
          <div><dt>Country</dt><dd>{lead.address.country}</dd></div>
          <div><dt>Postal code</dt><dd>{lead.address.postalCode}</dd></div>
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
        {lead.status === "CLOSED" && (
          <p className="closed-notice">This lead is closed. Further price changes and top-ups are disabled.</p>
        )}
      </section>
    </div>
  );
}
