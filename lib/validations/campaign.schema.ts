import { z } from "zod";

export const CAMPAIGN_TYPES = ["Roofing", "Trucking"] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const campaignSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required.").max(120),
  type: z.enum(CAMPAIGN_TYPES).default("Roofing"),
  description: z.string().trim().max(500).default(""),
  isActive: z.boolean().default(true),
  startDate: z.coerce.date({ message: "Start date is required." }),
  endDate: z.coerce.date({ message: "End date is required." }),
  clientIds: z.array(z.string().regex(/^[a-f\d]{24}$/i, "Choose valid clients.")).default([]),
}).refine((campaign) => campaign.endDate >= campaign.startDate, {
  message: "End date must be on or after the start date.",
  path: ["endDate"],
});
