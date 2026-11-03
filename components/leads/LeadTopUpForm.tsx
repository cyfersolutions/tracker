"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatUsd } from "@/lib/lead-pricing";

export function LeadTopUpForm({
  leadId,
  currentPrice,
  canSeeFinalPrice,
}: {
  leadId: string;
  currentPrice: number;
  canSeeFinalPrice: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [updatedPrice, setUpdatedPrice] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess(false);
    try {
      const response = await fetch(`/api/leads/${leadId}/topups`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), description }),
      });
      const result = (await response.json()) as { error?: string; finalPrice?: number };
      if (!response.ok) {
        setError(result.error ?? "Unable to add this price top-up.");
        return;
      }
      setAmount("");
      setDescription("");
      setSuccess(true);
      if (typeof result.finalPrice === "number" && Number.isFinite(result.finalPrice)) {
        setUpdatedPrice(result.finalPrice);
      }
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="topup-form" onSubmit={submit}>
      <h3>Add price top-up</h3>
      {canSeeFinalPrice && (
        <p className="muted">Current final price: {formatUsd(updatedPrice ?? currentPrice)}</p>
      )}
      <div className="topup-fields">
        <label>
          Description
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. Inspection completed"
            minLength={3}
            maxLength={500}
            required
          />
        </label>
        <label>
          Amount (USD)
          <input
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            min="0.01"
            max="10000000"
            step="0.01"
            required
          />
        </label>
        <button className="button button-primary" disabled={pending}>
          {pending ? "Adding..." : "Add top-up"}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {updatedPrice !== null ? (
        <p className="muted" role="status" aria-live="polite">
          Top-up added. New price: {formatUsd(updatedPrice)}.
        </p>
      ) : null}
      {success && !canSeeFinalPrice && (
        <p className="muted" role="status" aria-live="polite">Top-up added.</p>
      )}
    </form>
  );
}
