import "../styles/TextField.css";

export default function TextField({
    id,
    type = "text",
    placeholder,
    value,
    onChange,
    autoComplete,
    error,
}) {
    return (
        <div className="field">
            <input
                id={id}
                className={`field__input ${error ? "field__input--error" : ""}`}
                type={type}
                placeholder={placeholder}
                aria-label={placeholder}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
                value={value}
                onChange={onChange}
                autoComplete={autoComplete}
            />
            {error && (
                <p id={`${id}-error`} className="field__error">
                    {error}
                </p>
            )}
        </div>
    );
}