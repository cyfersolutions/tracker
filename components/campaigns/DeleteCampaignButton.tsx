"use client";

import { useRouter } from "next/navigation";

export function DeleteCampaignButton({ id }: { id: string }) {
  const router = useRouter();
  async function remove() {
    if (!window.confirm("Delete this campaign? Leads will become unassigned.")) return;
    const response = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (response.ok) router.refresh();
  }
  return <button className="text-link danger-link" onClick={() => void remove()}>Delete</button>;
}
