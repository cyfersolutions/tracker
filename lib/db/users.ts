import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import User from "@/models/User";

export async function getUserWithRole(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectToDatabase();
  return User.findById(id)
    .select("-password")
    .populate<{ role: InstanceType<typeof Role> | null }>("role")
    .exec();
}

export async function listUsers() {
  await connectToDatabase();
  return User.find()
    .select("-password")
    .populate("role", "name")
    .sort({ createdAt: -1 })
    .lean()
    .exec();
}
