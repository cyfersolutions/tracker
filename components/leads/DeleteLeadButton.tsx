"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteLeadButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!window.confirm("Delete this lead? This action cannot be undone.")) return;
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
      <button className="button button-danger" onClick={remove} disabled={pending}>
        {pending ? "Deleting..." : "Delete"}
      </button>
      {error && <span className="form-error" role="alert">{error}</span>}
    </>
  );
}
