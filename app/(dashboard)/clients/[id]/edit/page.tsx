import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { UserForm } from "@/components/users/UserForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import User from "@/models/User";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("users:edit");
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectToDatabase();
  const [client, roles] = await Promise.all([
    User.findById(id).select("-password").lean(),
    Role.find({ type: "client" }).select("name").sort({ name: 1 }).lean().exec(),
  ]);
  if (!client || client.isSuperAdmin) notFound();
  const clientRole = await Role.findOne({ _id: client.role, type: "client" }).select("_id");
  if (!clientRole) notFound();
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading">
        <div><p className="eyebrow">CLIENT ACCOUNTS</p><h1>Edit client</h1></div>
        <Link className="text-link" href="/clients">Cancel</Link>
      </header>
      <UserForm
        accountType="client"
        initial={{
          _id: String(client._id),
          name: client.name,
          email: client.email,
          roleId: String(clientRole._id),
          isActive: client.isActive,
        }}
        roles={roles.map((role) => ({ _id: String(role._id), name: role.name }))}
      />
    </div>
  );
}
