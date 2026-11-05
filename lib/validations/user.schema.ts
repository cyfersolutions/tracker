import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Choose a valid role.");

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(12).max(128),
  roleId: objectIdSchema.optional(),
  campaignIds: z.array(objectIdSchema).default([]),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase().max(254),
  roleId: objectIdSchema.optional(),
  campaignIds: z.array(objectIdSchema).default([]),
  isActive: z.boolean(),
  password: z.string().min(12).max(128).optional(),
});
