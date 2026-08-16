"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ACCEPTED_IMAGE_TYPES,
  MAX_PHOTOS_PER_PROPERTY,
  deletePhoto,
  reorderPhotos,
  signedUrls,
  uploadPhotos,
  type PropertyPhoto,
} from "../lib/property-photos";

/**
 * The photo manager for one saved property: add, reorder, set the cover, delete.
 *
 * ## The one honest caveat this component carries
 *
 * Everywhere else in this product, a photograph is either stock or credited, and the report
 * deliberately has none — `.claude/CLAUDE.md` records why: a stock interior beside a reader's
 * own figures reads as a picture of *their* flat, which is the same false claim the product
 * refuses to make with a number. **These photos are the exception that proves the rule**, and
 * they are the only kind that can be: the reader took them, of their own property. Nothing is
 * being asserted on their behalf.
 *
 * ## Why the cover is position 0 rather than a flag
 *
 * "Make this the cover" and "reorder" are one operation. An `isCover` boolean alongside an
 * ordering is two pieces of state that can disagree — two covers, or none — and the disagreement
 * only shows up on a list page much later.
 */
export function PropertyPhotos({
  propertyId,
  ownerId,
  initial,
  onCountChange,
}: {
  readonly propertyId: string;
  readonly ownerId: string;
  readonly initial?: readonly PropertyPhoto[] | undefined;
  readonly onCountChange?: ((n: number) => void) | undefined;
}): React.JSX.Element {
  const [photos, setPhotos] = useState<readonly PropertyPhoto[]>(initial ?? []);
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [loaded, setLoaded] = useState(initial !== undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial !== undefined) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/properties/${propertyId}/photos`);
      if (!res.ok || cancelled) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const body = (await res.json()) as { photos: PropertyPhoto[] };
      if (!cancelled) {
        setPhotos(body.photos);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, initial]);

  /* Signatures expire, so they are derived from the current photo list at render time and
     never stored. Re-run whenever the list changes — a newly uploaded photo has no URL yet. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map = await signedUrls(photos.map((p) => p.storagePath));
      if (!cancelled) setUrls(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  useEffect(() => {
    onCountChange?.(photos.length);
  }, [photos.length, onCountChange]);

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;
      const room = MAX_PHOTOS_PER_PROPERTY - photos.length;
      if (room <= 0) {
        setErrors([`This property already has ${MAX_PHOTOS_PER_PROPERTY} photos.`]);
        return;
      }

      setBusy(true);
      setErrors([]);
      const outcome = await uploadPhotos(ownerId, propertyId, files.slice(0, room));
      setPhotos((prev) => [...prev, ...outcome.uploaded]);
      const over =
        files.length > room ? [`Only ${room} more photo${room === 1 ? "" : "s"} would fit.`] : [];
      setErrors([...outcome.errors, ...over]);
      setBusy(false);
    },
    [ownerId, propertyId, photos.length],
  );

  async function remove(photo: PropertyPhoto): Promise<void> {
    setBusy(true);
    const error = await deletePhoto(propertyId, photo.id);
    if (error === null) {
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setErrors([]);
    } else {
      setErrors([error]);
    }
    setBusy(false);
  }

  /** Promotion to cover is a reorder that moves one id to the front. */
  async function makeCover(photo: PropertyPhoto): Promise<void> {
    const next = [photo, ...photos.filter((p) => p.id !== photo.id)];
    setPhotos(next); // optimistic: the grid reorders immediately
    setBusy(true);
    const error = await reorderPhotos(
      propertyId,
      next.map((p) => p.id),
    );
    if (error !== null) {
      setPhotos(photos); // put it back rather than leave the screen lying
      setErrors([error]);
    }
    setBusy(false);
  }

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold">Photos</h3>
        <p className="text-xs text-muted">
          {photos.length} of {MAX_PHOTOS_PER_PROPERTY} · yours only, never shown to anyone else
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []));
          // Clearing lets the same file be picked again after a failure — without this, a
          // second attempt at the identical file fires no change event at all.
          e.target.value = "";
        }}
      />

      {!loaded ? (
        <p className="mt-3 text-sm text-muted">Loading photos…</p>
      ) : (
        <>
          {photos.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo, i) => {
                const url = urls.get(photo.storagePath);
                return (
                  <li
                    key={photo.id}
                    className="group relative overflow-hidden rounded-card border border-line bg-surfaceMuted"
                  >
                    <div className="aspect-[4/3]">
                      {url === undefined ? (
                        <div className="grid h-full place-items-center text-[11px] text-muted">
                          …
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element -- a signed URL
                           from a private bucket, expiring hourly: next/image would need the
                           host allow-listed and would cache a URL built to expire. */
                        <img
                          src={url}
                          alt={i === 0 ? "Cover photo of your property" : `Photo ${i + 1} of your property`}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>

                    {i === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white shadow-card">
                        Cover
                      </span>
                    )}

                    {/* Always present rather than hover-only: a touch screen has no hover, and
                        a control that cannot be reached on a phone is not a control. */}
                    <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                      {i === 0 ? (
                        <span />
                      ) : (
                        <button
                          type="button"
                          onClick={() => void makeCover(photo)}
                          disabled={busy}
                          className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-mist shadow-card disabled:opacity-50"
                        >
                          Make cover
                        </button>
                      )}
                      {/* The visible label stays short because the tile is small, but the
                          accessible name says which photo and that it is a *photo* — the
                          portfolio card nearby has its own delete control, and "Remove" alone
                          does not tell a screen-reader user which of the two they are on. */}
                      <button
                        type="button"
                        onClick={() => void remove(photo)}
                        disabled={busy}
                        aria-label={`Remove photo ${i + 1}`}
                        className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-negative shadow-card disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || photos.length >= MAX_PHOTOS_PER_PROPERTY}
            className="btn-secondary mt-3 !px-4 !py-2 !text-[13px] disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? "Uploading…" : photos.length === 0 ? "Add photos" : "Add more"}
          </button>

          {photos.length === 0 && !busy && (
            <p className="mt-2 text-xs leading-relaxed text-muted">
              JPEG, PNG, WebP or AVIF, up to 10 MB each. They are stored privately and are
              visible only to you — the first one becomes the cover on your portfolio.
            </p>
          )}

          {errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {errors.map((e) => (
                <li key={e} className="text-xs text-negative">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
