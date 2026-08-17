"use client";

import { useEffect, useState } from "react";

/**
 * Notes on one saved property: write, edit, delete, newest first.
 *
 * ## Why a log rather than one editable field
 *
 * An investor's notes on a flat accumulate — first viewing, second viewing, what the agent said,
 * what the bank quoted — and **the sequence is the substance.** One text box turns that into a
 * blob somebody has to hand-date, and every edit silently overwrites what it used to say. So each
 * note is its own dated row; the comparison shows the most recent one, which is all a single field
 * could ever have shown anyway.
 *
 * ## The one thing this deliberately does not do
 *
 * It does not render markdown, or anything else, as markup. A note is displayed as plain text with
 * newlines preserved — the same rule the AI brief follows, for the same reason: interpreting stored
 * text as markup means trusting it as markup. Here the text is the reader's own, so the risk is
 * lower than with model output, but the reason to add an interpreter is also weaker. `whitespace-
 * pre-wrap` gives paragraphs without giving a parser.
 */

export interface PropertyNote {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const MAX_BODY = 4000;

export function PropertyNotes({
  propertyId,
  onCountChange,
}: {
  readonly propertyId: string;
  readonly onCountChange?: ((n: number) => void) | undefined;
}): React.JSX.Element {
  const [notes, setNotes] = useState<readonly PropertyNote[] | null>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/properties/${propertyId}/notes`);
      if (cancelled) return;
      if (!res.ok) {
        setNotes([]);
        return;
      }
      const body = (await res.json()) as { notes: PropertyNote[] };
      if (!cancelled) setNotes(body.notes);
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  useEffect(() => {
    if (notes !== null) onCountChange?.(notes.length);
  }, [notes, onCountChange]);

  async function add(): Promise<void> {
    const body = draft.trim();
    if (body === "") return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/properties/${propertyId}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const { note } = (await res.json()) as { note: PropertyNote };
      setNotes((prev) => [note, ...(prev ?? [])]);
      setDraft("");
    } else {
      setError(await readError(res));
    }
    setBusy(false);
  }

  async function saveEdit(id: string): Promise<void> {
    const body = editDraft.trim();
    if (body === "") return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const { note } = (await res.json()) as { note: PropertyNote };
      setNotes((prev) => (prev ?? []).map((n) => (n.id === id ? note : n)));
      setEditingId(null);
    } else {
      setError(await readError(res));
    }
    setBusy(false);
  }

  async function remove(id: string): Promise<void> {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 404) {
      setNotes((prev) => (prev ?? []).filter((n) => n.id !== id));
    } else {
      setError(await readError(res));
    }
    setBusy(false);
  }

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold">Notes</h3>
        <p className="text-xs text-muted">
          {notes === null ? "…" : `${notes.length} note${notes.length === 1 ? "" : "s"}`} · yours
          only, never shown to anyone else
        </p>
      </div>

      <div className="mt-2">
        <label htmlFor={`note-${propertyId}`} className="sr-only">
          Add a note about this property
        </label>
        <textarea
          id={`note-${propertyId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY))}
          rows={3}
          placeholder="What did you notice? The agent's asking price, the state of the windows, what the bank quoted…"
          className="w-full rounded-card border border-line bg-surfaceMuted px-3 py-2 text-sm outline-none focus:border-accent focus:bg-surface"
        />
        <div className="mt-1.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || draft.trim() === ""}
            className="btn-secondary !px-4 !py-1.5 !text-[13px] disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? "Saving…" : "Add note"}
          </button>
          {/* Only once it matters. A counter that reads 0/4000 from the moment the box appears is
              noise; one that appears near the ceiling is information. */}
          {draft.length > MAX_BODY - 500 && (
            <span className="text-xs text-muted">
              {MAX_BODY - draft.length} characters left
            </span>
          )}
        </div>
      </div>

      {error !== null && (
        <p role="alert" className="mt-2 text-xs text-negative">
          {error}
        </p>
      )}

      {notes !== null && notes.length > 0 && (
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-card border border-line bg-surfaceMuted px-3 py-2.5">
              {editingId === note.id ? (
                <>
                  <label htmlFor={`edit-${note.id}`} className="sr-only">
                    Edit this note
                  </label>
                  <textarea
                    id={`edit-${note.id}`}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value.slice(0, MAX_BODY))}
                    rows={3}
                    className="w-full rounded-card border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  />
                  <div className="mt-1.5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => void saveEdit(note.id)}
                      disabled={busy || editDraft.trim() === ""}
                      className="text-xs font-medium text-accent hover:underline disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-muted hover:text-mist"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Plain text with newlines kept — not markdown. See the file comment. */}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-mist">
                    {note.body}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                      {formatWhen(note.createdAt)}
                      {/* Said, not hidden: a note that has been revised should not look like it
                          always read this way. */}
                      {note.updatedAt !== note.createdAt && " · edited"}
                    </span>
                    {/* The visible words stay short, but the accessible names say *what* is
                        being edited or deleted. On the portfolio card these sit a few pixels from
                        "Delete property", and "Delete" alone does not tell a screen-reader user —
                        or an automated test, which is how this was caught the first time — which
                        of the two they are on. */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(note.id);
                        setEditDraft(note.body);
                      }}
                      aria-label="Edit this note"
                      className="ml-auto text-xs text-muted hover:text-mist"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(note.id)}
                      disabled={busy}
                      aria-label="Delete this note"
                      className="text-xs text-muted hover:text-negative disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {notes !== null && notes.length === 0 && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          No notes yet. Anything you write here stays with this property — it shows up on the
          comparison, so you can put two flats side by side with your own observations attached.
        </p>
      )}
    </section>
  );
}

/** Date only. A note is a record of a day's thinking, and a timestamp to the minute implies a
 *  precision about when an opinion formed that nobody has. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Rejections arrive as plain text (`HTTPException`) or JSON (`zValidator`) — text first, or the
 *  specific reason is lost to a thrown `res.json()`. Same fix as the listing importer's toast. */
async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? text;
  } catch {
    return text === "" ? `Request failed (${res.status})` : text;
  }
}
