const FALLBACK_AVATARS = [
  "/workforce/placeholders/avatars/avatar-01.svg",
  "/workforce/placeholders/avatars/avatar-02.svg",
  "/workforce/placeholders/avatars/avatar-03.svg",
  "/workforce/placeholders/avatars/avatar-04.svg",
];

// Deterministic (same name always picks the same fallback) rather than random -- a person's
// avatar shouldn't change on every re-render.
function fallbackFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_AVATARS[hash % FALLBACK_AVATARS.length];
}

const SIZE_CLASSES = { xs: "w-6 h-6 text-[9px]", sm: "w-8 h-8 text-[10px]", md: "w-10 h-10 text-xs", lg: "w-14 h-14 text-sm" };

// Circular avatar: a real imageUrl when one exists, otherwise initials on a tinted background
// (readable, no uncanny generated faces), falling back to a neutral silhouette placeholder only
// when there's no name to derive initials from either. Never a broken-image icon.
export function WorkforceAvatar({
  name,
  imageUrl,
  size = "md",
  className = "",
}: {
  name: string;
  imageUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const sizeClass = SIZE_CLASSES[size];

  if (imageUrl) {
    return <img src={imageUrl} alt={name} className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`} />;
  }

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (!initials) {
    return <img src={fallbackFor("unnamed")} alt="Unnamed" className={`${sizeClass} rounded-full shrink-0 ${className}`} />;
  }

  return (
    <span
      className={`${sizeClass} rounded-full shrink-0 flex items-center justify-center font-semibold bg-accent-purple text-white ${className}`}
      title={name}
    >
      {initials}
    </span>
  );
}
