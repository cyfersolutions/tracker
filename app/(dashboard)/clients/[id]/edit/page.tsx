import Link from "next/link";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { UserForm } from "@/components/users/UserForm";
import { requirePermission } from "@/lib/server/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import User from "@/models/User";
import Campaign from "@/models/Campaign";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("users:edit");
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectToDatabase();
  const [client, campaigns] = await Promise.all([
    User.findById(id).select("-password").lean(),
    Campaign.find({ isActive: true }).select("_id name").sort({ name: 1 }).lean().exec(),
  ]);
  if (!client || client.isSuperAdmin) notFound();
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
          isActive: client.isActive,
          campaignIds: (client.campaignIds ?? []).map(String),
        }}
        roles={[]}
        campaigns={campaigns.map((campaign) => ({ _id: String(campaign._id), name: campaign.name }))}
      />
    </div>
  );
}
