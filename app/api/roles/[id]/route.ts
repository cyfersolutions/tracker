import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import User from "@/models/User";
import { roleSchema } from "@/lib/validations/role.schema";

export const GET = withAuth("roles:view", async (_request, context) => {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid role identifier." }, { status: 400 });
    }
    await connectToDatabase();
    const role = await Role.findById(id).lean();
    if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
    return NextResponse.json(role);
  } catch (error) {
    return apiError(error);
  }
});

export const PUT = withAuth("roles:edit", async (request, context, user) => {
  if (!user.isSuperAdmin) {
    return NextResponse.json(
      { error: "Only the Super Admin can change role permissions." },
      { status: 403 },
    );
  }

  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid role identifier." }, { status: 400 });
    }
    const parsed = roleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid role data.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    await connectToDatabase();
    const role = await Role.findById(id);
    if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
    if (role.isSystem) {
      return NextResponse.json({ error: "System roles cannot be edited." }, { status: 403 });
    }
    role.name = parsed.data.name;
    role.type = parsed.data.type;
    role.permissions = parsed.data.permissions;
    await role.save();
    return NextResponse.json(role);
  } catch (error) {
    return apiError(error);
  }
});

export const DELETE = withAuth("roles:delete", async (_request, context) => {
  try {
    const { id } = await context.params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid role identifier." }, { status: 400 });
    }
    await connectToDatabase();
    const role = await Role.findById(id);
    if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
    if (role.isSystem) {
      return NextResponse.json({ error: "System roles cannot be deleted." }, { status: 403 });
    }
    const assignedUsers = await User.exists({ role: role._id });
    if (assignedUsers) {
      return NextResponse.json(
        { error: "Roles assigned to users cannot be deleted." },
        { status: 409 },
      );
    }
    await role.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
});
