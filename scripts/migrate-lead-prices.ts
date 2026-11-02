import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";
import { connectToDatabase } from "@/lib/db/connect";
import Lead from "@/models/Lead";

loadEnvConfig(process.cwd());

async function migrateLeadPrices() {
  await connectToDatabase();
  const result = await Lead.updateMany({}, [
    {
      $set: {
        finalPrice: {
          $add: [
            { $ifNull: ["$basePrice", 10] },
            { $sum: { $ifNull: ["$topUps.amount", []] } },
          ],
        },
      },
    },
  ]);
  console.info(
    `Updated final prices for ${result.modifiedCount} of ${result.matchedCount} leads.`,
  );
}

migrateLeadPrices()
  .catch((error: unknown) => {
    console.error("Lead price migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
