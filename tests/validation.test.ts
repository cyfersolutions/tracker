import assert from "node:assert/strict";
import test from "node:test";
import { leadMoveSchema, leadSchema, leadTopUpSchema } from "@/lib/validations/lead.schema";
import { campaignSchema } from "@/lib/validations/campaign.schema";
import { roleSchema } from "@/lib/validations/role.schema";
import { createUserSchema } from "@/lib/validations/user.schema";
import { fromSquareFeet, toSquareFeet } from "@/lib/roof-size";
import { toPlainPermissions } from "@/lib/permissions";
import {
  canManageLeadPrice,
  getLeadTotalPrice,
  getPreviousBasePriceAdjustment,
  omitLeadPrices,
} from "@/lib/lead-pricing";

const validLead = {
  name: "Jordan Lee",
  email: "JORDAN@example.com",
  phone: "+14155552671",
  videoUrl: "https://example.com/inspection-video",
  address: {
    street: "1 Main Street",
    city: "Denver",
    state: "Colorado",
    country: "United States",
    postalCode: "80202",
  },
  roofSize: 1200,
  assignedTo: "507f1f77bcf86cd799439011",
};

const validTruckingLead = {
  leadType: "Trucking",
  name: "Alex Miller",
  email: "alex@millerlogistics.com",
  phone: "+14155552671",
  mcNumber: "MC-987654",
  address: { state: "Texas" },
  otr: "Yes",
  truckType: "Dry Van",
  trucks: 5,
  revenue: 750000,
  assignedTo: "507f1f77bcf86cd799439011",
};

test("campaign schema validates Roofing and Trucking types", () => {
  const baseCampaign = {
    name: "Q4 Outreach",
    startDate: new Date("2026-10-01"),
    endDate: new Date("2026-12-31"),
  };
  const defaultType = campaignSchema.parse(baseCampaign);
  assert.equal(defaultType.type, "Roofing");

  const roofing = campaignSchema.safeParse({ ...baseCampaign, type: "Roofing" });
  assert.equal(roofing.success, true);

  const trucking = campaignSchema.safeParse({ ...baseCampaign, type: "Trucking" });
  assert.equal(trucking.success, true);
  if (trucking.success) assert.equal(trucking.data.type, "Trucking");

  const invalidType = campaignSchema.safeParse({ ...baseCampaign, type: "Solar" });
  assert.equal(invalidType.success, false);
});

test("trucking lead input accepts trucking variables and enforces required MC NO and State", () => {
  const parsed = leadSchema.parse(validTruckingLead);
  assert.equal(parsed.leadType, "Trucking");
  assert.equal(parsed.name, "Alex Miller");
  assert.equal(parsed.mcNumber, "MC-987654");
  assert.equal(parsed.address.state, "Texas");
  assert.equal(parsed.otr, "Yes");
  assert.equal(parsed.truckType, "Dry Van");
  assert.equal(parsed.trucks, 5);
  assert.equal(parsed.revenue, 750000);
  assert.equal(parsed.email, "alex@millerlogistics.com");
  assert.equal(parsed.phone, "+14155552671");
  assert.equal(parsed.roofSize, 0);
  assert.deepEqual(parsed.documents, []);

  // Accepts documents
  assert.equal(
    leadSchema.safeParse({
      ...validTruckingLead,
      documents: [{ name: "insurance.pdf", url: "/api/leads/videos/abc.pdf", size: 2048 }],
    }).success,
    true,
  );

  // MC NO is required for Trucking
  assert.equal(leadSchema.safeParse({ ...validTruckingLead, mcNumber: "" }).success, false);
  assert.equal(leadSchema.safeParse({ ...validTruckingLead, mcNumber: "   " }).success, false);

  // State is required for Trucking
  assert.equal(leadSchema.safeParse({ ...validTruckingLead, address: { state: "" } }).success, false);

  // Trucker Name is required
  assert.equal(leadSchema.safeParse({ ...validTruckingLead, name: " " }).success, false);

  // Phone is required
  assert.equal(leadSchema.safeParse({ ...validTruckingLead, phone: "invalid-phone" }).success, false);

  // Does not require videoUrl or street/city/postalCode for Trucking
  assert.equal(leadSchema.safeParse({ ...validTruckingLead, videoUrl: "" }).success, true);
});

