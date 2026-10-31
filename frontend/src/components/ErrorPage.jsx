import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ErrorPage.css";

export default function ErrorPage({
    title = "Something Went Wrong",
    message = "We couldn't load this content. Please try again or head back to your courses.",
    details = "",
    badge = "LOAD FAILED",
    onRetry = null,
    onBack = null,
    backText = "Back to My Courses",
    backUrl = "/courses",
}) {
    const navigate = useNavigate();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else if (backUrl) {
            navigate(backUrl);
        } else {
            navigate("/courses");
        }
    };

    return (
        <main className="ep-container">
            {/* Ambient Background Glows */}
            <div className="ep-ambient" aria-hidden="true">
                <span className="ep-orb ep-orb-1" />
                <span className="ep-orb ep-orb-2" />
                <span className="ep-orb ep-orb-3" />
            </div>

            <div className="ep-card">
                {/* Visual Animated Status Icon */}
                <div className="ep-icon-wrap" aria-hidden="true">
                    <span className="ep-icon-ring ep-icon-ring--outer" />
                    <span className="ep-icon-ring ep-icon-ring--inner" />
                    <div className="ep-icon-core">
                        <span>⚠</span>
                    </div>
                </div>

                {/* Status Pill */}
                <span className="ep-badge">{badge}</span>

                {/* Title & Explanation */}
                <h1 className="ep-title">{title}</h1>
                <p className="ep-desc">{message}</p>

                {/* Optional Tech Error Details */}
                {details && (
                    <div className="ep-details" title="Error details">
                        <code>{String(details)}</code>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="ep-actions">
                    {onRetry && (
                        <button
                            type="button"
                            className="ep-btn ep-btn-primary"
                            onClick={onRetry}
                        >
                            <span>↻</span> Try Again
                        </button>
                    )}

                    <button
                        type="button"
                        className="ep-btn ep-btn-secondary"
                        onClick={handleBack}
                    >
                        <span>←</span> {backText}
                    </button>
                </div>
            </div>
        </main>
    );
}

