import { z } from "zod";

export const campaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  isActive: z.boolean().default(true),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  clientIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, "Choose valid clients.")).default([]),
}).refine((campaign) => campaign.endDate >= campaign.startDate, {
  message: "End date must be on or after the start date.",
  path: ["endDate"],
});
