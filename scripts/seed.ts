import { hash } from "bcryptjs";
import mongoose from "mongoose";
import { loadEnvConfig } from "@next/env";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import User from "@/models/User";

loadEnvConfig(process.cwd());

async function seed() {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("SUPER_ADMIN_PASSWORD must be configured and at least 12 characters.");
  }

  await connectToDatabase();
  const role = await Role.findOneAndUpdate(
    { name: "Super Admin" },
    { $set: { isSystem: true, permissions: [] } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  const legacyClientRole = await Role.findOne({ name: "Client", isSystem: true });
  if (legacyClientRole) {
    legacyClientRole.type = "client";
    legacyClientRole.isSystem = false;
    await legacyClientRole.save();
    console.info("Migrated the previous Client role to a configurable client role.");
  }
  await Role.updateMany(
    { type: { $exists: false } },
    { $set: { type: "internal" } },
  );
  const existing = await User.findOne({ email: "superadmin@cms.internal" });
  if (existing) {
    existing.isSuperAdmin = true;
    existing.isActive = true;
    existing.role = role._id;
    await existing.save();
    console.info("Verified existing Super Admin account.");
  } else {
    await User.create({
      name: "Super Admin",
      email: "superadmin@cms.internal",
      password: await hash(password, 12),
      role: role._id,
      isSuperAdmin: true,
      isActive: true,
    });
    console.info("Created Super Admin account.");
  }
}

seed()
  .catch((error: unknown) => {
    console.error("Super Admin seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
