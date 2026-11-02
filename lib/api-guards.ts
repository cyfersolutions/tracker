import { auth } from "@/auth";
import { getUserWithRole } from "@/lib/db/users";
import type { Permission } from "@/lib/permissions";
import type { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export type AuthUser = NonNullable<Awaited<ReturnType<typeof getUserWithRole>>>;
export type RouteContext = { params: Promise<Record<string, string>> };
type ApiHandler = (
  request: NextRequest,
  context: RouteContext,
  user: AuthUser,
) => Promise<NextResponse>;

export function withAuth(
  requiredPermission: Permission | null,
  handler: ApiHandler,
) {
  return async (
    request: NextRequest,
    context: RouteContext,
  ): Promise<NextResponse> => {
    let session: Session | null;
    try {
      session = await auth();
    } catch (error) {
      return apiError(error);
    }
    const userId = session?.user?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    let user: AuthUser;
    try {
      const currentUser = await getUserWithRole(userId);
      if (!currentUser || !currentUser.isActive || !currentUser.role) {
        return NextResponse.json(
          { error: "Account not found or inactive" },
          { status: 401 },
        );
      }
      user = currentUser;
    } catch (error) {
      return apiError(error);
    }

    if (
      !user.isSuperAdmin &&
      requiredPermission &&
      !user.role.permissions.includes(requiredPermission)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return handler(request, context, user);
  };
}

export function apiError(error: unknown) {
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  ) {
    return NextResponse.json(
      { error: "A record with that value already exists." },
      { status: 409 },
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "CastError"
  ) {
    return NextResponse.json({ error: "Invalid record identifier." }, { status: 400 });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ValidationError"
  ) {
    const validationError = error as {
      errors?: Record<string, { message?: string }>;
    };
    const details = Object.fromEntries(
      Object.entries(validationError.errors ?? {}).map(([path, issue]) => [
        path,
        issue.message ?? "Invalid value.",
      ]),
    );
    return NextResponse.json(
      { error: "Submitted data is invalid.", details },
      { status: 400 },
    );
  }

  console.error("API request failed:", error);
  return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
}
