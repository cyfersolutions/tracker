import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { LeadForm } from "@/components/leads/LeadForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("leads:edit");
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectToDatabase();
  const lead = await Lead.findById(id).populate("assignedTo", "name").lean();
  if (!lead) notFound();
  const canManagePrice = user.isSuperAdmin || user.role.type === "client";
  const initial = JSON.parse(
    JSON.stringify({
      ...lead,
      basePrice: canManagePrice ? lead.basePrice : 10,
      finalPrice: canManagePrice ? lead.finalPrice : 10,
      topUps: canManagePrice ? lead.topUps : [],
    }),
  );
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading"><div><p className="eyebrow">LEAD MANAGEMENT</p><h1>Edit lead</h1><p className="muted">Update contact and property details.</p></div><Link href={`/leads/${id}`} className="text-link">Cancel</Link></header>
      <LeadForm initial={initial} canManagePrice={canManagePrice} />
    </div>
  );
}
