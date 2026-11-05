import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import "@/models/Lead";
import "@/models/Role";
import "@/models/User";
import { LEAD_STATUSES } from "@/lib/permissions";

test("all referenced models are registered before populate queries", () => {
  assert.equal(mongoose.modelNames().includes("Lead"), true);
  assert.equal(mongoose.modelNames().includes("Role"), true);
  assert.equal(mongoose.modelNames().includes("User"), true);

  const userSchema = mongoose.model("User").schema;
  assert.equal(userSchema.path("role").options.ref, "Role");
  assert.equal(userSchema.path("campaignIds").options.type[0].ref, "Campaign");
  const leadSchema = mongoose.model("Lead").schema;
  assert.ok(leadSchema.path("videoUrl"));
  assert.ok(leadSchema.path("finalPrice"));
  assert.deepEqual(leadSchema.path("status")?.options.enum, LEAD_STATUSES);
  assert.equal(leadSchema.path("basePrice").options.default, 50);
  assert.equal(leadSchema.path("finalPrice").options.default, 50);
  assert.equal(leadSchema.path("assignedTo").options.ref, "User");
  assert.equal(leadSchema.path("createdBy").options.ref, "User");
  assert.equal(leadSchema.path("topUps.addedBy")?.options.ref, "User");
});
