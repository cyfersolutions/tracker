"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function DashboardCampaignSelector({
  campaigns,
  selectedId,
}: {
  campaigns: Array<{ id: string; name: string }>;
  selectedId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("campaign", value);
    } else {
      params.delete("campaign");
    }
    router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="campaign-selector-inline">
      <select
        id="admin-dashboard-campaign"
        aria-label="Filter dashboard by campaign"
        value={selectedId}
        onChange={onChange}
      >
        <option value="">All campaigns ({campaigns.length})</option>
        {campaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.name}
          </option>
        ))}
      </select>
    </div>
  );
}
