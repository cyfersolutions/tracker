"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppGuard } from "@/context/AppGuard";
import { CampaignSelector, ClientCampaignNav } from "@/components/dashboard/ClientCampaignNav";

export function DashboardNav() {
  const { data: session } = useSession();
  const { can } = useAppGuard();
  const isSuperAdmin = session?.user?.isSuperAdmin === true;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isClient = session?.user?.accountType === "client";
  if (isClient && !searchParams.get("campaign")) return <CampaignSelector headless />;

  function navLink(href: string, label: string) {
    const active =
      href === "/dashboard" ? pathname === href : pathname.startsWith(href);
    return (
      <Link href={href} aria-current={active ? "page" : undefined}>
        {label}
      </Link>
    );
  }

  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="brand">
        <span className="brand-mark">LM</span>
        <span>Lead CMS</span>
      </Link>
      <nav className="primary-nav" aria-label="Main navigation">
        {isClient ? <ClientCampaignNav showSelector={false} /> : navLink("/dashboard", "Overview")}
        {can("campaigns:view") && navLink("/campaigns", "Campaigns")}
        {can("leads:view") && !isClient && navLink("/leads", "Leads")}
        {can("roles:view") && navLink("/roles", "Roles")}
        {can("users:view") && navLink("/clients", "Clients")}
        {can("users:view") && navLink("/users", "Users")}
        {isSuperAdmin && navLink("/settings", "Settings")}
      </nav>
      {!isClient && <div className="sidebar-user">
        <div className="user-avatar">{session?.user?.name?.slice(0, 1) ?? "U"}</div>
        <div className="user-info">
          <strong>{session?.user?.name}</strong>
          <span>{session?.user?.email}</span>
        </div>
        <button className="button button-quiet" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </button>
      </div>}
    </aside>
  );
}
