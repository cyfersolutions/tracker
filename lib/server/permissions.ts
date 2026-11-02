import { auth } from "@/auth";
import { getUserWithRole } from "@/lib/db/users";
import type { Permission } from "@/lib/permissions";
import { redirect } from "next/navigation";

export async function requirePermission(permission?: Permission) {
  const session = await auth();
  if (!session?.user?.userId) redirect("/login");

  const user = await getUserWithRole(session.user.userId);
  if (!user || !user.isActive || !user.role) redirect("/login");
  if (
    permission &&
    !user.isSuperAdmin &&
    !user.role.permissions.includes(permission)
  ) {
    redirect("/dashboard?error=forbidden");
  }
  return user;
}
