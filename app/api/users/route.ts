import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import type { RoleType } from "@/lib/role-types";
import User from "@/models/User";
import { createUserSchema } from "@/lib/validations/user.schema";
import { getClientRole } from "@/lib/db/client-role";
import Campaign from "@/models/Campaign";

function requestedRoleType(request: Request): RoleType | null {
  const type = new URL(request.url).searchParams.get("type") ?? "internal";
  return type === "internal" || type === "client" ? type : null;
}

export const GET = withAuth("users:view", async (request) => {
  try {
    const type = requestedRoleType(request);
    if (!type) return NextResponse.json({ error: "Invalid user type." }, { status: 400 });
    await connectToDatabase();
    const roles = await Role.find(
      type === "internal" ? { $or: [{ type: "internal" }, { type: { $exists: false } }] } : { type },
    ).select("_id").lean().exec();
    const users = await User.find()
      .where("role").in(roles.map((role) => role._id))
      .select("-password")
      .populate("role", "name")
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return NextResponse.json({ users });
  } catch (error) {
    return apiError(error);
  }
});

export const POST = withAuth("users:create", async (request) => {
  try {
    const type = requestedRoleType(request);
    if (!type) return NextResponse.json({ error: "Invalid user type." }, { status: 400 });
    const parsed = createUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid user data.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const role = type === "client"
      ? await getClientRole()
      : parsed.data.roleId
        ? await Role.findById(parsed.data.roleId).select("_id type")
        : null;
    if (type === "client") {
      const campaignIds = parsed.data.campaignIds ?? [];
      const count = await Campaign.countDocuments({ _id: { $in: campaignIds }, isActive: true });
      if (count !== campaignIds.length) return NextResponse.json({ error: "Choose only active campaigns." }, { status: 400 });
    }
    if (!role || (role.type !== type && !(type === "internal" && !role.type))) {
      return NextResponse.json({ error: "Choose a role for this account type." }, { status: 400 });
    }
    const password = await hash(parsed.data.password, 12);
    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      password,
      role: role._id,
      campaignIds: type === "client" ? parsed.data.campaignIds : [],
    });
    return NextResponse.json(
      { id: user.id, name: user.name, email: user.email, roleId: String(role._id) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
});
