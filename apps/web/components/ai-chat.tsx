"use client";

import { useEffect, useRef, useState } from "react";

import { useAiChat } from "./ai-chat-provider";

/**
 * The one floating element on every page. Fixed bottom-right, above everything, closed
 * by default — it should feel like a tool you reach for, not a banner you dismiss.
 *
 * Hand-drawn inline SVGs throughout, matching `choropleth.tsx`'s convention: this app
 * has no icon library dependency, and a chat bubble + a close glyph don't need one.
 */
export function AiChat(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const { messages, sending, error, send } = useAiChat();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function submit(): void {
    const text = draft;
    setDraft("");
    void send(text);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[min(560px,70dvh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-overlay">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <SparkleIcon className="h-4 w-4 text-accent" />
              <span className="text-[13px] font-semibold text-mist">Ask Veela</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1 text-muted transition-colors hover:bg-ink hover:text-mist"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <p className="text-[13px] leading-relaxed text-muted">
                Ask about a property you&apos;re analysing, a Hong Kong tax rule, or how
                to read a finding on the report. If a property is open on{" "}
                <span className="font-medium text-mist">/analyse</span>, the assistant
                can see its figures.
              </p>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-card bg-accent px-3.5 py-2.5 text-[13px] leading-relaxed text-white"
                      : "max-w-[85%] rounded-card bg-ink px-3.5 py-2.5 text-[13px] leading-relaxed text-mist"
                  }
                >
                  {m.content === "" && sending && i === messages.length - 1 ? (
                    <TypingDots />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {error !== null && (
              <p className="rounded-card border border-negative/20 bg-negative/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-negative">
                {error}
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-end gap-2 border-t border-line p-3"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask a question…"
              className="max-h-24 flex-1 resize-none rounded-card border border-line bg-ink px-3 py-2 text-[13px] leading-relaxed text-mist placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={draft.trim() === "" || sending}
              aria-label="Send"
              className="btn-primary !h-9 !w-9 !rounded-full !p-0 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Ask Veela"}
        aria-expanded={open}
        className="btn-primary !h-14 !w-14 !rounded-full !p-0"
      >
        {open ? <CloseIcon className="h-5 w-5" /> : <SparkleIcon className="h-5 w-5" />}
      </button>
    </div>
  );
}

function TypingDots(): React.JSX.Element {
  return (
    <span className="flex items-center gap-1 py-0.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
    </span>
  );
}

function SparkleIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        fill="currentColor"
      />
      <path
        d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

function CloseIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon({ className }: { readonly className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 12l16-7-6.5 7L20 19 4 12z"
        fill="currentColor"
      />
    </svg>
  );
}
