import Link from "next/link";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { requirePermission } from "@/lib/server/permissions";
import { getDefaultLeadPrice } from "@/lib/settings";

export default async function SettingsPage() {
  const user = await requirePermission();
  if (!user.isSuperAdmin) return null;
  const defaultLeadPrice = await getDefaultLeadPrice();
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading">
        <div><p className="eyebrow">SYSTEM CONFIGURATION</p><h1>Settings</h1><p className="muted">Manage defaults used when new records are created.</p></div>
        <Link href="/dashboard" className="text-link">Back to overview</Link>
      </header>
      <SettingsForm defaultLeadPrice={defaultLeadPrice} />
    </div>
  );
}
