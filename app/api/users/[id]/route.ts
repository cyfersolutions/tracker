import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import type { RoleType } from "@/lib/role-types";
import User from "@/models/User";
import { updateUserSchema } from "@/lib/validations/user.schema";
import { getClientRole } from "@/lib/db/client-role";
import Campaign from "@/models/Campaign";

function requestedRoleType(request: Request): RoleType | null {
  const type = new URL(request.url).searchParams.get("type") ?? "internal";
  return type === "internal" || type === "client" ? type : null;
}

export const GET = withAuth("users:view", async (request, context) => {
  try {
    const type = requestedRoleType(request);
    if (!type) return NextResponse.json({ error: "Invalid user type." }, { status: 400 });
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user identifier." }, { status: 400 });
    }
    await connectToDatabase();
    const user = await User.findById(id).select("-password").lean();
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const role = await Role.findById(user.role).select("type").lean();
    if (!role || (role.type !== type && !(type === "internal" && !role.type))) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    return apiError(error);
  }
});

export const PUT = withAuth("users:edit", async (request, context) => {
  try {
    const type = requestedRoleType(request);
    if (!type) return NextResponse.json({ error: "Invalid user type." }, { status: 400 });
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user identifier." }, { status: 400 });
    }
    const parsed = updateUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid user data.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const target = await User.findById(id);
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const targetRole = await Role.findById(target.role).select("type");
    if (!targetRole || (targetRole.type !== type && !(type === "internal" && !targetRole.type))) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (target.isSuperAdmin && (!parsed.data.isActive || parsed.data.roleId !== String(target.role))) {
      return NextResponse.json(
        { error: "The Super Admin cannot be deactivated or reassigned." },
        { status: 403 },
      );
    }

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
    target.name = parsed.data.name;
    target.email = parsed.data.email;
    target.role = role._id;
    target.campaignIds = type === "client" ? parsed.data.campaignIds : [];
    target.isActive = parsed.data.isActive;
    if (parsed.data.password) target.password = await hash(parsed.data.password, 12);
    await target.save();
    return NextResponse.json({
      id: target.id,
      name: target.name,
      email: target.email,
      roleId: String(target.role),
      isActive: target.isActive,
    });
  } catch (error) {
    return apiError(error);
  }
});

export const DELETE = withAuth("users:delete", async (_request, context) => {
  try {
    const type = requestedRoleType(_request);
    if (!type) return NextResponse.json({ error: "Invalid user type." }, { status: 400 });
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user identifier." }, { status: 400 });
    }
    await connectToDatabase();
    const user = await User.findById(id);
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const role = await Role.findById(user.role).select("type");
    if (!role || role.type !== type) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (user.isSuperAdmin) {
      return NextResponse.json({ error: "The Super Admin cannot be deleted." }, { status: 403 });
    }
    await user.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
});
