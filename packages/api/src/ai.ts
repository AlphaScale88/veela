/**
 * The model layer: **free providers first, paid as the backstop, automatic failover.**
 *
 * Asked to connect to free models and switch when a connection fails. That is the same shape
 * as the Overpass mirror problem already solved in `neighbourhood.ts` — several interchangeable
 * upstreams, none of them reliable on its own — and it is solved the same way, with one
 * critical difference explained under "Why this fails over *before* the first token".
 *
 * ## What "free" costs, and the part that is not about money
 *
 * Every provider below except Anthropic has a genuine free tier. The bill was never the
 * problem: a brief is a short prompt and at most ~900 output tokens, which is well under a cent
 * even at paid rates. **The real trade is data.** Free tiers generally reserve the right to
 * train on what you send, and what this app sends is a real person's property figures — price,
 * rent, and the building's location. `/privacy` carries a PDPO Personal Information Collection
 * Statement naming classes of transferees; whichever provider is switched on here becomes one
 * of them, and "trains on your inputs" is a materially different disclosure from a contractual
 * no-training term. **That page must be updated before this is pointed at real users' data.**
 * Nothing in this file can make that decision for you.
 *
 * ## Configuration
 *
 * Set any of the keys below. The chain tries them **in listed order** and uses the first one
 * that is configured *and* answers. Configure none and every AI feature degrades to the same
 * readable "not configured" sentence it always did — the rest of the app never depended on it.
 *
 * Each provider's model id is overridable (`GROQ_MODEL`, `GEMINI_MODEL`, …) because **third
 * party model ids drift far faster than this file will be edited.** A retired id shows up as a
 * 404 from that provider, which the chain treats as a failure and steps past — so a stale
 * default degrades to "one fewer provider" rather than to an outage. Override it to bring the
 * provider back.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface AiMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

interface Provider {
  /** Shown to the reader when a brief says which model wrote it. */
  readonly name: string;
  readonly keyEnv: string;
  readonly modelEnv: string;
  readonly defaultModel: string;
  /**
   * OpenAI-compatible `/chat/completions` base URL, or `undefined` for Anthropic's own API.
   * Almost every provider speaks the OpenAI wire format, which is why this needs one adapter
   * and one special case rather than six SDKs.
   */
  readonly baseUrl?: string;
  /** Only the custom provider takes its base URL from the environment. */
  readonly baseUrlEnv?: string;
  readonly free: boolean;
}

/** Resolved base URL: the env override if this provider allows one, else its fixed URL.
 *  `undefined` means "use Anthropic's own API". */
function baseUrlFor(p: Provider): string | undefined {
  if (p.baseUrlEnv !== undefined) {
    const v = process.env[p.baseUrlEnv];
    return v === undefined || v === "" ? undefined : v.replace(/\/+$/, "");
  }
  return p.baseUrl;
}

/**
 * Order matters: **free first**, because that is what was asked for, and the paid key last as
 * the one that answers when the free tiers are rate-limited — which is the normal failure mode
 * for a free tier, not an unusual one.
 */
const PROVIDERS: readonly Provider[] = [
  {
    /**
     * Anything else that speaks the OpenAI wire format: a self-hosted Ollama or LM Studio, a
     * corporate gateway, a provider that appears after this file was written.
     *
     * First in the chain so an explicit choice always beats the built-in defaults. It is also
     * the only entry whose base URL is configurable, which is what made the *success* path
     * testable here without holding a real free-tier key — a mock SSE server on localhost is a
     * valid custom provider.
     */
    name: "Custom",
    keyEnv: "AI_API_KEY",
    modelEnv: "AI_MODEL",
    defaultModel: "gpt-4o-mini",
    baseUrlEnv: "AI_BASE_URL",
    free: false,
  },
  {
    name: "Groq",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    free: true,
  },
  {
    name: "Gemini",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.0-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    free: true,
  },
  {
    name: "Cerebras",
    keyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    defaultModel: "llama-3.3-70b",
    baseUrl: "https://api.cerebras.ai/v1",
    free: true,
  },
  {
    name: "Mistral",
    keyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "mistral-small-latest",
    baseUrl: "https://api.mistral.ai/v1",
    free: true,
  },
  {
    name: "OpenRouter",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    baseUrl: "https://openrouter.ai/api/v1",
    free: true,
  },
  {
    name: "Claude",
    keyEnv: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
    // Haiku, not Sonnet: a three-paragraph brief over figures that are already computed does
    // not need the larger model, and this is the paid fallback — it should be cheap.
    defaultModel: "claude-haiku-4-5-20251001",
    free: false,
  },
];

function keyFor(p: Provider): string | undefined {
  const v = process.env[p.keyEnv];
  if (v === undefined || v === "") return undefined;
  // A custom provider with a key but no endpoint is a misconfiguration, not a provider — skip
  // it rather than firing requests at a built-in default it was never meant to use.
  if (p.baseUrlEnv !== undefined && baseUrlFor(p) === undefined) return undefined;
  return v;
}

function modelFor(p: Provider): string {
  const v = process.env[p.modelEnv];
  return v === undefined || v === "" ? p.defaultModel : v;
}

/** Which providers are actually usable right now — used by the "not configured" message so it
 *  can name the keys rather than making someone read this file. */
