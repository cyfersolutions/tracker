"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ROLE_PERMISSIONS, type Permission } from "@/lib/permissions";
import type { RoleType } from "@/lib/role-types";

const groups = [
  { label: "Leads", permissions: ROLE_PERMISSIONS.filter((permission) => permission.startsWith("leads:")) },
  { label: "Roles", permissions: ROLE_PERMISSIONS.filter((permission) => permission.startsWith("roles:")) },
  { label: "Users", permissions: ROLE_PERMISSIONS.filter((permission) => permission.startsWith("users:")) },
];

export function RoleForm({
  initial,
}: {
  initial?: { _id: string; name: string; type: RoleType; permissions: Permission[] };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const type: RoleType = initial?.type ?? "internal";
  const [permissions, setPermissions] = useState<Permission[]>(
    (initial?.permissions ?? []).filter(
      (permission): permission is Permission => permission !== "leads:topup",
    ),
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function toggle(permission: Permission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((value) => value !== permission)
        : [...current, permission],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save();
  }

  async function save() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(initial ? `/api/roles/${initial._id}` : "/api/roles", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, permissions }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to save this role.");
        return;
      }
      router.push("/roles");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-card stack-form" onSubmit={submit}>
      <label>Role name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required readOnly={initial?.name === "Super Admin"} /></label>
      <fieldset className="permission-fieldset">
        <legend>Permissions</legend>
        <p className="muted">
          Choose which actions members of this role may perform. Only the Super Admin can assign these permissions.
        </p>
        <div className="permission-groups">
          {groups.map((group) => (
            <section className="permission-group" key={group.label}>
              <h3>{group.label}</h3>
              {group.permissions.map((permission) => (
                <label className="check-row" key={permission}>
                  <input type="checkbox" checked={permissions.includes(permission)} onChange={() => toggle(permission)} />
                  <span>{permission}</span>
                </label>
              ))}
            </section>
          ))}
        </div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button className="button button-primary" disabled={pending}>{pending ? "Saving..." : "Save role"}</button><button type="button" className="button button-secondary" onClick={() => router.back()}>Cancel</button></div>
    </form>
  );
}
