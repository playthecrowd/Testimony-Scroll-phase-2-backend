// Deterministic placeholder image helpers so the same "seed" always renders the same image.
export function photo(seed: string, w = 800, h = 600) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

export function avatar(name: string, bg = "2f7dff") {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=${bg}&color=fff&bold=true`;
}

// Renders a QR code as an image via a public QR-generation service, same "external image URL,
// no new dependency" approach as photo()/avatar() above -- there's no QR-rendering code
// anywhere in this repo to reuse, and a full client-side QR library is more than a single share
// link needs.
export function qrCode(data: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}
