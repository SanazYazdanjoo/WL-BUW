import { canonicalCountry, searchCountries } from "./studentOptions";
import { ComboInput } from "./ComboInput";

// Country field: finds everyday names, official names and aliases ("USA",
// "South Korea", "Persia") and saves the standard spelling.
const countryNoMatch = (text) => `No country matches “${text}”. It will be saved as typed.`;

export function CountryInput(props) {
  return <ComboInput {...props} title="Countries" search={searchCountries} canonical={canonicalCountry} noMatch={countryNoMatch} />;
}

// Study programme field: a plain dropdown on every device. A programme that is
// not in the list (older records) is kept as an extra option so it still shows.
export function ProgramInput({ options, value, onChange, className, ...props }) {
  const current = value || "";
  const list = current && !options.includes(current) ? [current, ...options] : options;
  return (
    <select {...props} className={[className, "staff-program-select"].filter(Boolean).join(" ")} value={current} onChange={(event) => onChange(event.target.value)}>
      <option value="">Select a programme…</option>
      {list.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}
