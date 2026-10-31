import { API_URL } from "../config.js";
import { useEffect, useMemo, useState, useCallback } from "react";
import { ProgressBar } from "../components/ProgressBar";
import { useNavigate } from "react-router-dom";
import CourseChatWidget from "../components/Coursechatwidget";
import "../styles/Course.css";

const API_BASE = `${API_URL}/api/courses`;
const TOKEN_KEY = "token";

const TOPIC_RULES = [
    { match: /kubernetes|\bk8s\b/i, glyph: "☸", hue: 220 },
    { match: /docker/i, glyph: "🐳", hue: 200 },
    { match: /typescript/i, glyph: "TS", hue: 215 },
    { match: /javascript|\bjs\b/i, glyph: "JS", hue: 48 },
    { match: /react|next.?js|redux/i, glyph: "⚛", hue: 190 },
    { match: /node.?js|express/i, glyph: "⬡", hue: 125 },
    { match: /python|django|flask/i, glyph: "🐍", hue: 140 },
    { match: /\bjava\b|spring/i, glyph: "☕", hue: 25 },
    { match: /c\+\+|cpp/i, glyph: "C++", hue: 210 },
    { match: /\bc#|csharp|\.net/i, glyph: "C#", hue: 275 },
    { match: /html|css|frontend|front-end|web design/i, glyph: "</>", hue: 330 },
    { match: /sql|database|mongo|postgres|dbms/i, glyph: "▤", hue: 175 },
    { match: /git|github/i, glyph: "⑂", hue: 15 },
    { match: /devops|cloud|aws|azure/i, glyph: "☁", hue: 225 },
    { match: /algorithm|data structure|\bdsa\b|linked list|graph|tree/i, glyph: "⌘", hue: 290 },
    { match: /machine learning|deep learning|artificial intelligence|\bai\b/i, glyph: "✳", hue: 265 },
    { match: /cybersecurity|security|hacking|network/i, glyph: "🛡", hue: 350 },

    { match: /plant|garden|botany|flower|agriculture|forest/i, glyph: "🌿", hue: 125 },
    { match: /space|universe|astronomy|planet|galaxy|nasa/i, glyph: "🪐", hue: 255 },
    { match: /physics|quantum|mechanics/i, glyph: "⚛", hue: 195 },
    { match: /chemistry|chemical/i, glyph: "🧪", hue: 165 },
    { match: /biology|human body|genetics|anatomy/i, glyph: "🧬", hue: 325 },
    { match: /environment|climate|global warming|sustainability/i, glyph: "🌍", hue: 155 },
    { match: /ocean|marine|sea life/i, glyph: "🌊", hue: 200 },
    { match: /animal|wildlife|zoology/i, glyph: "🦋", hue: 45 },

    { match: /current affairs|breaking news|world news/i, glyph: "📰", hue: 15 },
    { match: /history|ancient|civilization|archaeology/i, glyph: "🏛", hue: 35 },
    { match: /geography|countries|maps|continents/i, glyph: "🗺", hue: 180 },
    { match: /politics|government|constitution|civics/i, glyph: "⚖", hue: 220 },
    { match: /economics|finance|investing|stock market/i, glyph: "📈", hue: 145 },
    { match: /business|marketing|entrepreneur|startup/i, glyph: "💼", hue: 30 },
    { match: /math|calculus|statistics|probability/i, glyph: "∑", hue: 205 },
    { match: /psychology|philosophy|mindfulness/i, glyph: "🧠", hue: 285 },
    { match: /language|english|grammar|writing|literature/i, glyph: "✍", hue: 315 },
    { match: /music|piano|guitar|singing/i, glyph: "🎵", hue: 330 },
    { match: /\bart\b|drawing|painting|design|photography/i, glyph: "🎨", hue: 345 },
    { match: /cooking|recipe|food|baking/i, glyph: "🍳", hue: 20 },
    { match: /fitness|workout|yoga|sports/i, glyph: "🏃", hue: 95 },
    { match: /travel|tourism|culture/i, glyph: "✈", hue: 210 },
];

const FALLBACK_HUES = [175, 205, 260, 320, 20, 95, 230, 350];

const hashString = (value = "") => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
};

