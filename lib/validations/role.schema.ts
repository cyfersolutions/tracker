import { z } from "zod";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { ROLE_TYPES } from "@/lib/role-types";

export const roleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(ROLE_TYPES).default("internal"),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).max(ALL_PERMISSIONS.length),
});
