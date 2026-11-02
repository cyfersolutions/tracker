import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import { RoleForm } from "@/components/roles/RoleForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import type { Permission } from "@/lib/permissions";
import type { RoleType } from "@/lib/role-types";

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("roles:edit");
  if (!user.isSuperAdmin) redirect("/roles");
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectToDatabase();
  const role = await Role.findById(id).lean();
  if (!role) notFound();
  if (role.name === "Super Admin") redirect("/roles");
  const initial = {
    _id: String(role._id),
    name: role.name,
    type: role.type as RoleType,
    permissions: role.permissions as Permission[],
  };
  return <div className="page-wrap narrow-page"><header className="page-heading"><div><p className="eyebrow">ACCESS CONTROL</p><h1>Edit {role.name}</h1></div><Link className="text-link" href="/roles">Cancel</Link></header><RoleForm initial={initial} /></div>;
}
