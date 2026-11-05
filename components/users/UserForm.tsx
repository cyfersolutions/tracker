"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
type RoleOption = { _id: string; name: string };
type UserValues = { _id: string; name: string; email: string; roleId?: string; campaignIds?: string[]; isActive: boolean };
type CampaignOption = { _id: string; name: string };

export function UserForm({
  roles,
  initial,
  accountType = "internal",
  campaigns = [],
}: {
  roles: RoleOption[];
  initial?: UserValues;
  accountType?: "internal" | "client";
  campaigns?: CampaignOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [roleId, setRoleId] = useState(initial?.roleId ?? "");
  const [campaignIds, setCampaignIds] = useState<string[]>(initial?.campaignIds ?? []);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const payload = initial
      ? { name, email, ...(accountType === "internal" && initial.roleId ? { roleId: initial.roleId } : {}), ...(accountType === "client" ? { campaignIds } : {}), isActive, ...(password ? { password } : {}) }
      : { name, email, ...(accountType === "internal" ? { roleId } : {}), ...(accountType === "client" ? { campaignIds } : {}), password };
    const apiBase = `/api/users?type=${accountType}`;
    const endpoint = initial
      ? `/api/users/${initial._id}?type=${accountType}`
      : apiBase;
    try {
      const response = await fetch(endpoint, {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to save this user.");
        return;
      }
      router.push(accountType === "client" ? "/clients" : "/users");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-card stack-form" onSubmit={submit}>
      <div className="form-grid">
        <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        {accountType !== "client" && (
          <label>Role<StyledSelect value={roleId} onChange={setRoleId} required options={[{ value: "", label: "Select a role" }, ...roles.map((role) => ({ value: role._id, label: role.name }))]} /></label>
        )}
        {accountType === "client" && <label>Campaigns<MultiSelect options={campaigns.map((campaign) => ({ value: campaign._id, label: campaign.name }))} value={campaignIds} onChange={setCampaignIds} placeholder="Select campaigns" /></label>}
        <label>{initial ? "New password (optional)" : "Password"}
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required={!initial} minLength={12} maxLength={128} placeholder={initial ? "Leave blank to keep current password" : "At least 12 characters"} />
        </label>
        {initial && <label className="check-row user-active-check"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />Account is active</label>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="button button-primary" disabled={pending}>{pending ? "Saving..." : "Save user"}</button><button className="button button-secondary" type="button" onClick={() => router.back()}>Cancel</button></div>
    </form>
  );
}
