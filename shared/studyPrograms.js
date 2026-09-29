// Programmes the Welcome Lounge writes by their short name. Long spellings found in the
// workbook or typed by staff are stored as the short name.
export const PROGRAM_SHORT_NAMES = {
  "Natural Hazards and Risks in Structural Engineering": "NHRE",
  "Digital Engineering": "DigiEng",
  "Computer Science for Digital Media": "CS4DM",
  "Digital Technologies in Architecture and Design": "DigiTechs",
  "Integrated Urban Development and Design": "IUDD",
  "Human-Computer Interaction": "HCI",
};
const byFolded = new Map(Object.entries(PROGRAM_SHORT_NAMES).map(([long, short]) => [long.toLowerCase().replace(/\s+/g, " "), short]));

export const shortProgram = (value) => (typeof value === "string" ? byFolded.get(value.trim().toLowerCase().replace(/\s+/g, " ")) ?? value : value);

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
