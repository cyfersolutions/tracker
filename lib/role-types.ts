export const ROLE_TYPES = ["internal", "client"] as const;
export type RoleType = (typeof ROLE_TYPES)[number];
