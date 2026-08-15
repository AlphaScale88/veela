/**
 * **What a user agreed to, and when — versioned, because consent to a document you have since
 * rewritten is not consent.**
 *
 * The Personal Data (Privacy) Ordinance's DPP1 requires notice at or before collection, and
 * this project's own notes have warned since the beginning that *retrofitting consent is
 * impossible*. Until now signup only linked to `/privacy` in passing: nothing was presented for
 * acceptance and nothing was recorded, so there was no answer to "what did this user actually
 * agree to" beyond "whatever the page said that day".
 *
 * ## Why versions are dates
 *
 * A semantic version implies a judgement about whether a change was breaking. For a legal
 * document every material change matters, and the only question anyone asks is *which wording
 * did they see*. A date answers that directly and sorts correctly.
 *
 * **Bump these whenever the corresponding page changes materially.** Existing users are then
 * asked to accept again — see the consent gate — rather than being silently treated as having
 * agreed to words that did not exist when they signed up.
 */

export const LEGAL_VERSIONS = {
  terms: "2026-08-16",
  privacy: "2026-08-16",
} as const;

export type LegalDocument = keyof typeof LEGAL_VERSIONS;

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = ["terms", "privacy"];

/** For the acceptance line and the record in `/account`. */
export const LEGAL_LABEL: Readonly<Record<LegalDocument, string>> = {
  terms: "Terms of service",
  privacy: "Privacy statement",
};
