// Tutor hours from the shift grid, shared by the Statistics page and tests.
// "10:00–13:00" → 3; returns null when the time text can't be read.
export function shiftHours(range) {
  const match = String(range || "").match(/(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const minutes = (Number(match[3]) * 60 + Number(match[4])) - (Number(match[1]) * 60 + Number(match[2]));
  return minutes > 0 ? minutes / 60 : null;
}
export const formatHours = (hours) => `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;

export function tutorStatistics({ shifts, shiftTimes, tutors = [], schedule = {}, today }) {
  const hours = { first: shiftHours(shiftTimes.first) ?? 0, second: shiftHours(shiftTimes.second) ?? 0 };
  const rows = new Map();
  const entry = (name) => {
    const key = name.trim().toLocaleLowerCase("en");
    if (!rows.has(key)) rows.set(key, { name: name.trim(), first: 0, second: 0, done: 0, planned: 0 });
    return rows.get(key);
  };
  for (const name of tutors) if (name?.trim()) entry(name);
  for (const day of shifts) {
    if ((schedule.start && day.date < schedule.start) || (schedule.end && day.date > schedule.end)) continue;
    for (const slot of ["first", "second"])
      for (const name of new Set(day[slot].map((value) => value.trim()).filter(Boolean))) {
        const row = entry(name);
        row[slot] += 1;
        row[day.date <= today ? "done" : "planned"] += hours[slot];
      }
  }
  return [...rows.values()].map((row) => ({ ...row, total: row.done + row.planned })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
