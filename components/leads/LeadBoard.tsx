"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import {
  formatStatusLabel,
  formatUsd,
  isApprovableStatus,
  requiresApproval,
  LOST_REASON_MIN_LENGTH,
} from "@/lib/lead-pricing";
import { LEAD_STATUSES, normalizeLeadStatus, type LeadStatus } from "@/lib/permissions";

export type BoardLead = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  location: string;
  campaign: string;
  status: LeadStatus;
  price: number | null;
  leadType?: "Roofing" | "Trucking";
  mcNumber?: string;
  truckType?: string;
  revenue?: number;
  assignedToName?: string;
  lostReason?: string;
  createdAt?: string | Date;
};

const STATUS_METADATA: Record<LeadStatus, { dot: string; bg: string; border: string }> = {
  WARM: {
    dot: "#d97706",
    bg: "rgba(217, 119, 6, 0.08)",
    border: "rgba(217, 119, 6, 0.3)",
  },
  INSPECTION_AWAITING: {
    dot: "#7c3aed",
    bg: "rgba(124, 58, 237, 0.08)",
    border: "rgba(124, 58, 237, 0.3)",
  },
  CONTRACT_SIGNING: {
    dot: "#0284c7",
    bg: "rgba(2, 132, 199, 0.08)",
    border: "rgba(2, 132, 199, 0.3)",
  },
  WON: {
    dot: "#16a34a",
    bg: "rgba(22, 163, 74, 0.08)",
    border: "rgba(22, 163, 74, 0.3)",
  },
  FOLLOWUP: {
    dot: "#2563eb",
    bg: "rgba(37, 99, 235, 0.08)",
    border: "rgba(37, 99, 235, 0.3)",
  },
  LOST: {
    dot: "#dc2626",
    bg: "rgba(220, 38, 38, 0.08)",
    border: "rgba(220, 38, 38, 0.3)",
  },
};

