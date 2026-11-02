import Link from "next/link";
import { UserForm } from "@/components/users/UserForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";

export default async function NewClientPage() {
  const user = await requirePermission("users:create");
  await connectToDatabase();
  const roles = await Role.find({ type: "client" }).select("name").sort({ name: 1 }).lean().exec();
  if (roles.length === 0) {
    return (
      <div className="page-wrap narrow-page">
        <header className="page-heading">
          <div>
            <p className="eyebrow">CLIENT ACCOUNTS</p>
            <h1>Cannot add a client yet</h1>
            <p className="muted">Create a Client role or change an existing role’s type to Client before creating an account.</p>
          </div>
          <Link className="text-link" href="/clients">Back to clients</Link>
        </header>
        {user.isSuperAdmin && (
          <section className="welcome-panel">
            <div>
              <p className="eyebrow">CLIENT ROLE REQUIRED</p>
              <h2>Create a Client role</h2>
              <p className="muted">Once the role is available, return here to create the client account.</p>
            </div>
            <Link href="/roles/new" className="button button-secondary">Create role</Link>
          </section>
        )}
      </div>
    );
  }
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading">
        <div><p className="eyebrow">CLIENT ACCOUNTS</p><h1>Add client</h1><p className="muted">Create a client login and assign a client role.</p></div>
        <Link className="text-link" href="/clients">Back to clients</Link>
      </header>
      <UserForm
        accountType="client"
        roles={roles.map((role) => ({ _id: String(role._id), name: role.name }))}
      />
    </div>
  );
}
