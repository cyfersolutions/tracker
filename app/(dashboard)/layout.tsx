import type { ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { requirePermission } from "@/lib/server/permissions";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requirePermission();
  return (
    <div className="app-shell">
      <DashboardNav />
      <main className="main-content">{children}</main>
    </div>
  );
}
