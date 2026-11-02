"use client";

import type { ReactNode } from "react";
import { useAppGuard } from "@/context/AppGuard";
import type { Permission } from "@/lib/permissions";

export function PermissionGate({
  require,
  mode = "any",
  fallback = null,
  children,
}: {
  require: Permission | Permission[];
  mode?: "any" | "all";
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, canAny, canAll, isReady } = useAppGuard();
  if (!isReady) return null;
  const permissions = Array.isArray(require) ? require : [require];
  const allowed =
    permissions.length === 1
      ? can(permissions[0])
      : mode === "all"
        ? canAll(permissions)
        : canAny(permissions);
  return allowed ? children : fallback;
}
