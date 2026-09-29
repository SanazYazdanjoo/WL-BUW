import { useCallback } from "react";
import { canonicalCountry, foldText, searchCountries, searchOptions } from "./studentOptions";
import { ComboInput } from "./ComboInput";

// Country field: finds everyday names, official names and aliases ("USA",
// "South Korea", "Persia") and saves the standard spelling.
const countryNoMatch = (text) => `No country matches “${text}”. It will be saved as typed.`;

export function CountryInput(props) {
  return <ComboInput {...props} title="Countries" search={searchCountries} canonical={canonicalCountry} noMatch={countryNoMatch} />;
}

// Study programme field: suggests the programmes already in use; any name can be typed.
const programNoMatch = (text) => `No programme matches “${text}”. It will be saved as typed.`;

export function ProgramInput({ options, maxLength = 300, ...props }) {
  const search = useCallback((query) => searchOptions(options, query), [options]);
  const canonical = useCallback((value) => options.find((option) => foldText(option) === foldText(value)) || null, [options]);
  return <ComboInput {...props} maxLength={maxLength} title="Study programmes" search={search} canonical={canonical} noMatch={programNoMatch} />;
}
