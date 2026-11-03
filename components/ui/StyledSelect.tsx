"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

export function StyledSelect({
  value,
  options,
  onChange,
  required,
  disabled,
  ariaLabel,
  name,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const displayedValue = options.find((option) => option.value === localValue);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="styled-select" ref={containerRef}>
      {name && <input type="hidden" name={name} value={localValue} />}
      <button
        type="button"
        className="styled-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={!displayedValue ? "styled-select-placeholder" : undefined}>
          {displayedValue?.label ?? "Select an option"}
        </span>
        <span className="styled-select-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="styled-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === localValue}
              className="styled-select-option"
              key={option.value}
              onClick={() => {
                setLocalValue(option.value);
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {required && <input className="styled-select-required" tabIndex={-1} required value={value} onChange={() => {}} aria-hidden="true" />}
    </div>
  );
}
