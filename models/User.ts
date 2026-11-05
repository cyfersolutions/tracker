import mongoose, { model, models, Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: { type: String, required: true, select: false },
    role: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    campaignIds: { type: [{ type: Schema.Types.ObjectId, ref: "Campaign" }], default: [] },
    isSuperAdmin: { type: Boolean, default: false, immutable: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
if (models.User && !models.User.schema.path("campaignIds")) {
  mongoose.deleteModel("User");
}
const User = models.User ?? model("User", userSchema);

export default User;
