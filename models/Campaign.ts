import mongoose, { model, models, Schema, type InferSchemaType } from "mongoose";

export const CAMPAIGN_TYPES = ["Roofing", "Trucking"] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

const campaignSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    type: { type: String, enum: CAMPAIGN_TYPES, default: "Roofing", required: true },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    clientIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
  },
  { timestamps: true },
);

export type CampaignDocument = InferSchemaType<typeof campaignSchema>;
if (
  models.Campaign &&
  (!models.Campaign.schema.path("startDate") ||
    !models.Campaign.schema.path("endDate") ||
    !models.Campaign.schema.path("clientIds") ||
    !models.Campaign.schema.path("type"))
) {
  mongoose.deleteModel("Campaign");
}
const Campaign = models.Campaign ?? model("Campaign", campaignSchema);

export default Campaign;
