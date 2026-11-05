import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleForm } from "@/components/roles/RoleForm";
import { requirePermission } from "@/lib/server/permissions";

export default async function NewRolePage() {
  const user = await requirePermission("roles:create");
  if (!user.isSuperAdmin) redirect("/roles");
  return <div className="page-wrap narrow-page"><header className="page-heading"><div><p className="eyebrow">ACCESS CONTROL</p><h1>Create role</h1><p className="muted">Assign permissions for an internal team role.</p></div><Link className="text-link" href="/roles">Back to roles</Link></header><RoleForm /></div>;
}
