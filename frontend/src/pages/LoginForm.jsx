
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TextField from "../components/TextField.jsx";
import PasswordField from "../components/PasswordField.jsx";
import "../styles/LoginForm.css";

export default function LoginForm({ onSwitch }) {
    const [form, setForm] = useState({
        email: "",
        password: "",
        remember: false
    });

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        const next = {};

        if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
            next.email = "Enter a valid email address.";
        }

        if (!form.password) {
            next.password = "Enter your password.";
        }

        setErrors(next);

        if (Object.keys(next).length > 0) return;

        setLoading(true);

        try {
            const response = await fetch(
                "http://localhost:5000/api/users/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email: form.email.trim(),
                        password: form.password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success || !data.token) {
                throw new Error(data.message || "Login failed.");
            }

            localStorage.setItem("token", data.token);

            if (form.remember) {
                localStorage.setItem("email", form.email.trim());
            } else {
                localStorage.removeItem("email");
            }

            navigate("/courses");
        } catch (error) {
            setErrors({
                general: error.message || "Unable to connect to the server."
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="login" onSubmit={handleSubmit} noValidate>
            <h1 className="login__title">Welcome back</h1>

            <div className="login__fields">
                <TextField
                    id="login-email"
                    type="email"
                    placeholder="Email address"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                    }
                    error={errors.email}
                />

                <PasswordField
                    id="login-password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                    }
                    error={errors.password}
                />
            </div>

            {errors.general && (
                <p role="alert" className="login__error">
                    {errors.general}
                </p>
            )}

            <div className="login__row">
                <label className="login__remember">
                    <input
                        type="checkbox"
                        checked={form.remember}
                        onChange={(e) =>
                            setForm({ ...form, remember: e.target.checked })
                        }
                    />
                    Remember me
                </label>

                <a className="login__forgot" href="#forgot">
                    Forgot password?
                </a>
            </div>

            <button
                type="submit"
                className="login__submit"
                disabled={loading}
            >
                {loading ? "Logging in..." : "Log in"}
            </button>

            <p className="login__switch">
                New here?{" "}
                <button
                    type="button"
                    className="login__link"
                    onClick={onSwitch}
                >
                    Create account
                </button>
            </p>
        </form>
    );
}
