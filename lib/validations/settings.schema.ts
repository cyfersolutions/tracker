import { z } from "zod";

export const settingsSchema = z.object({
  defaultLeadPrice: z.number().finite().min(0).max(10000000).multipleOf(0.01),
});
