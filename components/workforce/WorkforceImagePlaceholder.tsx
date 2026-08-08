// A single, reusable rule for every image area in Workforce: always render something (never a
// browser broken-image icon), preserve the caller's aspect ratio, and stay swappable to a real
// asset later by changing only `src` -- no component rewrite. `devLabel` renders centered over the
// image, but only when NODE_ENV is "development" -- it must never appear in a real deployment,
// so it's applied here in the wrapper rather than baked into any placeholder SVG itself.
export function WorkforceImagePlaceholder({
  src,
  alt,
  aspectRatio = "16 / 9",
  rounded = "1rem",
  devLabel,
  className = "",
}: {
  src: string;
  alt: string;
  aspectRatio?: string;
  rounded?: string;
  devLabel?: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`} style={{ aspectRatio, borderRadius: rounded }}>
      <img src={src} alt={alt} className="w-full h-full object-cover" />
      {devLabel && process.env.NODE_ENV === "development" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[11px] font-medium tracking-wide uppercase px-3 py-1.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
            {devLabel}
          </span>
        </div>
      )}
    </div>
  );
}
