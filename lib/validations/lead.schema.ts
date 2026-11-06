import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/permissions";

const uploadedVideoPath =
  /^\/api\/leads\/videos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.[a-z0-9]{1,10})?$/i;

export const leadSchema = z
  .object({
    leadType: z.enum(["Roofing", "Trucking"]).optional().default("Roofing"),
    name: z.string().trim().min(1, "Name is required.").max(160),
    email: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.email().trim().toLowerCase().max(254).optional(),
    ),
    phone: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{7,14}$/, "Enter an international phone number in E.164 format, e.g. +14155552671."),
    videoUrl: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (value) =>
          value === "" ||
          uploadedVideoPath.test(value) ||
          (z.url().safeParse(value).success && /^https?:\/\//i.test(value)),
        "Enter a valid HTTP or HTTPS video URL or upload a file.",
      )
      .optional()
      .default(""),
    address: z.object({
      street: z.string().trim().max(200).optional().default(""),
      city: z.string().trim().max(120).optional().default(""),
      state: z.string().trim().max(120),
      country: z.string().trim().max(120).optional().default(""),
      postalCode: z.string().trim().max(24).optional().default(""),
    }),
    roofSize: z.number().finite().min(0).optional().default(0),
    // Trucking fields
    mcNumber: z.string().trim().max(60).optional().default(""),
    truckType: z.string().trim().max(120).optional().default(""),
    trucks: z.coerce.number().finite().min(0).optional().default(0),
    revenue: z.coerce.number().finite().min(0).optional().default(0),
    otr: z.enum(["Yes", "No"]).optional().default("Yes"),
    documents: z
      .array(
        z.object({
          _id: z.string().optional(),
          name: z.string().trim().min(1).max(255),
          url: z.string().trim().min(1),
          size: z.number().optional().default(0),
          uploadedAt: z.coerce.date().optional(),
        }),
      )
      .optional()
      .default([]),
    basePrice: z.number().finite().min(0).max(10000000).multipleOf(0.01).optional().default(50),
    notes: z.string().max(10000).optional().default(""),
    status: z.preprocess(
      (value) => (typeof value === "string" ? value.toUpperCase() : value),
      z.enum(LEAD_STATUSES).optional().default(LEAD_STATUSES[0]),
    ),
    assignedTo: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Choose an active assignee.")
      .nullable()
      .optional(),
    campaign: z.string().regex(/^[a-f\d]{24}$/i, "Choose a valid campaign.").nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.leadType === "Trucking") {
      if (!data.mcNumber || data.mcNumber.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MC Number is required for Trucking leads.",
          path: ["mcNumber"],
        });
      }
      if (!data.address.state || data.address.state.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "State is required.",
          path: ["address", "state"],
        });
      }
    } else {
      // Roofing lead
      if (!data.videoUrl || data.videoUrl.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A voice recording is required.",
          path: ["videoUrl"],
        });
      }
      if (!data.address.street || data.address.street.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Street is required.",
          path: ["address", "street"],
        });
      }
      if (!data.address.city || data.address.city.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "City is required.",
          path: ["address", "city"],
        });
      }
      if (!data.address.state || data.address.state.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "State is required.",
          path: ["address", "state"],
        });
      }
      if (!data.address.country || data.address.country.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Country is required.",
          path: ["address", "country"],
        });
      }
      if (!data.address.postalCode || data.address.postalCode.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Postal code is required.",
          path: ["address", "postalCode"],
        });
      }
    }
  });

export const leadMoveSchema = z
  .object({
    status: z.enum(LEAD_STATUSES),
    reason: z.string().trim().max(500).optional(),
    topUpAmount: z.number().finite().min(0.01).max(10000000).multipleOf(0.01).optional(),
  })
  .refine((value) => value.status !== "LOST" || (value.reason?.length ?? 0) >= 3, {
    message: "A reason of at least 3 characters is required to mark a lead as lost.",
    path: ["reason"],
  });

export const leadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional().default(""),
  status: z.enum(LEAD_STATUSES).optional(),
});

export const leadTopUpSchema = z.object({
  description: z.string().trim().min(3).max(500),
  amount: z.number().finite().min(0.01).max(10000000).multipleOf(0.01),
});

export type LeadInput = z.infer<typeof leadSchema>;
