// Programmes the Welcome Lounge writes by their short name. Long spellings found in the
// workbook or typed by staff are stored as the short name.
export const PROGRAM_SHORT_NAMES = {
  "Natural Hazards and Risks in Structural Engineering": "NHRE",
  "Digital Engineering": "DigiEng",
  "Computer Science for Digital Media": "CS4DM",
  "Digital Technologies in Architecture and Design": "DigiTechs",
};
const byFolded = new Map(Object.entries(PROGRAM_SHORT_NAMES).map(([long, short]) => [long.toLowerCase().replace(/\s+/g, " "), short]));

export const shortProgram = (value) => (typeof value === "string" ? byFolded.get(value.trim().toLowerCase().replace(/\s+/g, " ")) ?? value : value);
