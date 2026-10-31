import { API_URL } from "../config.js";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProgressBar } from "../components/ProgressBar";
import ErrorPage from "../components/ErrorPage.jsx";
import { getTopicLogo } from "../utils/topicHelpers.js";

import "../styles/CourseDetails.css";

const API_BASE = `${API_URL}/api/courses`;

/* Animated number counter */
function CountUp({ value, duration = 900 }) {
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        const target = Number(value) || 0;
        let start = null;
        let frame;

        const step = (timestamp) => {
            if (start === null) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(eased * target));
            if (progress < 1) frame = requestAnimationFrame(step);
        };

        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [value, duration]);

    return <>{display}</>;
}

export default function CourseDetails() {
    const { courseSlug } = useParams();
    const navigate = useNavigate();

    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    // Share states
    const [shareOpen, setShareOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [users, setUsers] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [shareError, setShareError] = useState("");
    const [shareMessage, setShareMessage] = useState("");
    const [sharingUserId, setSharingUserId] = useState(null);

    // Delete states
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [deleteOpen, setDeleteOpen] = useState(false);

    // UI-only states
    const [toast, setToast] = useState(null);
    const heroRef = useRef(null);
    const [progress, setProgress] = useState(null);

    const getToken = () => localStorage.getItem("token");

    const getHeaders = () => {
        const token = getToken();

        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const showToast = (message, type = "success") => {
        setToast({ message, type, id: Date.now() });
    };

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(timer);
    }, [toast]);

    // Mouse-follow spotlight on hero
    const handleHeroMove = (event) => {
        const el = heroRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        el.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };

    // --------------------------------
    // FETCH COURSE
    // --------------------------------

    useEffect(() => {
        const controller = new AbortController();

        const fetchCourse = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await fetch(
                    `${API_BASE}/${encodeURIComponent(courseSlug)}`,
                    {
                        signal: controller.signal,
                        headers: getHeaders(),
                    }
                );

                const data = await response.json();

                if (!response.ok || data.success === false) {
                    throw new Error(data.message || "Unable to load course.");
                }

                setCourse(data.course);

                // Load course progress directly
                try {
                    let pRes = await fetch(
                        `${API_URL}/api/course-progress/${encodeURIComponent(courseSlug)}`,
                        { signal: controller.signal, headers: getHeaders() }
                    );
                    if (!pRes.ok) {
                        pRes = await fetch(
                            `${API_URL}/api/progress/${encodeURIComponent(courseSlug)}`,
                            { signal: controller.signal, headers: getHeaders() }
                        );
                    }
                    if (pRes.ok) {
                        const pData = await pRes.json();
                        setProgress(pData);
                    }
                } catch {
                    /* ignore progress fetch failure */
                }
            } catch (err) {
                if (err.name !== "AbortError") {
                    setError(err.message);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchCourse();

        return () => controller.abort();
    }, [courseSlug]);

    // --------------------------------
    // SEARCH USERS
    // --------------------------------

    useEffect(() => {
        if (!shareOpen) return;

        const query = searchQuery.trim();

        if (query.length < 2) {
            setUsers([]);
            setShareError("");
            setSearchLoading(false);
            return;
        }

        const controller = new AbortController();

        const timer = setTimeout(async () => {
            try {
                setSearchLoading(true);
                setShareError("");
                setShareMessage("");

                const response = await fetch(
                    `${API_BASE}/share/search-users?q=${encodeURIComponent(query)}`,
                    {
                        signal: controller.signal,
                        headers: getHeaders(),
                    }
                );

                const data = await response.json();

                if (!response.ok || data.success === false) {
                    throw new Error(data.message || "Unable to search users.");
                }

                setUsers(Array.isArray(data.users) ? data.users : []);
            } catch (err) {
                if (err.name !== "AbortError") {
                    setShareError(err.message);
                    setUsers([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setSearchLoading(false);
                }
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [searchQuery, shareOpen]);

    // Close modals with Escape
    useEffect(() => {
        const onKey = (event) => {
            if (event.key === "Escape") {
                setShareOpen(false);
                if (!deleting) setDeleteOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [deleting]);

    // --------------------------------
    // SHARE COURSE WITH USER
    // --------------------------------

    const shareWithUser = async (user) => {
        if (!course) return;

        try {
            setSharingUserId(user._id);
            setShareError("");
            setShareMessage("");

            const response = await fetch(`${API_BASE}/share`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({
                    courseSlug,
                    userId: user._id,
                }),
            });

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Unable to share course.");
            }

            setCourse((previous) => ({
                ...previous,
                sharedWith: [
                    ...(previous.sharedWith || []).filter(
                        (entry) =>
                            String(entry?._id || entry) !== String(user._id)
                    ),
                    {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                    },
                ],
            }));

            const msg =
                data.message || `Course shared with ${user.name || user.email}.`;
            setShareMessage(msg);
            showToast(msg, "success");
        } catch (err) {
            setShareError(err.message);
        } finally {
            setSharingUserId(null);
        }
    };

    // --------------------------------
    // DELETE COURSE
    // --------------------------------

    const deleteCourse = async () => {
        if (!course || deleting) return;

        try {
            setDeleting(true);
            setDeleteError("");

            const response = await fetch(
                `${API_BASE}/${encodeURIComponent(courseSlug)}`,
                {
                    method: "DELETE",
                    headers: getHeaders(),
                }
            );

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(data.message || "Unable to delete course.");
            }

            navigate("/courses", { replace: true });
        } catch (err) {
            setDeleteError(err.message);
            setDeleting(false);
            setDeleteOpen(false);
        }
    };

    // --------------------------------
    // OPEN LESSON
    // --------------------------------

    const openLesson = (lesson) => {
        navigate(
            `/course/${encodeURIComponent(courseSlug)}/lesson/${encodeURIComponent(
                lesson.lessonId
            )}`
        );
    };

    // --------------------------------
    // OPEN QUIZ
    // --------------------------------

    const openQuiz = (lesson = null) => {
        if (lesson && lesson.lessonId) {
            navigate(
                `/course/${encodeURIComponent(courseSlug)}/lesson/${encodeURIComponent(
                    lesson.lessonId
                )}/quiz`
            );
        } else {
            navigate(`/course/${encodeURIComponent(courseSlug)}/quiz`);
        }
    };

    const isAlreadyShared = (userId) => {
        return (
            course?.sharedWith?.some(
                (entry) =>
                    String(entry?._id || entry) === String(userId)
            ) || false
        );
    };

    // --------------------------------
    // LOADING / ERROR STATES
    // --------------------------------

    if (loading) {
        return (
            <main className="cd-page">
                <div className="cd-skeleton cd-skeleton-back" />
                <div className="cd-skeleton cd-skeleton-hero" />
                <div className="cd-skeleton cd-skeleton-row" />
                <div className="cd-skeleton cd-skeleton-row" />
                <div className="cd-skeleton cd-skeleton-row" />
            </main>
        );
    }

    if (error) {
        return (
            <div className="cd-state">
                <div className="cd-state-icon">⚠</div>
                <h2>Unable to load course</h2>
                <p>{error}</p>

                <button onClick={() => navigate("/courses")}>
                    Back to My Courses
                </button>
            </div>
        );
    }

    if (!course) return null;

    const lessons = course.lessons || [];
    const sharedCount = (course.sharedWith || []).length;
    const doneIds = new Set((progress?.completedLessons || []).map(String));
    const topicLogo = getTopicLogo(course.title || "");

    // --------------------------------
    // UI
    // --------------------------------

    return (
        <main className="cd-page">

            {/* Ambient background orbs */}
            <div className="cd-bg" aria-hidden="true">
                <span className="cd-orb cd-orb-1" />
                <span className="cd-orb cd-orb-2" />
                <span className="cd-orb cd-orb-3" />
            </div>

            <button
                className="cd-back"
                onClick={() => navigate("/courses")}
            >
                <span className="cd-back-arrow">←</span> Back to My Courses
            </button>

            {/* COURSE HERO */}

            <section
                className="cd-hero"
                ref={heroRef}
                onMouseMove={handleHeroMove}
            >
                <div className="cd-hero-glow" aria-hidden="true" />
                <div className="cd-hero-grid" aria-hidden="true" />

                <span className="cd-label">
                    <i className="cd-pulse" /> YOUR LEARNING SPACE
                </span>

                <h1>{course.title}</h1>

                <p>
                    {course.description ||
                        "Explore the lessons and start learning at your own pace."}
                </p>

                <div className="cd-stats">

                    <div>
                        <strong><CountUp value={lessons.length} /></strong>
                        <span>Lessons</span>
                    </div>

                    {course.level && (
                        <div>
                            <strong>{course.level}</strong>
                            <span>Level</span>
                        </div>
                    )}

                    {course.duration && (
                        <div>
                            <strong>{course.duration}</strong>
                            <span>Duration</span>
                        </div>
                    )}

                    {sharedCount > 0 && (
                        <div>
                            <strong><CountUp value={sharedCount} /></strong>
                            <span>Shared with</span>
                        </div>
                    )}

                </div>

                <div className="pg-detail">
                    <ProgressBar percentage={progress?.percentage || 0} size="md" />
                    <p className="pg-caption">
                        {progress?.completedCount || 0} of {lessons.length} lessons completed
                        {progress?.isCompleted ? " · Course complete" : ""}
                    </p>
                </div>

                {/* COURSE ACTIONS */}

                <div className="cd-actions">

                    {lessons.length > 0 && (
                        <button
                            className="cd-start-btn"
                            onClick={() => openLesson(lessons[0])}
                        >
                            <span>▶</span>
                            Start Learning
                        </button>
                    )}

                    {/* NEW TAKE QUIZ BUTTON */}
                    <button
                        className="cd-start-btn"
                        style={{
                            background: "linear-gradient(135deg, #9a68ff, #db2777)",
                            boxShadow: "0 8px 24px rgba(219, 39, 119, 0.35)",
                        }}
                        onClick={() => openQuiz()}
                    >
                        <span>✨</span>
                        Take Quiz
                    </button>

                    <button
                        className="cd-share-btn"
                        onClick={() => {
                            setShareOpen(true);
                            setSearchQuery("");
                            setUsers([]);
                            setShareError("");
                            setShareMessage("");
                        }}
                    >
                        <span>↗</span>
                        Share Course
                    </button>

                    <button
                        className="cd-delete-btn"
                        onClick={() => setDeleteOpen(true)}
                        disabled={deleting}
                    >
                        <span>🗑</span>
                        {deleting ? "Deleting..." : "Delete Course"}
                    </button>

                </div>

                {deleteError && (
                    <p className="cd-delete-error" role="alert">
                        {deleteError}
                    </p>
                )}

            </section>

            {/* COURSE LESSONS */}

            <section className="cd-content">

                <div className="cd-heading">

                    <div>
                        <span>COURSE CURRICULUM</span>
                        <h2>What you'll learn</h2>
                    </div>

                    <span className="cd-total">
                        {lessons.length} lessons
                    </span>

                </div>

                <div className="cd-lessons">

                    {lessons.map((lesson, index) => (
                        <button
                            key={lesson.lessonId || lesson._id || index}
                            className="cd-lesson"
                            style={{ "--i": index }}
                            onClick={() => openLesson(lesson)}
                        >

                            <span className="cd-lesson-bar" aria-hidden="true" />

                            <span className="cd-number">
                                {doneIds.has(String(lesson.lessonId)) ? "✓" : String(index + 1).padStart(2, "0")}
                            </span>

                            <span className="cd-lesson-info">

                                <strong>
                                    {lesson.title || `Lesson ${index + 1}`}
                                </strong>

                                {lesson.learningObjective && (
                                    <small>
                                        {lesson.learningObjective}
                                    </small>
                                )}

                            </span>

                            <span className="cd-arrow">→</span>

                        </button>
                    ))}

                    {lessons.length === 0 && (
                        <p className="cd-empty">
                            No lessons are available in this course yet.
                        </p>
                    )}

                </div>

            </section>

            {/* SHARE MODAL */}

            {shareOpen && (

                <div
                    className="cd-modal-overlay"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            setShareOpen(false);
                        }
                    }}
                >

                    <div className="cd-modal">

                        <div className="cd-modal-header">

                            <div className="cd-modal-icon">
                                ↗
                            </div>

                            <div className="cd-modal-title">
                                <h2>Share Course</h2>
                                <p>Choose a LearnSpace user</p>
                            </div>

                            <button
                                className="cd-modal-close"
                                onClick={() => setShareOpen(false)}
                                aria-label="Close sharing dialog"
                            >
                                ×
                            </button>

                        </div>

                        <div className="cd-modal-body">

                            <p className="cd-share-course-name">
                                Sharing: <strong>{course.title}</strong>
                            </p>

                            <input
                                className="cd-search-input"
                                type="search"
                                placeholder="Search name or email..."
                                value={searchQuery}
                                onChange={(event) =>
                                    setSearchQuery(event.target.value)
                                }
                                autoFocus
                            />

                            <p className="cd-search-help">
                                Type at least 2 characters to find a user.
                            </p>

                            {searchQuery.trim().length < 2 && (
                                <p className="cd-search-status">
                                    Start typing to find a user.
                                </p>
                            )}

                            {searchLoading && (
                                <p className="cd-search-status">
                                    <i className="cd-spinner" /> Searching users...
                                </p>
                            )}

                            {shareError && (
                                <p className="cd-search-error">
                                    {shareError}
                                </p>
                            )}

                            {shareMessage && (
                                <p className="cd-search-success">
                                    {shareMessage}
                                </p>
                            )}

                            <div className="cd-user-list">

                                {!searchLoading &&
                                    searchQuery.trim().length >= 2 &&
                                    users.length === 0 &&
                                    !shareError && (
                                        <p className="cd-empty-users">
                                            No matching users found.
                                        </p>
                                    )}

                                {users.map((user, index) => {

                                    const alreadyShared =
                                        isAlreadyShared(user._id);

                                    const initials = (
                                        user.name || user.email || "?"
                                    )
                                        .trim()
                                        .split(/\s+/)
                                        .map((part) => part[0])
                                        .slice(0, 2)
                                        .join("")
                                        .toUpperCase();

                                    return (

                                        <div
                                            className="cd-user-row"
                                            key={user._id}
                                            style={{ "--i": index }}
                                        >

                                            <div className="cd-avatar">
                                                {initials}
                                            </div>

                                            <div className="cd-user-info">
                                                <strong>
                                                    {user.name || "Unnamed user"}
                                                </strong>

                                                <small>
                                                    {user.email}
                                                </small>
                                            </div>

                                            <button
                                                className={`cd-user-share-btn ${alreadyShared ? "shared" : ""
                                                    }`}
                                                disabled={
                                                    alreadyShared ||
                                                    sharingUserId !== null
                                                }
                                                onClick={() =>
                                                    shareWithUser(user)
                                                }
                                            >
                                                {alreadyShared
                                                    ? "✓ Shared"
                                                    : sharingUserId === user._id
                                                        ? "Sharing..."
                                                        : "Share"}
                                            </button>

                                        </div>

                                    );
                                })}

                            </div>

                        </div>

                        <div className="cd-modal-footer">

                            <span>
                                Only share courses with people you trust.
                            </span>

                            <button
                                onClick={() => setShareOpen(false)}
                            >
                                Done
                            </button>

                        </div>

                    </div>

                </div>

            )}

            {/* DELETE CONFIRM MODAL */}

            {deleteOpen && (
                <div
                    className="cd-modal-overlay"
                    onClick={(event) => {
                        if (event.target === event.currentTarget && !deleting) {
                            setDeleteOpen(false);
                        }
                    }}
                >
                    <div className="cd-modal cd-confirm">
                        <div className="cd-confirm-icon">🗑</div>
                        <h2>Delete this course?</h2>
                        <p>
                            <strong>{course.title}</strong> will be permanently
                            removed. This action cannot be undone.
                        </p>

                        <div className="cd-confirm-actions">
                            <button
                                className="cd-confirm-cancel"
                                onClick={() => setDeleteOpen(false)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>

                            <button
                                className="cd-confirm-delete"
                                onClick={deleteCourse}
                                disabled={deleting}
                            >
                                {deleting ? "Deleting..." : "Yes, delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST */}

            {toast && (
                <div
                    key={toast.id}
                    className={`cd-toast cd-toast-${toast.type}`}
                    role="status"
                >
                    <span className="cd-toast-dot" />
                    {toast.message}
                </div>
            )}

        </main>
    );
}