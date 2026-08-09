"use client";

import type { ChatMessage } from "@veela/types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Client-only, in-memory chat state — matches the rest of the product's "no account,
 * nothing saved" ethos, quoted on the homepage and in `/analyse`'s own copy. Refresh
 * the tab and the conversation is gone; that is a feature, not a gap to fill in later.
 *
 * `context` is a plain-text summary of whatever property is currently under analysis.
 * It lives here rather than on the page component so the floating chat button, mounted
 * once in the root layout, can see it regardless of which route is active. A page sets
 * it via `useAiChatContext().setContext(...)`; the panel just reads whatever is current.
 */
interface AiChatState {
  readonly messages: readonly ChatMessage[];
  readonly sending: boolean;
  readonly error: string | null;
  readonly context: string | undefined;
  readonly setContext: (context: string | undefined) => void;
  readonly send: (text: string) => Promise<void>;
  readonly reset: () => void;
}

const AiChatContext = createContext<AiChatState | null>(null);

export function AiChatProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<string | undefined>(undefined);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed === "" || sending) return;

      setError(null);
      const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(next);
      setSending(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: next, context }),
        });

        if (!res.body) {
          throw new Error("The server did not stream a response.");
        }

        // The 503-with-body case (no ANTHROPIC_API_KEY) and the happy-path stream both
        // arrive as `res.ok` text/plain — the route can't renegotiate a status code once
        // it has started streaming, so plain text is the message either way.
        setMessages((cur) => [...cur, { role: "assistant", content: "" }]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((cur) => {
            const last = cur[cur.length - 1];
            if (last === undefined || last.role !== "assistant") return cur;
            const updated = [...cur];
            updated[updated.length - 1] = { role: "assistant", content: last.content + chunk };
            return updated;
          });
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Something went wrong.");
      } finally {
        setSending(false);
      }
    },
    [messages, context, sending],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const value = useMemo<AiChatState>(
    () => ({ messages, sending, error, context, setContext, send, reset }),
    [messages, sending, error, context, send, reset],
  );

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat(): AiChatState {
  const ctx = useContext(AiChatContext);
  if (ctx === null) throw new Error("useAiChat must be used inside AiChatProvider");
  return ctx;
}
