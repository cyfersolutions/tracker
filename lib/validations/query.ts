import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/permissions";

export const leadExportQuerySchema = z.object({
  search: z.string().trim().max(200).optional().default(""),
  status: z.enum(LEAD_STATUSES).optional(),
});
