import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import "../styles/LessonPage.css";

/* =====================================
   API + AUTH HELPERS
===================================== */

const API_BASE = (
    import.meta.env.VITE_API_BASE ||
    localStorage.getItem("apiBase") ||
    "http://localhost:5000/api"
).replace(/\/+$/, "");

const isJwt = (v) =>
    typeof v === "string" &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.trim());

function findTokenInObject(value, depth = 0) {
    if (depth > 5 || value == null) return "";

    if (typeof value === "string") {
        const t = value.trim();
        if (isJwt(t)) return t;
        try {
            const parsed = JSON.parse(t);
            if (parsed && typeof parsed === "object") {
                return findTokenInObject(parsed, depth + 1);
            }
        } catch {
            /* not JSON */
        }
        return "";
    }

    if (typeof value !== "object") return "";

    const keys = ["token", "jwt", "accessToken", "authToken", "bearerToken", "access_token"];
    for (const k of keys) {
        if (isJwt(value[k])) return value[k].trim();
    }
    for (const nested of Object.values(value)) {
        const found = findTokenInObject(nested, depth + 1);
        if (found) return found;
    }
    return "";
}

function getStoredToken() {
    const keys = [
        "token", "jwt", "accessToken", "authToken", "bearerToken",
        "access_token", "auth", "user", "apiSettings", "apiConfig",
        "courseSettings", "learnspaceSettings",
    ];
    const storages = [sessionStorage, localStorage];

    for (const s of storages) {
        for (const k of keys) {
            const v = s.getItem(k);
            if (!v) continue;
            const found = findTokenInObject(v);
            if (found) return found;
        }
    }
    for (const s of storages) {
        for (let i = 0; i < s.length; i++) {
            const v = s.getItem(s.key(i));
            if (!v) continue;
            const found = findTokenInObject(v);
            if (found) return found;
        }
    }
    return "";
}

function getAuthHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function readResponse(response) {
    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { message: text };
    }
    if (!response.ok) {
        throw new Error(
            data.message || data.error || `Request failed with status ${response.status}`
        );
    }
    return data;
}

function getLessonFromResponse(data) {
    if (data?.lesson?.title) return data.lesson;
    if (data?.data?.lesson?.title) return data.data.lesson;
    if (data?.course?.lesson?.title) return data.course.lesson;
    if (data?.data?.title) return data.data;
    if (data?.title) return data;
    return null;
}

const safeUrl = (url) => (/^https?:\/\//i.test(url || "") ? url : "");

/* =====================================
   SMALL UI HELPERS
===================================== */

// Button ripple micro-interaction
function ripple(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const span = document.createElement("span");
    span.className = "ld-ripple";
    span.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2
        }px;top:${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(span);
    setTimeout(() => span.remove(), 650);
}

// Fades + slides a card in when it scrolls into view
function Reveal({ children, className = "", delay = 0, as: Tag = "section", ...rest }) {
    const ref = useRef(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setShown(true);
                    io.disconnect();
                }
            },
            { threshold: 0.1 }
        );
        io.observe(node);
        return () => io.disconnect();
    }, []);

    return (
        <Tag
            ref={ref}
            className={`${className} ld-reveal ${shown ? "ld-in" : ""}`}
            style={{ "--d": `${delay}ms` }}
            {...rest}
        >
            {children}
        </Tag>
    );
}

/* =====================================
   PDF (light, print-friendly version)
===================================== */

function h(tag, text, css = "") {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (css) node.style.cssText = css;
    return node;
}

