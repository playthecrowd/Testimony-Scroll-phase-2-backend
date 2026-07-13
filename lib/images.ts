// Deterministic placeholder image helpers so the same "seed" always renders the same image.
export function photo(seed: string, w = 800, h = 600) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

export function avatar(name: string, bg = "2f7dff") {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=${bg}&color=fff&bold=true`;
}
