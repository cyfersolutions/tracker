"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PromptDialogProps = {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  inputType?: "text" | "number";
  min?: string;
  max?: string;
  step?: string;
  prefix?: string;
  maxLength?: number;
  submitLabel: string;
  danger?: boolean;
  error?: string;
  pending?: boolean;
  isValid: (value: string) => boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

// Styles are inline on purpose: the dialog must look identical wherever it is
// opened, regardless of global CSS (inputs, buttons, forms) in the app.
const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    overflowY: "auto",
    background: "rgba(15, 23, 42, 0.55)",
    backdropFilter: "blur(6px)",
  },
  card: {
    boxSizing: "border-box",
    width: "min(460px, 100%)",
    margin: "auto",
    borderRadius: 20,
    background: "var(--surface-strong, #ffffff)",
    border: "var(--card-border, 1px solid rgba(148, 163, 184, 0.2))",
    padding: 28,
    boxShadow: "var(--shadow, 0 24px 70px rgba(15, 23, 42, 0.3))",
    color: "var(--ink, #0f172a)",
    textAlign: "left",
  },
  eyebrow: { margin: 0, color: "var(--cyfer-red, #dc2626)", fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase" },
  title: { margin: "6px 0 6px", fontSize: 21, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.25, color: "var(--ink-heading, #0f172a)" },
  description: { margin: "0 0 4px", color: "var(--muted, #64748b)", fontSize: 13, lineHeight: 1.5 },
  label: { display: "block", marginTop: 16, color: "var(--ink, #0f172a)", fontSize: 12, fontWeight: 700 },
  control: {
    boxSizing: "border-box",
    display: "flex",
    alignItems: "stretch",
    width: "100%",
    marginTop: 8,
    overflow: "hidden",
    borderRadius: 10,
    background: "var(--surface-elevated, #ffffff)",
    border: "1px solid var(--line-strong, rgba(148, 163, 184, 0.35))",
  },
  prefix: {
    display: "flex",
    alignItems: "center",
    padding: "0 14px",
    background: "var(--primary-soft, rgba(30, 58, 95, 0.1))",
    color: "var(--primary, #1e3a5f)",
    fontSize: 14,
    fontWeight: 700,
  },
  field: {
    boxSizing: "border-box",
    display: "block",
    flex: 1,
    minWidth: 0,
    width: "100%",
    minHeight: 44,
    margin: 0,
    border: 0,
    outline: "none",
    background: "transparent",
    padding: "11px 13px",
    color: "var(--ink, #0f172a)",
    font: "inherit",
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.5,
    boxShadow: "none",
  },
  error: { margin: "12px 0 0", color: "var(--red, #dc2626)", fontSize: 12, fontWeight: 600 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 },
  cancel: {
    minHeight: 40,
    padding: "0 18px",
    borderRadius: 10,
    border: "1px solid var(--line-strong, rgba(148, 163, 184, 0.3))",
    background: "var(--surface, #ffffff)",
    color: "var(--ink, #0f172a)",
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  submit: {
    minHeight: 40,
    padding: "0 18px",
    borderRadius: 10,
    border: 0,
    color: "#ffffff",
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
  },
};

export function PromptDialog({
  eyebrow,
  title,
  description,
  label,
  placeholder,
  multiline = false,
  inputType = "text",
  min,
  max,
  step,
  prefix,
  maxLength,
  submitLabel,
  danger = false,
  error,
  pending = false,
  isValid,
  onCancel,
  onSubmit,
}: PromptDialogProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputId = useId();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (typeof document === "undefined") return null;
  const canSubmit = isValid(value) && !pending;
  const fieldProps = {
    id: inputId,
    value,
    placeholder,
    maxLength,
    autoFocus: true,
    onChange: (event: { target: { value: string } }) => setValue(event.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };

  return createPortal(
    <div style={styles.backdrop} role="presentation" onMouseDown={onCancel}>
      <form
        style={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit(value);
        }}
      >
        <p style={styles.eyebrow}>{eyebrow}</p>
        <h2 id={`${inputId}-title`} style={styles.title}>{title}</h2>
        {description && <p style={styles.description}>{description}</p>}
        <label htmlFor={inputId} style={styles.label}>
          {label}
          <span
            style={{
              ...styles.control,
              borderColor: focused ? "var(--primary, #1e3a5f)" : "var(--line-strong, rgba(148, 163, 184, 0.35))",
              boxShadow: focused ? "0 0 0 3px var(--primary-focus, rgba(30, 58, 95, 0.2))" : "none",
            }}
          >
            {prefix && <span style={styles.prefix}>{prefix}</span>}
            {multiline ? (
              <textarea
                {...fieldProps}
                rows={4}
                style={{ ...styles.field, minHeight: 110, resize: "vertical" }}
              />
            ) : (
              <input
                {...fieldProps}
                type={inputType}
                min={min}
                max={max}
                step={step}
                style={styles.field}
              />
            )}
          </span>
        </label>
        {error && <p style={styles.error} role="alert">{error}</p>}
        <div style={styles.actions}>
          <button type="button" style={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              ...styles.submit,
              background: danger ? "var(--red, #dc2626)" : "var(--primary-gradient, #1e3a5f)",
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {pending ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
