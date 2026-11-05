"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  formatStatusLabel,
  formatUsd,
  isApprovableStatus,
  requiresApproval,
  LOST_REASON_MIN_LENGTH,
} from "@/lib/lead-pricing";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/permissions";

export type BoardLead = {
  id: string;
  name: string;
  phone: string;
  location: string;
  campaign: string;
  status: LeadStatus;
  price: number | null;
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; target: LeadStatus } | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [wonLeadId, setWonLeadId] = useState<string | null>(null);

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
        setError("Only clients can mark a lead as won.");
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
        setError("Only clients can approve moving a Warm lead forward.");
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
    setPendingId(id);
    setLeads((current) =>
      current.map((lead) => (lead.id === id ? { ...lead, status: target } : lead)),
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
      router.refresh();
    } catch {
      setLeads(previous);
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      {error && <p className="form-error board-error" role="alert">{error}</p>}
      <div className="board-scroll">
        {LEAD_STATUSES.map((status) => {
          const column = leads.filter((lead) => lead.status === status);
          return (
            <section
              key={status}
              className={`board-column${overColumn === status ? " is-over" : ""}`}
              aria-label={`${formatStatusLabel(status)} leads`}
              onDragOver={(event) => {
                if (dragId) {
                  event.preventDefault();
                  setOverColumn(status);
                }
              }}
              onDragLeave={() => setOverColumn((current) => (current === status ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setOverColumn(null);
                if (dragId) requestMove(dragId, status);
                setDragId(null);
              }}
            >
              <div className="board-column-head">
                <h2>{formatStatusLabel(status)}</h2>
                <span className="board-count">{column.length}</span>
              </div>
              <div className="board-cards">
                {column.map((lead) => {
                  const locked = lead.status === "WON";
                  return (
                    <article
                      key={lead.id}
                      className={`board-card${dragId === lead.id ? " is-dragging" : ""}${locked ? " is-locked" : ""}`}
                      draggable={!locked && canMove && pendingId !== lead.id}
                      onDragStart={() => setDragId(lead.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverColumn(null);
                      }}
                    >
                      <Link href={`/leads/${lead.id}${campaignQuery}`}>{lead.name}</Link>
                      <small>{lead.phone}</small>
                      <small>{lead.location}</small>
                      {lead.campaign && <small>{lead.campaign}</small>}
                      {lead.price !== null && <small>Price: {formatUsd(lead.price)}</small>}
                      {!locked && canMove && (
                        <div className="board-card-actions">
                          {canApprove && isApprovableStatus(lead.status) && (
                            <button
                              type="button"
                              className="button button-primary board-approve"
                              disabled={pendingId === lead.id}
                              onClick={() => requestMove(lead.id, "INSPECTION_AWAITING")}
                            >
                              Accept
                            </button>
                          )}
                          {lead.status !== "LOST" && (
                            <button
                              type="button"
                              className="button button-danger board-approve"
                              disabled={pendingId === lead.id}
                              onClick={() => requestMove(lead.id, "LOST")}
                            >
                              Reject
                            </button>
                          )}
                          <select
                            aria-label={`Move ${lead.name} to another column`}
                            value={lead.status}
                            disabled={pendingId === lead.id}
                            onChange={(event) => requestMove(lead.id, event.target.value as LeadStatus)}
                          >
                            {LEAD_STATUSES.map((option) => (
                              <option key={option} value={option}>{formatStatusLabel(option)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {rejecting !== null && (
        <PromptDialog
          eyebrow="MARK AS LOST"
          title="Why is this lead lost?"
          label="Reason"
          placeholder="e.g. Homeowner is not interested"
          multiline
          maxLength={500}
          submitLabel="Mark as lost"
          danger
          isValid={(value) => value.trim().length >= LOST_REASON_MIN_LENGTH}
          onCancel={() => setRejecting(null)}
          onSubmit={(value) => {
            const id = rejecting;
            setRejecting(null);
            void move(id, "LOST", { reason: value.trim() });
          }}
        />
      )}
      {wonLeadId !== null && (
        <PromptDialog
          eyebrow="MARK AS WON"
          title="Enter the top-up amount"
          description="This amount is added to the lead's price, and the lead is then locked as won."
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
        message={`This moves the lead from Warm to ${confirm ? formatStatusLabel(confirm.target) : ""}. The lead keeps its current price; no extra amount is added.`}
        confirmLabel="Approve"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const pending = confirm;
          setConfirm(null);
          if (pending) void move(pending.id, pending.target);
        }}
      />
    </>
  );
}
