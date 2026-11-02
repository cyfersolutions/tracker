import { model, models, Schema, type InferSchemaType } from "mongoose";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { ROLE_TYPES } from "@/lib/role-types";

export type { RoleType } from "@/lib/role-types";

const roleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    type: { type: String, enum: ROLE_TYPES, default: "internal", required: true },
    permissions: {
      type: [{ type: String, enum: ALL_PERMISSIONS }],
      default: [],
    },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type RoleDocument = InferSchemaType<typeof roleSchema>;
const Role = models.Role ?? model("Role", roleSchema);

export default Role;
