// Every date people read or type uses DD.MM.YYYY; times are 24-hour Weimar time.
// Stored values stay ISO (YYYY-MM-DD) so they sort and validate simply.
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEIMAR = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Berlin" });
const weimarParts = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : Object.fromEntries(WEIMAR.formatToParts(date).map(({ type, value: part }) => [type, part]));
};

// "2026-09-29" or a timestamp → "29.09.2026"; "" when the value is empty or invalid.
export function formatDate(value) {
  if (!value) return "";
  const iso = String(value).match(ISO_DAY);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const p = weimarParts(value);
  return p ? `${p.day}.${p.month}.${p.year}` : "";
}

// A timestamp → "29.09.2026, 14:05" in Weimar time; "" when invalid.
export function formatDateTime(value) {
  if (!value) return "";
  const p = weimarParts(value);
  return p ? `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}` : "";
}

// "29.09.2026" (also "29.9.2026") or "2026-09-29" → "2026-09-29"; "" when it is not a real date.
export function parseDate(text) {
  const value = String(text ?? "").trim();
  const german = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const iso = german ? `${german[3]}-${german[2].padStart(2, "0")}-${german[1].padStart(2, "0")}` : value;
  if (!ISO_DAY.test(iso)) return "";
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : "";
}
