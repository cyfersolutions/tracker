import Link from "next/link";
import { UserForm } from "@/components/users/UserForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";

export default async function NewUserPage() {
  await requirePermission("users:create");
  await connectToDatabase();
  const roles = await Role.find({
    $or: [{ type: "internal" }, { type: { $exists: false } }],
  }).select("name").sort({ name: 1 }).lean().exec();
  if (roles.length === 0) {
    return (
      <div className="page-wrap narrow-page">
        <header className="page-heading">
          <div>
            <p className="eyebrow">WORKSPACE ACCESS</p>
            <h1>Cannot add a user yet</h1>
            <p className="muted">Create an Internal role before creating a user account.</p>
          </div>
          <Link className="text-link" href="/users">Back to users</Link>
        </header>
        <section className="welcome-panel">
          <div>
            <p className="eyebrow">INTERNAL ROLE REQUIRED</p>
            <h2>Create an Internal role</h2>
            <p className="muted">Once the role is available, return here to create the user account.</p>
          </div>
          <Link href="/roles/new" className="button button-secondary">Create role</Link>
        </section>
      </div>
    );
  }
  return <div className="page-wrap narrow-page"><header className="page-heading"><div><p className="eyebrow">WORKSPACE ACCESS</p><h1>Add user</h1><p className="muted">Create a new team account.</p></div><Link className="text-link" href="/users" >Back to users</Link></header><UserForm roles={roles.map((role) => ({ _id: String(role._id), name: role.name }))} /></div>;
}
