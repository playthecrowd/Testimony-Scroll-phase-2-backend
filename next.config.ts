import type { NextConfig } from "next";

// Explicit, finite allowlist -- not a wildcard -- covering exactly the external image hosts this
// app ever produces a URL for: Supabase Storage (lesson thumbnails) and the two placeholder
// hosts the mock/seed data layer uses (lib/images.ts).
function supabaseStorageHostname(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || null;
  } catch {
    return null;
  }
}

const supabaseHostname = supabaseStorageHostname();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      { protocol: "https" as const, hostname: "picsum.photos" },
      { protocol: "https" as const, hostname: "ui-avatars.com" },
    ],
  },
};

export default nextConfig;
