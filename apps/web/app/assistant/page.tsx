"use client";

import { useEffect, useRef, useState } from "react";

import { AppShell } from "../../components/app-shell";
import { useAiChat } from "../../components/ai-chat-provider";

/**
 * The same assistant as the floating button on every other page — `useAiChat()` is one
 * global provider (`app/layout.tsx`), so this page and the floating panel share one
 * conversation and one `context`. This page exists for when the floating panel is too
 * small for a real back-and-forth, not as a second assistant.
 */
export default function AssistantPage(): React.JSX.Element {
  const { messages, sending, error, context, send } = useAiChat();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function submit(): void {
    const text = draft;
    setDraft("");
    void send(text);
  }

  return (
    <AppShell breadcrumb="AI Assistant">
      <div className="flex h-[calc(100dvh-8rem)] max-w-3xl flex-col">
        <header className="mb-4">
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.03em] text-mist">
            Ask Veela
          </h1>
          <p className="mt-1 text-sm text-muted">
            {context !== undefined
              ? "Grounded in the report currently open on /analyse."
              : "Open a report on /analyse to ground answers in its actual figures."}
          </p>
        </header>

        <div
          ref={listRef}
          className="flex-1 space-y-3 overflow-y-auto rounded-panel border border-line bg-surface p-5 shadow-card"
        >
          {messages.length === 0 && (
            <p className="text-sm leading-relaxed text-muted">
              Ask about a property you're analysing, a Hong Kong tax rule, or how to
              read a finding on the report.
            </p>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-card bg-accent px-4 py-2.5 text-sm leading-relaxed text-white"
                    : "max-w-[80%] rounded-card bg-surfaceMuted px-4 py-2.5 text-sm leading-relaxed text-mist"
                }
              >
                {m.content === "" && sending && i === messages.length - 1 ? "…" : m.content}
              </div>
            </div>
          ))}

          {error !== null && (
            <p className="rounded-card border border-negative/20 bg-negative/5 px-4 py-2.5 text-sm text-negative">
              {error}
            </p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-3 flex items-end gap-2"
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
            rows={2}
            placeholder="Ask a question…"
            className="max-h-32 flex-1 resize-none rounded-card border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={draft.trim() === "" || sending}
            className="btn-primary !py-3 disabled:pointer-events-none disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </AppShell>
  );
}
