import { useState } from "react";
import "../styles/PasswordField.css";

export default function PasswordField({
    id,
    placeholder = "Password",
    value,
    onChange,
    autoComplete,
    error,
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="pw">
            <div className="pw__wrap">
                <input
                    id={id}
                    className={`pw__input ${error ? "pw__input--error" : ""}`}
                    type={visible ? "text" : "password"}
                    placeholder={placeholder}
                    aria-label={placeholder}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-error` : undefined}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                />
                <button
                    type="button"
                    className="pw__toggle"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                        {visible && <path d="M3 3l18 18" />}
                    </svg>
                </button>
            </div>
            {error && (
                <p id={`${id}-error`} className="pw__error">
                    {error}
                </p>
            )}
        </div>
    );
}