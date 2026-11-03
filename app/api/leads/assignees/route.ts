import { NextResponse } from "next/server";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import User from "@/models/User";

export const GET = withAuth("leads:edit", async () => {
  try {
    await connectToDatabase();
    const clientRoles = await Role.find({ type: "client" }).select("_id").lean().exec();
    const users = await User.find({
      isActive: true,
      role: { $nin: clientRoles.map((role) => role._id) },
    })
      .select("name email")
      .sort({ name: 1 })
      .lean()
      .exec();
    return NextResponse.json({ users });
  } catch (error) {
    return apiError(error);
  }
});
