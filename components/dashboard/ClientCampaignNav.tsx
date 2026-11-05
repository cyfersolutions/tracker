"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Campaign = { id: string; name: string };

export function CampaignSelector({ inline = false }: { inline?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const requestedCampaign = searchParams.get("campaign") ?? "";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetch("/api/client/campaigns")
      .then((response) => response.ok ? response.json() as Promise<{ campaigns: Campaign[] }> : Promise.reject(new Error("Unable to load campaigns.")))
      .then((result) => {
        setCampaigns(result.campaigns);
        const hasRequestedCampaign = requestedCampaign && result.campaigns.some((campaign) => campaign.id === requestedCampaign);
        if (!hasRequestedCampaign && result.campaigns[0]) {
          const params = new URLSearchParams(queryString);
          params.set("campaign", result.campaigns[0].id);
          params.delete("page");
          router.replace(`${pathname}?${params}`);
        }
      })
      .catch(() => setCampaigns([]));
  }, [pathname, queryString, requestedCampaign, router]);

  const selectedCampaign = campaigns.some((campaign) => campaign.id === requestedCampaign)
    ? requestedCampaign
    : "";

  function changeCampaign(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("campaign", value);
    else params.delete("campaign");
    params.delete("page");
    router.push(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  return <div className={inline ? "campaign-selector-inline" : "client-campaign-picker"}>
    {!inline && <label htmlFor="client-campaign">Campaign</label>}
    <select id={inline ? "dashboard-campaign" : "client-campaign"} aria-label="Choose campaign" value={selectedCampaign} onChange={(event) => changeCampaign(event.target.value)}>
      <option value="">Select a campaign</option>
      {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
    </select>
  </div>;
}

export function ClientDashboardControls() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const name = session?.user?.name ?? "Client";
  const email = session?.user?.email ?? "";

  useEffect(() => {
    if (!menuOpen) return;
    function closeMenu(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <div className="client-dashboard-controls">
      <CampaignSelector inline />
      <div className="client-account-menu" ref={menuRef}>
        <button
          className="client-account-trigger"
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="user-avatar">{name.slice(0, 1).toUpperCase()}</span>
          <span className="client-account-name">{name}</span>
        </button>
        {menuOpen && (
          <div className="client-account-dropdown" role="menu">
            <div className="client-account-details">
              <strong>{name}</strong>
              <span>{email}</span>
            </div>
            <button
              className="client-sign-out"
              type="button"
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientCampaignNav({ showSelector = true }: { showSelector?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCampaign = searchParams.get("campaign") ?? "";

  if (!showSelector && !selectedCampaign) return null;

  return (
    <div className="client-campaign-nav">
      {showSelector && <CampaignSelector />}
      {selectedCampaign && (
        <div className="client-campaign-links">
          <Link href={`/dashboard?campaign=${encodeURIComponent(selectedCampaign)}`} aria-current={pathname === "/dashboard" ? "page" : undefined}>
            Overview
          </Link>
          <Link className="client-leads-link" href={`/leads?campaign=${encodeURIComponent(selectedCampaign)}`} aria-current={pathname.startsWith("/leads") ? "page" : undefined}>
            Leads
          </Link>
        </div>
      )}
    </div>
  );
}