export function LeadBoard({
  initialLeads,
  canApprove,
  canMove,
  campaignId,
}: {
  initialLeads: BoardLead[];
  canApprove: boolean;
  canMove: boolean;
  campaignId?: string;
}) {
  const campaignQuery = campaignId ? `?campaign=${campaignId}` : "";
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<LeadStatus | null>(null);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; target: LeadStatus } | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [wonLeadId, setWonLeadId] = useState<string | null>(null);

  function triggerToast(message: string) {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 3000);
  }

  function requestMove(id: string, target: LeadStatus) {
    const lead = leads.find((item) => item.id === id);
    if (!canMove || !lead || lead.status === target || lead.status === "WON") return;
    setError("");
    if (target === "LOST") {
      setRejecting(id);
      return;
    }
    if (lead.status === "CONTRACT_SIGNING" && target === "WON") {
      if (!canApprove) {
        setError("Only clients and Super Admins can mark a lead as won.");
        return;
      }
      setWonLeadId(id);
      return;
    }
    if (target === "INSPECTION_AWAITING" && !isApprovableStatus(lead.status)) {
      setError("Only Warm leads can be accepted for inspection.");
      return;
    }
    if (requiresApproval(lead.status, target)) {
      if (!canApprove) {
        setError("Only clients and Super Admins can approve moving a Warm lead forward.");
        return;
      }
      setConfirm({ id, target });
      return;
    }
    void move(id, target);
  }

  async function move(
    id: string,
    target: LeadStatus,
    extra: { reason?: string; topUpAmount?: number } = {},
  ) {
    const previous = leads;
    const targetLead = leads.find((l) => l.id === id);
    setPendingId(id);
    // Optimistic instant update
    setLeads((current) =>
      current.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              status: target,
              ...(extra.reason !== undefined ? { lostReason: extra.reason } : {}),
            }
          : lead,
      ),
    );
    try {
      const response = await fetch(`/api/leads/${id}/status`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target, ...extra }),
      });
      const result = (await response.json()) as { error?: string; finalPrice?: number };
      if (!response.ok) {
        setLeads(previous);
        setError(result.error ?? "Unable to move this lead.");
        return;
      }
      if (typeof result.finalPrice === "number") {
        setLeads((current) =>
          current.map((lead) =>
            lead.id === id ? { ...lead, price: result.finalPrice ?? lead.price } : lead,
          ),
        );
      }
      triggerToast(`Moved ${targetLead?.name || "lead"} to ${formatStatusLabel(target)}.`);
      router.refresh();
    } catch {
      setLeads(previous);
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  const draggingLead = dragId ? leads.find((l) => l.id === dragId) : null;

  return (
    <div className="linear-board-wrap">
      {error && (
        <div className="form-error-banner" role="alert" style={{ marginBottom: "16px" }}>
          <span>{error}</span>
        </div>
      )}
      {successToast && (
        <div className="linear-board-toast" role="status">
          <Icon name="check" size={16} />
          <span>{successToast}</span>
        </div>
      )}

      <div className="linear-board-scroll">
        {LEAD_STATUSES.map((status) => {
          const column = leads.filter((lead) => normalizeLeadStatus(lead.status) === status);
          const meta = STATUS_METADATA[status];
          const isTarget = overColumn === status;
          const canDropHere = draggingLead && draggingLead.status !== status && draggingLead.status !== "WON";

          return (
            <section
              key={status}
              className={`linear-board-column ${isTarget && canDropHere ? "is-over" : ""}`}
              style={{
                "--column-dot": meta.dot,
                "--column-bg": meta.bg,
                "--column-border": meta.border,
              } as React.CSSProperties}
              aria-label={`${formatStatusLabel(status)} leads`}
              onDragOver={(event) => {
                if (dragId && canDropHere) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (overColumn !== status) setOverColumn(status);
                }
              }}
              onDragEnter={(event) => {
                if (dragId && canDropHere) {
                  event.preventDefault();
                  if (overColumn !== status) setOverColumn(status);
                }
              }}
              onDragLeave={(event) => {
                // Only clear if actually leaving the column element
                const related = event.relatedTarget as HTMLElement | null;
                if (!related || !event.currentTarget.contains(related)) {
                  setOverColumn((current) => (current === status ? null : current));
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setOverColumn(null);
                if (dragId && canDropHere) {
                  requestMove(dragId, status);
                }
                setDragId(null);
              }}
            >
              {/* Column Header */}
              <div className="linear-column-head">
                <div className="linear-column-title-group">
                  <span className="linear-column-dot" style={{ background: meta.dot }} />
                  <h2>{formatStatusLabel(status)}</h2>
                </div>
                <span className="linear-column-count">{column.length}</span>
              </div>

              {/* Cards Container */}
              <div className="linear-board-cards">
                {isTarget && canDropHere && (
                  <div className="linear-drop-indicator">
                    <Icon name="plus" size={14} />
                    <span>Drop into {formatStatusLabel(status)}</span>
                  </div>
                )}

                {column.map((lead) => {
                  const locked = lead.status === "WON";
                  const isDragging = dragId === lead.id;
                  const isPending = pendingId === lead.id;

                  return (
                    <article
                      key={lead.id}
                      className={`linear-card ${isDragging ? "is-dragging" : ""} ${locked ? "is-locked" : ""}`}
                      draggable={!locked && canMove && !isPending}
                      onDragStart={(event) => {
                        setDragId(lead.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", lead.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverColumn(null);
                      }}
                    >
                      {/* Top Meta Tags */}
                      <div className="linear-card-tags">
                        {lead.leadType === "Trucking" ? (
                          <span className="linear-tag linear-tag-trucking">
                            <Icon name="truck" size={12} />
                            <span>Trucking</span>
                          </span>
                        ) : (
                          <span className="linear-tag linear-tag-roofing">
                            <Icon name="home" size={12} />
                            <span>Roofing</span>
                          </span>
                        )}

                        {lead.mcNumber && (
                          <span className="linear-tag linear-tag-mc" title={`MC Number: ${lead.mcNumber}`}>
                            {lead.mcNumber}
                          </span>
                        )}

                        {lead.price !== null && (
                          <span className="linear-tag linear-tag-price">
                            {formatUsd(lead.price)}
                          </span>
                        )}

                        {locked && (
                          <span className="linear-tag linear-tag-locked">
                            Won
                          </span>
                        )}
                      </div>

                      {/* Lead Name */}
                      <Link
                        className="linear-card-title"
                        href={`/leads/${lead.id}${campaignQuery}`}
                        title="View lead details"
                      >
                        {lead.name}
                      </Link>

                      {/* Details & Location */}
                      <div className="linear-card-details">
                        {lead.phone && (
                          <div className="linear-card-detail-item">
                            <Icon name="phone" size={12} />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                        {lead.location && (
                          <div className="linear-card-detail-item">
                            <span>📍</span>
                            <span>{lead.location}</span>
                          </div>
                        )}
                        {lead.assignedToName && (
                          <div className="linear-card-detail-item linear-card-assignee">
                            <div className="linear-card-avatar">
                              {lead.assignedToName.charAt(0).toUpperCase()}
                            </div>
                            <span>{lead.assignedToName}</span>
                          </div>
                        )}
                      </div>

                      {/* Lost / Follow-up Reason Comment */}
                      {lead.lostReason && (lead.status === "LOST" || lead.status === "FOLLOWUP") && (
                        <div
                          className={`linear-card-reason ${
                            lead.status === "FOLLOWUP" ? "linear-card-reason-followup" : ""
                          }`}
                        >
                          <Icon name="alert" size={12} />
                          <span title={`Reason: ${lead.lostReason}`}>&ldquo;{lead.lostReason}&rdquo;</span>
                        </div>
                      )}

                      {/* Quick Action Toolbar (Single Clean Row, Never Overflows) */}
                      {!locked && canMove && (
                        <div className="linear-card-actions">
                          {canApprove && isApprovableStatus(lead.status) && (
                            <button
                              type="button"
                              className="linear-action-btn linear-action-accept"
                              disabled={isPending}
                              title="Accept for inspection"
                              onClick={() => requestMove(lead.id, "INSPECTION_AWAITING")}
                            >
                              <Icon name="check" size={13} />
                              <span>Accept</span>
                            </button>
                          )}

                          {lead.status !== "LOST" && (
                            <button
                              type="button"
                              className="linear-action-btn linear-action-reject"
                              disabled={isPending}
                              title="Reject and move to follow up"
                              onClick={() => requestMove(lead.id, "LOST")}
                            >
                              <Icon name="close" size={13} />
                              <span>Reject</span>
                            </button>
                          )}

                          {/* If in LOST: Direct one-click Move to Follow Up */}
                          {lead.status === "LOST" && (
                            <button
                              type="button"
                              className="linear-action-btn linear-action-followup"
                              disabled={isPending}
                              title="Move this lost lead to Follow Up"
                              onClick={() => {
                                if (lead.lostReason) {
                                  void move(lead.id, "FOLLOWUP");
                                } else {
                                  setRejecting(lead.id);
                                }
                              }}
                            >
                              <Icon name="arrowRight" size={13} />
                              <span>Move to Follow Up</span>
                            </button>
                          )}

                          {/* Quick move dropdown for non-Warm, non-Lost stages */}
                          {!isApprovableStatus(lead.status) && lead.status !== "LOST" && (
                            <select
                              className="linear-quick-select"
                              aria-label={`Change status for ${lead.name}`}
                              value={lead.status}
                              disabled={isPending}
                              onChange={(event) => requestMove(lead.id, event.target.value as LeadStatus)}
                            >
                              {LEAD_STATUSES.map((option) => (
                                <option key={option} value={option}>
                                  Move to {formatStatusLabel(option)}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}

                {column.length === 0 && !isTarget && (
                  <div className="linear-empty-column">
                    <span className="linear-empty-dash">No leads in this stage</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {rejecting !== null && (
        <PromptDialog
          eyebrow="LEAD REJECTION & FOLLOW UP"
          title="Why is this lead lost?"
          description="Enter a comment explaining why this lead was lost. It will be moved to Follow Up with this comment recorded."
          label="Comment / Reason"
          placeholder="e.g. Homeowner wants call back next week, or price was too high..."
          multiline
          maxLength={500}
          submitLabel="Move to Follow Up"
          danger
          isValid={(value) => value.trim().length >= LOST_REASON_MIN_LENGTH}
          onCancel={() => setRejecting(null)}
          onSubmit={(value) => {
            const id = rejecting;
            setRejecting(null);
            void move(id, "FOLLOWUP", { reason: value.trim() });
          }}
        />
      )}

      {wonLeadId !== null && (
        <PromptDialog
          eyebrow="MARK AS WON"
          title="Enter the top-up amount"
          description="This amount will be added to the lead's final price, and the lead will be locked as won."
          label="Amount (USD)"
          inputType="number"
          prefix="$"
          min="0.01"
          max="10000000"
          step="0.01"
          placeholder="0.00"
          submitLabel="Add top-up and mark as won"
          isValid={(value) => Number.isFinite(Number(value)) && Number(value) >= 0.01}
          onCancel={() => setWonLeadId(null)}
          onSubmit={(value) => {
            const id = wonLeadId;
            setWonLeadId(null);
            void move(id, "WON", { topUpAmount: Number(value) });
          }}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title="Approve this move?"
        message={`This moves the lead from Warm to ${confirm ? formatStatusLabel(confirm.target) : ""}. The lead keeps its current price.`}
        confirmLabel="Approve"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const pending = confirm;
          setConfirm(null);
          if (pending) void move(pending.id, pending.target);
        }}
      />
    </div>
  );
}
