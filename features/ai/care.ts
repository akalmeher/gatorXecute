/**
 * Feature Owner: Divij Anand
 * Deterministic care rules that hold no matter what a model says. Safe to
 * import from client components.
 *
 * - Crisis language always surfaces support resources.
 * - Personal/health/family details always mark a message as personal, and
 *   the version shared with teammates may never contain them.
 * - People are referred to by name or "they": never by a guessed pronoun.
 */

/** Matches language that suggests risk of self-harm. Deliberately broad: a false positive only shows resources. */
const CRISIS =
  /\b(suicid\w*|kill(ing)? myself|end(ing)? (my|it all|my life)|take my (own )?life|want to die|wanna die|don'?t want to (live|be here|exist)|self[- ]?harm\w*|hurt(ing)? myself|no reason to live|better off (dead|without me))\b/i;

/** Personal, health, family and grief details that teammates shouldn't see unless the student chooses to share them. */
const PERSONAL =
  /\b(cancer|tumou?r|chemo\w*|sick|ill(ness)?|hospital\w*|hospice|surgery|diagnos\w*|death ?bed|dying|died|passed away|funeral|grie\w+|mourn\w*|terminal|disease|injur\w*|pregnan\w*|miscarr\w*|therap\w*|depress\w*|anxiety|panic attack|mental health|medication|rehab|overdose|accident|emergency|abuse\w*|divorce|evict\w*|homeless\w*|mom|mum|mother|dad|father|grand(ma|pa|mother|father)|parent|sister|brother|family|sad|crying|heartbroken|overwhelm\w*|stress\w*|anxious|burn(ed|t)? ?out|exhausted|struggl\w*|lonely|scared|afraid|upset|hopeless)\b/i;

export const SUPPORT = {
  crisisLine: "988 Suicide & Crisis Lifeline: call or text 988 (24/7, free)",
  campus: { name: "SFSU Counseling & Psychological Services (CAPS)", detail: "Same Day Support", url: "https://caps.sfsu.edu/" },
} as const;

export function mentionsCrisis(text: string): boolean {
  return CRISIS.test(text);
}

export function mentionsPersonal(text: string): boolean {
  return PERSONAL.test(text) || CRISIS.test(text);
}

/** Words in a teammate-facing summary that reveal personal details (should be empty). */
export function personalDetailsIn(text: string): string[] {
  const found = new Set<string>();
  const re = new RegExp(PERSONAL.source, "gi");
  for (const match of text.matchAll(re)) found.add(match[0].toLowerCase());
  if (CRISIS.test(text)) found.add("crisis language");
  return [...found];
}

/** Safe fallback for what teammates see, with no reason given. */
export function discreetNote(name: string, awayFrom?: string, awayTo?: string): string {
  const first = name.trim().split(/\s+/)[0] || "A teammate";
  if (!awayFrom) return `${first} needs some time away for a personal matter.`;
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  };
  const range = !awayTo || awayTo === awayFrom ? fmt(awayFrom) : `${fmt(awayFrom)}–${fmt(awayTo)}`;
  return `${first} is away ${range} for a personal matter.`;
}

const PRONOUN = /\b(he|she|him|her|his|hers|himself|herself)\b/i;

/**
 * Model-written strings that use a gendered pronoun. Strings copied from the
 * student's own words (they appear in the input) are allowed: students may
 * talk about their mom; the AI may not guess anyone's pronouns.
 */
export function guessedPronouns(output: unknown, input: string): string[] {
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      if (PRONOUN.test(value) && !input.includes(value)) found.push(value);
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(output);
  return found;
}
