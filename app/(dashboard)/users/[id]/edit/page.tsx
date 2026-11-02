import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import { UserForm } from "@/components/users/UserForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import User from "@/models/User";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("users:edit");
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectToDatabase();
  const [user, roles] = await Promise.all([
    User.findById(id).select("-password").lean(),
    Role.find({ type: "internal" }).select("name").sort({ name: 1 }).lean().exec(),
  ]);
  if (!user) notFound();
  if (user.isSuperAdmin) redirect("/users");
  const internalRole = await Role.findOne({ _id: user.role, type: "internal" }).select("_id");
  if (!internalRole) redirect("/users");
  return <div className="page-wrap narrow-page"><header className="page-heading"><div><p className="eyebrow">WORKSPACE ACCESS</p><h1>Edit user</h1></div><Link className="text-link" href="/users">Cancel</Link></header><UserForm initial={{ _id: String(user._id), name: user.name, email: user.email, roleId: String(internalRole._id), isActive: user.isActive }} roles={roles.map((role) => ({ _id: String(role._id), name: role.name }))} /></div>;
}
