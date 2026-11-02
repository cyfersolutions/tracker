import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/permissions";

const optionalObjectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Choose a valid user.")
  .nullable()
  .optional();

const uploadedVideoPath =
  /^\/api\/leads\/videos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.[a-z0-9]{1,10})?$/i;

export const leadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.email().trim().toLowerCase().max(254),
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
    ),
  address: z.object({
    street: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(120),
    country: z.string().trim().min(1).max(120),
    postalCode: z.string().trim().min(1).max(24),
  }),
  roofSize: z.number().finite().min(0),
  basePrice: z.number().finite().min(0).max(10000000).multipleOf(0.01).optional().default(10),
  notes: z.string().max(10000).optional().default(""),
  status: z.preprocess(
    (value) => (typeof value === "string" ? value.toUpperCase() : value),
    z.enum(LEAD_STATUSES).optional().default(LEAD_STATUSES[0]),
  ),
  assignedTo: optionalObjectId,
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
