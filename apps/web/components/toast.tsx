"use client";

/**
 * A dismissible, fixed-position notice for something that happened, not a field the
 * reader is mid-typing. The listing importer's "server rejected that link" used to be an
 * inline paragraph below the button — easy to miss once the reader had scrolled on, and
 * indistinguishable from the many other inline validation messages on this page. A
 * fetch failure is an event; it deserves to stay visible until dismissed, wherever the
 * reader has scrolled to.
 *
 * Top-right, not bottom-right — `ai-chat.tsx`'s floating trigger already owns that
 * corner (`fixed bottom-5 right-5`). `top-20`, not `top-5`, clears `site-nav.tsx`'s
 * sticky header rather than sitting half behind it.
 */
interface Props {
  readonly message: string;
  readonly onDismiss: () => void;
}

export function ErrorToast({ message, onDismiss }: Props): React.JSX.Element {
  return (
    <div
      role="alert"
      className="fixed right-5 top-20 z-50 flex max-w-sm items-start gap-3 rounded-panel border border-negative/40 bg-surface px-4 py-3.5 text-sm text-negative shadow-lift"
    >
      <p className="flex-1 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-lg leading-none text-muted transition-colors hover:text-mist"
      >
        ×
      </button>
    </div>
  );
}
