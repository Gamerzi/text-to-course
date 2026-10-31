import { useState } from "react";
import VideoPanel from "./VideoPanel.jsx";
import LoginForm from "../pages/LoginForm.jsx";
import RegisterForm from "../pages/RegisterForm.jsx";
import "../styles/AuthPage.css";

const BRAND = "nightdesk"; // change your app name here

export default function AuthPage() {
    const [mode, setMode] = useState("register"); // "login" | "register"

    return (
        <main className="auth-frame">
            <section className="auth-stage">
                <VideoPanel />

                <div className="auth-card">
                    <div className="auth-brand">
                        <span className="auth-brand__mark" aria-hidden="true" />
                        <span className="auth-brand__name">{BRAND}</span>
                    </div>

                    {mode === "login" ? (
                        <LoginForm onSwitch={() => setMode("register")} />
                    ) : (
                        <RegisterForm onSwitch={() => setMode("login")} />
                    )}
                </div>
            </section>
        </main>
    );
}