import Link from "next/link";
import { UserForm } from "@/components/users/UserForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";

export default async function NewUserPage() {
  await requirePermission("users:create");
  await connectToDatabase();
  const roles = await Role.find({ type: "internal" }).select("name").sort({ name: 1 }).lean().exec();
  return <div className="page-wrap narrow-page"><header className="page-heading"><div><p className="eyebrow">WORKSPACE ACCESS</p><h1>Add user</h1><p className="muted">Create a new team account.</p></div><Link className="text-link" href="/users">Back to users</Link></header><UserForm roles={roles.map((role) => ({ _id: String(role._id), name: role.name }))} /></div>;
}