const getInitials = (title = "") => {
    const words = title.replace(/[^\w\s]/g, "").trim().split(/\s+/).filter(Boolean);
    return words.length
        ? words.slice(0, 2).map((word) => word[0].toUpperCase()).join("")
        : "?";
};

const getTopicLogo = (title = "") => {
    const rule = TOPIC_RULES.find((item) => item.match.test(title));
    if (rule) return { ...rule, fallback: false };
    return {
        glyph: getInitials(title),
        hue: FALLBACK_HUES[hashString(title) % FALLBACK_HUES.length],
        fallback: true,
    };
};

const idOf = (value) => String(value?._id || value?.id || value || "");

const getUserInfoFromToken = () => {
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return { id: "", name: "" };
        const payload = JSON.parse(
            atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
        );
        return {
            id: String(payload._id || payload.id || payload.sub || ""),
            name: payload.name || payload.username || localStorage.getItem("userName") || ""
        };
    } catch {
        return { id: "", name: "" };
    }
};

const getUserIdFromToken = () => getUserInfoFromToken().id;

const getLessonCount = (course) =>
    Array.isArray(course.lessons) ? course.lessons.length : 0;

const getDuration = (course) => {
    if (course.duration) return String(course.duration);
    const minutes = (course.lessons || []).reduce(
        (sum, lesson) => sum + (Number(lesson.durationMinutes || lesson.duration) || 0),
        0
    );
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return hours ? `${hours}h ${String(remaining).padStart(2, "0")}m` : `${remaining}m`;
};

const formatLevel = (level) =>
    level ? String(level).charAt(0).toUpperCase() + String(level).slice(1).toLowerCase() : "";

const Icon = ({ name }) => {
    const paths = {
        lessons: (
            <>
                <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H20v14H5.5A1.5 1.5 0 0 0 4 19.5z" />
                <path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3" />
            </>
        ),
        clock: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
            </>
        ),
        level: <path d="M5 20v-5M12 20V9M19 20V4" />,
        user: (
            <>
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
            </>
        ),
    };

    return (
        <svg
            className="cj-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths[name]}
        </svg>
    );
};

const LogoTile = ({ title }) => {
    const { glyph, hue, fallback } = getTopicLogo(title);

    return (
        <div
            className={`cj-thumb${fallback ? " cj-thumb--fallback" : ""}`}
            style={{ "--h": hue, "--h2": (hue + 45) % 360 }}
            aria-hidden="true"
        >
            <span className="cj-thumb-ring cj-thumb-ring--a" />
            <span className="cj-thumb-ring cj-thumb-ring--b" />
            <span className={`cj-thumb-glyph${glyph.length > 3 ? " is-long" : ""}`}>
                {glyph}
            </span>
            <span className="cj-thumb-caption">
                {fallback ? "EXPLORE SOMETHING NEW" : "LEARNING COLLECTION"}
            </span>
        </div>
    );
};

const getStatusBadge = (percentage) => {
    if (percentage >= 100) {
        return { label: "Completed", className: "cj-badge--completed", icon: "✓" };
    }
    if (percentage > 0) {
        return { label: "In progress", className: "cj-badge--inprogress", icon: "⚡" };
    }
    return { label: "Not started", className: "cj-badge--notstarted", icon: "○" };
};

