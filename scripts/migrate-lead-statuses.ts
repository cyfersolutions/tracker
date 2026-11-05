import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// Old status -> new status
const MAPPING: Record<string, string> = {
  NEW: "WARM",
  QUALIFIED: "WARM",
  HOT: "WARM",
  CONTACTED: "FOLLOWUP",
  CONVERTED: "WON",
  CLOSED: "WON",
};

async function migrate() {
  const { connectToDatabase } = await import("@/lib/db/connect");
  await connectToDatabase();
  const leads = mongoose.connection.collection("leads");
  for (const [from, to] of Object.entries(MAPPING)) {
    const result = await leads.updateMany({ status: from }, { $set: { status: to } });
    console.info(`${from} -> ${to}: ${result.modifiedCount} leads`);
  }
  const lost = await leads.updateMany(
    { status: "LOST", lostReason: { $exists: false } },
    { $set: { lostReason: "" } },
  );
  console.info(`Initialised lostReason on ${lost.modifiedCount} lost leads.`);
}

migrate()
  .catch((error: unknown) => {
    console.error("Lead status migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
