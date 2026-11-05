import assert from "node:assert/strict";
import test from "node:test";
import { leadSchema, leadTopUpSchema } from "@/lib/validations/lead.schema";
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

test("lead input normalizes optional email and status", () => {
  const parsed = leadSchema.parse(validLead);
  assert.equal(parsed.email, "jordan@example.com");
  assert.equal(parsed.status, "NEW");
  assert.equal(parsed.notes, "");
  assert.equal(leadSchema.parse({ ...validLead, status: "contacted" }).status, "CONTACTED");
  assert.equal(leadSchema.parse({ ...validLead, email: "" }).email, undefined);
});

test("lead input rejects invalid status, negative area, and incomplete address", () => {
  assert.equal(leadSchema.safeParse({ ...validLead, status: "pending" }).success, false);
  assert.equal(leadSchema.safeParse({ ...validLead, status: "CLOSED" }).success, true);
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