const CourseCard = ({ course, shared, onOpen, progress }) => {
    const lessons = getLessonCount(course);
    const duration = getDuration(course);
    const level = formatLevel(course.level);
    const owner = typeof course.creator === "object" ? course.creator?.name : "";
    const percentage = progress?.percentage || 0;
    const status = getStatusBadge(percentage);

    const actionText = percentage >= 100 ? "Review Course" : percentage > 0 ? "Continue" : "Start Course";

    return (
        <button
            type="button"
            className="cj-card"
            onClick={() => onOpen(course)}
            aria-label={`Open course ${course.title || "Untitled Course"}`}
        >
            {/* Top Status & Shared Badge */}
            <div className="cj-card-top-badges">
                <span className={`cj-status-pill ${status.className}`}>
                    <span className="cj-status-dot" /> {status.label}
                </span>
                {shared && <span className="cj-badge cj-badge--shared">Shared</span>}
            </div>

            <LogoTile title={course.title || "Untitled Course"} />

            <div className="cj-card-body">
                <h3 className="cj-card-title">{course.title || "Untitled Course"}</h3>

                <ul className="cj-meta">
                    <li>
                        <Icon name="lessons" />
                        {lessons} {lessons === 1 ? "lesson" : "lessons"}
                    </li>
                    {duration && (
                        <li>
                            <Icon name="clock" />
                            {duration}
                        </li>
                    )}
                    {level && (
                        <li>
                            <Icon name="level" />
                            {level}
                        </li>
                    )}
                    {shared && owner && (
                        <li>
                            <Icon name="user" />
                            {owner}
                        </li>
                    )}
                </ul>

                <div className="pg-card-progress">
                    <ProgressBar percentage={percentage} size="sm" />
                    <p className="pg-caption">
                        {progress?.completedCount || 0}/{lessons} lessons · {percentage}%
                    </p>
                </div>

                <div className="cj-card-action-bar">
                    <span className={`cj-card-btn ${percentage > 0 ? "is-active" : ""}`}>
                        {actionText} <span aria-hidden="true">→</span>
                    </span>
                </div>
            </div>
        </button>
    );
};

const Section = ({ title, count, courses, shared, emptyText, onOpen, progressBySlug = {} }) => (
    <section className="cj-section">
        <header className="cj-section-head">
            <h2>{title}</h2>
            <span className="cj-count">{count}</span>
        </header>

        {courses.length === 0 ? (
            <p className="cj-empty">{emptyText}</p>
        ) : (
            <div className="cj-grid">
                {courses.map((course, index) => (
                    <CourseCard
                        key={course.courseSlug || idOf(course) || index}
                        course={course}
                        shared={shared}
                        onOpen={onOpen}
                        progress={progressBySlug[course.courseSlug]}
                    />
                ))}
            </div>
        )}
    </section>
);

const SkeletonGrid = () => (
    <div className="cj-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
            <div className="cj-card cj-skeleton" key={index}>
                <div className="cj-card-top-badges">
                    <span className="cj-sk-pill" />
                </div>
                <div className="cj-thumb cj-sk-thumb">
                    <div className="cj-sk-glyph" />
                </div>
                <div className="cj-card-body">
                    <div className="cj-line cj-line--title" />
                    <div className="cj-line cj-line--title-short" />
                    <div className="cj-sk-meta">
                        <span className="cj-sk-chip" />
                        <span className="cj-sk-chip" />
                    </div>
                    <div className="cj-line cj-line--progress" />
                    <div className="cj-sk-action">
                        <span className="cj-sk-btn" />
                    </div>
                </div>
            </div>
        ))}
    </div>
);