test("lead input normalizes optional email and status", () => {
  const parsed = leadSchema.parse(validLead);
  assert.equal(parsed.email, "jordan@example.com");
  assert.equal(parsed.status, "WARM");
  assert.equal(parsed.notes, "");
  assert.equal(leadSchema.parse({ ...validLead, status: "followup" }).status, "FOLLOWUP");
  assert.equal(leadSchema.parse({ ...validLead, email: "" }).email, undefined);
});

test("lead input rejects invalid status, negative area, and incomplete address", () => {
  assert.equal(leadSchema.safeParse({ ...validLead, status: "pending" }).success, false);
  assert.equal(leadSchema.safeParse({ ...validLead, status: "WON" }).success, true);
  assert.equal(leadSchema.safeParse({ ...validLead, roofSize: -10 }).success, false);
  assert.equal(
    leadSchema.safeParse({ ...validLead, address: { ...validLead.address, city: "" } }).success,
    false,
  );
  assert.equal(leadSchema.safeParse({ ...validLead, name: " " }).success, false);
  assert.equal(leadSchema.safeParse({ ...validLead, email: "not-an-email" }).success, false);
  assert.equal(leadSchema.safeParse({ ...validLead, phone: "4155552671" }).success, false);
  assert.equal(leadSchema.safeParse({ ...validLead, phone: "+1 415 555 2671" }).success, false);
  assert.equal(leadSchema.safeParse({ ...validLead, videoUrl: "" }).success, false);
  assert.equal(leadSchema.safeParse({ ...validLead, videoUrl: "javascript:alert(1)" }).success, false);
  assert.equal(
    leadSchema.safeParse({
      ...validLead,
      videoUrl: "/api/leads/videos/01234567-89ab-cdef-0123-456789abcdef.mp4",
    }).success,
    true,
  );
  assert.equal(
    leadSchema.safeParse({ ...validLead, videoUrl: "/api/leads/videos/../../private.mp4" }).success,
    false,
  );
});

test("top-ups require a description and positive currency-cent amounts", () => {
  assert.equal(leadTopUpSchema.safeParse({ description: "Inspection done", amount: 50 }).success, true);
  assert.equal(leadTopUpSchema.safeParse({ description: "Ok", amount: 50 }).success, false);
  assert.equal(leadTopUpSchema.safeParse({ description: "Inspection done", amount: 50.005 }).success, false);
});

test("role input accepts only defined permission keys", () => {
  const internalRole = roleSchema.safeParse({ name: "Sales", permissions: ["leads:view"] });
  assert.equal(internalRole.success, true);
  if (internalRole.success) assert.equal(internalRole.data.type, "internal");
  assert.equal(
    roleSchema.safeParse({ name: "External Client", type: "client", permissions: ["leads:view"] }).success,
    true,
  );
  assert.equal(
    roleSchema.safeParse({ name: "Sales", permissions: ["leads:topup"] }).success,
    false,
  );
  assert.equal(roleSchema.safeParse({ name: "Sales", permissions: ["system:root"] }).success, false);
  assert.equal(roleSchema.safeParse({ name: "Sales", type: "root", permissions: [] }).success, false);
});

test("user creation requires a strong password and ignores protected fields", () => {
  const parsed = createUserSchema.safeParse({
    name: "Jordan Lee",
    email: "JORDAN@example.com",
    password: "A-long-temporary-password",
    roleId: "507f1f77bcf86cd799439011",
    isSuperAdmin: true,
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.email, "jordan@example.com");
    assert.equal("isSuperAdmin" in parsed.data, false);
  }
  assert.equal(
    createUserSchema.safeParse({
      name: "Jordan Lee",
      email: "jordan@example.com",
      password: "short",
      roleId: "507f1f77bcf86cd799439011",
    }).success,
    false,
  );
});

