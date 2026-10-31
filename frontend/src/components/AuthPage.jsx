import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import VideoPanel from "./VideoPanel.jsx";
import LoginForm from "../pages/LoginForm.jsx";
import RegisterForm from "../pages/RegisterForm.jsx";
import "../styles/AuthPage.css";

const BRAND = "nightdesk"; // change your app name here

export default function AuthPage({ initialMode }) {
    const location = useLocation();
    const navigate = useNavigate();

    // Default to register for "/" or "/register", and login for "/login"
    const getModeFromPath = () => {
        if (location.pathname === "/login") return "login";
        return initialMode || "register";
    };

    const [mode, setMode] = useState(getModeFromPath);

    useEffect(() => {
        if (location.pathname === "/login") {
            setMode("login");
        } else if (location.pathname === "/" || location.pathname === "/register") {
            setMode("register");
        }
    }, [location.pathname]);

    const handleSwitchToLogin = () => {
        setMode("login");
        navigate("/login");
    };

    const handleSwitchToRegister = () => {
        setMode("register");
        navigate("/register");
    };

    return (
        <div className="auth-page-wrapper">
            <main className="auth-frame">
                <section className="auth-stage">
                    <VideoPanel />

                    <div className="auth-card">
                        <div className="auth-brand">
                            <span className="auth-brand__mark" aria-hidden="true" />
                            <span className="auth-brand__name">{BRAND}</span>
                        </div>

                        {mode === "login" ? (
                            <LoginForm onSwitch={handleSwitchToRegister} />
                        ) : (
                            <RegisterForm onSwitch={handleSwitchToLogin} />
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
