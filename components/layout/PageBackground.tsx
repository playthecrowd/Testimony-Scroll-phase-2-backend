/**
 * Renders a full-bleed background image behind page content, tinted with the
 * site's navy/blue palette so it reads as part of the brand rather than a
 * random photo. Cards (`.qk-card`) already use solid opaque backgrounds, so
 * text stays legible on top of any image.
 *
 * The image fades and gently zooms in on mount — since Next.js remounts the
 * page component on every navigation, this replays each time you move
 * between pages. Respects prefers-reduced-motion (see globals.css).
 *
 * Usage: drop <PageBackground src="..." /> as the first child of a page's
 * root element (the root element needs `relative` so this can sit behind it
 * with `absolute inset-0 -z-10`).
 *
 * Swap the `src` per page for a page-specific image, or reuse the same URL
 * across pages for a consistent site-wide backdrop — both are supported.
 */
export function PageBackground({ src, opacity = 0.5 }: { src: string; opacity?: number }) {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <img
        src={src}
        alt=""
        className="qk-bg-image w-full h-full object-cover"
        style={{ "--qk-bg-target-opacity": opacity } as React.CSSProperties}
      />
      {/* Brand tint: navy/blue wash + the same radial accents used on the base background,
          dialed back to ~60% strength at its darkest so the photo stays clearly visible
          while the color still reads as part of the brand. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% -10%, rgba(13,26,51,0.55) 0%, transparent 60%), radial-gradient(1000px 500px at 100% 0%, rgba(26,16,48,0.5) 0%, transparent 55%), linear-gradient(180deg, rgba(6,10,20,0.3) 0%, rgba(6,10,20,0.6) 75%, rgba(6,10,20,0.72) 100%)",
        }}
      />
    </div>
  );
}
