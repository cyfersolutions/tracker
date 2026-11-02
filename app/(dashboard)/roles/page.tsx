import Link from "next/link";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import User from "@/models/User";
import { DeleteRoleButton } from "@/components/roles/DeleteRoleButton";

export default async function RolesPage() {
  const user = await requirePermission("roles:view");
  await connectToDatabase();
  const [roles, counts] = await Promise.all([
    Role.find().sort({ name: 1 }).lean().exec(),
    User.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
  ]);
  const countByRole = new Map(counts.map((row) => [String(row._id), row.count]));
  const canCreate = user.isSuperAdmin;
  const canEdit = user.isSuperAdmin;
  const canDelete = user.isSuperAdmin || user.role.permissions.includes("roles:delete");

  return (
    <div className="page-wrap">
      <header className="page-heading"><div><p className="eyebrow">ACCESS CONTROL</p><h1>Roles</h1><p className="muted">Define permissions for each team role.</p></div>{canCreate && <Link href="/roles/new" className="button button-primary">Create role</Link>}</header>
      <div className="table-card"><div className="table-scroll"><table>
        <thead><tr><th>Role</th><th>Permissions</th><th>Assigned users</th><th>Type</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{roles.map((role) => (
          <tr key={String(role._id)}>
            <td><strong>{role.name}</strong></td>
            <td>{role.name === "Super Admin" ? "All permissions (Super Admin)" : `${role.permissions.length} permissions`}</td>
            <td>{countByRole.get(String(role._id)) ?? 0}</td>
            <td><span className={`status-badge ${role.type === "client" ? "status-new" : "status-qualified"}`}>{role.type === "client" ? "Client" : role.isSystem ? "System" : "Internal"}</span></td>
            <td><div className="row-actions">{canEdit && !role.isSystem && <Link className="text-link" href={`/roles/${role._id}/edit`}>Edit</Link>}{canDelete && !role.isSystem && <DeleteRoleButton id={String(role._id)} />}</div></td>
          </tr>
        ))}</tbody>
      </table></div></div>
    </div>
  );
}
