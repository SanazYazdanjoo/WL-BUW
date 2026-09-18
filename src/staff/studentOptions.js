import { getNames } from "country-list";

export const COUNTRY_OPTIONS = getNames().sort((a, b) => a.localeCompare(b));

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
  "Computer Science for Digital Media",
  "Digital Engineering",
  "Digital Technologies in Architecture and Design",
  "European Media Culture",
  "European Urban Studies",
  "Fine Art",
  "Film Cultures – Extended Cinema",
  "Human-Computer Interaction",
  "Integrated Urban Development and Design",
  "Management [Construction, Real Estate and Infrastructure]",
  "Media Art and Design",
  "Media Culture",
  "Media Management",
  "MediaEcologies",
  "Media Studies",
  "Natural Hazards and Risks in Structural Engineering",
  "Product Design",
  "Urbanism",
  "Visual Communication",
  "Environmental Engineering",
].sort((a, b) => a.localeCompare(b));
