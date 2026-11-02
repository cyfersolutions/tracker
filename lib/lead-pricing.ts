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
