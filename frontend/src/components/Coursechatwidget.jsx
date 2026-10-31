import { useEffect, useRef, useState } from "react";
import robotVideo from "../assets/videos/robot.mp4";
import "../styles/CoursechatWidget.css";

const API_BASE = "http://localhost:5000/api/courses";
const TOKEN_KEY = "token";

const SUGGESTIONS = [
    "Learn React",
    "Master Python",
    "Data Structures",
    "Machine Learning",
];

const SparkleIcon = () => (
    <svg
        className="ccw-sparkle"
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M13 6l2.2 6.8L22 15l-6.8 2.2L13 24l-2.2-6.8L4 15l6.8-2.2z" />
        <path d="M24 4l.9 2.6L27.5 7.5l-2.6.9L24 11l-.9-2.6-2.6-.9 2.6-.9z" />
        <path d="M25 20l.8 2.2 2.2.8-2.2.8L25 26l-.8-2.2-2.2-.8 2.2-.8z" />
    </svg>
);

/**
 * Robot video that fades in only once it can play,
 * and whose edges melt into the dialog background.
 */
function RobotStage() {
    const videoRef = useRef(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const reduce = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        if (reduce) {
            video.pause();
        } else {
            // Some browsers need an explicit play() after mount
            video.play().catch(() => { });
        }
    }, []);

    return (
        <div className="ccw-stage" aria-hidden="true">
            <div className="ccw-stage-glow" />
            <video
                ref={videoRef}
                className={`ccw-video${ready ? " is-ready" : ""}`}
                src={robotVideo}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onCanPlay={() => setReady(true)}
            />
        </div>
    );
}

/**
 * Floating button + centered dialog that generates a course from a prompt.
 *
 * Props:
 *  - onCreated(course): called after the backend returns the new course.
 *  - onOpenCourse(course): optional, used by the "Open course" button.
 */
export default function CourseChatWidget({ onCreated, onOpenCourse }) {
    const [open, setOpen] = useState(false);
    const [topic, setTopic] = useState("");
    // "idle" | "loading" | "done" | "error"
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");
    const [course, setCourse] = useState(null);

    const inputRef = useRef(null);
    const generating = status === "loading";

    const openDialog = () => {
        // Start fresh if the last run already finished
        if (status === "done" || status === "error") {
            setStatus("idle");
            setError("");
            setCourse(null);
        }
        setOpen(true);
    };

    const closeDialog = () => setOpen(false);

    // Focus the input, lock page scroll, close on Escape
    useEffect(() => {
        if (!open) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKey = (e) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);

        const timer = setTimeout(() => inputRef.current?.focus(), 250);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKey);
            clearTimeout(timer);
        };
    }, [open]);

    const generate = async (e) => {
        e?.preventDefault();

        const text = topic.trim();
        if (!text || generating) return;

        setStatus("loading");
        setError("");

        try {
            const token = localStorage.getItem(TOKEN_KEY);

            const response = await fetch(`${API_BASE}/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                // Adjust these keys if your controller expects different names
                body: JSON.stringify({ topic: text, prompt: text }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message ||
                    "We couldn't generate that course. Please try again."
                );
            }

            // Support a few common response shapes
            const created = data.course || data.data || data;

            setCourse(created);
            setStatus("done");
            setTopic("");
            onCreated?.(created);
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again.");
            setStatus("error");
        }
    };

    const handleOpenCourse = () => {
        setOpen(false);
        if (course) onOpenCourse?.(course);
    };

    const createAnother = () => {
        setStatus("idle");
        setCourse(null);
        setError("");
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const pickSuggestion = (text) => {
        if (generating) return;
        setTopic(text);
        inputRef.current?.focus();
    };

    const heading = {
        idle: "What do you want to learn today?",
        error: "What do you want to learn today?",
        loading: "Building your course…",
        done: "Your course is ready!",
    }[status];

    const subheading = {
        idle: "Your AI learning assistant will build a personalized course just for you.",
        error: "Your AI learning assistant will build a personalized course just for you.",
        loading: "Writing lessons and objectives. This can take a minute.",
        done: course?.title
            ? `“${course.title}” was added to My Courses.`
            : "It was added to My Courses.",
    }[status];

    return (
        <>
            {!open && (
                <button
                    type="button"
                    className="ccw-fab"
                    onClick={openDialog}
                    aria-label="Create a course"
                >
                    <SparkleIcon />
                    <span className="ccw-fab-label">
                        {generating ? "Generating…" : "New course"}
                    </span>
                    {generating && <span className="ccw-fab-dot" />}
                </button>
            )}

            {open && (
                <div
                    className="ccw-overlay"
                    onMouseDown={(e) =>
                        e.target === e.currentTarget && closeDialog()
                    }
                >
                    <section
                        className="ccw-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ccw-title"
                    >
                        <button
                            type="button"
                            className="ccw-close"
                            onClick={closeDialog}
                            aria-label="Close"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>

                        <RobotStage />

                        <div className="ccw-content">
                            <h2 id="ccw-title" key={status}>
                                {heading}
                            </h2>
                            <p className="ccw-sub">{subheading}</p>

                            {status !== "done" && (
                                <form className="ccw-form" onSubmit={generate}>
                                    <label className="ccw-field">
                                        <SparkleIcon />
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={topic}
                                            onChange={(e) =>
                                                setTopic(e.target.value)
                                            }
                                            placeholder="Describe the course you want to create..."
                                            disabled={generating}
                                            maxLength={200}
                                            aria-label="Course topic"
                                        />
                                    </label>

                                    {status === "error" && (
                                        <p className="ccw-error" role="alert">
                                            {error}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        className="ccw-generate"
                                        disabled={generating || !topic.trim()}
                                    >
                                        {generating ? (
                                            <>
                                                <span className="ccw-spinner" />
                                                Generating…
                                            </>
                                        ) : status === "error" ? (
                                            "Try again"
                                        ) : (
                                            "Generate My Course"
                                        )}
                                    </button>

                                    <div className="ccw-chips">
                                        {SUGGESTIONS.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => pickSuggestion(s)}
                                                disabled={generating}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </form>
                            )}

                            {status === "done" && (
                                <div className="ccw-done">
                                    {onOpenCourse && (
                                        <button
                                            type="button"
                                            className="ccw-generate"
                                            onClick={handleOpenCourse}
                                        >
                                            Open course
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="ccw-secondary"
                                        onClick={createAnother}
                                    >
                                        Create another
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}