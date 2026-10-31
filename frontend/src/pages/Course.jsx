import { useEffect, useMemo, useState, useCallback } from "react";
import { OverallProgress, ProgressBar } from "../components/ProgressBar";

import { useNavigate } from "react-router-dom";
import CourseChatWidget from "../components/Coursechatwidget";
import "../styles/Course.css";

const API_BASE = "http://localhost:5000/api/courses";
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

const getUserIdFromToken = () => {
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return "";
        const payload = JSON.parse(
            atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
        );
        return String(payload._id || payload.id || payload.sub || "");
    } catch {
        return "";
    }
};

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


const CourseCard = ({ course, shared, onOpen, progress }) => {
    const lessons = getLessonCount(course);
    const duration = getDuration(course);
    const level = formatLevel(course.level);
    const owner = typeof course.creator === "object" ? course.creator?.name : "";

    return (
        <button
            type="button"
            className="cj-card"
            onClick={() => onOpen(course)}
            aria-label={`Open course ${course.title || "Untitled Course"}`}
        >
            <LogoTile title={course.title || "Untitled Course"} />

            {shared && <span className="cj-badge">Shared with you</span>}

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
                    <ProgressBar percentage={progress?.percentage || 0} size="sm" />
                    <p className="pg-caption">
                        {progress?.completedCount || 0}/{lessons} lessons · {progress?.percentage || 0}%
                    </p>
                </div>

                <span className="cj-card-action">
                    Open course <span aria-hidden="true">→</span>
                </span>
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
        {Array.from({ length: 4 }, (_, index) => (
            <div className="cj-card cj-skeleton" key={index}>
                <div className="cj-thumb" />
                <div className="cj-card-body">
                    <div className="cj-line" />
                    <div className="cj-line cj-line--short" />
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

    const navigate = useNavigate();
    const userId = currentUserId || getUserIdFromToken();

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

            // Fetch progress for dashboard cards & overall bar
            try {
                let pRes = await fetch("http://localhost:5000/api/course-progress/my-progress", {
                    signal,
                    headers,
                });
                if (!pRes.ok) {
                    pRes = await fetch("http://localhost:5000/api/progress/my-progress", {
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
        // Show it immediately
        if (newCourse?.courseSlug) {
            setCourses((prev) => [
                newCourse,
                ...prev.filter((c) => c.courseSlug !== newCourse.courseSlug),
            ]);
        }

        // Then sync with the server without showing the skeleton
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

    const handleOpen = (course) => {
        if (onOpenCourse) {
            onOpenCourse(course);
        } else if (course.courseSlug) {
            navigate(`/course/${course.courseSlug}`);
        } else {
            console.warn("This course does not have a courseSlug:", course);
        }
    };

    return (
        <div className="cj-root">
            {loading && (
                <>
                    <h2 className="cj-skeleton-title">My Courses</h2>
                    <SkeletonGrid />
                </>
            )}

            {!loading && error && (
                <div className="cj-error" role="alert">
                    <p>{error}</p>
                    <button type="button" onClick={() => load()}>
                        Try again
                    </button>
                </div>
            )}

            {!loading && !error && (
                <>
                    <OverallProgress courses={[...mine, ...shared]} bySlug={bySlug} />

                    <Section
                        title="My Courses"
                        count={mine.length}
                        courses={mine}
                        emptyText="You haven't created any courses yet. Generate one from a topic to get started."
                        onOpen={handleOpen}
                        progressBySlug={bySlug}
                    />
                    <Section
                        title="Shared Courses"
                        count={shared.length}
                        courses={shared}
                        shared
                        emptyText="Nothing shared with you yet. Courses shared by others will appear here."
                        onOpen={handleOpen}
                        progressBySlug={bySlug}
                    />
                </>
            )}

            <CourseChatWidget
                onCreated={handleCourseCreated}
                onOpenCourse={handleOpen}
            />
        </div>
    );
}