import Link from "next/link";
import { Types } from "mongoose";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import { LeadBoard, type BoardLead } from "@/components/leads/LeadBoard";
import { canManageLeadPrice, getLeadTotalPrice } from "@/lib/lead-pricing";

const BOARD_LIMIT = 500;

export default async function LeadBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const user = await requirePermission("leads:view");
  const query = await searchParams;
  const isClient = user.role.type === "client";
  const canMove = isClient || user.isSuperAdmin || user.role.permissions.includes("leads:edit");
  const assignedCampaignIds = isClient ? (user.campaignIds ?? []) : [];
  const selectedCampaign =
    isClient &&
    Types.ObjectId.isValid(query.campaign ?? "") &&
    assignedCampaignIds.some((id: unknown) => String(id) === query.campaign)
      ? query.campaign
      : undefined;
  await connectToDatabase();
  const filter = isClient
    ? { campaign: { $in: selectedCampaign ? [selectedCampaign] : assignedCampaignIds } }
    : {};
  const [docs, total] = await Promise.all([
    Lead.find(filter)
      .populate("campaign", "name")
      .sort({ updatedAt: -1, _id: -1 })
      .limit(BOARD_LIMIT)
      .lean()
      .exec(),
    Lead.countDocuments(filter),
  ]);
  const showPrice = canManageLeadPrice(user);
  const leads: BoardLead[] = docs.map((lead) => ({
    id: String(lead._id),
    name: lead.name,
    phone: lead.phone,
    location: `${lead.address.city}, ${lead.address.country}`,
    campaign: typeof lead.campaign === "object" && lead.campaign ? lead.campaign.name : "",
    status: lead.status as BoardLead["status"],
    price: showPrice
      ? (lead.finalPrice ??
        getLeadTotalPrice({ basePrice: lead.basePrice ?? 50, topUps: lead.topUps ?? [] }))
      : null,
  }));
  const listHref = selectedCampaign ? `/leads?campaign=${selectedCampaign}` : "/leads";

  return (
    <div className="page-wrap">
      <header className="page-heading">
        <div>
          <p className="eyebrow">PIPELINE</p>
          <h1>Lead board</h1>
          <p className="muted">
            {canMove
              ? "Drag leads between columns. Moving a Warm lead to Inspection Awaiting, Contract Signing or Won needs your approval (no extra charge); moving a lead to Lost needs a reason."
              : "Read-only view of your pipeline."}
            {total > BOARD_LIMIT ? ` Showing the ${BOARD_LIMIT} most recently updated of ${total}.` : ""}
          </p>
        </div>
        <div className="heading-actions">
          <Link className="button button-secondary" href={listHref}>List view</Link>
        </div>
      </header>
      <LeadBoard initialLeads={leads} canApprove={canMove && showPrice} canMove={canMove} campaignId={selectedCampaign} />
    </div>
  );
}
