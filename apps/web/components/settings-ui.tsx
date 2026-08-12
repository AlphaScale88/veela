"use client";

import { useState, type ReactNode } from "react";

/**
 * The shared furniture for the Settings page, taken from a reference screenshot: tabs
 * across the top, collapsible sections with a tinted header bar and a chevron, rows whose
 * control sits far right between "Off" and "On" labels, and a footer action bar with a
 * secondary action on the left and the primary Save on the right.
 *
 * Extracted into components rather than written inline because the layout repeats per
 * section and per row — and because the alternative, hand-rolling each section, is how a
 * page ends up with three slightly different chevrons.
 */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  readonly tabs: readonly { id: string; label: string }[];
  readonly active: string;
  readonly onChange: (id: string) => void;
}): React.JSX.Element {
  return (
    /* Underline tabs, not pills: the reference uses an underline, and it keeps the one
       filled element on this page as the Save button. `overflow-x-auto` so two or three
       tabs never overflow a phone. */
    <div role="tablist" className="-mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <div className="flex gap-6 whitespace-nowrap">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              className={`-mb-px border-b-2 pb-3 pt-1 text-[15px] transition-colors ${
                isActive
                  ? "border-accent font-medium text-accent"
                  : "border-transparent text-muted hover:text-mist"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A collapsible section. Open by default — a settings page whose sections all start shut
 * makes a reader click before they can see whether the thing they came for is even here.
 */
export function SettingsSection({
  title,
  children,
  defaultOpen = true,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-accent/[0.07] px-5 py-3.5 text-left transition-colors hover:bg-accent/10"
      >
        <span className="text-[15px] font-semibold text-accent">{title}</span>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-accent transition-transform ${open ? "" : "rotate-180"}`} />
      </button>
      {open && <div className="px-5">{children}</div>}
    </section>
  );
}

/**
 * One setting. The control is pushed to the far right and the label given the room, which
 * is what makes a long list scannable — the eye runs down the labels, then down the
 * controls, without crossing between.
 */
export function SettingRow({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line py-4 last:border-b-0">
      <div className="min-w-0 flex-1 basis-52">
        <p className="text-[15px] text-mist">{label}</p>
        {hint !== undefined && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** `Off — switch — On`, exactly as the reference labels it. The words matter: a bare
 *  switch leaves a reader guessing which end is on, and this pattern removes the guess. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
  /** For screen readers — the visible label lives in the row, not the control. */
  readonly label: string;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <span className={`flex items-center gap-2.5 ${disabled ? "opacity-50" : ""}`}>
      <span className="text-xs text-muted">Off</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? "border-accent bg-accent/15" : "border-line bg-surfaceMuted"
        } ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-0.5 rounded-full bg-inverse transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-1"
          }`}
          style={{ height: 18, width: 18 }}
        />
      </button>
      <span className="text-xs text-muted">On</span>
    </span>
  );
}

/** Footer bar: secondary action left, primary right — the reference's
 *  "Unsubscribe from all" / "Save" arrangement. */
export function SettingsFooter({
  secondary,
  children,
}: {
  readonly secondary?: ReactNode;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
      <div>{secondary}</div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

function ChevronIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
