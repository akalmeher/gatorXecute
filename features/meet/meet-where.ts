/**
 * Feature Owner: Divij Anand
 * "Where?" is one field. Students type a place, paste a link or a phone
 * number, or name an app, and the meaning is worked out here, with no AI and
 * no accounts. Only the raw text is stored (in the Quick Meet link), so
 * nothing is ever asked twice and a bad parse can't corrupt the poll.
 */

export type WhereKind = "place" | "online" | "phone" | "hybrid";

export interface Where {
  kind: WhereKind;
  /** Short line to show, e.g. "Zoom", "J. Paul Leonard Library", "Library + Zoom". */
  label: string;
  /** App name for online meetings, e.g. "Zoom", "Discord". */
  platform?: string;
  /** Join link (http/https only). */
  url?: string;
  /** The in-person part, if any. */
  place?: string;
  /** Digits for a tel: link. */
  phone?: string;
  /** Meeting ID typed next to an app name, e.g. "Zoom 812 3456 7890". */
  meetingId?: string;
  /** Google Maps search for the place. */
  mapsUrl?: string;
}

export const MAX_WHERE_CHARS = 200;

const PLATFORMS: { name: string; hosts: RegExp; words: RegExp }[] = [
  { name: "Zoom", hosts: /(^|\.)zoom\.(us|com)$/, words: /\bzoom\b/i },
  { name: "Google Meet", hosts: /^meet\.google\.com$/, words: /\b(google meet|g ?meet|meet\.google)\b/i },
  { name: "Discord", hosts: /(^|\.)discord(app)?\.(gg|com)$/, words: /\bdiscord\b/i },
  { name: "Microsoft Teams", hosts: /^teams\.(microsoft|live)\.com$/, words: /\b(ms |microsoft )?teams\b/i },
  { name: "Webex", hosts: /(^|\.)webex\.com$/, words: /\b(webex|cisco)\b/i },
  { name: "FaceTime", hosts: /^facetime\.apple\.com$/, words: /\bfacetime\b/i },
  { name: "Slack huddle", hosts: /(^|\.)slack\.com$/, words: /\bslack\b/i },
  { name: "WhatsApp", hosts: /(^|\.)(whatsapp\.com|wa\.me)$/, words: /\bwhatsapp\b/i },
  { name: "Skype", hosts: /(^|\.)skype\.com$/, words: /\bskype\b/i },
  { name: "Jitsi", hosts: /^meet\.jit\.si$/, words: /\bjitsi\b/i },
];

