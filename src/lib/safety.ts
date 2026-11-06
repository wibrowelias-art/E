/**
 * Hard safety filter (spec: block CSAM / sexual content involving minors, scams,
 * doxxing). Applied server-side to every human post and edit, and to every
 * simulator line before it is posted or persisted. Deliberately conservative:
 * it blocks combinations, not single everyday words.
 */

export type SafetyReason = "minors" | "scam" | "doxxing";

const MINOR =
  /\b(child|children|kid|kids|minor|minors|underage|under-age|preteen|pre-teen|schoolgirl|schoolboy|teenie|minderjährig\w*|kinder|grundschul\w*|(1[0-7]|[1-9])\s*(yo|y\/o|years?\s*old|jahre\s*alt|jährige[rn]?))\b/i;
const SEXUAL =
  /\b(sex|sexual|sexuell\w*|nude|nudes|naked|nackt\w*|porn\w*|explicit|horny|erotic|erotisch\w*|onlyfans|lewd|nsfw)\b/i;

const SCAM = [
  /\b(send|sende|schick\w*|überweis\w*|transfer|wire)\b.{0,40}\b(money|geld|btc|bitcoin|eth|crypto|krypto|usdt|paypal|gift\s?cards?|gutschein\w*)\b/i,
  /\b(guaranteed|garantiert\w*)\s+(returns?|profits?|gewinn\w*|rendite\w*)\b/i,
  /\binvestment\s+opportunit/i,
  /\b(seed|recovery)\s+phrase\b|\bprivate\s+key\b/i,
  /\bdouble\s+your\s+(money|crypto|btc)\b/i,
];

const DOXX = [
  // German street address with house number
  /\b[A-ZÄÖÜ][a-zäöüß]+(straße|strasse|str\.|weg|allee|platz|gasse|damm|ring|chaussee|stieg|kamp)\s+\d{1,4}\s?[a-zA-Z]?\b/,
  // mobile numbers
  /(\+49|0049|\b0)\s?1[5-7]\d[\s/-]?\d{3,4}[\s-]?\d{2,5}\b/,
  // IBAN
  /\b[A-Z]{2}\d{2}\s?(\d{4}\s?){4}\d{2}\b/,
  // licence plates (HH-AB 1234)
  /\b[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}\s?\d{1,4}[EH]?\b/,
];

export function safetyCheck(text: string): { ok: true } | { ok: false; reason: SafetyReason } {
  const t = text.normalize("NFKC");
  if (MINOR.test(t) && SEXUAL.test(t)) return { ok: false, reason: "minors" };
  if (SCAM.some((r) => r.test(t))) return { ok: false, reason: "scam" };
  if (DOXX.some((r) => r.test(t))) return { ok: false, reason: "doxxing" };
  return { ok: true };
}

export const SAFETY_MESSAGE: Record<SafetyReason, string> = {
  minors: "Blocked: sexual content involving minors is never allowed here.",
  scam: "Blocked: this looks like a scam or a request for money.",
  doxxing: "Blocked: no addresses, phone numbers, bank details or plates.",
};
