// src/components/MarkCompleteButton.jsx
import { useEffect, useState } from "react";
import { fetchCourseProgress, setLessonCompleted } from "./progressApi";

/**
 * Lesson page button. Loads whether this lesson is done, toggles on click.
 * idleClass / doneClass let you reuse the page's own button styles.
 */
export default function MarkCompleteButton({
    courseSlug,
    lessonId,
    onToast,
    idleClass = "pg-btn",
    doneClass = "pg-btn is-done",
}) {
    const [completed, setCompleted] = useState(false);
    const [ready, setReady] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        setReady(false);

        fetchCourseProgress(courseSlug, controller.signal)
            .then((p) =>
                setCompleted((p.completedLessons || []).map(String).includes(String(lessonId)))
            )
            .catch(() => { })
            .finally(() => {
                if (!controller.signal.aborted) setReady(true);
            });

        return () => controller.abort();
    }, [courseSlug, lessonId]);

    const toggle = async () => {
        const next = !completed;
        setSaving(true);
        try {
            const result = await setLessonCompleted(courseSlug, lessonId, next);
            setCompleted(next);
            onToast?.(
                result.isCompleted
                    ? "Course complete. Well done!"
                    : next
                        ? `Lesson completed · ${result.percentage}% of the course done`
                        : "Lesson marked as incomplete"
            );
        } catch (err) {
            onToast?.(err.message || "Could not update progress.");
        } finally {
            setSaving(false);
        }
    };

    if (!ready) return null;

    return (
        <button
            type="button"
            className={completed ? doneClass : idleClass}
            onClick={toggle}
            disabled={saving}
        >
            <span aria-hidden="true">{completed ? "✓" : "○"}</span>
            {saving ? "Saving..." : completed ? "Completed" : "Mark as complete"}
        </button>
    );
}