function buildPdfNode(lesson, courseSlug, lessonId) {
    const root = h(
        "div",
        null,
        "position:fixed;left:-10000px;top:0;width:760px;padding:24px;background:#fff;color:#1e293b;font-family:Arial,sans-serif;line-height:1.6;z-index:-1;"
    );
    const box = (css = "") =>
        h("div", null, `border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin-bottom:14px;break-inside:avoid;${css}`);

    const top = box();
    if (lesson.lessonNumber) top.append(h("div", `Lesson ${lesson.lessonNumber}`, "color:#6d44e0;font-weight:700;font-size:13px;"));
    top.append(h("h1", lesson.title || "Untitled Lesson", "margin:6px 0 10px;font-size:28px;"));
    top.append(h("p", lesson.learningObjective || "", "margin:0;color:#475569;"));
    root.append(top);

    if (lesson.overview) {
        const b = box();
        b.append(h("h2", "Overview", "margin:0 0 8px;"), h("p", lesson.overview, "margin:0;white-space:pre-wrap;color:#475569;"));
        root.append(b);
    }

    if (lesson.sections?.length) {
        const b = box();
        b.append(h("h2", "Lesson Content", "margin:0 0 8px;"));
        lesson.sections.forEach((s) => {
            b.append(
                h("h3", s.subtopic || "Section", "margin:14px 0 4px;color:#334155;"),
                h("p", s.content || "", "margin:0;white-space:pre-wrap;color:#475569;")
            );
        });
        root.append(b);
    }

    if (lesson.codeSnippet?.code) {
        const b = box();
        b.append(h("h2", lesson.codeSnippet.filename || "Code Example", "margin:0 0 8px;"));
        if (lesson.codeSnippet.explanation) b.append(h("p", lesson.codeSnippet.explanation, "color:#475569;"));
        b.append(
            h(
                "pre",
                lesson.codeSnippet.code,
                "white-space:pre-wrap;word-break:break-word;background:#f1f5f9;padding:14px;border-radius:8px;font-size:12px;"
            )
        );
        root.append(b);
    }

    if (lesson.keyTakeaways?.length) {
        const b = box();
        b.append(h("h2", "Key Takeaways", "margin:0 0 8px;"));
        const ul = h("ul", null, "margin:0;padding-left:20px;");
        lesson.keyTakeaways.forEach((t) => ul.append(h("li", t, "margin-bottom:6px;")));
        b.append(ul);
        root.append(b);
    }

    if (lesson.citations?.length) {
        const b = box();
        b.append(h("h2", "References", "margin:0 0 8px;"));
        const ul = h("ul", null, "margin:0;padding-left:20px;");
        lesson.citations.forEach((c) => {
            const text = [c.title, c.url, c.description].filter(Boolean).join(" - ");
            ul.append(h("li", text, "margin-bottom:6px;word-break:break-word;"));
        });
        b.append(ul);
        root.append(b);
    }

    // Latest submitted quiz attempt (saved by the quiz page)
    let attempt = null;
    try {
        attempt = JSON.parse(localStorage.getItem(`quizAttempt_${courseSlug}_${lessonId}`) || "null");
    } catch {
        attempt = null;
    }

    const quiz = box();
    quiz.append(h("h2", "Lesson Quiz and Your Responses", "margin:0 0 8px;"));
    if (!attempt) {
        quiz.append(
            h("p", "No submitted quiz attempt is saved for this lesson yet. Complete and submit the lesson quiz, then download the PDF again to include your responses.", "color:#475569;")
        );
    } else {
        const r = attempt.result || {};
        const questions = attempt.questions || [];
        quiz.append(
            h(
                "p",
                `Quiz: ${attempt.quizTitle || "Lesson Quiz"} | Score: ${r.score ?? 0}/${r.totalQuestions ?? questions.length} | Percentage: ${r.percentage ?? 0}% | Status: ${r.passed ? "Passed" : "Review needed"} | Attempted: ${attempt.attemptedAt ? new Date(attempt.attemptedAt).toLocaleString() : "Unknown"}`,
                "color:#475569;"
            )
        );

        questions.forEach((q, i) => {
            const qid = String(q.questionId ?? i + 1);
            const block = h("div", null, "padding:10px 0;border-top:1px solid #e2e8f0;break-inside:avoid;");
            block.append(h("p", `${i + 1}. ${q.question || q.text || "Question"}`, "font-weight:700;margin:0 0 4px;"));

            const ans = (attempt.answers || []).find((a) => String(a.questionId) === qid) || (attempt.answers || [])[i];
            const idx = Number(ans?.selectedIndex ?? -1);
            const opt = (Array.isArray(q.options) ? q.options : [])[idx];
            const optText = typeof opt === "string" ? opt : opt?.text ?? opt?.label ?? opt?.value ?? "";
            block.append(h("p", `Your answer: ${idx >= 0 && optText ? optText : "No answer selected"}`, "margin:0 0 4px;"));

            const fb = r.breakdown || [];
            const item = fb.find((f) => String(f.questionId ?? "") === qid) || fb[i];
            if (item) {
                block.append(
                    h("p", `Result: ${item.isCorrect ? "Correct" : "Incorrect"}`, `margin:0 0 4px;font-weight:700;color:${item.isCorrect ? "#047857" : "#b91c1c"};`)
                );
                if (item.explanation) block.append(h("p", `Explanation: ${item.explanation}`, "margin:0;color:#475569;"));
            }
            quiz.append(block);
        });
    }
    root.append(quiz);

    return root;
}

