"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function SettingsForm({ defaultLeadPrice }: { defaultLeadPrice: number }) {
  const router = useRouter();
  const [price, setPrice] = useState(String(defaultLeadPrice));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultLeadPrice: Number(price) }),
      });
      const result = (await response.json()) as { error?: string; updatedLeads?: number };
      if (!response.ok) {
        setError(result.error ?? "Unable to save settings.");
        return;
      }
      setSaved(
        result.updatedLeads === undefined
          ? "Settings saved."
          : `Settings saved. Updated ${result.updatedLeads} open lead${result.updatedLeads === 1 ? "" : "s"}.`,
      );
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-card stack-form" onSubmit={submit}>
      <label>
        Default lead price (USD)
        <input type="number" min="0" max="10000000" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required />
        <span className="table-subtext">This updates all open leads and applies to new leads. Won leads remain unchanged. Existing top-ups are preserved.</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {saved && <p className="form-success" role="status">{saved}</p>}
      <div className="form-actions">
        <button className="button button-primary" disabled={pending}>{pending ? "Saving..." : "Save settings"}</button>
      </div>
    </form>
  );
}
