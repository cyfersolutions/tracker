import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import User from "@/models/User";

export async function getUserWithRole(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectToDatabase();
  const user = await User.findById(id)
    .select("-password")
    .populate<{ role: InstanceType<typeof Role> | null }>("role")
    .exec();
  if (!user) return null;
  if (user.role?.type === "client") {
    user.role.permissions = ["leads:view", "leads:topup"];
  }
  return user;
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
