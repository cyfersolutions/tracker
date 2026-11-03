import Link from "next/link";
import { LeadForm } from "@/components/leads/LeadForm";
import { requirePermission } from "@/lib/server/permissions";
import { getDefaultLeadPrice } from "@/lib/settings";

export default async function NewLeadPage() {
  const user = await requirePermission("leads:create");
  const canManagePrice = user.isSuperAdmin || user.role.type === "client";
  const defaultLeadPrice = await getDefaultLeadPrice();
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading"><div><p className="eyebrow">LEAD MANAGEMENT</p><h1>Add a lead</h1><p className="muted">Capture contact and property details.</p></div><Link href="/leads" className="text-link">Back to leads</Link></header>
      <LeadForm canManagePrice={canManagePrice} defaultLeadPrice={defaultLeadPrice} />
    </div>
  );
}
