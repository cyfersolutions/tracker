import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Campaign from "@/models/Campaign";
import Role from "@/models/Role";
import User from "@/models/User";

export const GET = withAuth("leads:edit", async (request: NextRequest) => {
  try {
    await connectToDatabase();
    const campaignId = request.nextUrl.searchParams.get("campaign");
    const clientRoles = await Role.find({ type: "client" }).select("_id").lean().exec();
    const clientRoleIds = clientRoles.map((role) => role._id);

    if (campaignId && Types.ObjectId.isValid(campaignId)) {
      const campaign = await Campaign.findById(campaignId)
        .populate({
          path: "clientIds",
          match: { isActive: true, role: { $in: clientRoleIds } },
          select: "_id name email",
        })
        .lean()
        .exec();

      const users = ((campaign?.clientIds ?? []) as unknown as Array<{ _id: unknown; name: string; email: string }>)
        .filter(Boolean)
        .map((client) => ({ _id: String(client._id), name: client.name, email: client.email }));

      return NextResponse.json({ users });
    }

    const users = await User.find({
      isActive: true,
      role: { $in: clientRoleIds },
    })
      .select("name email")
      .sort({ name: 1 })
      .lean()
      .exec();

    return NextResponse.json({
      users: users.map((user) => ({ _id: String(user._id), name: user.name, email: user.email })),
    });
  } catch (error) {
    return apiError(error);
  }
});
