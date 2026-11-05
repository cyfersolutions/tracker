"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MultiSelect } from "@/components/ui/MultiSelect";

type ClientOption = { _id: string; name: string; email: string };
type CampaignValues = { _id: string; name: string; description: string; isActive: boolean; startDate: string; endDate: string; clientIds: string[] };

export function CampaignForm({ initial, clients = [] }: { initial?: CampaignValues; clients?: ClientOption[] }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [clientIds, setClientIds] = useState(initial?.clientIds ?? []);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch(initial ? `/api/campaigns/${initial._id}` : "/api/campaigns", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, isActive, startDate, endDate, clientIds }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to save campaign.");
        return;
      }
      router.push("/campaigns");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <form className="form-card stack-form" onSubmit={submit}>
    <div className="form-grid">
      <label>Campaign name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label>
      <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} /></label>
      <label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
      <label>End date<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} min={startDate || undefined} required /></label>
      <label>Clients<MultiSelect options={clients.map((client) => ({ value: client._id, label: `${client.name} (${client.email})` }))} value={clientIds} onChange={setClientIds} placeholder="Select clients" /></label>
      {initial && <label className="check-row user-active-check"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />Campaign is active</label>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button button-primary" disabled={pending}>{pending ? "Saving..." : "Save campaign"}</button><button className="button button-secondary" type="button" onClick={() => router.back()}>Cancel</button></div>
  </form>;
}
