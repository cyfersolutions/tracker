import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/permissions";

export const leadExportQuerySchema = z.object({
  search: z.string().trim().max(200).optional().default(""),
  status: z.enum(LEAD_STATUSES).optional(),
  campaign: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});
