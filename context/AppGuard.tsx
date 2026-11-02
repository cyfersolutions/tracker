"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";

interface AppGuardContextValue {
  isSuperAdmin: boolean;
  permissions: Permission[];
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  isReady: boolean;
}

const AppGuardContext = createContext<AppGuardContextValue | null>(null);

export function AppGuardProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false;
  const permissionSet = new Set(ALL_PERMISSIONS);
  const permissions = (session?.user?.permissions ?? []).filter(
    (permission): permission is Permission => permissionSet.has(permission as Permission),
  );
  const can = (permission: Permission) =>
    isSuperAdmin || permissions.includes(permission);
  const canAny = (required: Permission[]) =>
    isSuperAdmin || required.some((permission) => permissions.includes(permission));
  const canAll = (required: Permission[]) =>
    isSuperAdmin || required.every((permission) => permissions.includes(permission));

  return (
    <AppGuardContext.Provider
      value={{
        isSuperAdmin,
        permissions,
        can,
        canAny,
        canAll,
        isReady: status !== "loading",
      }}
    >
      {children}
    </AppGuardContext.Provider>
  );
}

export function useAppGuard() {
  const context = useContext(AppGuardContext);
  if (!context) throw new Error("useAppGuard must be used inside AppGuardProvider.");
  return context;
}