export default function Course({ onOpenCourse, currentUserId }) {
    const [bySlug, setBySlug] = useState({});
    const [courses, setCourses] = useState([]);
    const [sharedFromApi, setSharedFromApi] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filter & Search states
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'in-progress' | 'not-started' | 'completed'

    const navigate = useNavigate();
    const userInfo = getUserInfoFromToken();
    const userId = currentUserId || userInfo.id;
    const userName = userInfo.name ? userInfo.name.split(" ")[0] : "Learner";

    const load = useCallback(async (signal) => {
        setLoading(true);
        setError("");

        try {
            const token = localStorage.getItem(TOKEN_KEY);
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const myCoursesResponse = await fetch(`${API_BASE}/my-courses`, { signal, headers });
            const myCoursesData = await myCoursesResponse.json().catch(() => ({}));

            if (!myCoursesResponse.ok || myCoursesData.success === false) {
                throw new Error(myCoursesData.message || "Could not load your courses.");
            }

            const sharedCoursesResponse = await fetch(`${API_BASE}/shared-with-me`, {
                signal,
                headers,
            });
            const sharedCoursesData = await sharedCoursesResponse.json().catch(() => ({}));

            if (!sharedCoursesResponse.ok || sharedCoursesData.success === false) {
                throw new Error(sharedCoursesData.message || "Could not load shared courses.");
            }

            setCourses(Array.isArray(myCoursesData.courses) ? myCoursesData.courses : []);

            // Fetch progress for dashboard cards & stats
            try {
                let pRes = await fetch(`${API_URL}/api/course-progress/my-progress`, {
                    signal,
                    headers,
                });
                if (!pRes.ok) {
                    pRes = await fetch(`${API_URL}/api/progress/my-progress`, {
                        signal,
                        headers,
                    });
                }
                const pList = await pRes.json().catch(() => []);
                if (pRes.ok && Array.isArray(pList)) {
                    const map = {};
                    pList.forEach((item) => {
                        map[item.courseSlug] = item;
                    });
                    setBySlug(map);
                }
            } catch {
                /* ignore progress fetch errors */
            }
            setSharedFromApi(
                Array.isArray(sharedCoursesData.sharedCourses)
                    ? sharedCoursesData.sharedCourses
                    : []
            );
        } catch (err) {
            if (err.name !== "AbortError") {
                setError(err.message || "Could not load your courses.");
            }
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    const handleCourseCreated = useCallback(async (newCourse) => {
        if (newCourse?.courseSlug) {
            setCourses((prev) => [
                newCourse,
                ...prev.filter((c) => c.courseSlug !== newCourse.courseSlug),
            ]);
        }

        try {
            const token = localStorage.getItem(TOKEN_KEY);
            const res = await fetch(`${API_BASE}/my-courses`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray(data.courses)) setCourses(data.courses);
        } catch {
            /* the optimistic update is already showing */
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const { mine, shared } = useMemo(() => {
        if (sharedFromApi !== null) return { mine: courses, shared: sharedFromApi };

        const mineList = [];
        const sharedList = [];

        courses.forEach((course) => {
            const creatorId = idOf(course.creator);
            const ownedByMe = userId && creatorId === userId;
            const sharedWithMe =
                userId && (course.sharedWith || []).some((id) => idOf(id) === userId);

            if (ownedByMe || !userId || !sharedWithMe) mineList.push(course);
            else sharedList.push(course);
        });

        return { mine: mineList, shared: sharedList };
    }, [courses, sharedFromApi, userId]);

    // All combined courses
    const allCourses = useMemo(() => {
        const map = new Map();
        [...mine, ...shared].forEach((c) => {
            if (c.courseSlug) map.set(c.courseSlug, c);
        });
        return Array.from(map.values());
    }, [mine, shared]);

    // Overall Progress Stats
    const stats = useMemo(() => {
        const totalLessons = allCourses.reduce(
            (sum, c) => sum + (Array.isArray(c.lessons) ? c.lessons.length : 0),
            0
        );
        const completedLessons = allCourses.reduce(
            (sum, c) => sum + (bySlug[c.courseSlug]?.completedCount || 0),
            0
        );
        const finishedCount = allCourses.filter(
            (c) => bySlug[c.courseSlug]?.isCompleted || bySlug[c.courseSlug]?.percentage === 100
        ).length;
        const inProgressCount = allCourses.filter((c) => {
            const p = bySlug[c.courseSlug];
            return p && p.completedCount > 0 && !p.isCompleted && p.percentage < 100;
        }).length;
        const notStartedCount = allCourses.filter((c) => {
            const p = bySlug[c.courseSlug];
            return !p || p.completedCount === 0;
        }).length;

        const overallPercentage =
            totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

        return {
            totalLessons,
            completedLessons,
            finishedCount,
            inProgressCount,
            notStartedCount,
            overallPercentage,
            allCount: allCourses.length,
        };
    }, [allCourses, bySlug]);

    // Find the most relevant in-progress course for the "Continue Learning" hero spotlight
    const continueCourse = useMemo(() => {
        // First look for in-progress courses
        const inProgress = allCourses.find((c) => {
            const p = bySlug[c.courseSlug];
            return p && p.completedCount > 0 && !p.isCompleted && p.percentage < 100;
        });
        if (inProgress) return inProgress;

        // If none in progress, take the first not-started course
        return allCourses.find((c) => {
            const p = bySlug[c.courseSlug];
            return !p || !p.isCompleted;
        }) || null;
    }, [allCourses, bySlug]);

    // Dynamic journey subtitle
    const journeySubtitle = useMemo(() => {
        if (!continueCourse) {
            return "Explore new topics and expand your knowledge with personalized AI courses.";
        }
        const p = bySlug[continueCourse.courseSlug];
        const total = getLessonCount(continueCourse);
        const done = p?.completedCount || 0;
        const left = Math.max(0, total - done);

        if (done > 0 && left > 0) {
            return `You're ${left} ${left === 1 ? "lesson" : "lessons"} away from finishing "${continueCourse.title}".`;
        }
        return "Continue your learning journey and level up your skills today.";
    }, [continueCourse, bySlug]);

    // Filter and search courses
    const filterCourses = useCallback(
        (list) => {
            return list.filter((course) => {
                const p = bySlug[course.courseSlug];
                const pct = p?.percentage || 0;
                const isDone = p?.isCompleted || pct === 100;
                const isStarted = p?.completedCount > 0;

                // Category filter
                if (activeFilter === "in-progress" && (!isStarted || isDone)) return false;
                if (activeFilter === "completed" && !isDone) return false;
                if (activeFilter === "not-started" && isStarted) return false;

                // Search query
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const titleMatch = (course.title || "").toLowerCase().includes(q);
                    const topicMatch = (course.topic || "").toLowerCase().includes(q);
                    const levelMatch = (course.level || "").toLowerCase().includes(q);
                    if (!titleMatch && !topicMatch && !levelMatch) return false;
                }

                return true;
            });
        },
        [activeFilter, searchQuery, bySlug]
    );

    const filteredMine = useMemo(() => filterCourses(mine), [filterCourses, mine]);
    const filteredShared = useMemo(() => filterCourses(shared), [filterCourses, shared]);

    const handleOpen = (course) => {
        if (onOpenCourse) {
            onOpenCourse(course);
        } else if (course.courseSlug) {
            navigate(`/course/${course.courseSlug}`);
        } else {
            console.warn("This course does not have a courseSlug:", course);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem("token");
        localStorage.removeItem("email");
        localStorage.removeItem("userName");
        sessionStorage.clear();
        navigate("/login", { replace: true });
    };

    return (
        <div className="cj-root">
            {/* Ambient Purple Gradient Glows with subtle animation */}
            <div className="cj-ambient-bg" aria-hidden="true">
                <div className="cj-ambient-glow" />
                <div className="cj-orb cj-orb-1" />
                <div className="cj-orb cj-orb-2" />
                <div className="cj-orb cj-orb-3" />
            </div>

            <div className="cj-shell">
                {/* 1. Welcome Section & Stats Header */}
                <header className="cj-welcome-section">
                    <div className="cj-welcome-top-row">
                        <div className="cj-welcome-content">
                            <h1 className="cj-welcome-title">
                                Welcome back, <span className="cj-welcome-name">{userName}</span> <span className="cj-wave-emoji" aria-hidden="true">👋</span>
                            </h1>
                            <p className="cj-welcome-subtitle">{journeySubtitle}</p>
                        </div>

                        <button
                            type="button"
                            className="cj-logout-btn"
                            onClick={handleLogout}
                            title="Log out of your account"
                            aria-label="Log out"
                        >
                            <span className="cj-logout-icon" aria-hidden="true">⎋</span>
                            <span>Logout</span>
                        </button>
                    </div>

                    {/* Stats Widget Pills */}
                    <div className="cj-stats-grid">
                        <div className="cj-stat-pill cj-stat-progress">
                            <div className="cj-stat-ring-box">
                                <span className="cj-stat-percent">{stats.overallPercentage}%</span>
                            </div>
                            <div className="cj-stat-info">
                                <span className="cj-stat-num">{stats.completedLessons}/{stats.totalLessons}</span>
                                <span className="cj-stat-label">Lessons completed</span>
                            </div>
                        </div>

                        <div className="cj-stat-pill">
                            <span className="cj-stat-icon-badge" aria-hidden="true">🏆</span>
                            <div className="cj-stat-info">
                                <span className="cj-stat-num">{stats.finishedCount}</span>
                                <span className="cj-stat-label">Course finished</span>
                            </div>
                        </div>

                        <div className="cj-stat-pill">
                            <span className="cj-stat-icon-badge" aria-hidden="true">⚡</span>
                            <div className="cj-stat-info">
                                <span className="cj-stat-num">{stats.inProgressCount}</span>
                                <span className="cj-stat-label">In progress</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* 2. Continue Learning Spotlight Banner (if an active course exists) */}
                {continueCourse && !loading && !error && (
                    <div className="cj-continue-hero" onClick={() => handleOpen(continueCourse)}>
                        <div className="cj-continue-inner">
                            <div className="cj-continue-chip">
                                <span className="cj-pulse-dot" /> CONTINUE LEARNING
                            </div>

                            <div className="cj-continue-body">
                                <div className="cj-continue-icon-tile" aria-hidden="true">
                                    <span>{getTopicLogo(continueCourse.title).glyph}</span>
                                </div>

                                <div className="cj-continue-details">
                                    <h2 className="cj-continue-title">{continueCourse.title}</h2>
                                    <div className="cj-continue-progress-row">
                                        <div className="cj-continue-bar">
                                            <div
                                                className="cj-continue-fill"
                                                style={{ width: `${bySlug[continueCourse.courseSlug]?.percentage || 0}%` }}
                                            />
                                        </div>
                                        <span className="cj-continue-meta">
                                            {bySlug[continueCourse.courseSlug]?.completedCount || 0} of {getLessonCount(continueCourse)} lessons · {Math.max(0, getLessonCount(continueCourse) - (bySlug[continueCourse.courseSlug]?.completedCount || 0))} left
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="cj-continue-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpen(continueCourse);
                                    }}
                                >
                                    Resume <span aria-hidden="true">▶</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Search Bar & Category Filter Pills */}
                <div className="cj-toolbar">
                    <div className="cj-search-box">
                        <span className="cj-search-icon" aria-hidden="true">🔍</span>
                        <input
                            type="text"
                            className="cj-search-input"
                            placeholder="Search your courses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="cj-search-clear"
                                onClick={() => setSearchQuery("")}
                                title="Clear search"
                                aria-label="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="cj-filter-pills" role="tablist" aria-label="Course filters">
                        <button
                            type="button"
                            className={`cj-filter-pill ${activeFilter === "all" ? "is-active" : ""}`}
                            onClick={() => setActiveFilter("all")}
                        >
                            All <span className="cj-pill-count">{stats.allCount}</span>
                        </button>

                        <button
                            type="button"
                            className={`cj-filter-pill ${activeFilter === "in-progress" ? "is-active" : ""}`}
                            onClick={() => setActiveFilter("in-progress")}
                        >
                            In progress <span className="cj-pill-count">{stats.inProgressCount}</span>
                        </button>

                        <button
                            type="button"
                            className={`cj-filter-pill ${activeFilter === "not-started" ? "is-active" : ""}`}
                            onClick={() => setActiveFilter("not-started")}
                        >
                            Not started <span className="cj-pill-count">{stats.notStartedCount}</span>
                        </button>

                        <button
                            type="button"
                            className={`cj-filter-pill ${activeFilter === "completed" ? "is-active" : ""}`}
                            onClick={() => setActiveFilter("completed")}
                        >
                            Completed <span className="cj-pill-count">{stats.finishedCount}</span>
                        </button>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="cj-loading-container">
                        <h2 className="cj-skeleton-title">Loading courses...</h2>
                        <SkeletonGrid />
                    </div>
                )}

                {/* Error State */}
                {!loading && error && (
                    <div className="cj-error" role="alert">
                        <p>{error}</p>
                        <button type="button" onClick={() => load()}>
                            Try again
                        </button>
                    </div>
                )}

                {/* Course Grid Content */}
                {!loading && !error && (
                    <>
                        <Section
                            title="My Courses"
                            count={filteredMine.length}
                            courses={filteredMine}
                            emptyText={
                                searchQuery || activeFilter !== "all"
                                    ? "No courses match your current search or category filter."
                                    : "You haven't created any courses yet. Generate one to get started."
                            }
                            onOpen={handleOpen}
                            progressBySlug={bySlug}
                        />

                        {shared.length > 0 && (
                            <Section
                                title="Shared Courses"
                                count={filteredShared.length}
                                courses={filteredShared}
                                shared
                                emptyText="No shared courses match your current filter."
                                onOpen={handleOpen}
                                progressBySlug={bySlug}
                            />
                        )}
                    </>
                )}
            </div>

            <CourseChatWidget
                onCreated={handleCourseCreated}
                onOpenCourse={handleOpen}
            />
        </div>
    );
}
