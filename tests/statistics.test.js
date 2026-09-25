import test from "node:test";
import assert from "node:assert/strict";
import { fairShare, formatHours, shiftHours, tutorStatistics } from "../src/staff/statistics.js";

test("tutor hours add up worked and planned shifts within the semester period", () => {
  assert.equal(shiftHours("10:00–13:00"), 3);
  assert.equal(shiftHours("9.30 - 12.00"), 2.5);
  assert.equal(shiftHours("mornings"), null);
  assert.equal(formatHours(2.5), "2.5 h");
  const rows = tutorStatistics({
    shiftTimes: { first: "10:00–13:00", second: "12:00–15:00" },
    tutors: ["Sanaz", "Ali", "Zarina", ""],
    schedule: { start: "2026-09-28", end: "2026-10-09" },
    today: "2026-09-29",
    shifts: [
      { date: "2026-09-20", first: ["Ali", "", "", ""], second: ["", "", "", ""] },
      { date: "2026-09-28", first: ["Sanaz", "ali ", "", ""], second: ["Sanaz", "", "", ""] },
      { date: "2026-10-01", first: ["Ali", "", "", ""], second: ["Daniel", "", "", ""] },
    ],
  });
  assert.deepEqual(rows.map(({ name, first, second, done, planned, total }) => [name, first, second, done, planned, total]), [
    ["Ali", 2, 0, 3, 3, 6],
    ["Sanaz", 1, 1, 6, 0, 6],
    ["Daniel", 0, 1, 0, 3, 3],
    ["Zarina", 0, 0, 0, 0, 0],
  ]);
});

test("fair share divides the hours of open days between the tutors", () => {
  const shiftTimes = { first: "10:00–13:00", second: "12:00–15:00" };
  const tutors = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  // Two weeks Mon 2026-09-28 – Fri 2026-10-09: 10 weekdays, Fri 2026-10-02 closed, Sat 2026-10-03 staffed.
  const shifts = [
    { date: "2026-10-02", first: ["", "", "", ""], second: ["", "", "", ""], event: "Bank Holiday" },
    { date: "2026-10-03", first: ["A", "", "", ""], second: ["", "", "", ""], event: "" },
  ];
  const fair = fairShare({ shifts, shiftTimes, tutors, schedule: { start: "2026-09-28", end: "2026-10-09", perShift: 3 } });
  assert.deepEqual(fair, { openDays: 10, perShift: 3, tutorCount: 10, totalHours: 180, perTutor: 18 });
  assert.equal(fairShare({ shifts, shiftTimes, tutors, schedule: {} }), null);
  assert.equal(fairShare({ shifts, shiftTimes, tutors: [], schedule: { start: "2026-09-28", end: "2026-10-09" } }), null);
});
