"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteRoleButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  async function remove() {
    setConfirming(false);
    try {
      const response = await fetch(`/api/roles/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to delete role.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    }
  }
  return <div className="row-actions"><button className="button button-danger" onClick={() => setConfirming(true)}>Delete</button>{error && <span className="form-error" role="alert">{error}</span>}<ConfirmDialog open={confirming} title="Delete this role?" message="This action cannot be undone." confirmLabel="Delete role" onCancel={() => setConfirming(false)} onConfirm={remove} /></div>;
}
