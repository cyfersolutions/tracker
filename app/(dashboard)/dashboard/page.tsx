import Link from "next/link";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";
import Role from "@/models/Role";
import User from "@/models/User";

export default async function DashboardPage() {
  const user = await requirePermission();
  const canViewLeads = user.isSuperAdmin || user.role.permissions.includes("leads:view");
  const canViewUsers = user.isSuperAdmin || user.role.permissions.includes("users:view");
  const canViewRoles = user.isSuperAdmin || user.role.permissions.includes("roles:view");
  await connectToDatabase();
  const [leadCount, newLeadCount, userCount, roleCount] = await Promise.all([
    canViewLeads ? Lead.countDocuments() : Promise.resolve(null),
    canViewLeads ? Lead.countDocuments({ status: "NEW" }) : Promise.resolve(null),
    canViewUsers ? User.countDocuments({ isActive: true }) : Promise.resolve(null),
    canViewRoles ? Role.countDocuments() : Promise.resolve(null),
  ]);

  return (
    <div className="page-wrap">
      <header className="page-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Good to see you, {user.name.split(" ")[0]}</h1>
          <p className="muted">Here is a snapshot of your lead workspace.</p>
        </div>
        {canViewLeads && <Link className="button button-primary" href="/leads">View leads</Link>}
      </header>
      <section className="stat-grid" aria-label="Workspace statistics">
        <article className="stat-card"><span>Total leads</span><strong>{leadCount ?? "—"}</strong><small>{canViewLeads ? "Across all statuses" : "No access to lead data"}</small></article>
        <article className="stat-card"><span>New leads</span><strong>{newLeadCount ?? "—"}</strong><small>{canViewLeads ? "Waiting for first contact" : "No access to lead data"}</small></article>
        <article className="stat-card"><span>Active users</span><strong>{userCount ?? "—"}</strong><small>{canViewUsers ? "With workspace access" : "No access to user data"}</small></article>
        <article className="stat-card"><span>Roles</span><strong>{roleCount ?? "—"}</strong><small>{canViewRoles ? "Configured access groups" : "No access to role data"}</small></article>
      </section>
      <section className="welcome-panel">
        <div>
          <p className="eyebrow">GET STARTED</p>
          <h2>Your sales workspace is ready</h2>
          <p className="muted">Use the navigation to manage leads and access settings available to your role.</p>
        </div>
        {canViewLeads && <Link href="/leads" className="text-link">Open lead management →</Link>}
      </section>
    </div>
  );
}
