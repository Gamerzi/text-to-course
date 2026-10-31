import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TextField from "../components/TextField.jsx";
import PasswordField from "../components/PasswordField.jsx";
import "../styles/RegisterForm.css";

export default function RegisterForm({ onSwitch }) {
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: ""
    });

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const update = (key) => (e) =>
        setForm({ ...form, [key]: e.target.value });

    const validate = () => {
        const next = {};

        if (!form.name.trim()) {
            next.name = "Enter your name.";
        }

        if (!/^\S+@\S+\.\S+$/.test(form.email)) {
            next.email = "Enter a valid email address.";
        }

        if (form.password.length < 8) {
            next.password = "Use at least 8 characters.";
        }

        return next;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const next = validate();
        setErrors(next);

        if (Object.keys(next).length > 0) return;

        setLoading(true);

        try {
            const response = await fetch(
                "http://localhost:5000/api/users/register",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name: form.name.trim(),
                        email: form.email.trim(),
                        password: form.password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success || !data.token) {
                throw new Error(
                    data.message || "Registration failed."
                );
            }

            // Store JWT for protected routes.
            localStorage.setItem("token", data.token);

            // Navigate to your courses page.
            navigate("/courses");

        } catch (error) {
            setErrors({
                general:
                    error.message ||
                    "Could not connect to the backend."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form
            className="register"
            onSubmit={handleSubmit}
            noValidate
        >
            <h1 className="register__title">Create account</h1>

            <div className="register__fields">
                <TextField
                    id="reg-name"
                    placeholder="Full name"
                    autoComplete="name"
                    value={form.name}
                    onChange={update("name")}
                    error={errors.name}
                />

                <TextField
                    id="reg-email"
                    type="email"
                    placeholder="Email address"
                    autoComplete="email"
                    value={form.email}
                    onChange={update("email")}
                    error={errors.email}
                />

                <PasswordField
                    id="reg-password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={update("password")}
                    error={errors.password}
                />
            </div>

            {errors.general && (
                <p role="alert" className="register__error">
                    {errors.general}
                </p>
            )}

            <button
                type="submit"
                className="register__submit"
                disabled={loading}
            >
                {loading ? "Creating account..." : "Create account"}
            </button>

            <p className="register__terms">
                By creating an account you agree to the{" "}
                <a href="#terms">Terms of Service</a> and{" "}
                <a href="#privacy">Privacy Policy</a>.
            </p>

            <p className="register__switch">
                Have an account?{" "}
                <button
                    type="button"
                    className="register__link"
                    onClick={onSwitch}
                >
                    Log in
                </button>
            </p>
        </form>
    );
}
