"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAppGuard } from "@/context/AppGuard";
import { CampaignSelector, ClientCampaignNav } from "@/components/dashboard/ClientCampaignNav";
import { BrandLogo, BrandMark } from "@/components/ui/BrandLogo";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function DashboardNav() {
  const { data: session } = useSession();
  const { can } = useAppGuard();
  const isSuperAdmin = session?.user?.isSuperAdmin === true;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isClient = session?.user?.accountType === "client";
  // The drawer is "open" only for the path it was opened on, so navigating closes it.
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const drawerOpen = openOnPath === pathname;

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenOnPath(null);
    }
    document.addEventListener("keydown", onKey);
    document.body.classList.add("drawer-locked");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("drawer-locked");
    };
  }, [drawerOpen]);

  function navLink(href: string, label: string, icon: IconName, exact = false) {
    const active =
      exact || href === "/dashboard"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link href={href} aria-current={active ? "page" : undefined}>
        <Icon name={icon} size={17} />
        <span>{label}</span>
      </Link>
    );
  }

  const adminLinks: ReactNode[] = [
    can("campaigns:view") && <li key="campaigns">{navLink("/campaigns", "Campaigns", "campaign")}</li>,
    can("users:view") && <li key="clients">{navLink("/clients", "Clients", "clients")}</li>,
    can("users:view") && <li key="users">{navLink("/users", "Users", "users")}</li>,
    can("roles:view") && <li key="roles">{navLink("/roles", "Roles", "roles")}</li>,
    isSuperAdmin && <li key="settings">{navLink("/settings", "Settings", "settings")}</li>,
  ].filter(Boolean);

  const name = session?.user?.name ?? "User";
  const email = session?.user?.email ?? "";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <header className="mobile-topbar">
        <button
          type="button"
          className="icon-button"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="app-sidebar"
          onClick={() => setOpenOnPath(pathname)}
        >
          <Icon name="menu" size={20} />
        </button>
        <Link href="/dashboard" className="mobile-brand" aria-label="Cyfer Lead CMS home">
          <BrandMark size={30} />
          <span>Lead CMS</span>
        </Link>
        <ThemeToggle compact />
      </header>

      {drawerOpen && <div className="sidebar-scrim" onClick={() => setOpenOnPath(null)} aria-hidden="true" />}

      <aside id="app-sidebar" className={`sidebar${drawerOpen ? " is-open" : ""}`} aria-label="Sidebar">
        <div className="sidebar-head">
          <Link href="/dashboard" className="brand" aria-label="Cyfer Lead CMS home">
            <BrandLogo priority />
          </Link>
          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => setOpenOnPath(null)}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <span className="sidebar-product">Lead Management</span>

        <nav className="primary-nav" aria-label="Main navigation">
          <p className="nav-section-label">Workspace</p>
          {isClient ? (
            <ClientCampaignNav showSelector={false} />
          ) : (
            <ul>
              <li>{navLink("/dashboard", "Overview", "dashboard")}</li>
              {can("leads:view") && <li>{navLink("/leads", "Leads", "leads")}</li>}
            </ul>
          )}
          {isClient && can("campaigns:view") && (
            <ul>
              <li>{navLink("/campaigns", "Campaigns", "campaign")}</li>
            </ul>
          )}
          {!isClient && adminLinks.length > 0 && (
            <>
              <p className="nav-section-label">Administration</p>
              <ul>{adminLinks}</ul>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />
          {!isClient && (
            <div className="sidebar-user">
              <div className="user-avatar" aria-hidden="true">{initials || "U"}</div>
              <div className="user-info">
                <strong>{name}</strong>
                <span>{email}</span>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <Icon name="logout" size={17} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
