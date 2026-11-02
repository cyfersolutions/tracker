import { NextResponse } from "next/server";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import User from "@/models/User";

export const GET = withAuth("leads:edit", async () => {
  try {
    await connectToDatabase();
    const users = await User.find({ isActive: true })
      .select("name email")
      .sort({ name: 1 })
      .lean()
      .exec();
    return NextResponse.json({ users });
  } catch (error) {
    return apiError(error);
  }
});