export function configuredProviders(): readonly string[] {
  return PROVIDERS.filter((p) => keyFor(p) !== undefined).map((p) => p.name);
}

export function providerKeyNames(): readonly string[] {
  return PROVIDERS.map((p) => `${p.keyEnv}${p.free ? " (free tier)" : ""}`);
}

/** Per-attempt ceiling. A provider that has not produced its first token by now is treated as
 *  failed and the next one is tried — well inside the route's own 60s `maxDuration`. */
const FIRST_TOKEN_TIMEOUT_MS = 12_000;

export interface StreamResult {
  /** The provider that actually answered, for the "written by" line. `null` if none did. */
  readonly provider: string | null;
  /** Every provider that was tried and failed, newest last — for the server log. */
  readonly failures: readonly string[];
}

/**
 * Stream a completion from the first provider that works.
 *
 * ## Why this fails over *before* the first token, and never after
 *
 * The Overpass hedging races mirrors and takes whichever answers first, because a JSON body is
 * atomic — a loser can be thrown away. **A token stream cannot be.** Once text has reached the
 * reader, switching providers would splice two different answers into one paragraph, which is
 * worse than any error message. So the rule is strict: a provider may be abandoned only while
 * `emitted` is still false. After that, a mid-stream failure is reported as an interruption and
 * the partial answer is kept — the same call `/chat` already made for the same reason.
 *
 * Sequential rather than raced, unlike Overpass: these are *accounts*, not public mirrors.
 * Firing five providers in parallel to use one answer would burn five rate-limit budgets per
 * request, and free tiers are exactly where that is scarcest.
 */
export async function streamCompletion(
  opts: {
    readonly system: string;
    readonly messages: readonly AiMessage[];
    readonly maxTokens: number;
  },
  write: (text: string) => Promise<void>,
): Promise<StreamResult> {
  const failures: string[] = [];

  for (const provider of PROVIDERS) {
    const key = keyFor(provider);
    if (key === undefined) continue;

    let emitted = false;
    const mark = async (text: string): Promise<void> => {
      emitted = true;
      await write(text);
    };

    try {
      const base = baseUrlFor(provider);
      if (base === undefined) {
        await streamAnthropic(provider, key, opts, mark);
      } else {
        await streamOpenAiCompatible(provider, base, key, opts, mark);
      }
      // Answered with nothing at all: treat as a failure so the next provider gets a turn,
      // rather than handing back a blank brief that looks like the feature is broken.
      if (!emitted) {
        failures.push(`${provider.name}: returned no text`);
        continue;
      }
      return { provider: provider.name, failures };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "unknown error";
      if (emitted) {
        // Committed. Cannot switch — say so and keep what arrived.
        await write("\n\n[The response was interrupted.]");
        return { provider: provider.name, failures };
      }
      failures.push(`${provider.name}: ${message}`);
    }
  }

  return { provider: null, failures };
}

/** OpenAI-compatible SSE: `data: {...}` lines, terminated by `data: [DONE]`. */
async function streamOpenAiCompatible(
  provider: Provider,
  baseUrl: string,
  key: string,
  opts: { system: string; messages: readonly AiMessage[]; maxTokens: number },
  write: (text: string) => Promise<void>,
): Promise<void> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: modelFor(provider),
      max_tokens: opts.maxTokens,
      stream: true,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
    }),
    signal: AbortSignal.timeout(FIRST_TOKEN_TIMEOUT_MS * 4),
  });

  if (!res.ok) {
    // Body often carries the useful part ("model decommissioned", "rate limit"), and it is what
    // makes a stale default model id diagnosable rather than mysterious.
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(`HTTP ${res.status}${detail === "" ? "" : ` — ${detail}`}`);
  }

  const reader = res.body?.getReader();
  if (reader === undefined) throw new Error("no response body");

  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are newline-delimited; keep the trailing partial line for the next chunk.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "" || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: readonly { delta?: { content?: string } }[];
        };
        const text = json.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text !== "") await write(text);
      } catch {
        // A frame that isn't JSON is not worth failing a working stream over.
      }
    }
  }
}

/** Anthropic's own API, via the SDK that was already a dependency. */
async function streamAnthropic(
  provider: Provider,
  key: string,
  opts: { system: string; messages: readonly AiMessage[]; maxTokens: number },
  write: (text: string) => Promise<void>,
): Promise<void> {
  const client = new Anthropic({ apiKey: key });
  const stream = client.messages.stream({
    model: modelFor(provider),
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      await write(event.delta.text);
    }
  }
}

/** The sentence shown when nothing is configured, or when everything that is configured
 *  failed. Names the keys, so the fix does not require reading source. */
export function unavailableMessage(failures: readonly string[]): string {
  const configured = configuredProviders();
  if (configured.length === 0) {
    return (
      "No AI provider is configured on this deployment yet. Set any one of these and the " +
      `written brief starts working: ${providerKeyNames().join(", ")}. ` +
      "Everything else — the verdict engine, the maps, the area data — works without it."
    );
  }
  return (
    `Every configured AI provider failed just now (${configured.join(", ")}). ` +
    `Details: ${failures.join("; ")}. The report itself is unaffected — none of its figures ` +
    "come from a model."
  );
}
