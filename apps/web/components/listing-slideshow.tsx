"use client";

import { useCallback, useState } from "react";

import { LISTING_PHOTO_ALT, listingPhotoPath } from "./property-finder";

/** How many of the sixteen interiors a report shows. Fewer than sixteen because nobody clicks
 *  through sixteen, and comfortably fewer so the set never repeats an image. */
export const SLIDESHOW_LENGTH = 5;

/**
 * The photo numbers a report shows, **starting with the one the reader clicked**.
 *
 * The first slide has to be the clicked photo: the whole reason `?photo=` exists is that a report
 * opened from a card should show the picture on that card, and a slideshow that opens on a
 * different image quietly breaks the property it was built for. The rest follow consecutively
 * modulo sixteen, which keeps them distinct for any length up to sixteen — the same argument the
 * card grid uses for `rank % 16` over a hash.
 */
export function slideshowPhotos(first: number, count = SLIDESHOW_LENGTH): readonly number[] {
  const total = 16;
  const start = ((Math.trunc(first) - 1 + total) % total) + 1;
  return Array.from({ length: Math.min(count, total) }, (_, i) => ((start - 1 + i) % total) + 1);
}

/**
 * The listing photos on a report, card-sized, as a slideshow.
 *
 * ## Three sizes in two days, and the third is the one that holds
 *
 * Full-bleed 16:9 first — over a thousand pixels tall on a wide screen, pushing the figures off
 * the page. Then a 96px thumbnail, which was too apologetic to be worth the space it took. Now a
 * **card**: the same shape and roughly the same width as the finder cards these listings come
 * from, which is the size at which a photograph looks deliberate rather than either shouted or
 * hidden. It is width-capped rather than fluid, so it stays a card on a 2,000px monitor instead of
 * quietly becoming a hero again.
 *
 * ## The gallery makes a claim a single photo did not, and the caption has to answer it
 *
 * One labelled stock photo says "here is a picture of a flat, illustratively". **Five in a
 * slideshow says "here are five views of this flat"** — which would be false twice over: these
 * are unrelated CC0 interiors, and the flat is generated. So the caption states the number and
 * says outright that they are *different rooms in different buildings*, not one property
 * photographed five times. That sentence is the price of the feature; without it the gallery is a
 * more convincing lie than the thing it replaced.
 *
 * ## No autoplay
 *
 * A carousel that advances by itself moves the page under somebody reading a tax figure, and it
 * takes the choice of when to move away from anyone who reads slowly. Everything here is driven
 * by the reader: two buttons, five dots, and the arrow keys.
 */
export function ListingSlideshow({
  firstPhoto,
  className,
}: {
  readonly firstPhoto: number;
  readonly className?: string;
}): React.JSX.Element {
  const photos = slideshowPhotos(firstPhoto);
  const [index, setIndex] = useState(0);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + photos.length) % photos.length);
    },
    [photos.length],
  );

  return (
    <figure
      className={`overflow-hidden rounded-card border border-line bg-surface shadow-card ${className ?? ""}`}
      /* Arrow keys work whenever anything inside has focus, which is where a keyboard user will
         be — the events bubble from the buttons and dots. */
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        }
      }}
      role="group"
      aria-label={`Stock interior photographs, ${photos.length} of them, illustrative only`}
    >
      <div className="relative aspect-[16/10] bg-surfaceMuted">
        {/* Every slide is rendered and the inactive ones hidden, rather than swapping one `src`.
            Sixteen local JPEGs are already downloaded by the time anyone clicks, so this trades a
            few hundred KB for never showing a blank frame mid-transition. */}
        {photos.map((n, i) => (
          /* eslint-disable-next-line @next/next/no-img-element -- already sized and compressed to
             what this renders; next/image would add a pipeline over files that need no resizing. */
          <img
            key={n}
            src={listingPhotoPath(n)}
            alt={`${LISTING_PHOTO_ALT} (${i + 1} of ${photos.length})`}
            aria-hidden={i !== index}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        <SlideButton side="left" onClick={() => go(-1)} />
        <SlideButton side="right" onClick={() => go(1)} />

        <p className="absolute right-2.5 top-2.5 rounded-full bg-ink/80 px-2 py-0.5 font-mono shadow-card text-[10px] font-medium text-white">
          {index + 1} / {photos.length}
        </p>

        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
          {photos.map((n, i) => (
            <button
              key={n}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photograph ${i + 1} of ${photos.length}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-white shadow-card" : "w-1.5 bg-white/70 shadow-card hover:bg-white"
              }`}
            />
          ))}
        </div>
      </div>

      <figcaption className="border-t border-line px-3.5 py-2.5 text-xs leading-relaxed text-muted">
        <strong className="text-mist">Illustrative only — not this property.</strong> These are{" "}
        {photos.length} <strong className="text-mist">unrelated</strong> stock interiors, not one
        flat photographed {photos.length} times: different rooms in different buildings, none of
        them in Hong Kong. This is a generated sample listing, so there is no real flat to
        photograph. Save a property of your own and you can attach your own pictures.
      </figcaption>
    </figure>
  );
}

function SlideButton({
  side,
  onClick,
}: {
  readonly side: "left" | "right";
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photograph" : "Next photograph"}
      className={`absolute top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full bg-ink/75 text-white shadow-card transition-colors hover:bg-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
        strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
        <path d={side === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}
