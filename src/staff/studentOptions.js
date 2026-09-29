import { COUNTRIES } from "./countries.js";
import { PROGRAM_SHORT_NAMES } from "../../shared/studyPrograms.js";

// "Côte d'Ivoire" → "cote d ivoire", so accents and punctuation never block a match.
export const foldText = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const INDEX = COUNTRIES.map(([name, aliases = []]) => ({ name, folded: foldText(name), aliases: aliases.map((alias) => ({ alias, folded: foldText(alias) })) }));
const startsWord = (text, query) => text.startsWith(query) || text.includes(` ${query}`);

// Countries matching what the tutor typed, best first: name starts with it,
// then a word in the name, then an alias ("USA", "Persia"), then anywhere.
// `prefix` tells the picker the top result is a confident guess worth pre-selecting.
export function searchCountries(query) {
  const q = foldText(query);
  if (!q) return INDEX.map(({ name }) => ({ name, prefix: false }));
  const results = [];
  for (const country of INDEX) {
    const alias = country.aliases.find((a) => a.folded === q) || country.aliases.find((a) => startsWord(a.folded, q));
    // An exact abbreviation ("UK") beats a name that merely starts the same way ("Ukraine").
    if (country.folded === q) results.push({ name: country.name, rank: -1 });
    else if (alias?.folded === q) results.push({ name: country.name, alias: alias.alias, rank: -0.5 });
    else if (country.folded.startsWith(q)) results.push({ name: country.name, rank: 0 });
    else if (startsWord(country.folded, q)) results.push({ name: country.name, rank: 1 });
    else if (alias) results.push({ name: country.name, alias: alias.alias, rank: 2 });
    else if (country.folded.includes(q)) results.push({ name: country.name, rank: 3 });
  }
  return results.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map(({ name, alias, rank }) => ({ name, alias, prefix: rank < 3 }));
}

// The standard spelling for a typed name or alias ("usa" → "United States"), if any.
export function canonicalCountry(value) {
  const q = foldText(value);
  if (!q) return null;
  const hits = INDEX.filter((country) => country.folded === q || country.aliases.some((a) => a.folded === q));
  return hits.length === 1 ? hits[0].name : null;
}

// Suggested names from BUW's 2026 academic-programme overview
// (https://www.uni-weimar.de/en/university/studies/academic-programmes/).
// Existing
// workbook values are added at runtime, and tutors can type other programmes.
export const STUDY_PROGRAM_OPTIONS = [
  "Architecture",
  "Architecture and Urbanism",
  "Art Education for Secondary Schools",
  "Art and Design (PhD)",
  "Building Materials Engineering",
  "Civil Engineering",
  "Civil Engineering – Structural Engineering",
  "Computer Science",
  "European Media Culture",
  "European Urban Studies",
  "Fine Art",
  "Film Cultures – Extended Cinema",
  "Management [Construction, Real Estate and Infrastructure]",
  "Media Art and Design",
  "Media Culture",
  "Media Management",
  "MediaEcologies",
  "Media Studies",
  "Product Design",
  "Urbanism",
  "Visual Communication",
  "Environmental Engineering",
  ...Object.values(PROGRAM_SHORT_NAMES),
].sort((a, b) => a.localeCompare(b));
