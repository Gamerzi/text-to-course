// src/components/ProgressBar.jsx
import "../styles/Progressbar.css";

const clamp = (n) => Math.min(100, Math.max(0, Number(n) || 0));

/** Basic bar. size = "sm" | "md" | "lg" */
export function ProgressBar({ percentage = 0, size = "md", label }) {
    const value = clamp(percentage);

    return (
        <div
            className={`pg-track pg-${size}`}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label || "Progress"}
        >
            <div
                className={`pg-fill${value === 100 ? " is-done" : ""}`}
                style={{ width: `${value}%` }}
            />
        </div>
    );
}

/**
 * Overall progress across every course on the dashboard.
 * courses = all courses shown (mine + shared), bySlug from useMyProgress().
 */
export function OverallProgress({ courses = [], bySlug = {} }) {
    const unique = [...new Map(courses.map((c) => [c.courseSlug, c])).values()];

    const totalLessons = unique.reduce(
        (sum, c) => sum + (Array.isArray(c.lessons) ? c.lessons.length : 0),
        0
    );
    const completedLessons = unique.reduce(
        (sum, c) => sum + (bySlug[c.courseSlug]?.completedCount || 0),
        0
    );
    const finished = unique.filter((c) => bySlug[c.courseSlug]?.isCompleted).length;
    const inProgress = unique.filter((c) => {
        const p = bySlug[c.courseSlug];
        return p && p.completedCount > 0 && !p.isCompleted;
    }).length;

    const percentage =
        totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

    if (unique.length === 0) return null;

    return (
        <section className="pg-overall" aria-label="Overall learning progress">
            <div className="pg-overall-head">
                <h2>Your learning progress</h2>
                <strong>{percentage}%</strong>
            </div>

            <ProgressBar percentage={percentage} size="lg" label="Overall learning progress" />

            <p className="pg-overall-meta">
                {completedLessons} of {totalLessons} lessons completed
                {" · "}
                {finished} finished
                {" · "}
                {inProgress} in progress
            </p>
        </section>
    );
}

export default ProgressBar;