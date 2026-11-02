"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { AppGuardProvider } from "@/context/AppGuard";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AppGuardProvider>{children}</AppGuardProvider>
    </SessionProvider>
  );
}
