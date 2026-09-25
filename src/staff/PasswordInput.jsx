import { useState } from "react";

// Password field with a Show/Hide toggle. Other props go to the <input>.
export function PasswordInput(props) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="staff-password">
      <input {...props} type={visible ? "text" : "password"} autoCapitalize="none" spellCheck={false} />
      <button type="button" className="staff-password-toggle" aria-pressed={visible} aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible((value) => !value)}>
        {visible ? "Hide" : "Show"}
      </button>
    </span>
  );
}