/* =====================================
   PAGE
===================================== */

export default function LessonPage() {
    const { courseSlug, lessonId } = useParams();
    const navigate = useNavigate();

    const [lesson, setLesson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    // Lesson Progress state
    const [isCompleted, setIsCompleted] = useState(false);
    const [courseProgress, setCourseProgress] = useState(null);
    const [progressLoading, setProgressLoading] = useState(true);
    const [savingProgress, setSavingProgress] = useState(false);

    const [showUpdate, setShowUpdate] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [updating, setUpdating] = useState(false);
    const [updateError, setUpdateError] = useState("");

    const [toast, setToast] = useState("");
    const [pdfBusy, setPdfBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    const [voiceBusy, setVoiceBusy] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState({ msg: "", error: false });
    const [audioUrl, setAudioUrl] = useState("");
    const [playing, setPlaying] = useState(false);

    const audioRef = useRef(null);
    const objectUrlRef = useRef("");
    const codeRef = useRef(null);
    const progressRef = useRef(null);
    const heroRef = useRef(null);
    const toastTimer = useRef(null);

    const showToast = (msg) => {
        setToast(msg);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(""), 3200);
    };

    /* ---------- load lesson ---------- */
    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            if (!courseSlug || !lessonId) {
                setError("Missing course or lesson in the URL.");
                setLoading(false);
                return;
            }
            if (!getStoredToken()) {
                setError("You are not logged in. Please log in and try again.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError("");
                const res = await fetch(
                    `${API_BASE}/courses/${encodeURIComponent(courseSlug)}/${encodeURIComponent(lessonId)}`,
                    { method: "GET", headers: getAuthHeaders(), signal: controller.signal }
                );
                const data = await readResponse(res);
                const found = getLessonFromResponse(data);
                if (!found) throw new Error("Lesson data was not found in the API response.");
                setLesson(found);
            } catch (err) {
                if (err.name === "AbortError") return;
                console.error("Load lesson error:", err);
                setError(err.message || "Unable to load lesson.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        load();
        return () => controller.abort();
    }, [courseSlug, lessonId, reloadKey]);

    /* ---------- load course & lesson progress ---------- */
    useEffect(() => {
        const controller = new AbortController();

        async function loadProgress() {
            if (!courseSlug || !lessonId || !getStoredToken()) {
                setProgressLoading(false);
                return;
            }

            try {
                setProgressLoading(true);
                let res = await fetch(
                    `${API_BASE}/course-progress/${encodeURIComponent(courseSlug)}`,
                    { method: "GET", headers: getAuthHeaders(), signal: controller.signal }
                );
                if (!res.ok) {
                    res = await fetch(
                        `${API_BASE}/progress/${encodeURIComponent(courseSlug)}`,
                        { method: "GET", headers: getAuthHeaders(), signal: controller.signal }
                    );
                }
                const data = await readResponse(res);
                setCourseProgress(data);
                const done = (data.completedLessons || [])
                    .map(String)
                    .includes(String(lessonId));
                setIsCompleted(done);
            } catch (err) {
                if (err.name === "AbortError") return;
                console.warn("Progress load notice:", err.message);
            } finally {
                if (!controller.signal.aborted) setProgressLoading(false);
            }
        }

        loadProgress();
        return () => controller.abort();
    }, [courseSlug, lessonId, reloadKey]);

    /* ---------- toggle lesson complete ---------- */
    const toggleComplete = async () => {
        if (!getStoredToken()) {
            showToast("You are not logged in. Please log in first.");
            return;
        }

        const next = !isCompleted;
        setSavingProgress(true);

        try {
            let res = await fetch(
                `${API_BASE}/course-progress/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonId)}`,
                {
                    method: "PATCH",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ completed: next }),
                }
            );

            if (!res.ok) {
                res = await fetch(
                    `${API_BASE}/progress/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonId)}`,
                    {
                        method: "PATCH",
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ completed: next }),
                    }
                );
            }

            const data = await readResponse(res);
            setIsCompleted(next);
            setCourseProgress(data);

            showToast(
                data.isCompleted
                    ? "🎉 Course complete. Well done!"
                    : next
                        ? `✓ Lesson completed · ${data.percentage ?? 0}% of course done`
                        : "Lesson marked as incomplete"
            );
        } catch (err) {
            console.error("Toggle complete error:", err);
            showToast(err.message || "Could not update progress.");
        } finally {
            setSavingProgress(false);
        }
    };

    /* ---------- reading progress bar ---------- */
    useEffect(() => {
        const onScroll = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
            if (progressRef.current) progressRef.current.style.transform = `scaleX(${ratio})`;
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [lesson]);

    /* ---------- syntax highlight ---------- */
    useEffect(() => {
        if (codeRef.current && lesson?.codeSnippet?.code) {
            codeRef.current.removeAttribute("data-highlighted");
            hljs.highlightElement(codeRef.current);
        }
    }, [lesson]);

    /* ---------- cleanup ---------- */
    useEffect(
        () => () => {
            clearTimeout(toastTimer.current);
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        },
        []
    );

    /* ---------- hero spotlight ---------- */
    const onHeroMove = (e) => {
        const rect = heroRef.current?.getBoundingClientRect();
        if (!rect) return;
        heroRef.current.style.setProperty("--mx", `${e.clientX - rect.left}px`);
        heroRef.current.style.setProperty("--my", `${e.clientY - rect.top}px`);
    };

    /* ---------- update lesson (AI) ---------- */
    const updateLesson = async () => {
        const text = prompt.trim();
        if (!text) {
            setUpdateError("Please enter what you want to change.");
            return;
        }
        if (!getStoredToken()) {
            setUpdateError("You are not logged in.");
            return;
        }

        try {
            setUpdating(true);
            setUpdateError("");
            const res = await fetch(
                `${API_BASE}/courses/${encodeURIComponent(courseSlug)}/${encodeURIComponent(lessonId)}/update`,
                { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ prompt: text }) }
            );
            const data = await readResponse(res);
            const updated = getLessonFromResponse(data);
            if (!updated) throw new Error("The API did not return the updated lesson.");

            setLesson(updated);
            setShowUpdate(false);
            setPrompt("");
            showToast(data.message || "Lesson updated successfully.");
        } catch (err) {
            console.error("Update lesson error:", err);
            setUpdateError(err.message || "Unable to update lesson.");
        } finally {
            setUpdating(false);
        }
    };

    /* ---------- voice ---------- */
    const generateVoice = async () => {
        try {
            setVoiceBusy(true);
            setVoiceStatus({ msg: "Generating Hinglish explanation...", error: false });

            const res = await fetch(
                `${API_BASE}/voice/${encodeURIComponent(courseSlug)}/${encodeURIComponent(lessonId)}`,
                { method: "POST", headers: getAuthHeaders() }
            );
            if (!res.ok) await readResponse(res);

            const type = res.headers.get("content-type") || "";
            let url;

            if (type.includes("application/json")) {
                const data = await res.json();
                url = data.audioUrl || data.url || data.data?.audioUrl;
                if (!url) throw new Error("Voice API did not return an audio URL.");
            } else {
                const blob = await res.blob();
                if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                url = URL.createObjectURL(blob);
                objectUrlRef.current = url;
            }

            setAudioUrl(url);
            setVoiceStatus({ msg: "Voice explanation generated.", error: false });
            setTimeout(() => audioRef.current?.play().catch(() => { }), 50);
        } catch (err) {
            console.error("Voice generation error:", err);
            setVoiceStatus({ msg: err.message || "Unable to generate voice.", error: true });
        } finally {
            setVoiceBusy(false);
        }
    };

    const stopVoice = () => {
        const a = audioRef.current;
        if (!a) return;
        a.pause();
        a.currentTime = 0;
    };

    /* ---------- copy code ---------- */
    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(lesson.codeSnippet.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    /* ---------- PDF ---------- */
    const downloadPdf = async () => {
        let node;
        try {
            setPdfBusy(true);
            const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                import("html2canvas"),
                import("jspdf"),
            ]);

            node = buildPdfNode(lesson, courseSlug, lessonId);
            document.body.appendChild(node);

            const canvas = await html2canvas(node, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
                windowWidth: 800,
            });

            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const usableW = pageW - margin * 2;
            const usableH = pageH - margin * 2;
            const pxPerMm = canvas.width / usableW;
            const sliceMax = Math.floor(usableH * pxPerMm);

            let y = 0;
            let page = 0;
            while (y < canvas.height) {
                const sliceH = Math.min(sliceMax, canvas.height - y);
                const pc = document.createElement("canvas");
                pc.width = canvas.width;
                pc.height = sliceH;
                const ctx = pc.getContext("2d");
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, pc.width, pc.height);
                ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

                if (page > 0) pdf.addPage();
                pdf.addImage(pc.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, usableW, sliceH / pxPerMm);
                y += sliceH;
                page++;
            }

            const safe =
                (lesson.title || "lesson-notes").replace(/[\\/:*?"<>|]+/g, "-").trim() || "lesson-notes";
            pdf.save(`${safe}.pdf`);
            showToast("Notes downloaded as PDF.");
        } catch (err) {
            console.error("PDF download error:", err);
            showToast(`Unable to generate PDF: ${err.message}`);
        } finally {
            node?.remove();
            setPdfBusy(false);
        }
    };

    /* ---------- video ---------- */
    const renderVideo = () => {
        const v = lesson.video;
        if (!v) return null;

        let embed = v.embedUrl || "";
        if (!embed && v.videoId) {
            embed = `https://www.youtube.com/embed/${encodeURIComponent(v.videoId)}`;
        }
        embed = safeUrl(embed);

        if (embed) {
            return (
                <Reveal className="ld-card">
                    <h2 className="ld-card-title"><span className="ld-ico">▶</span> Video Tutorial</h2>
                    <div className="ld-video">
                        <iframe
                            src={embed}
                            title={v.title || "Lesson video"}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />
                    </div>
                </Reveal>
            );
        }

        const link = safeUrl(v.videoUrl);
        if (link) {
            return (
                <Reveal className="ld-card">
                    <h2 className="ld-card-title"><span className="ld-ico">▶</span> Video Tutorial</h2>
                    <a className="ld-link-pill" href={link} target="_blank" rel="noopener noreferrer">
                        Watch video: {v.title || "Open video"} ↗
                    </a>
                </Reveal>
            );
        }
        return null;
    };

    /* =====================================
       RENDER
    ===================================== */

    const background = (
        <div className="ld-bg" aria-hidden="true">
            <span className="ld-orb ld-orb-1" />
            <span className="ld-orb ld-orb-2" />
            <span className="ld-orb ld-orb-3" />
        </div>
    );

    if (loading) {
        return (
            <div className="ld-page">
                {background}
                <div className="ld-shell">
                    <div className="ld-skeleton ld-sk-back" />
                    <div className="ld-skeleton ld-sk-hero" />
                    <div className="ld-skeleton ld-sk-card" />
                    <div className="ld-skeleton ld-sk-card" />
                </div>
            </div>
        );
    }

    if (error || !lesson) {
        return (
            <div className="ld-page">
                {background}
                <div className="ld-state">
                    <div className="ld-state-icon">!</div>
                    <h2>Unable to load lesson</h2>
                    <p>{error || "Lesson not found."}</p>
                    <div className="ld-state-actions">
                        <button className="ld-btn ld-btn-ghost" onMouseDown={ripple} onClick={() => navigate(`/course/${courseSlug}`)}>
                            ← Back to Course
                        </button>
                        <button className="ld-btn ld-btn-primary" onMouseDown={ripple} onClick={() => setReloadKey((k) => k + 1)}>
                            Try again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const sections = Array.isArray(lesson.sections) ? lesson.sections : [];
    const takeaways = Array.isArray(lesson.keyTakeaways) ? lesson.keyTakeaways : [];
    const citations = Array.isArray(lesson.citations) ? lesson.citations : [];
    const code = lesson.codeSnippet;

    return (
        <div className="ld-page">
            {background}
            <div className="ld-progress"><div ref={progressRef} className="ld-progress-bar" /></div>

            <div className="ld-shell">
                <button className="ld-back" onClick={() => navigate(`/course/${courseSlug}`)}>
                    <span className="ld-back-arrow">←</span> Back to Course
                </button>

                {/* HERO */}
                <header className="ld-hero" ref={heroRef} onMouseMove={onHeroMove}>
                    <div className="ld-hero-grid" />
                    <div className="ld-hero-glow" />

                    <div className="ld-hero-body">
                        {lesson.lessonNumber ? (
                            <span className="ld-label">
                                <i className="ld-pulse" /> LESSON {lesson.lessonNumber}
                            </span>
                        ) : null}

                        <h1>{lesson.title || "Untitled Lesson"}</h1>
                        {lesson.learningObjective ? <p>{lesson.learningObjective}</p> : null}

                        {/* Course Progress Bar */}
                        {courseProgress && typeof courseProgress.percentage === "number" && (
                            <div className="ld-course-progress">
                                <div className="ld-cp-head">
                                    <span>Course Progress</span>
                                    <strong>{courseProgress.percentage}%</strong>
                                </div>
                                <div className="ld-cp-track">
                                    <div
                                        className={`ld-cp-fill ${courseProgress.percentage === 100 ? "is-done" : ""}`}
                                        style={{ width: `${courseProgress.percentage}%` }}
                                    />
                                </div>
                                <p className="ld-cp-caption">
                                    {courseProgress.completedCount || 0} of {courseProgress.totalLessons || 0} lessons completed
                                    {courseProgress.isCompleted ? " · Course complete" : ""}
                                </p>
                            </div>
                        )}

                        <div className="ld-actions">
                            <button className="ld-btn ld-btn-primary" onMouseDown={ripple}
                                onClick={() => navigate(`/course/${courseSlug}/lesson/${lessonId}/quiz`)}>
                                <span>🧠</span> Take Lesson Quiz
                            </button>

                            {/* Mark / Completed button with inline progress logic */}
                            <button
                                type="button"
                                className={`ld-btn ${isCompleted ? "ld-btn-green" : "ld-btn-ghost"}`}
                                onMouseDown={ripple}
                                onClick={toggleComplete}
                                disabled={savingProgress || progressLoading}
                            >
                                <span aria-hidden="true">{isCompleted ? "✓" : "○"}</span>
                                {savingProgress ? "Saving..." : isCompleted ? "Completed" : "Mark as complete"}
                            </button>

                            <button className="ld-btn ld-btn-green" onMouseDown={ripple} onClick={downloadPdf} disabled={pdfBusy}>
                                {pdfBusy ? <i className="ld-spinner" /> : <span>⬇</span>}
                                {pdfBusy ? "Generating PDF..." : "Download Notes (PDF)"}
                            </button>

                            <button className={`ld-btn ld-btn-ghost ${showUpdate ? "is-active" : ""}`}
                                onMouseDown={ripple} onClick={() => setShowUpdate((s) => !s)}>
                                <span>✏️</span> Update Lesson
                            </button>
                        </div>
                    </div>
                </header>

                {/* UPDATE PANEL */}
                <div className={`ld-collapse ${showUpdate ? "open" : ""}`}>
                    <div className="ld-collapse-inner">
                        <section className="ld-card ld-update">
                            <h2 className="ld-card-title"><span className="ld-ico">✨</span> Update with AI</h2>
                            <p className="ld-muted">Tell AI how you want to improve or change this lesson.</p>

                            <textarea
                                className="ld-textarea"
                                rows={5}
                                value={prompt}
                                disabled={updating}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Example: Make this lesson easier for beginners and add practical examples."
                            />

                            {updateError ? <div className="ld-note ld-note-error">{updateError}</div> : null}
                            {updating ? (
                                <div className="ld-note"><i className="ld-spinner" /> AI is updating this lesson. Please wait...</div>
                            ) : null}

                            <div className="ld-actions ld-actions-tight">
                                <button className="ld-btn ld-btn-primary" onMouseDown={ripple} onClick={updateLesson} disabled={updating}>
                                    {updating ? "Updating..." : "Update Lesson"}
                                </button>
                                <button className="ld-btn ld-btn-ghost" onMouseDown={ripple} disabled={updating}
                                    onClick={() => { setShowUpdate(false); setPrompt(""); setUpdateError(""); }}>
                                    Cancel
                                </button>
                            </div>
                        </section>
                    </div>
                </div>

                {/* CONTENT */}
                <main className="ld-content">
                    {renderVideo()}

                    {lesson.overview ? (
                        <Reveal className="ld-card">
                            <h2 className="ld-card-title"><span className="ld-ico">📖</span> Overview</h2>
                            <div className="ld-text">{lesson.overview}</div>
                        </Reveal>
                    ) : null}

                    {sections.length > 0 && (
                        <Reveal className="ld-card">
                            <h2 className="ld-card-title"><span className="ld-ico">🧩</span> Lesson Content</h2>
                            <div className="ld-sections">
                                {sections.map((s, i) => (
                                    <div className="ld-section" key={`${s.subtopic}-${i}`} style={{ "--i": i }}>
                                        <span className="ld-section-num">{String(i + 1).padStart(2, "0")}</span>
                                        <div>
                                            <h3>{s.subtopic || "Section"}</h3>
                                            <div className="ld-text">{s.content}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Reveal>
                    )}

                    {code?.code ? (
                        <Reveal className="ld-card">
                            <div className="ld-code-head">
                                <h2 className="ld-card-title"><span className="ld-ico">💻</span> {code.filename || "Code Example"}</h2>
                                <button className={`ld-btn ld-btn-small ${copied ? "ld-btn-green" : "ld-btn-ghost"}`}
                                    onMouseDown={ripple} onClick={copyCode}>
                                    {copied ? "✓ Copied!" : "Copy"}
                                </button>
                            </div>
                            {code.explanation ? <p className="ld-text ld-code-exp">{code.explanation}</p> : null}
                            <pre className="ld-pre">
                                <code key={code.code} ref={codeRef} className={`language-${code.language || "plaintext"}`}>
                                    {code.code}
                                </code>
                            </pre>
                        </Reveal>
                    ) : null}

                    {takeaways.length > 0 && (
                        <Reveal className="ld-card">
                            <h2 className="ld-card-title"><span className="ld-ico">🎯</span> Key Takeaways</h2>
                            <ul className="ld-takeaways">
                                {takeaways.map((t, i) => (
                                    <li key={i} style={{ "--i": i }}>
                                        <span className="ld-check">✓</span>
                                        <span>{t}</span>
                                    </li>
                                ))}
                            </ul>
                        </Reveal>
                    )}

                    {citations.length > 0 && (
                        <Reveal className="ld-card">
                            <h2 className="ld-card-title"><span className="ld-ico">🔗</span> References</h2>
                            <ul className="ld-refs">
                                {citations.map((c, i) => {
                                    const url = safeUrl(c.url);
                                    const inner = (
                                        <>
                                            <strong>{c.title || c.url || "Reference"}</strong>
                                            {c.description ? <small>{c.description}</small> : null}
                                        </>
                                    );
                                    return (
                                        <li key={i} style={{ "--i": i }}>
                                            {url ? (
                                                <a href={url} target="_blank" rel="noopener noreferrer">
                                                    <div>{inner}</div>
                                                    <span className="ld-ref-arrow">↗</span>
                                                </a>
                                            ) : (
                                                <div className="ld-ref-plain">{inner}</div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </Reveal>
                    )}

                    {/* VOICE */}
                    <Reveal className="ld-card ld-voice">
                        <h2 className="ld-card-title"><span className="ld-ico">🔊</span> Hinglish Voice Explanation</h2>
                        <p className="ld-muted">Generate a Hinglish explanation of this lesson.</p>

                        <div className="ld-voice-row">
                            <div className="ld-actions ld-actions-tight">
                                <button className="ld-btn ld-btn-primary" onMouseDown={ripple} onClick={generateVoice} disabled={voiceBusy}>
                                    {voiceBusy ? <i className="ld-spinner" /> : <span>🔊</span>}
                                    {voiceBusy ? "Generating..." : "Generate Voice"}
                                </button>
                                <button className="ld-btn ld-btn-ghost" onMouseDown={ripple} onClick={stopVoice} disabled={!audioUrl}>
                                    ■ Stop
                                </button>
                            </div>

                            <div className={`ld-wave ${playing ? "on" : ""}`} aria-hidden="true">
                                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                                    <i key={n} style={{ "--n": n }} />
                                ))}
                            </div>
                        </div>

                        {voiceStatus.msg ? (
                            <div className={`ld-note ${voiceStatus.error ? "ld-note-error" : ""}`}>{voiceStatus.msg}</div>
                        ) : null}

                        {audioUrl ? (
                            <audio
                                ref={audioRef}
                                className="ld-audio"
                                src={audioUrl}
                                controls
                                onPlay={() => setPlaying(true)}
                                onPause={() => setPlaying(false)}
                                onEnded={() => setPlaying(false)}
                            />
                        ) : null}
                    </Reveal>
                </main>
            </div>

            {toast ? (
                <div className="ld-toast" key={toast} role="status">
                    <i className="ld-toast-dot" />
                    {toast}
                </div>
            ) : null}
        </div>
    );
}
