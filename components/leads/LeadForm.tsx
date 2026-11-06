"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatStatusLabel } from "@/lib/lead-pricing";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/permissions";
import { useAppGuard } from "@/context/AppGuard";
import { fromSquareFeet, toSquareFeet } from "@/lib/roof-size";
import { formatUsd } from "@/lib/lead-pricing";
import { StyledSelect } from "@/components/ui/StyledSelect";

type DocumentItem = { _id?: string; name: string; url: string; size?: number };

type LeadValues = {
  _id?: string;
  leadType?: "Roofing" | "Trucking";
  name: string;
  email: string;
  phone: string;
  videoUrl: string;
  address: { street: string; city: string; state: string; country: string; postalCode: string };
  roofSize: number;
  mcNumber?: string;
  truckType?: string;
  trucks?: number;
  revenue?: number;
  otr?: "Yes" | "No";
  documents?: DocumentItem[];
  basePrice: number;
  topUps?: Array<{ amount: number }>;
  notes: string;
  status: LeadStatus;
  assignedTo: { _id?: string; id?: string; name?: string } | string | null;
  campaign?: { _id?: string; name?: string; type?: "Roofing" | "Trucking" } | string | null;
};

type ClientOption = { _id: string; name: string; email: string };
type CampaignOption = {
  _id: string;
  name: string;
  type?: "Roofing" | "Trucking";
  clients?: ClientOption[];
};

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
  leadType: "Roofing",
  name: "",
  email: "",
  phone: "",
  videoUrl: "",
  address: { street: "", city: "", state: "", country: "", postalCode: "" },
  roofSize: 0,
  mcNumber: "",
  truckType: "",
  trucks: 0,
  revenue: 0,
  otr: "Yes",
  documents: [],
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
  allClients = [],
}: {
  initial?: LeadValues;
  canManagePrice: boolean;
  defaultLeadPrice?: number;
  campaigns?: CampaignOption[];
  allClients?: ClientOption[];
}) {
  const router = useRouter();
  const { can } = useAppGuard();
  const canAssign = can("leads:edit") || can("leads:create");
  const [values, setValues] = useState<LeadValues>(() =>
    initial
      ? {
          ...emptyLead,
          ...initial,
          address: { ...emptyLead.address, ...initial.address },
          basePrice: initial.basePrice ?? defaultLeadPrice,
          topUps: initial.topUps ?? [],
          documents: initial.documents ?? [],
        }
      : { ...emptyLead, basePrice: defaultLeadPrice },
  );
  const [unit, setUnit] = useState<"sqft" | "sqm">("sqft");
  const [assignees, setAssignees] = useState<ClientOption[]>(allClients);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [existingDocs, setExistingDocs] = useState<DocumentItem[]>(initial?.documents ?? []);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const assignedId =
    typeof values.assignedTo === "string"
      ? values.assignedTo
      : values.assignedTo?._id ?? values.assignedTo?.id ?? "";

  const selectedCampaignId =
    typeof values.campaign === "string" ? values.campaign : values.campaign?._id ?? "";
  const selectedCampaign = campaigns.find((c) => c._id === selectedCampaignId);
  const currentLeadType: "Roofing" | "Trucking" =
    selectedCampaign?.type ?? values.leadType ?? (initial?.leadType ?? "Roofing");
  const isTrucking = currentLeadType === "Trucking";

  const campaignClients = selectedCampaign?.clients;
  const activeClientOptions: ClientOption[] =
    campaignClients !== undefined
      ? campaignClients
      : assignees;

  useEffect(() => {
    if (!canAssign) return;
    if (selectedCampaign?.clients !== undefined) {
      return;
    }
    const query = selectedCampaignId ? `?campaign=${selectedCampaignId}` : "";
    fetch(`/api/leads/assignees${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load clients.");
        const result = (await response.json()) as { users: ClientOption[] };
        setAssignees(result.users);
      })
      .catch(() => setError("Could not load clients for assignment."));
  }, [canAssign, selectedCampaignId, selectedCampaign?.clients]);

  function clearFieldError(field: string) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function setField<K extends keyof LeadValues>(key: K, value: LeadValues[K]) {
    clearFieldError(key as string);
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleCampaignChange(newCampaignId: string) {
    clearFieldError("campaign");
    const matched = campaigns.find((c) => c._id === newCampaignId);
    setValues((current) => {
      const currentAssignedId =
        typeof current.assignedTo === "string"
          ? current.assignedTo
          : current.assignedTo?._id ?? current.assignedTo?.id ?? "";
      const validClients = matched?.clients;
      const isStillValid = validClients ? validClients.some((c) => c._id === currentAssignedId) : false;
      return {
        ...current,
        campaign: newCampaignId || null,
        leadType: matched?.type ?? current.leadType ?? "Roofing",
        assignedTo: isStillValid ? current.assignedTo : null,
      };
    });
  }

  function updateAddress(key: keyof LeadValues["address"], value: string) {
    clearFieldError(`address.${key}`);
    setValues((current) => ({
      ...current,
      address: { ...current.address, [key]: value },
    }));
  }

  function validateLeadForm(): Record<string, string> {
    const errs: Record<string, string> = {};

    // Common phone check
    if (!values.phone || !values.phone.trim()) {
      errs.phone = "Phone number is required.";
    } else if (!/^\+[1-9]\d{7,14}$/.test(values.phone.trim())) {
      errs.phone = "Enter an international phone number in E.164 format, e.g. +14155552671.";
    }

    // Email check (optional, but validate format if present)
    if (values.email && values.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        errs.email = "Enter a valid email address.";
      }
    }

    // Call Transferred To check
    if (canAssign && !assignedId) {
      errs.assignedTo = "Please select a client to transfer the call to.";
    }

    if (isTrucking) {
      if (!values.name || !values.name.trim()) {
        errs.name = "Trucker name is required.";
      }
      if (!values.mcNumber || !values.mcNumber.trim()) {
        errs.mcNumber = "MC Number is required for Trucking leads.";
      }
      if (!values.address.state || !values.address.state.trim()) {
        errs["address.state"] = "State is required.";
      }
    } else {
      // Roofing
      if (!values.name || !values.name.trim()) {
        errs.name = "Full name is required.";
      }
      if (!values.address.street || !values.address.street.trim()) {
        errs["address.street"] = "Street address is required.";
      }
      if (!values.address.city || !values.address.city.trim()) {
        errs["address.city"] = "City is required.";
      }
      if (!values.address.state || !values.address.state.trim()) {
        errs["address.state"] = "State is required.";
      }
      if (!values.address.country || !values.address.country.trim()) {
        errs["address.country"] = "Country is required.";
      }
      if (!values.address.postalCode || !values.address.postalCode.trim()) {
        errs["address.postalCode"] = "Postal code is required.";
      }
      if (!initial?.videoUrl && !videoFile) {
        errs.videoUrl = "A voice recording is required for Roofing leads.";
      }
      if (values.roofSize === undefined || isNaN(Number(values.roofSize)) || Number(values.roofSize) < 0) {
        errs.roofSize = "Roof size must be a non-negative number.";
      }
    }

    return errs;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const validationErrors = validateLeadForm();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Please fill in all required fields marked below.");
      return;
    }
    setFieldErrors({});
    setPending(true);
    const { basePrice, ...leadValues } = values;
    const payload = {
      ...leadValues,
      leadType: currentLeadType,
      ...(canManagePrice ? { basePrice: Number(basePrice) } : {}),
      roofSize: isTrucking ? 0 : Number(values.roofSize),
      address: isTrucking
        ? {
            street: "",
            city: "",
            state: values.address.state,
            country: "",
            postalCode: "",
          }
        : values.address,
      ...(isTrucking
        ? {
            mcNumber: values.mcNumber ?? "",
            truckType: values.truckType ?? "",
            trucks: Number(values.trucks) || 0,
            revenue: Number(values.revenue) || 0,
            otr: values.otr ?? "Yes",
            documents: existingDocs,
          }
        : {}),
      assignedTo: canAssign ? assignedId || null : null,
      campaign: selectedCampaignId || null,
    };
    try {
      const body = new FormData();
      body.append("lead", JSON.stringify(payload));
      if (!isTrucking && videoFile) body.append("video", videoFile);
      if (isTrucking) {
        for (const file of docFiles) {
          body.append("documents", file);
        }
      }
      const response = await fetch(initial?._id ? `/api/leads/${initial._id}` : "/api/leads", {
        method: initial?._id ? "PUT" : "POST",
        body,
      });
      const result = (await response.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
        details?: { fieldErrors?: Record<string, string[]> };
      };
      if (!response.ok) {
        const serverFieldErrors: Record<string, string> = { ...result.fieldErrors };
        if (result.details?.fieldErrors) {
          for (const [key, msgs] of Object.entries(result.details.fieldErrors)) {
            if (msgs && msgs.length > 0 && !serverFieldErrors[key]) {
              serverFieldErrors[key] = msgs[0];
            }
          }
        }
        if (Object.keys(serverFieldErrors).length > 0) {
          setFieldErrors(serverFieldErrors);
        }
        setError(
          result.error ||
          formatValidationDetails(result.details) ||
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
          Campaign
          <StyledSelect
            className={fieldErrors.campaign ? "input-error" : ""}
            value={selectedCampaignId}
            onChange={handleCampaignChange}
            options={[
              { value: "", label: "None" },
              ...campaigns.map((campaign) => ({
                value: campaign._id,
                label: `${campaign.name} (${campaign.type || "Roofing"})`,
              })),
            ]}
          />
          {fieldErrors.campaign && <span className="field-error">{fieldErrors.campaign}</span>}
          {selectedCampaign && (
            <span className="table-subtext">
              Campaign type: <strong>{currentLeadType}</strong>
            </span>
          )}
        </label>

        {!selectedCampaignId && (
          <label>
            Lead type
            <StyledSelect
              value={currentLeadType}
              onChange={(value) => setField("leadType", value as "Roofing" | "Trucking")}
              options={[
                { value: "Roofing", label: "Roofing" },
                { value: "Trucking", label: "Trucking" },
              ]}
            />
          </label>
        )}

        {isTrucking ? (
          <>
            <label>
              Trucker Name
              <input
                className={fieldErrors.name ? "input-error" : ""}
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
                required
                maxLength={160}
                placeholder="e.g. John Doe / Fleet Owner"
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </label>
            <label>
              MC NO <span style={{ color: "var(--red)", fontWeight: "bold" }}>* (Important)</span>
              <input
                className={fieldErrors.mcNumber ? "input-error" : ""}
                value={values.mcNumber ?? ""}
                onChange={(e) => setField("mcNumber", e.target.value)}
                required
                maxLength={60}
                placeholder="e.g. MC-123456"
              />
              {fieldErrors.mcNumber && <span className="field-error">{fieldErrors.mcNumber}</span>}
            </label>
            <label>
              Number (Phone)
              <input
                type="tel"
                className={fieldErrors.phone ? "input-error" : ""}
                value={values.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="+14155552671"
                maxLength={16}
                required
              />
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
            </label>
            <label>
              Email
              <input
                type="email"
                className={fieldErrors.email ? "input-error" : ""}
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="trucker@example.com"
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </label>
            <label>
              State
              <input
                className={fieldErrors["address.state"] ? "input-error" : ""}
                value={values.address.state}
                onChange={(e) => updateAddress("state", e.target.value)}
                required
                maxLength={120}
                placeholder="e.g. Texas or TX"
              />
              {fieldErrors["address.state"] && <span className="field-error">{fieldErrors["address.state"]}</span>}
            </label>
            <label>
              OTR (Over The Road)
              <StyledSelect
                value={values.otr ?? "Yes"}
                onChange={(value) => setField("otr", value as "Yes" | "No")}
                options={[
                  { value: "Yes", label: "Yes" },
                  { value: "No", label: "No" },
                ]}
              />
            </label>
            <label>
              Truck Type
              <input
                className={fieldErrors.truckType ? "input-error" : ""}
                value={values.truckType ?? ""}
                onChange={(e) => setField("truckType", e.target.value)}
                placeholder="e.g. Semi, Dry Van, Flatbed, Reefer"
                maxLength={120}
              />
              {fieldErrors.truckType && <span className="field-error">{fieldErrors.truckType}</span>}
            </label>
            <label>
              Trucks (Quantity)
              <input
                type="number"
                min="0"
                step="1"
                className={fieldErrors.trucks ? "input-error" : ""}
                value={values.trucks || ""}
                onChange={(e) => setField("trucks", e.target.value === "" ? 0 : Number(e.target.value))}
                placeholder="e.g. 5"
              />
              {fieldErrors.trucks && <span className="field-error">{fieldErrors.trucks}</span>}
            </label>
            <label>
              Revenue (USD)
              <input
                type="number"
                min="0"
                step="any"
                className={fieldErrors.revenue ? "input-error" : ""}
                value={values.revenue || ""}
                onChange={(e) => setField("revenue", e.target.value === "" ? 0 : Number(e.target.value))}
                placeholder="e.g. 150000"
              />
              {fieldErrors.revenue && <span className="field-error">{fieldErrors.revenue}</span>}
            </label>
            <label>
              Status
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
          </>
        ) : (
          <>
            <label>
              Full name
              <input
                className={fieldErrors.name ? "input-error" : ""}
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
                required
                maxLength={160}
              />
              {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
            </label>
            <label>
              Email
              <input
                type="email"
                className={fieldErrors.email ? "input-error" : ""}
                value={values.email}
                onChange={(e) => setField("email", e.target.value)}
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </label>
            <label>
              Phone
              <input
                type="tel"
                className={fieldErrors.phone ? "input-error" : ""}
                value={values.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="+14155552671"
                maxLength={16}
                required
              />
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
            </label>
            <label>
              Status
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
            <label className="span-two">
              Street address
              <input
                className={fieldErrors["address.street"] ? "input-error" : ""}
                value={values.address.street}
                onChange={(e) => updateAddress("street", e.target.value)}
                required
              />
              {fieldErrors["address.street"] && <span className="field-error">{fieldErrors["address.street"]}</span>}
            </label>
            <label>
              City
              <input
                className={fieldErrors["address.city"] ? "input-error" : ""}
                value={values.address.city}
                onChange={(e) => updateAddress("city", e.target.value)}
                required
              />
              {fieldErrors["address.city"] && <span className="field-error">{fieldErrors["address.city"]}</span>}
            </label>
            <label>
              State
              <input
                className={fieldErrors["address.state"] ? "input-error" : ""}
                value={values.address.state}
                onChange={(e) => updateAddress("state", e.target.value)}
                required
              />
              {fieldErrors["address.state"] && <span className="field-error">{fieldErrors["address.state"]}</span>}
            </label>
            <label>
              Country
              <input
                className={fieldErrors["address.country"] ? "input-error" : ""}
                value={values.address.country}
                onChange={(e) => updateAddress("country", e.target.value)}
                required
              />
              {fieldErrors["address.country"] && <span className="field-error">{fieldErrors["address.country"]}</span>}
            </label>
            <label>
              Postal code
              <input
                className={fieldErrors["address.postalCode"] ? "input-error" : ""}
                value={values.address.postalCode}
                onChange={(e) => updateAddress("postalCode", e.target.value)}
                required
              />
              {fieldErrors["address.postalCode"] && <span className="field-error">{fieldErrors["address.postalCode"]}</span>}
            </label>
            <label>
              Roof size
              <span className="input-with-select">
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={fieldErrors.roofSize ? "input-error" : ""}
                  value={Number.isFinite(displayRoofSize) ? Number(displayRoofSize.toFixed(2)) : ""}
                  onChange={(e) => {
                    clearFieldError("roofSize");
                    setField("roofSize", toSquareFeet(Number(e.target.value), unit));
                  }}
                  required
                />
                <StyledSelect
                  ariaLabel="Roof size unit"
                  value={unit}
                  onChange={(value) => setUnit(value as "sqft" | "sqm")}
                  options={[
                    { value: "sqft", label: "sq ft" },
                    { value: "sqm", label: "sq m" },
                  ]}
                />
              </span>
              {fieldErrors.roofSize && <span className="field-error">{fieldErrors.roofSize}</span>}
            </label>
          </>
        )}

        {isTrucking ? (
          <div className="span-two">
            <label>
              Documents (Upload multiple files)
              <input
                type="file"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length > 0) {
                    setDocFiles((prev) => [...prev, ...files]);
                  }
                }}
              />
            </label>
            {docFiles.length > 0 && (
              <div style={{ marginTop: "8px" }}>
                <span className="table-subtext" style={{ fontWeight: 600 }}>Files ready to upload:</span>
                <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", display: "grid", gap: "6px" }}>
                  {docFiles.map((f, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "var(--surface-strong)",
                        border: "1px solid var(--line)",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    >
                      <span>📄 {f.name} ({Math.round(f.size / 1024)} KB)</span>
                      <button
                        type="button"
                        className="text-link"
                        style={{ color: "var(--red)", cursor: "pointer", border: "none", background: "none", padding: 0 }}
                        onClick={() => setDocFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {existingDocs.length > 0 && (
              <div style={{ marginTop: "8px" }}>
                <span className="table-subtext" style={{ fontWeight: 600 }}>Existing documents:</span>
                <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", display: "grid", gap: "6px" }}>
                  {existingDocs.map((doc, i) => (
                    <li
                      key={doc._id || i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "var(--surface-strong)",
                        border: "1px solid var(--line)",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    >
                      <a className="text-link" href={doc.url} target="_blank" rel="noopener noreferrer">
                        📄 {doc.name}
                      </a>
                      <button
                        type="button"
                        className="text-link"
                        style={{ color: "var(--red)", cursor: "pointer", border: "none", background: "none", padding: 0 }}
                        onClick={() => setExistingDocs((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="span-two">
            <label>
              Voice recording (Audio)
              <input
                type="file"
                accept="audio/*,video/*"
                className={fieldErrors.videoUrl ? "input-error" : ""}
                onChange={(event) => {
                  clearFieldError("videoUrl");
                  setVideoFile(event.target.files?.[0] ?? null);
                }}
                required={!initial?.videoUrl}
              />
              {fieldErrors.videoUrl && <span className="field-error">{fieldErrors.videoUrl}</span>}
            </label>
            {initial?.videoUrl && !videoFile && (
              <div style={{ marginTop: "6px" }}>
                <span className="table-subtext">Current audio recording:</span>
                <audio controls preload="metadata" src={initial.videoUrl} style={{ width: "100%", maxWidth: "420px", marginTop: "4px" }}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}
          </div>
        )}

        {canManagePrice && (
          <label>
            Starting price (USD)
            <input
              type="number"
              min="0"
              max="10000000"
              step="0.01"
              className={fieldErrors.basePrice ? "input-error" : ""}
              value={values.basePrice ?? 50}
              onChange={(e) => {
                clearFieldError("basePrice");
                setField("basePrice", Number(e.target.value));
              }}
              readOnly={initial?.status === "WON"}
              required
            />
            {fieldErrors.basePrice && <span className="field-error">{fieldErrors.basePrice}</span>}
            {initial?._id && (
              <span className="table-subtext">
                price after this update: {formatUsd(currentFinalPrice)}.
                {initial.status === "WON" ? " Price is locked because this lead is won." : ""}
              </span>
            )}
          </label>
        )}

        {canAssign && (
          <label>
            Call Transferred To
            <StyledSelect
              className={fieldErrors.assignedTo ? "input-error" : ""}
              value={assignedId}
              onChange={(value) => {
                clearFieldError("assignedTo");
                setField("assignedTo", value || null);
              }}
              required
              options={[
                {
                  value: "",
                  label: selectedCampaignId
                    ? activeClientOptions.length === 0
                      ? "No clients assigned to this campaign"
                      : "Select a client from this campaign"
                    : "Select a client",
                },
                ...activeClientOptions.map((user) => ({
                  value: user._id,
                  label: `${user.name} (${user.email})`,
                })),
              ]}
            />
            {fieldErrors.assignedTo && <span className="field-error">{fieldErrors.assignedTo}</span>}
            {selectedCampaignId && activeClientOptions.length === 0 && (
              <span className="table-subtext" style={{ color: "var(--red)" }}>
                This campaign has no clients assigned. Please assign a client to the campaign first.
              </span>
            )}
          </label>
        )}

        <label className="span-two">
          Notes
          <textarea
            rows={4}
            maxLength={10000}
            value={values.notes}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </label>
      </div>
      <div className="form-actions">
        <button className="button button-primary" disabled={pending}>
          {pending ? "Saving..." : "Save lead"}
        </button>
        <button type="button" className="button button-secondary" onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
