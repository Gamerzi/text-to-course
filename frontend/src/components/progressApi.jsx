import { API_URL } from "../config.js";
// src/components/progressApi.js
const headers = () => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const handle = async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed with status ${res.status}`);
    return data;
};

// Mark / unmark one lesson — tries /api/course-progress first, then /api/progress
export const setLessonCompleted = async (courseSlug, lessonId, completed) => {
    const body = JSON.stringify({ completed });
    let res = await fetch(
        `${API_URL}/api/course-progress/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonId)}`,
        { method: "PATCH", headers: headers(), body }
    );
    if (!res.ok && res.status === 404) {
        res = await fetch(
            `${API_URL}/api/progress/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonId)}`,
            { method: "PATCH", headers: headers(), body }
        );
    }
    return handle(res);
};

// Progress for one course (by slug)
export const fetchCourseProgress = async (courseSlug, signal) => {
    let res = await fetch(
        `${API_URL}/api/course-progress/${encodeURIComponent(courseSlug)}`,
        { headers: headers(), signal }
    );
    if (!res.ok && res.status === 404) {
        res = await fetch(
            `${API_URL}/api/progress/${encodeURIComponent(courseSlug)}`,
            { headers: headers(), signal }
        );
    }
    return handle(res);
};

// Progress for every course the user has started
export const fetchMyProgress = async (signal) => {
    let res = await fetch(`${API_URL}/api/course-progress/my-progress`, {
        headers: headers(),
        signal,
    });
    if (!res.ok && res.status === 404) {
        res = await fetch(`${API_URL}/api/progress/my-progress`, {
            headers: headers(),
            signal,
        });
    }
    return handle(res);
};

