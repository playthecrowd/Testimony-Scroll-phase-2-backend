// Phase 10.3 -- the first timezone-aware display helper in this codebase (spec SS9). Always
// renders via the occurrence's own stored IANA zone name, never the visitor's browser-local
// timezone, so every viewer sees the same "7:00 PM Central" regardless of who's looking. A real
// IANA name (not a fixed UTC offset) means daylight saving is handled automatically by the
// platform's own Intl/date formatting -- there is nothing to special-case here.

// Reads Date.now() internally so callers never call it directly in a component's render body
// (react-hooks/purity) -- used to split a member's registrations into upcoming/past.
export function isFutureOccurrence(startsAtIso: string): boolean {
  return new Date(startsAtIso).getTime() >= Date.now();
}

export function formatOccurrenceDateTime(startsAtIso: string, timezone: string): string {
  try {
    return new Date(startsAtIso).toLocaleString("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    // An invalid/unrecognized IANA name should never crash the page -- fall back to a UTC-labeled
    // rendering so the host/member at least sees a legible instant rather than an error boundary.
    return `${new Date(startsAtIso).toISOString()} UTC`;
  }
}

export function formatOccurrenceTimeRange(startsAtIso: string, endsAtIso: string | null, timezone: string): string {
  const start = formatOccurrenceDateTime(startsAtIso, timezone);
  if (!endsAtIso) return start;
  try {
    const end = new Date(endsAtIso).toLocaleString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
    return `${start} – ${end}`;
  } catch {
    return start;
  }
}

// Short zone abbreviation/offset label (e.g. "CDT", "GMT+2") suitable for a compact badge next to
// a formatted date -- falls back to the raw IANA name if the runtime can't resolve a short form.
export function formatTimezoneLabel(referenceIso: string, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" }).formatToParts(new Date(referenceIso));
    const zonePart = parts.find((p) => p.type === "timeZoneName");
    return zonePart?.value ?? timezone;
  } catch {
    return timezone;
  }
}

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Phoenix",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Manila",
  "Asia/Kolkata",
  "Australia/Sydney",
] as const;

export function getCommonTimezoneOptions(): readonly string[] {
  return COMMON_TIMEZONES;
}
