"use client";

import { LEAD_STATUSES } from "@/lib/permissions";
import { StyledSelect } from "@/components/ui/StyledSelect";

export function LeadStatusFilter({ value }: { value: string }) {
  return (
    <StyledSelect
      name="status"
      value={value}
      onChange={() => {}}
      options={[
        { value: "", label: "All statuses" },
        ...LEAD_STATUSES.map((status) => ({ value: status, label: status })),
      ]}
    />
  );
}