// Links with a scheme, or bare links on a known meeting host ("zoom.us/j/123").
const URL_RE =
  /\bhttps?:\/\/[^\s<>"']+|\b(?:[a-z0-9-]+\.)*(?:zoom\.us|meet\.google\.com|discord\.gg|discord\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|meet\.jit\.si|facetime\.apple\.com|wa\.me)\/[^\s<>"']*/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{8,}\d)/;
const CALL_WORDS = /\b(phone( call)?|call me|call|ring)\b/i;
const TBD = /^(tbd|tba|later|decide later|not sure|\?+)$/i;
const ONLINE_WORDS = /\b(online|virtual|video( call)?|remote)\b/i;

function safeUrl(raw: string): string | undefined {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme.replace(/[).,;]+$/, ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function platformFor(url: string | undefined, text: string): string | undefined {
  if (url) {
    const host = new URL(url).hostname.toLowerCase();
    const byHost = PLATFORMS.find((p) => p.hosts.test(host));
    if (byHost) return byHost.name;
  }
  return PLATFORMS.find((p) => p.words.test(text))?.name;
}

const EDGE_PUNCT = /^[\s,;:+&/()-]+|[\s,;:+&/()-]+$/g;
const LEADING_FILLER = /^(and|or|plus|at|on|via|in|me|us|by)(\s+|$)/i;
const TRAILING_FILLER = /(^|\s+)(and|or|plus|at|on|via|in|by|me|us)$/i;

/** Trims punctuation and connecting words left over after links and app names are removed. */
function tidy(text: string): string {
  let s = text.replace(/\s+/g, " ").trim();
  let previous;
  do {
    previous = s;
    s = s.replace(EDGE_PUNCT, "").replace(LEADING_FILLER, "").replace(TRAILING_FILLER, "").trim();
  } while (s !== previous);
  return s;
}

export function mapsSearchUrl(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/** Works out what "Where?" means. Returns null for empty or "decide later". */
export function parseWhere(input: string | undefined): Where | null {
  const text = (input ?? "").trim().slice(0, MAX_WHERE_CHARS);
  if (!text || TBD.test(text)) return null;

  const urlMatch = text.match(URL_RE);
  const url = urlMatch ? safeUrl(urlMatch[0]) : undefined;
  let rest = urlMatch ? text.replace(urlMatch[0], " ") : text;

  const platform = platformFor(url, text);
  const phoneMatch = rest.match(PHONE_RE);
  // Digits next to an app name ("Zoom 812 3456 7890") are a meeting ID, not a phone number.
  const isMeetingId = Boolean(phoneMatch && platform && !url && !CALL_WORDS.test(text));
  const phone = phoneMatch && !isMeetingId ? phoneMatch[0].replace(/[^\d+]/g, "") : undefined;
  const meetingId = phoneMatch && isMeetingId ? phoneMatch[0].trim() : undefined;
  if (phoneMatch) rest = rest.replace(phoneMatch[0], " ");

  // Whatever remains, minus app names and filler words, is the in-person part.
  let placeText = rest;
  for (const p of PLATFORMS) placeText = placeText.replace(p.words, " ");
  placeText = tidy(placeText.replace(ONLINE_WORDS, " ").replace(CALL_WORDS, " ").replace(/\b(link|meeting|server)\b/gi, " "));
  const place = placeText.length >= 3 && /[a-z]/i.test(placeText) ? placeText : undefined;

  const online = Boolean(url || platform || ONLINE_WORDS.test(text));
  const byPhone = Boolean(phone || (!online && CALL_WORDS.test(text) && !place));
  const app = platform ?? (url ? "Online" : "Video call");

  if (place && online) {
    return { kind: "hybrid", label: `${place} + ${app}`, place, platform, url, mapsUrl: mapsSearchUrl(place) };
  }
  if (online) return { kind: "online", label: app, platform, url, phone, meetingId };
  if (byPhone) return { kind: "phone", label: "Phone call", phone };
  // A plain place keeps the student's own words.
  return { kind: "place", label: tidy(text), place: tidy(text), mapsUrl: mapsSearchUrl(tidy(text)) };
}

/** One line for calendars and messages, e.g. "J. Paul Leonard Library" or "Zoom: https://…". */
export function whereForCalendar(where: Where): { location: string; url?: string } {
  const app = where.url ?? (where.platform && [where.platform, where.meetingId && `ID ${where.meetingId}`].filter(Boolean).join(" "));
  const parts = [where.place, app, where.phone && `Phone: ${where.phone}`].filter(Boolean);
  return { location: parts.join(" · "), url: where.url };
}

/** One-tap choices. Places are real SF State spots; apps leave room to paste a link. */
export const WHERE_SUGGESTIONS: { label: string; value: string; needsLink?: boolean }[] = [
  { label: "Library", value: "J. Paul Leonard Library, SF State" },
  { label: "Student Center", value: "Cesar Chavez Student Center, SF State" },
  { label: "Zoom", value: "Zoom", needsLink: true },
  { label: "Google Meet", value: "Google Meet", needsLink: true },
  { label: "Discord", value: "Discord", needsLink: true },
  { label: "Phone call", value: "Phone call" },
];

// ---------- J. Paul Leonard Library study rooms ----------

/** From library.sfsu.edu/reserve-room: SFSU only, up to 3 hours a day, booked up to 3 days ahead. */
export const LIBRARY_ROOMS = {
  url: "https://sfsu.libcal.com/spaces?lid=24473",
  maxMinutes: 180,
  daysAhead: 3,
};

const LIBRARY_RE = /\b(j\.? ?paul leonard|leonard library|library|lib \d{3})\b/i;

export function isLibrary(where: Where | null): boolean {
  return Boolean(where?.place && LIBRARY_RE.test(where.place));
}

function dayDiff(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * Whether a study room can be booked for this meeting yet, in plain words.
 * Without a confirmed time, just the rules.
 */
export function libraryBooking(
  when: { date: string; durationMinutes: number } | null,
  today: string
): { canBookNow: boolean; note: string } {
  const rules = "Rooms are for SFSU students, up to 3 hours, booked up to 3 days ahead.";
  if (!when) return { canBookNow: true, note: rules };
  if (when.durationMinutes > LIBRARY_ROOMS.maxMinutes) {
    return { canBookNow: false, note: "Study rooms can be booked for up to 3 hours, so shorten the meeting or split it." };
  }
  const ahead = dayDiff(today, when.date);
  if (ahead > LIBRARY_ROOMS.daysAhead) {
    const [y, m, d] = when.date.split("-").map(Number);
    const opens = new Date(Date.UTC(y, m - 1, d - LIBRARY_ROOMS.daysAhead)).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return { canBookNow: false, note: `Booking opens ${opens} (3 days before).` };
  }
  return { canBookNow: true, note: "Book it now: rooms go fast." };
}
