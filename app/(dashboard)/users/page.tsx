import Link from "next/link";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import User from "@/models/User";
import Role from "@/models/Role";
import { DeleteUserButton } from "@/components/users/DeleteUserButton";

export default async function UsersPage() {
  const currentUser = await requirePermission("users:view");
  await connectToDatabase();
  const internalRoles = await Role.find({ type: "internal" }).select("_id").lean().exec();
  const users = await User.find({ role: { $in: internalRoles.map((role) => role._id) } })
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
      <header className="page-heading"><div><p className="eyebrow">WORKSPACE ACCESS</p><h1>Users</h1><p className="muted">Manage team accounts and role assignments.</p></div>{canCreate && <Link href="/users/new" className="button button-primary">Add user</Link>}</header>
      <div className="table-card"><div className="table-scroll"><table>
        <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{users.map((user) => {
          const role = typeof user.role === "object" && user.role ? user.role.name : "Unassigned";
          return <tr key={String(user._id)}>
            <td><strong>{user.name}</strong><span className="table-subtext">{user.email}</span></td>
            <td>{role}{user.isSuperAdmin && <span className="system-tag">Super Admin</span>}</td>
            <td><span className={`status-badge ${user.isActive ? "status-converted" : "status-lost"}`}>{user.isActive ? "Active" : "Inactive"}</span></td>
            <td>{new Date(user.createdAt).toLocaleDateString()}</td>
            <td><div className="row-actions">{canEdit && !user.isSuperAdmin && <Link className="text-link" href={`/users/${user._id}/edit`}>Edit</Link>}{canDelete && !user.isSuperAdmin && <DeleteUserButton id={String(user._id)} />}</div></td>
          </tr>;
        })}</tbody>
      </table></div></div>
    </div>
  );
}
