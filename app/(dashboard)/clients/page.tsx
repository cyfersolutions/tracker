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
    .populate("campaignIds", "name")
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
        {canCreate && <Link href="/clients/new" className="button button-primary">Add client</Link>}
      </header>
      <div className="table-card">
        <div className="table-scroll"><table>
          <thead><tr><th>Client</th><th>Account type</th><th>Campaigns</th><th>Access</th><th>Status</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{clients.map((client) => {
            return (
              <tr key={String(client._id)}>
                <td><strong>{client.name}</strong><span className="table-subtext">{client.email}</span></td>
                <td><span className="status-badge status-new">Client</span></td>
                <td>{Array.isArray(client.campaignIds) && client.campaignIds.length > 0 ? client.campaignIds.map((campaign: { name?: string } | string) => typeof campaign === "object" && campaign ? campaign.name ?? "Unknown" : "Unknown").join(", ") : "None"}</td>
                <td>View leads · Add price top-ups</td>
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
        {clients.length === 0 && <div className="empty-state"><h2>No clients yet</h2><p>Create a client account with fixed client access.</p></div>}
      </div>
    </div>
  );
}
