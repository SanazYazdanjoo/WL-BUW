import assert from "node:assert/strict";
import test from "node:test";
import { canonicalCountry, searchCountries } from "../src/staff/studentOptions.js";

const top = (query) => searchCountries(query)[0]?.name;

test("country search finds everyday names, aliases and official names", () => {
  assert.equal(top("germ"), "Germany");
  assert.equal(top("USA"), "United States");
  assert.equal(top("uk"), "United Kingdom");
  assert.equal(top("turkey"), "Türkiye");
  assert.equal(top("persia"), "Iran");
  assert.equal(top("islamic republic"), "Iran");
  assert.equal(top("cote"), "Côte d'Ivoire");
  assert.equal(top("kosovo"), "Kosovo");
  assert.deepEqual(searchCountries("korea").map((c) => c.name).slice(0, 2), ["North Korea", "South Korea"]);
});

test("country search ranks confident matches first and marks loose ones", () => {
  assert.equal(searchCountries("ind")[0].name, "India");
  assert.equal(searchCountries("ind")[0].prefix, true);
  const loose = searchCountries("stan").find((c) => c.name === "Afghanistan");
  assert.equal(loose.prefix, false);
  assert.equal(searchCountries("").length, 250);
  assert.deepEqual(searchCountries("zzzz"), []);
});

test("typed names and aliases are saved in the standard spelling", () => {
  assert.equal(canonicalCountry("usa"), "United States");
  assert.equal(canonicalCountry("  germany "), "Germany");
  assert.equal(canonicalCountry("Russian Federation"), "Russia");
  assert.equal(canonicalCountry("Korea"), null);
  assert.equal(canonicalCountry("Stateless"), null);
});