test("roof area is converted to and stored as square feet", () => {
  assert.ok(Math.abs(toSquareFeet(100, "sqm") - 1076.39) < 1e-8);
  assert.ok(Math.abs(fromSquareFeet(1076.39, "sqm") - 100) < 1e-8);
  assert.equal(toSquareFeet(100, "sqft"), 100);
});

test("permissions copied from database values are cloneable plain arrays", () => {
  const permissions = toPlainPermissions(["leads:view", "leads:create"]);
  assert.equal(Array.isArray(permissions), true);
  assert.deepEqual(structuredClone(permissions), ["leads:view", "leads:create"]);
});

test("lead final price adds top-ups to its base price", () => {
  assert.equal(getLeadTotalPrice({ basePrice: 50, topUps: [{ amount: 50 }] }), 100);
  assert.equal(getLeadTotalPrice({ basePrice: 50, topUps: [{ amount: 50 }, { amount: 6 }] }), 106);
  assert.equal(getLeadTotalPrice({ basePrice: 50, topUps: [] }), 50);
});

test("changing an open lead's base price preserves its previous positive price", () => {
  const previousPrice = getPreviousBasePriceAdjustment(50, 20);
  assert.equal(previousPrice, 50);
  assert.equal(
    getLeadTotalPrice({
      basePrice: 20,
      topUps: [{ amount: 50 }, ...(previousPrice === null ? [] : [{ amount: previousPrice }])],
    }),
    120,
  );
  assert.equal(getPreviousBasePriceAdjustment(50, 50), null);
  assert.equal(getPreviousBasePriceAdjustment(0, 10), null);
});

test("internal lead API payloads omit all price details", () => {
  const visibleLead = omitLeadPrices({
    name: "Jordan Lee",
    basePrice: 50,
    finalPrice: 60,
    topUps: [{ amount: 50 }],
  });

  test("only Super Admins and client roles can manage lead prices", () => {
    assert.equal(canManageLeadPrice({ isSuperAdmin: true, role: { type: "internal" } }), true);
    assert.equal(canManageLeadPrice({ isSuperAdmin: false, role: { type: "client" } }), true);
    assert.equal(canManageLeadPrice({ isSuperAdmin: false, role: { type: "internal" } }), false);
  });
  assert.deepEqual(visibleLead, { name: "Jordan Lee" });
});

test("only Warm and Hot leads are approvable for inspection", async () => {
  const { isApprovableStatus } = await import("@/lib/lead-pricing");
  assert.equal(isApprovableStatus("WARM"), true);
  assert.equal(isApprovableStatus("HOT"), false);
  assert.equal(isApprovableStatus("FOLLOWUP"), false);
  assert.equal(isApprovableStatus("INSPECTION_AWAITING"), false);
});

test("moving a lead to Lost requires a reason", () => {
  assert.equal(leadMoveSchema.safeParse({ status: "LOST" }).success, false);
  assert.equal(leadMoveSchema.safeParse({ status: "LOST", reason: "  " }).success, false);
  assert.equal(leadMoveSchema.safeParse({ status: "LOST", reason: "Not interested" }).success, true);
  assert.equal(leadMoveSchema.safeParse({ status: "FOLLOWUP" }).success, true);
});

test("moving a Warm lead to inspection, contract or won requires approval", async () => {
  const { requiresApproval } = await import("@/lib/lead-pricing");
  for (const target of ["INSPECTION_AWAITING", "CONTRACT_SIGNING", "WON"]) {
    assert.equal(requiresApproval("WARM", target), true);
    assert.equal(requiresApproval("FOLLOWUP", target), false);
  }
  assert.equal(requiresApproval("WARM", "FOLLOWUP"), false);
  assert.equal(requiresApproval("WARM", "LOST"), false);
});

test("move payload validates the Won top-up amount", () => {
  assert.equal(leadMoveSchema.safeParse({ status: "WON", topUpAmount: 25 }).success, true);
  assert.equal(leadMoveSchema.safeParse({ status: "WON", topUpAmount: 0 }).success, false);
});
