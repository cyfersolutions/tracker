import Link from "next/link";
import { UserForm } from "@/components/users/UserForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import Campaign from "@/models/Campaign";

export default async function NewClientPage() {
  await requirePermission("users:create");
  await connectToDatabase();
  const campaigns = await Campaign.find({ isActive: true }).select("_id name").sort({ name: 1 }).lean().exec();
  return (
    <div className="page-wrap narrow-page">
      <header className="page-heading">
        <div><p className="eyebrow">CLIENT ACCOUNTS</p><h1>Add client</h1><p className="muted">Create a client login with fixed client access.</p></div>
        <Link className="text-link" href="/clients">Back to clients</Link>
      </header>
      <UserForm
        accountType="client"
        roles={[]}
        campaigns={campaigns.map((campaign) => ({ _id: String(campaign._id), name: campaign.name }))}
      />
    </div>
  );
}
