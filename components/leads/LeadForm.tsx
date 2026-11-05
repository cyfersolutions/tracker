"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatStatusLabel } from "@/lib/lead-pricing";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/permissions";
import { useAppGuard } from "@/context/AppGuard";
import { fromSquareFeet, toSquareFeet } from "@/lib/roof-size";
import { formatUsd } from "@/lib/lead-pricing";
import { StyledSelect } from "@/components/ui/StyledSelect";

type LeadValues = {
  _id?: string;
  name: string;
  email: string;
  phone: string;
  videoUrl: string;
  address: { street: string; city: string; state: string; country: string; postalCode: string };
  roofSize: number;
  basePrice: number;
  topUps?: Array<{ amount: number }>;
  notes: string;
  status: LeadStatus;
  assignedTo: { _id?: string; id?: string; name?: string } | string | null;
  campaign?: { _id?: string } | string | null;
};

type Assignee = { _id: string; name: string; email: string };
type CampaignOption = { _id: string; name: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatValidationDetails(details: unknown) {
  if (!isRecord(details)) return "";
  const messages: string[] = [];
  if (isRecord(details.fieldErrors)) {
    for (const [field, errors] of Object.entries(details.fieldErrors)) {
      if (Array.isArray(errors)) {
        messages.push(...errors.map((error) => `${field}: ${String(error)}`));
      }
    }
  }
  if (Array.isArray(details.formErrors)) {
    messages.push(...details.formErrors.map(String));
  }
  if (messages.length === 0) {
    for (const [field, message] of Object.entries(details)) {
      if (typeof message === "string") messages.push(`${field}: ${message}`);
    }
  }
  return messages.join(" ");
}

const emptyLead: LeadValues = {
  name: "",
  email: "",
  phone: "",
  videoUrl: "",
  address: { street: "", city: "", state: "", country: "", postalCode: "" },
  roofSize: 0,
  basePrice: 50,
  notes: "",
  status: "WARM",
  assignedTo: null,
  campaign: null,
};

export function LeadForm({
  initial,
  canManagePrice,
  defaultLeadPrice = 50,
  campaigns = [],
}: {
  initial?: LeadValues;
  canManagePrice: boolean;
  defaultLeadPrice?: number;
  campaigns?: CampaignOption[];
}) {
  const router = useRouter();
  const { can } = useAppGuard();
  const canAssign = can("leads:edit");
  const [values, setValues] = useState<LeadValues>(() =>
    initial
      ? {
          ...emptyLead,
          ...initial,
          address: { ...emptyLead.address, ...initial.address },
          basePrice: initial.basePrice ?? defaultLeadPrice,
          topUps: initial.topUps ?? [],
        }
      : { ...emptyLead, basePrice: defaultLeadPrice },
  );
  const [unit, setUnit] = useState<"sqft" | "sqm">("sqft");
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!canAssign) return;
    fetch("/api/leads/assignees")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load assignees.");
        const result = (await response.json()) as { users: Assignee[] };
        setAssignees(result.users);
      })
      .catch(() => setError("Could not load active users for assignment."));
  }, [canAssign]);

  const assignedId =
    typeof values.assignedTo === "string"
      ? values.assignedTo
      : values.assignedTo?._id ?? values.assignedTo?.id ?? "";

  function setField<K extends keyof LeadValues>(key: K, value: LeadValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateAddress(key: keyof LeadValues["address"], value: string) {
    setValues((current) => ({
      ...current,
      address: { ...current.address, [key]: value },
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const { basePrice, ...leadValues } = values;
    const payload = {
      ...leadValues,
      ...(canManagePrice ? { basePrice: Number(basePrice) } : {}),
      roofSize: Number(values.roofSize),
      assignedTo: canAssign ? assignedId || null : null,
      campaign: typeof values.campaign === "string" ? values.campaign || null : values.campaign?._id ?? null,
    };
    try {
      const body = new FormData();
      body.append("lead", JSON.stringify(payload));
      if (videoFile) body.append("video", videoFile);
      const response = await fetch(initial?._id ? `/api/leads/${initial._id}` : "/api/leads", {
        method: initial?._id ? "PUT" : "POST",
        body,
      });
      const result = (await response.json()) as { error?: string; details?: unknown };
      if (!response.ok) {
        setError(
          [result.error, formatValidationDetails(result.details)].filter(Boolean).join(" ") ||
            "Unable to save this lead.",
        );
        return;
      }
      router.push(initial?._id ? `/leads/${initial._id}` : "/leads");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const displayRoofSize = fromSquareFeet(Number(values.roofSize), unit);
  const currentFinalPrice =
    Number(values.basePrice ?? 50) +
    (values.topUps ?? []).reduce((total, topUp) => total + topUp.amount, 0) +
    (initial &&
    initial.status !== "WON" &&
    values.basePrice !== initial.basePrice &&
    (initial.basePrice ?? 50) > 0
      ? initial.basePrice ?? 50
      : 0);

  return (
    <form className="form-card stack-form" onSubmit={submit}>
      <div className="form-grid">
        <label>Full name<input value={values.name} onChange={(e) => setField("name", e.target.value)} required maxLength={160} /></label>
        <label>Campaign
          <StyledSelect
            value={typeof values.campaign === "string" ? values.campaign : values.campaign?._id ?? ""}
            onChange={(value) => setField("campaign", value || null)}
            options={[
              { value: "", label: "None" },
              ...campaigns.map((campaign) => ({ value: campaign._id, label: campaign.name })),
            ]}
          />
        </label>
        <label>Email<input type="email" value={values.email} onChange={(e) => setField("email", e.target.value)} /></label>
        <label>Phone
          <input
            type="tel"
            value={values.phone}
            onChange={(e) => setField("phone", e.target.value)}
            placeholder="+14155552671"
            pattern="^\+[1-9][0-9]{7,14}$"
            title="Use international E.164 format, for example +14155552671."
            maxLength={16}
            required
          />
        </label>
        <label className="span-two">Voice recording
          <input
            type="file"
            onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
            required={!initial?.videoUrl}
          />
          {initial?.videoUrl && !videoFile && (
            <span className="table-subtext">
              Current video is kept unless you choose a replacement.
            </span>
          )}
        </label>
        <label>Status
          <StyledSelect
            value={values.status}
            onChange={(value) => setField("status", value as LeadStatus)}
            disabled={initial?.status === "WON"}
            options={LEAD_STATUSES.filter(
              (status) =>
                status === values.status ||
                (status !== "LOST" && status !== "INSPECTION_AWAITING"),
            ).map((status) => ({ value: status, label: formatStatusLabel(status) }))}
          />
        </label>
        <label className="span-two">Street address<input value={values.address.street} onChange={(e) => updateAddress("street", e.target.value)} required /></label>
        <label>City<input value={values.address.city} onChange={(e) => updateAddress("city", e.target.value)} required /></label>
        <label>State<input value={values.address.state} onChange={(e) => updateAddress("state", e.target.value)} required /></label>
        <label>Country<input value={values.address.country} onChange={(e) => updateAddress("country", e.target.value)} required /></label>
        <label>Postal code<input value={values.address.postalCode} onChange={(e) => updateAddress("postalCode", e.target.value)} required /></label>
        <label>Roof size
          <span className="input-with-select">
            <input type="number" min="0" step="any" value={Number.isFinite(displayRoofSize) ? Number(displayRoofSize.toFixed(2)) : ""} onChange={(e) => setField("roofSize", toSquareFeet(Number(e.target.value), unit))} required />
            <StyledSelect
              ariaLabel="Roof size unit"
              value={unit}
              onChange={(value) => setUnit(value as "sqft" | "sqm")}
              options={[{ value: "sqft", label: "sq ft" }, { value: "sqm", label: "sq m" }]}
            />
          </span>
        </label>
        {canManagePrice && <label>Starting price (USD)
          <input
            type="number"
            min="0"
            max="10000000"
            step="0.01"
            value={values.basePrice ?? 50}
            onChange={(e) => setField("basePrice", Number(e.target.value))}
            readOnly={initial?.status === "WON"}
            required
          />
          {initial?._id && (
            <span className="table-subtext">
              price after this update: {formatUsd(currentFinalPrice)}.
              {initial.status === "WON" ? " Price is locked because this lead is won." : ""}
            </span>
          )}
        </label>}
        {canAssign && <label>Call Transferred To
          <StyledSelect
            value={assignedId}
            onChange={(value) => setField("assignedTo", value || null)}
            required
            options={[
              { value: "", label: "Select an internal user" },
              ...assignees.map((user) => ({ value: user._id, label: `${user.name} (${user.email})` })),
            ]}
          />
        </label>}
        <label className="span-two">Notes<textarea rows={4} maxLength={10000} value={values.notes} onChange={(e) => setField("notes", e.target.value)} /></label>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="button button-primary" disabled={pending}>{pending ? "Saving..." : "Save lead"}</button>
        <button type="button" className="button button-secondary" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}
