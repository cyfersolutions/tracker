import { connectToDatabase } from "@/lib/db/connect";
import Settings from "@/models/Settings";

export const FALLBACK_DEFAULT_LEAD_PRICE = 50;

export async function getDefaultLeadPrice() {
  await connectToDatabase();
  const settings = await Settings.findOne({ key: "global" }).select("defaultLeadPrice").lean();
  return settings?.defaultLeadPrice ?? FALLBACK_DEFAULT_LEAD_PRICE;
}
