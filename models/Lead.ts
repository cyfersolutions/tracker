import { model, models, Schema, type InferSchemaType } from "mongoose";
import mongoose from "mongoose";
import { LEAD_STATUSES } from "@/lib/permissions";

const VIDEO_URL_PATTERN =
  /^(?:$|https?:\/\/.+|\/api\/leads\/videos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.[a-z0-9]{1,10})?)$/i;

const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^\+[1-9]\d{7,14}$/,
    },
    videoUrl: {
      type: String,
      required: false,
      trim: true,
      maxlength: 2048,
      match: VIDEO_URL_PATTERN,
    },
    address: {
      street: { type: String, required: true, trim: true, maxlength: 200 },
      city: { type: String, required: true, trim: true, maxlength: 120 },
      country: { type: String, required: true, trim: true, maxlength: 120 },
      postalCode: { type: String, required: true, trim: true, maxlength: 24 },
    },
    roofSize: { type: Number, required: true, min: 0 },
    basePrice: { type: Number, required: true, min: 0, default: 10 },
    finalPrice: { type: Number, required: true, min: 0, default: 10 },
    topUps: {
      type: [
        new Schema(
          {
            description: { type: String, required: true, trim: true, maxlength: 500 },
            amount: { type: Number, required: true, min: 0.01, max: 10000000 },
            addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
            addedAt: { type: Date, required: true, default: Date.now },
          },
          { _id: true },
        ),
      ],
      default: [],
    },
    closedAt: { type: Date, default: null },
    notes: { type: String, default: "", maxlength: 10000 },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: LEAD_STATUSES[0],
      index: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

leadSchema.index({ createdAt: -1 });
leadSchema.index({ name: "text", email: "text", phone: "text" });

export type LeadDocument = InferSchemaType<typeof leadSchema>;
const registeredStatusValues = models.Lead?.schema.path("status")?.options.enum ?? [];
const registeredVideoUrlPattern = models.Lead?.schema.path("videoUrl")?.options.match;
if (models.Lead && (
  !models.Lead.schema.path("videoUrl") ||
  !models.Lead.schema.path("finalPrice") ||
  !(registeredVideoUrlPattern instanceof RegExp) ||
  registeredVideoUrlPattern.source !== VIDEO_URL_PATTERN.source ||
  registeredStatusValues.length !== LEAD_STATUSES.length ||
  LEAD_STATUSES.some((status) => !registeredStatusValues.includes(status))
)) {
  mongoose.deleteModel("Lead");
}
const Lead = models.Lead ?? model("Lead", leadSchema);

export default Lead;
