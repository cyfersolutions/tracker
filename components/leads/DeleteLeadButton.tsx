"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteLeadButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    setConfirming(false);
    setPending(true);
    try {
      const response = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to delete this lead.");
        return;
      }
      router.push("/leads");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button className="button button-danger" onClick={() => setConfirming(true)} disabled={pending}>
        {pending ? "Deleting..." : "Delete"}
      </button>
      {error && <span className="form-error" role="alert">{error}</span>}
      <ConfirmDialog
        open={confirming}
        title="Delete this lead?"
        message="This action cannot be undone."
        confirmLabel="Delete lead"
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
      />
    </>
  );
}
