"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteUserButton({
  id,
  accountType = "internal",
}: {
  id: string;
  accountType?: "internal" | "client";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function remove() {
    if (!window.confirm("Delete this user?")) return;
    try {
      const response = await fetch(`/api/users/${id}?type=${accountType}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to delete user.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    }
  }
  return <div className="row-actions"><button className="button button-danger" onClick={remove}>Delete</button>{error && <span className="form-error" role="alert">{error}</span>}</div>;
}
