import Link from "next/link";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import User from "@/models/User";
import { DeleteUserButton } from "@/components/users/DeleteUserButton";

export default async function ClientsPage() {
  const currentUser = await requirePermission("users:view");
  await connectToDatabase();
  const clientRoles = await Role.find({ type: "client" }).select("_id").lean().exec();
  const clients = await User.find({ role: { $in: clientRoles.map((role) => role._id) } })
    .select("-password")
    .populate("role", "name")
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  const canCreate = currentUser.isSuperAdmin || currentUser.role.permissions.includes("users:create");
  const canEdit = currentUser.isSuperAdmin || currentUser.role.permissions.includes("users:edit");
  const canDelete = currentUser.isSuperAdmin || currentUser.role.permissions.includes("users:delete");

  return (
    <div className="page-wrap">
      <header className="page-heading">
        <div>
          <p className="eyebrow">CLIENT ACCOUNTS</p>
          <h1>Clients</h1>
          <p className="muted">{clients.length} client account{clients.length === 1 ? "" : "s"}</p>
        </div>
        {canCreate && clientRoles.length > 0 && <Link href="/clients/new" className="button button-primary">Add client</Link>}
      </header>
      {clientRoles.length === 0 && (
        <section className="welcome-panel">
          <div>
            <p className="eyebrow">CLIENT ROLE REQUIRED</p>
            <h2>Create a client role to get started</h2>
            <p className="muted">There is no Client role available, so a client account cannot be created yet. Set a role’s type to Client, or create a new Client role.</p>
          </div>
          {currentUser.isSuperAdmin && <Link href="/roles/new" className="button button-secondary">Create role</Link>}
        </section>
      )}
      <div className="table-card">
        <div className="table-scroll"><table>
          <thead><tr><th>Client</th><th>Client role</th><th>Status</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{clients.map((client) => {
            const roleName = typeof client.role === "object" && client.role ? client.role.name : "Unassigned";
            return (
              <tr key={String(client._id)}>
                <td><strong>{client.name}</strong><span className="table-subtext">{client.email}</span></td>
                <td>{roleName}</td>
                <td><span className={`status-badge ${client.isActive ? "status-converted" : "status-lost"}`}>{client.isActive ? "Active" : "Inactive"}</span></td>
                <td>{new Date(client.createdAt).toLocaleDateString()}</td>
                <td><div className="row-actions">
                  {canEdit && !client.isSuperAdmin && <Link className="text-link" href={`/clients/${client._id}/edit`}>Edit</Link>}
                  {canDelete && !client.isSuperAdmin && <DeleteUserButton id={String(client._id)} accountType="client" />}
                </div></td>
              </tr>
            );
          })}</tbody>
        </table></div>
        {clients.length === 0 && clientRoles.length > 0 && <div className="empty-state"><h2>No clients yet</h2><p>Create a client account and assign it to a client role.</p></div>}
      </div>
    </div>
  );
}
