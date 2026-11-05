"use client";

import { useEffect, useRef, useState } from "react";

export type MultiSelectOption = { value: string; label: string };

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.filter((option) => value.includes(option.value));
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return <div className="multi-select" ref={ref}>
    <button type="button" className="multi-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className={selected.length === 0 ? "styled-select-placeholder" : undefined}>{selected.length === 0 ? placeholder : selected.length === 1 ? selected[0].label : `${selected.length} selected`}</span>
      <span className="styled-select-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="multi-select-menu" role="listbox" aria-multiselectable="true">
      {options.length === 0 ? <span className="muted multi-select-empty">No options available.</span> : options.map((option) => <label className="multi-select-option" key={option.value}><input type="checkbox" checked={value.includes(option.value)} onChange={() => onChange(value.includes(option.value) ? value.filter((current) => current !== option.value) : [...value, option.value])} />{option.label}</label>)}
      {selected.length > 0 && <button type="button" className="multi-select-clear" onClick={() => onChange([])}>Clear selection</button>}
    </div>}
  </div>;
}
