import { supabaseBrowser } from "./supabase-browser";

/**
 * Uploading and reading photographs of a user's own property.
 *
 * ## The bytes never touch our API
 *
 * The browser writes straight to a private Supabase Storage bucket using its own session, and
 * only then tells our API that the object exists. Two reasons, and the second is the one that
 * would have bitten: a Vercel function's request body is capped below a modern phone photo, and
 * proxying megabytes through a serverless function to re-upload them spends latency and money
 * to gain nothing the browser could not do directly.
 *
 * ## The bucket is private, so every read is signed
 *
 * These are photographs of where somebody lives, attached to their price, their mortgage and
 * their address. That is personal data under the PDPO, and a public bucket would protect it
 * only by the unguessability of a URL — which survives exactly until one is pasted somewhere.
 * The cost of choosing correctly here is that a URL expires, so `signedUrls` is called at
 * render time and its results are not persisted anywhere.
 *
 * ## Zero configuration, like everything else that needs a key
 *
 * Every function returns a plain result rather than throwing when Supabase is unconfigured, so
 * a deployment with no Supabase renders a property page with no photo section rather than a
 * broken one — the same rule `DATABASE_URL`, the Maps key and `ANTHROPIC_API_KEY` follow.
 */

const BUCKET = "property-photos";

/** Matches the bucket's own `allowed_mime_types`. **SVG is deliberately absent**: it is an
 *  image and also a script host, and these are rendered from a domain that holds a session. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS_PER_PROPERTY = 24;

export interface PropertyPhoto {
  readonly id: string;
  readonly propertyId: string;
  readonly storagePath: string;
  readonly contentType: string;
  readonly bytes: number;
  readonly sortOrder: number;
}

/** Why a particular file was refused, in words a reader can act on. `null` means accepted. */
export function rejectionReason(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `${file.name}: only JPEG, PNG, WebP and AVIF images can be uploaded.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `${file.name} is ${mb} MB — the limit is 10 MB.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * `{ownerId}/{propertyId}/{uuid}.{ext}` — a contract, not a naming preference.
 *
 * The bucket's RLS policies authorise a read or a write by comparing the **first path
 * segment** against `auth.uid()`, and the API re-checks the first two against the caller and
 * the property. Change the shape here and every existing object becomes unreadable.
 *
 * The filename is a fresh UUID rather than the user's own: two photos called `IMG_0042.jpg`
 * would otherwise collide, and an uploaded filename is attacker-controlled text that would end
 * up in a URL.
 */
function objectPath(ownerId: string, propertyId: string, contentType: string): string {
  const ext = EXTENSIONS[contentType] ?? "bin";
  return `${ownerId}/${propertyId}/${crypto.randomUUID()}.${ext}`;
}

export interface UploadOutcome {
  readonly uploaded: readonly PropertyPhoto[];
  /** One line per file that did not make it, naming the file and the reason. */
  readonly errors: readonly string[];
}

/**
 * Upload files and register each one.
 *
 * **Sequential, not `Promise.all`.** Uploading eight photos at once from a phone saturates the
 * connection and makes every one of them slower, and a partial failure in a parallel batch
 * leaves no sensible order for what did succeed. It also means `sortOrder` comes out matching
 * the order the reader picked, because the API appends.
 *
 * A failure on one file does not abandon the rest — a single unreadable image in a selection
 * of ten should cost that image, not the other nine — so failures accumulate into `errors`.
 */
export async function uploadPhotos(
  ownerId: string,
  propertyId: string,
  files: readonly File[],
): Promise<UploadOutcome> {
  const supabase = supabaseBrowser();
  if (supabase === null) {
    return { uploaded: [], errors: ["Photo storage isn't configured on this deployment."] };
  }

  const uploaded: PropertyPhoto[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const reason = rejectionReason(file);
    if (reason !== null) {
      errors.push(reason);
      continue;
    }

    const path = objectPath(ownerId, propertyId, file.type);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`);
      continue;
    }

    /* Register only after the object is really there. The reverse order would create rows
       pointing at nothing, which is the failure that shows up much later as a photo that
       silently refuses to load. An object with no row is the harmless direction: invisible to
       the product, costing only storage. */
    const res = await fetch(`/api/properties/${propertyId}/photos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storagePath: path, contentType: file.type, bytes: file.size }),
    });

    if (!res.ok) {
      // Roll the object back so a failed registration does not leave an orphan behind.
      await supabase.storage.from(BUCKET).remove([path]);
      errors.push(`${file.name}: ${await readError(res)}`);
      continue;
    }

    const body = (await res.json()) as { photo: PropertyPhoto };
    uploaded.push(body.photo);
  }

  return { uploaded, errors };
}

/**
 * Signed URLs for a batch of object paths, valid for an hour.
 *
 * One request for the whole list rather than one per photo — a portfolio of twenty properties
 * would otherwise mint twenty signatures in twenty round trips just to draw its thumbnails.
 *
 * Missing entries are simply absent from the map rather than throwing: one expired or deleted
 * object should cost that one tile, not the page.
 */
export async function signedUrls(
  paths: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;

  const supabase = supabaseBrowser();
  if (supabase === null) return out;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls([...paths], 60 * 60);
  if (error || data === null) return out;

  for (const row of data) {
    if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
  }
  return out;
}

/** Removes the row first, then the object — see the route's own comment for why that order. */
export async function deletePhoto(propertyId: string, photoId: string): Promise<string | null> {
  const res = await fetch(`/api/properties/${propertyId}/photos/${photoId}`, { method: "DELETE" });
  if (!res.ok) return await readError(res);

  const { storagePath } = (await res.json()) as { storagePath: string };
  const supabase = supabaseBrowser();
  if (supabase !== null) await supabase.storage.from(BUCKET).remove([storagePath]);
  return null;
}

/**
 * Delete objects by key — used when a whole property goes.
 *
 * Postgres cascades the photo *rows*, but nothing cascades into a storage bucket, so without
 * this the images outlive the property: unreachable through the product and still photographs
 * of somebody's home after they asked for it to be deleted. `DELETE /properties/:id` returns
 * the keys for exactly this call.
 */
export async function removeStoredPhotos(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = supabaseBrowser();
  if (supabase === null) return;
  await supabase.storage.from(BUCKET).remove([...paths]);
}

export async function reorderPhotos(
  propertyId: string,
  photoIds: readonly string[],
): Promise<string | null> {
  const res = await fetch(`/api/properties/${propertyId}/photos`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ photoIds }),
  });
  return res.ok ? null : await readError(res);
}

/**
 * Rejections arrive in two shapes and always have — Hono's `HTTPException` sends plain text,
 * `zValidator` sends a Zod error as JSON. Calling `res.json()` unconditionally throws on the
 * first and loses the specific reason, which is exactly the bug the listing importer's toast
 * had. Text first, then JSON.
 */
async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? text;
  } catch {
    return text === "" ? `Request failed (${res.status})` : text;
  }
}
