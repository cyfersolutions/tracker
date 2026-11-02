export const ALL_PERMISSIONS = [
  "leads:view",
  "leads:create",
  "leads:edit",
  "leads:delete",
  "leads:export",
  "roles:view",
  "roles:create",
  "roles:edit",
  "roles:delete",
  "users:view",
  "users:create",
  "users:edit",
  "users:delete",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export function toPlainPermissions(
  permissions: readonly Permission[],
): Permission[] {
  return Array.from(permissions);
}

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "LOST",
  "CONVERTED",
  "CLOSED",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
