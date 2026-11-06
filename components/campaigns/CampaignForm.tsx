"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { CAMPAIGN_TYPES, type CampaignType } from "@/lib/validations/campaign.schema";

type ClientOption = { _id: string; name: string; email: string };
type CampaignValues = {
  _id: string;
  name: string;
  type?: CampaignType;
  description: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  clientIds: string[];
};

export function CampaignForm({ initial, clients = [] }: { initial?: CampaignValues; clients?: ClientOption[] }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<CampaignType>(initial?.type ?? "Roofing");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [clientIds, setClientIds] = useState(initial?.clientIds ?? []);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Campaign name is required.";
    if (!startDate) errs.startDate = "Start date is required.";
    if (!endDate) errs.endDate = "End date is required.";
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      errs.endDate = "End date must be on or after the start date.";
    }
    return errs;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Please fill in all required fields marked below.");
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      const response = await fetch(initial ? `/api/campaigns/${initial._id}` : "/api/campaigns", {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, description, isActive, startDate, endDate, clientIds }),
      });
      const result = (await response.json()) as { error?: string; fieldErrors?: Record<string, string> };
      if (!response.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
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

  return (
    <form className="form-card stack-form" onSubmit={submit} noValidate>
      {Object.keys(fieldErrors).length > 0 && (
        <div className="form-error-banner" role="alert">
          <strong>Please correct the following fields:</strong>
          <ul>
            {Object.entries(fieldErrors).map(([field, msg]) => (
              <li key={field}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
      {error && Object.keys(fieldErrors).length === 0 && (
        <div className="form-error-banner" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="form-grid">
        <label>
          Campaign name
          <input
            className={fieldErrors.name ? "input-error" : ""}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError("name");
            }}
            required
            maxLength={120}
          />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </label>
        <label>
          Campaign type
          <StyledSelect
            value={type}
            onChange={(val) => setType(val as CampaignType)}
            options={CAMPAIGN_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </label>
        <label className="span-two">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
          />
        </label>
        <label>
          Start date
          <input
            className={fieldErrors.startDate ? "input-error" : ""}
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              clearFieldError("startDate");
            }}
            required
          />
          {fieldErrors.startDate && <span className="field-error">{fieldErrors.startDate}</span>}
        </label>
        <label>
          End date
          <input
            className={fieldErrors.endDate ? "input-error" : ""}
            type="date"
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              clearFieldError("endDate");
            }}
            min={startDate || undefined}
            required
          />
          {fieldErrors.endDate && <span className="field-error">{fieldErrors.endDate}</span>}
        </label>
        <label className="span-two">
          Clients
          <MultiSelect
            className={fieldErrors.clientIds ? "input-error" : ""}
            options={clients.map((client) => ({
              value: client._id,
              label: `${client.name} (${client.email})`,
            }))}
            value={clientIds}
            onChange={(val) => {
              setClientIds(val);
              clearFieldError("clientIds");
            }}
            placeholder="Select clients"
          />
          {fieldErrors.clientIds && <span className="field-error">{fieldErrors.clientIds}</span>}
        </label>
        {initial && (
          <label className="check-row user-active-check span-two">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Campaign is active
          </label>
        )}
      </div>
      <div className="form-actions">
        <button className="button button-primary" disabled={pending}>
          {pending ? "Saving..." : "Save campaign"}
        </button>
        <button className="button button-secondary" type="button" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
