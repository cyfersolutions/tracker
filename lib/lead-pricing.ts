type LeadPriceDetails = {
  basePrice: number;
  topUps: ReadonlyArray<{ amount: number }>;
};

export function canManageLeadPrice(user: {
  isSuperAdmin: boolean;
  role: { type: string };
}) {
  return user.isSuperAdmin || user.role.type === "client";
}

export function getPreviousBasePriceAdjustment(previousPrice: number, nextPrice: number) {
  return previousPrice > 0 && previousPrice !== nextPrice ? previousPrice : null;
}

export function getLeadTotalPrice(lead: LeadPriceDetails) {
  const amount = lead.basePrice + lead.topUps.reduce((total, topUp) => total + topUp.amount, 0);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function omitLeadPrices<T extends {
  basePrice?: unknown;
  finalPrice?: unknown;
  topUps?: unknown;
}>(lead: T): Omit<T, "basePrice" | "finalPrice" | "topUps"> {
  const visibleLead = { ...lead };
  delete visibleLead.basePrice;
  delete visibleLead.finalPrice;
  delete visibleLead.topUps;
  return visibleLead;
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export const APPROVABLE_STATUSES = ["WARM"] as const;
export const LOST_REASON_MIN_LENGTH = 3;

export const APPROVAL_TARGETS = ["INSPECTION_AWAITING", "CONTRACT_SIGNING", "WON"] as const;

/** Moving a Warm lead to any of these statuses needs the client's approval. It does not change the price. */
export function requiresApproval(from: string, to: string) {
  return isApprovableStatus(from) && (APPROVAL_TARGETS as readonly string[]).includes(to);
}

export function isApprovableStatus(status: string) {
  return (APPROVABLE_STATUSES as readonly string[]).includes(status);
}

export function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
