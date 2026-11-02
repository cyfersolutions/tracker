import { NextResponse } from "next/server";
import { apiError, withAuth } from "@/lib/api-guards";
import { connectToDatabase } from "@/lib/db/connect";
import Role from "@/models/Role";
import { roleSchema } from "@/lib/validations/role.schema";

export const GET = withAuth("roles:view", async () => {
  try {
    await connectToDatabase();
    const roles = await Role.find().sort({ name: 1 }).lean().exec();
    return NextResponse.json({ roles });
  } catch (error) {
    return apiError(error);
  }
});

export const POST = withAuth("roles:create", async (request, _context, user) => {
  if (!user.isSuperAdmin) {
    return NextResponse.json(
      { error: "Only the Super Admin can create roles and assign permissions." },
      { status: 403 },
    );
  }

  try {
    const parsed = roleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid role data.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    await connectToDatabase();
    const role = await Role.create(parsed.data);
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
});
