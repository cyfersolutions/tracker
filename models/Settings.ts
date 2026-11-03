import { model, models, Schema, type InferSchemaType } from "mongoose";

const settingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    defaultLeadPrice: { type: Number, required: true, min: 0, max: 10000000, default: 50 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export type SettingsDocument = InferSchemaType<typeof settingsSchema>;
const Settings = models.Settings ?? model("Settings", settingsSchema);

export default Settings;
