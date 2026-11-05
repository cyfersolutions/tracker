import { z } from "zod";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { ROLE_TYPES } from "@/lib/role-types";

export const roleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(ROLE_TYPES).default("internal"),
  permissions: z.array(z.enum(ROLE_PERMISSIONS)).max(ROLE_PERMISSIONS.length),
});
