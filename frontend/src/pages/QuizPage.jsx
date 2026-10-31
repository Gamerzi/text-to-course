import { API_URL } from "../config.js";
import React, { useState, useEffect, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/QuizPage.css';

const API_BASE = `${API_URL}/api/courses`;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/* =====================================================
   DEMO / PREVIEW DATA
   Only used when you open the page with "?demo=1".
   It is NOT used as a fallback anymore: if the backend
   has no quiz, the "No quiz available" screen is shown.
===================================================== */

const DEMO_QUIZ = {
    lessonTitle: "JavaScript Fundamentals",
    title: "JavaScript Fundamentals",
    topic: "JavaScript Basics",
    passingPercentage: 60,
    questions: [
        {
            questionId: 1,
            difficulty: "easy",
            question: "Which keyword declares a variable that cannot be reassigned after it is initialized?",
            options: ["let", "var", "const", "static"],
            correctIndex: 2,
            explanation: "`const` creates a binding that cannot be reassigned. If the value is an object or array, its contents can still be changed."
        },
        {
            questionId: 2,
            difficulty: "easy",
            question: "What does the `typeof` operator return when used on a text string?",
            options: ["string", "text", "char", "object"],
            correctIndex: 0,
            explanation: "`typeof` always returns the word string for any string primitive, no matter its length or content."
        },
        {
            questionId: 3,
            difficulty: "easy",
            question: "Which array method adds one or more items to the end of an array?",
            options: ["push()", "pop()", "shift()", "unshift()"],
            correctIndex: 0,
            explanation: "`push()` appends items to the end of an array and returns the array's new length."
        },
        {
            questionId: 4,
            difficulty: "medium",
            question: "What does `1 == '1'` evaluate to in JavaScript?",
            options: ["true", "false", "undefined", "TypeError"],
            correctIndex: 0,
            explanation: "The `==` operator coerces types before comparing, turning the string '1' into the number 1, so the result is true. The strict `===` operator would return false instead."
        },
        {
            questionId: 5,
            difficulty: "medium",
            question: "Inside a plain function that is called on its own, in non-strict mode, what does `this` refer to?",
            options: ["The function itself", "undefined", "The global object", "The nearest enclosing scope"],
            correctIndex: 2,
            explanation: "Calling a function on its own in non-strict mode binds `this` to the global object (`window` in browsers). In strict mode, `this` would be undefined instead."
        },
        {
            questionId: 6,
            difficulty: "medium",
            question: "Which array method returns a new array built by transforming every element of the original?",
            options: ["forEach()", "map()", "filter()", "reduce()"],
            correctIndex: 1,
            explanation: "`map()` runs a function on each element and returns a new array of the same length with the results, unlike `forEach()` (returns nothing) or `filter()` (returns a subset)."
        },
        {
            questionId: 7,
            difficulty: "hard",
            question: "Which description best matches a closure?",
            options: [
                "A function that accepts no parameters",
                "A function bundled together with references to its surrounding scope",
                "A loop that never terminates",
                "A method used to close a database connection"
            ],
            correctIndex: 1,
            explanation: "A closure lets an inner function keep accessing variables from its outer function's scope, even after that outer function has already returned."
        },
        {
            questionId: 8,
            difficulty: "hard",
            question: "When every promise passed to `Promise.all([p1, p2])` resolves successfully, what do you get back?",
            options: [
                "Only the first promise's result",
                "A promise that rejects immediately",
                "A single promise that resolves to an array of both results, in order",
                "undefined"
            ],
            correctIndex: 2,
            explanation: "`Promise.all()` waits for every promise to settle and resolves with an array of their results in the same order they were passed in, or it rejects as soon as any one of them rejects."
        },
        {
            questionId: 9,
            difficulty: "easy",
            question: "What is the value of the expression [1, 2, 3].length?",
            options: ["2", "3", "undefined", "Error"],
            correctIndex: 1,
            explanation: "The `length` property reflects how many elements the array currently holds, which is three in this case."
        },
        {
            questionId: 10,
            difficulty: "hard",
            question: "Which statement about `let` and hoisting is accurate?",
            options: [
                "`let` declarations are never hoisted",
                "`let` is hoisted but stays in a temporal dead zone until its declaration runs",
                "`let` is hoisted and initialized with undefined, just like `var`",
                "`let` cannot be declared inside a block"
            ],
            correctIndex: 1,
            explanation: "`let` bindings are hoisted to the top of their block but cannot be accessed before the declaration line executes - that gap is called the temporal dead zone, and reading the variable early throws a ReferenceError."
        }
    ]
};

// Builds a result object shaped just like the real API response,
// so the result screen doesn't need to know whether it's live or demo data.
function buildDemoResult(quiz, answers) {
    const breakdown = quiz.questions.map((q) => {
        const selectedIndex = answers[q.questionId];
        const isCorrect = selectedIndex === q.correctIndex;

        return {
            question: q.question,
            isCorrect,
            userAnswer: selectedIndex !== undefined ? q.options[selectedIndex] : null,
            correctOption: q.options[q.correctIndex],
            explanation: q.explanation
        };
    });

    const score = breakdown.filter(b => b.isCorrect).length;
    const totalQuestions = quiz.questions.length;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const passingPercentage = quiz.passingPercentage || 60;

    return {
        success: true,
        score,
        totalQuestions,
        percentage,
        passingPercentage,
        passed: percentage >= passingPercentage,
        breakdown
    };
}

/* =====================================================
   SMALL HELPERS
===================================================== */

// Turns `code` in text into <code> elements (no more raw backticks)
function Inline({ text }) {
    if (text === null || text === undefined) return null;
    const parts = String(text).split(/(`[^`]+`)/g);

    return parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 2
            ? <code key={i} className="qp-code">{part.slice(1, -1)}</code>
            : <React.Fragment key={i}>{part}</React.Fragment>
    );
}

// Options may already come as "A) text" from the API. We show our own letter badge.
const stripLetter = (text) => String(text ?? '').replace(/^\s*[A-F][\).:]\s+/, '');

// Click ripple for buttons (the .qp-ripple span is styled in the CSS)
function ripple(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const keyboard = e.detail === 0; // Enter / Space press
    const x = keyboard ? rect.width / 2 : e.clientX - rect.left;
    const y = keyboard ? rect.height / 2 : e.clientY - rect.top;

    const span = document.createElement('span');
    span.className = 'qp-ripple';
    span.style.cssText =
        `width:${size}px;height:${size}px;left:${x - size / 2}px;top:${y - size / 2}px`;

    btn.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
}

// Smooth number count-up (rAF based, no re-render storms)
function useCountUp(target, duration = 1100) {
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (!target) {
            setValue(0);
            return;
        }

        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduce) {
            setValue(target);
            return;
        }

        let raf;
        const start = performance.now();

        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(target * eased));
            if (t < 1) raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);

    return value;
}

/* =====================================================
   MAIN COMPONENT
===================================================== */

export default function QuizPage() {
    const { courseSlug, lessonId: paramLessonId } = useParams();
    const navigate = useNavigate();

    // Explicit demo mode: add ?demo=1 to the URL to preview the full UI
    // with sample data, with no backend required at all.
    const demoRequested = useMemo(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search);
        const flag = params.get('demo');
        return flag === '1' || flag === 'true';
    }, []);

    const [activeLessonId, setActiveLessonId] = useState(paramLessonId || null);
    const [quizData, setQuizData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isDemo, setIsDemo] = useState(false);
    const [reloadKey, setReloadKey] = useState(0); // bump to re-fetch

    const [selectedAnswers, setSelectedAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [reviewFilter, setReviewFilter] = useState('all');
    const [regenerating, setRegenerating] = useState(false);

    const getHeaders = () => {
        const token = localStorage.getItem("token");

        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        };
    };

    // Explicit preview mode: skip the network entirely and load sample data.
    useEffect(() => {
        if (!demoRequested) return;

        setQuizData(DEMO_QUIZ);
        setIsDemo(true);
        setError("");
        setLoading(false);
    }, [demoRequested]);

    // Get the first lesson if no lesson ID exists in the URL
    useEffect(() => {
        if (demoRequested) return;

        if (paramLessonId) {
            setActiveLessonId(paramLessonId);
            return;
        }

        if (!courseSlug) {
            setError("No course specified.");
            setLoading(false);
            return;
        }

        const fetchFirstLesson = async () => {
            try {
                const response = await fetch(
                    `${API_BASE}/${encodeURIComponent(courseSlug)}`,
                    { headers: getHeaders() }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Unable to load course.");
                }

                const lessons = data.course?.lessons || [];

                if (lessons.length > 0) {
                    const firstId = lessons[0].lessonId || lessons[0]._id;
                    setActiveLessonId(firstId);
                } else {
                    setError("No lessons found for this course.");
                    setLoading(false);
                }
            } catch (err) {
                // Shown by the "No quiz available" screen
                console.error("Course fetch error:", err);
                setError(err.message || "Unable to load course.");
                setLoading(false);
            }
        };

        fetchFirstLesson();
    }, [courseSlug, paramLessonId, demoRequested, reloadKey]);

    // Fetch quiz
    useEffect(() => {
        if (demoRequested) return;
        if (!courseSlug || !activeLessonId) return;

        const controller = new AbortController();

        const fetchQuiz = async () => {
            setLoading(true);
            setError("");
            setQuizData(null);
            setSelectedAnswers({});
            setResult(null);
            setIsDemo(false);

            try {
                const response = await fetch(
                    `${API_BASE}/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(activeLessonId)}/quiz`,
                    {
                        headers: getHeaders(),
                        signal: controller.signal
                    }
                );

                const data = await response.json();

                if (!response.ok || data.success === false) {
                    throw new Error(
                        data.message || data.error || "Unable to load quiz."
                    );
                }

                if (!data.quiz) {
                    throw new Error("No quiz data returned from server.");
                }

                setQuizData(data.quiz);
            } catch (err) {
                if (err.name !== "AbortError") {
                    // quizData stays null -> "No quiz available" screen
                    console.error("Quiz fetch error:", err);
                    setError(err.message || "Unable to load quiz.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchQuiz();

        return () => controller.abort();
    }, [courseSlug, activeLessonId, demoRequested, reloadKey]);

    const questions = quizData?.questions || [];
    const totalQuestions = questions.length;

    const answeredCount = Object.keys(selectedAnswers).length;

    const progressPercent = totalQuestions > 0
        ? Math.round((answeredCount / totalQuestions) * 100)
        : 0;

    const animatedScore = useCountUp(result ? Number(result.percentage) || 0 : 0);

    const handleSelectOption = (questionId, optionIndex) => {
        if (result || submitting) return;

        setSelectedAnswers(prev => ({
            ...prev,
            [questionId]: optionIndex
        }));
    };

    // Submit quiz
    const handleSubmit = async () => {
        if (answeredCount === 0 || submitting || result) return;
        if (!isDemo && !activeLessonId) return;

        setSubmitting(true);
        setError("");

        if (isDemo) {
            // Brief, simulated delay so the submit state still feels real.
            await new Promise(resolve => setTimeout(resolve, 500));

            setResult(buildDemoResult(quizData, selectedAnswers));
            setReviewFilter('all');
            setSubmitting(false);

            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        const payloadAnswers = Object.entries(selectedAnswers).map(
            ([qId, index]) => ({
                questionId: Number(qId),
                selectedIndex: Number(index)
            })
        );

        try {
            const response = await fetch(
                `${API_BASE}/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(activeLessonId)}/quiz/submit`,
                {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        answers: payloadAnswers
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message || data.error || "Failed to submit quiz."
                );
            }

            setResult(data);
            setReviewFilter('all');

            // Start result page from the top
            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });

        } catch (err) {
            console.error("Quiz submit error:", err);
            setError(err.message || "Submission failed.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleBack = () => {
        if (courseSlug) {
            navigate(`/course/${encodeURIComponent(courseSlug)}`);
        } else {
            navigate(-1);
        }
    };

    const handleRetry = () => {
        setSelectedAnswers({});
        setResult(null);
        setReviewFilter('all');
        setError("");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    };

    // Re-request the quiz from the backend (used by the "No quiz" screen)
    const handleReload = () => {
        setError("");
        setLoading(true);
        setReloadKey(k => k + 1);
    };

    
    // Force-regenerate quiz from backend using AI
    const handleRegenerateQuiz = async () => {
        if (isDemo || !courseSlug || !activeLessonId || regenerating) return;
        setRegenerating(true);
        setError("");
        setResult(null);
        setSelectedAnswers({});
        setReviewFilter('all');
        setQuizData(null);
        setLoading(true);
        try {
            const response = await fetch(
                `${API_BASE}/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(activeLessonId)}/quiz?regenerate=true`,
                { headers: getHeaders() }
            );
            const data = await response.json();
            if (!response.ok || data.success === false) {
                throw new Error(data.message || data.error || "Failed to regenerate quiz.");
            }
            if (!data.quiz) throw new Error("No quiz data returned.");
            setQuizData(data.quiz);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            console.error("Regenerate quiz error:", err);
            setError(err.message || "Failed to regenerate quiz.");
        } finally {
            setRegenerating(false);
            setLoading(false);
        }
    };
/* ---------- Loading screen ---------- */
    if (loading) {
        return (
            <div className="qp-root">
                <BackgroundEffects />

                <div className="qp-state-container">
                    <div className="qp-loader"></div>
                    <h2>Preparing your quiz</h2>
                    <p>Getting your questions ready...</p>
                </div>
            </div>
        );
    }

    /* ---------- No quiz fallback ----------
       Shown when the backend returns no quiz, an error, or a quiz
       with zero questions. (Submit errors don't land here because
       quizData exists by then.) */
    if (!result && (!quizData || questions.length === 0)) {
        return (
            <div className="qp-root">
                <BackgroundEffects />

                <div className="qp-state-container">
                    <div className="qp-state-icon info">?</div>
                    <h2>No quiz available</h2>
                    <p>
                        This lesson doesn't have a quiz yet, or we couldn't load it.
                        You can go back to the course or try again.
                    </p>

                    {error && <p className="qp-state-detail">{error}</p>}

                    <div className="qp-state-actions">
                        <button
                            className="qp-secondary-btn"
                            onClick={(e) => { ripple(e); handleReload(); }}
                        >
                            Try again
                        </button>

                        <button
                            className="qp-primary-btn"
                            onClick={(e) => { ripple(e); handleBack(); }}
                        >
                            Back to Course
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* ---------- Result screen ---------- */
    if (result) {
        const score = Math.max(0, Math.min(100, Number(result.percentage) || 0));
        const passed = Boolean(result.passed);
        const breakdown = result.breakdown || [];
        const wrongCount = breakdown.filter(b => !b.isCorrect).length;

        const RING_R = 70;
        const RING_C = 2 * Math.PI * RING_R;
        const ringOffset = RING_C * (1 - score / 100);

        const visibleItems = breakdown
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => reviewFilter === 'all' || !item.isCorrect);

        return (
            <div className="qp-root qp-result-root">
                <BackgroundEffects />

                <Navbar
                    onBack={handleBack}
                    right={
                        <span className="qp-nav-status">
                            <span className="qp-status-dot"></span>
                            Assessment completed
                        </span>
                    }
                />

                <main className="qp-result-container">

                    <section className="qp-result-hero">
                        {passed && <Confetti />}

                        <div className={`qp-result-icon ${passed ? 'passed' : 'failed'}`}>
                            {passed ? '🏆' : '📖'}
                        </div>

                        <span className="qp-section-label">QUIZ COMPLETED</span>

                        {isDemo && (
                            <div className="qp-demo-badge">
                                <span className="qp-demo-dot"></span>
                                Preview mode — sample results
                            </div>
                        )}

                        <h1>{passed ? 'Congratulations!' : 'Quiz needs review'}</h1>

                        <p>
                            {passed
                                ? "Excellent work! You've successfully completed this assessment."
                                : "Don't worry. Review your answers below and strengthen your understanding."}
                        </p>

                        <div className={`qp-score-ring ${passed ? 'passed' : 'failed'}`}>
                            <svg viewBox="0 0 164 164" aria-hidden="true">
                                <defs>
                                    <linearGradient id="qp-ring-fail" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#c084fc" />
                                        <stop offset="100%" stopColor="#7c3aed" />
                                    </linearGradient>
                                    <linearGradient id="qp-ring-pass" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#2dd4bf" />
                                        <stop offset="100%" stopColor="#5fc9ff" />
                                    </linearGradient>
                                </defs>
                                <circle className="qp-ring-track" cx="82" cy="82" r={RING_R} />
                                <circle
                                    className="qp-ring-fill"
                                    cx="82"
                                    cy="82"
                                    r={RING_R}
                                    stroke={passed ? 'url(#qp-ring-pass)' : 'url(#qp-ring-fail)'}
                                    style={{
                                        '--c': RING_C,
                                        '--off': ringOffset
                                    }}
                                />
                            </svg>

                            <div className="qp-score-inner">
                                <strong>{animatedScore}%</strong>
                                <span>YOUR SCORE</span>
                            </div>
                        </div>

                        <div className="qp-score-details">
                            <div>
                                <strong>{result.score ?? 0}</strong>
                                <span>Correct answers</span>
                            </div>

                            <span className="qp-score-separator"></span>

                            <div>
                                <strong>{result.totalQuestions ?? totalQuestions}</strong>
                                <span>Total questions</span>
                            </div>

                            <span className="qp-score-separator"></span>

                            <div>
                                <strong>{result.passingPercentage ?? 60}%</strong>
                                <span>Passing score</span>
                            </div>
                        </div>

                        <div className={`qp-result-status ${passed ? 'passed' : 'failed'}`}>
                            <span>{passed ? '✓' : '↗'}</span>
                            {passed ? 'You passed this assessment' : 'Keep learning and try again'}
                        </div>
                    </section>

                    <section className="qp-review-section">
                        <div className="qp-review-heading">
                            <div>
                                <span className="qp-section-label">DETAILED ANALYSIS</span>
                                <h2>Review your answers</h2>
                                <p>Understand your mistakes and learn from every question.</p>
                            </div>

                            <div className="qp-review-tabs" role="tablist" aria-label="Filter answers">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={reviewFilter === 'all'}
                                    className={reviewFilter === 'all' ? 'is-active' : ''}
                                    onClick={() => setReviewFilter('all')}
                                >
                                    All <span>{breakdown.length}</span>
                                </button>

                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={reviewFilter === 'wrong'}
                                    className={reviewFilter === 'wrong' ? 'is-active' : ''}
                                    onClick={() => setReviewFilter('wrong')}
                                >
                                    Needs review <span>{wrongCount}</span>
                                </button>
                            </div>
                        </div>

                        <div className="qp-review-list" key={reviewFilter}>
                            {visibleItems.length === 0 && (
                                <div className="qp-review-empty">
                                    Every answer was correct. Nothing to review.
                                </div>
                            )}

                            {visibleItems.map(({ item, index }, pos) => (
                                <article
                                    key={index}
                                    className={`qp-review-card ${item.isCorrect ? 'correct' : 'incorrect'}`}
                                    style={{ '--item-index': Math.min(pos, 8) }}
                                >
                                    <div className="qp-review-card-header">
                                        <div className="qp-review-number">
                                            {String(index + 1).padStart(2, '0')}
                                        </div>

                                        <div className="qp-review-question">
                                            <h3><Inline text={item.question} /></h3>
                                        </div>

                                        <span className={`qp-review-indicator ${item.isCorrect ? 'correct' : 'incorrect'}`}>
                                            {item.isCorrect ? '✓ Correct' : '✕ Incorrect'}
                                        </span>
                                    </div>

                                    <div className="qp-review-answers">
                                        <div className={`qp-answer-row ${item.isCorrect ? 'answer-correct' : 'answer-wrong'}`}>
                                            <span className="qp-answer-label">Your answer</span>
                                            <span><Inline text={item.userAnswer || 'Not answered'} /></span>
                                        </div>

                                        {!item.isCorrect && item.correctOption && (
                                            <div className="qp-answer-row answer-correct">
                                                <span className="qp-answer-label">Correct answer</span>
                                                <span><Inline text={item.correctOption} /></span>
                                            </div>
                                        )}
                                    </div>

                                    {item.explanation && (
                                        <div className="qp-explanation">
                                            <span className="qp-explanation-icon">✦</span>
                                            <div>
                                                <strong>Explanation</strong>
                                                <p><Inline text={item.explanation} /></p>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            ))}
                        </div>
                    </section>

                    <div className="qp-result-actions">
                        <button
                            className="qp-secondary-btn"
                            onClick={(e) => { ripple(e); handleBack(); }}
                        >
                            ← Back to Course
                        </button>

                        <button
                            className="qp-primary-btn"
                            onClick={(e) => { ripple(e); handleRetry(); }}
                        >
                            Try Again <span>↻</span>
                        </button>

                        {!isDemo && (
                            <button
                                className="qp-regenerate-btn"
                                disabled={regenerating}
                                onClick={(e) => { ripple(e); handleRegenerateQuiz(); }}
                                title="Generate a fresh set of questions using AI"
                            >
                                {regenerating ? (
                                    <><span className="qp-button-spinner"></span> Generating...</>
                                ) : (
                                    <>✨ Regenerate Quiz</>
                                )}
                            </button>
                        )}
                    </div>

                </main>
            </div>
        );
    }

    /* ---------- Main quiz screen ---------- */
    return (
        <div className="qp-root">
            <BackgroundEffects />

            <Navbar
                onBack={handleBack}
                center={
                    <span className="qp-lesson-badge" title={quizData?.lessonTitle}>
                        <span className="qp-status-dot"></span>
                        <span className="qp-lesson-badge-text">
                            {quizData?.lessonTitle || 'Course assessment'}
                        </span>
                    </span>
                }
                right={
                    <div className="qp-help">
                        <button
                            type="button"
                            className="qp-help-btn"
                            aria-label="Quiz help"
                            aria-describedby="qp-help-tip"
                        >
                            ?
                        </button>
                        <div role="tooltip" id="qp-help-tip" className="qp-help-tip">
                            Answer all questions and submit your quiz to see your results.
                        </div>
                    </div>
                }
            />

            {/* Hero */}
            <header className="qp-hero">
                <div className="qp-hero-label">
                    <span className="qp-status-dot"></span>
                    KNOWLEDGE ASSESSMENT
                </div>

                {isDemo && (
                    <div className="qp-demo-badge">
                        <span className="qp-demo-dot"></span>
                        Preview mode — showing sample quiz data
                    </div>
                )}

                <h1>{quizData?.title || 'Test your knowledge'}</h1>

                {quizData?.topic ? (
                    <div className="qp-hero-meta">
                        <span>Topic: {quizData.topic}</span>
                        <span>Passing score: {quizData.passingPercentage || 60}%</span>
                    </div>
                ) : (
                    <p>Answer the questions below to test your understanding.</p>
                )}
            </header>

            {/* Questions */}
            <main className="qp-main">
                <div className="qp-questions-list">
                    {questions.map((q, idx) => {
                        const questionId = q.questionId;
                        const currentSelected = selectedAnswers[questionId];

                        return (
                            <article
                                key={questionId ?? idx}
                                className={`qp-card ${currentSelected !== undefined ? 'is-answered' : ''}`}
                                style={{ '--item-index': Math.min(idx, 8) }}
                            >
                                <div className="qp-card-header">
                                    <span className="qp-number-badge">
                                        {String(idx + 1).padStart(2, '0')}
                                    </span>

                                    <div className="qp-card-heading">
                                        {q.difficulty && (
                                            <span className={`qp-difficulty-badge qp-difficulty-${q.difficulty}`}>
                                                {q.difficulty}
                                            </span>
                                        )}
                                        <h3><Inline text={q.question} /></h3>
                                    </div>
                                </div>

                                <div className="qp-options-grid" role="group" aria-label={`Question ${idx + 1} options`}>
                                    {q.options.map((optText, optIdx) => {
                                        const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);
                                        const isSelected = currentSelected === optIdx;

                                        return (
                                            <button
                                                key={optIdx}
                                                type="button"
                                                className={`qp-option-btn ${isSelected ? 'is-selected' : ''}`}
                                                onClick={() => handleSelectOption(questionId, optIdx)}
                                                aria-pressed={isSelected}
                                            >
                                                <span className="qp-option-letter">{letter}</span>

                                                <span className="qp-option-text">
                                                    <Inline text={stripLetter(optText)} />
                                                </span>

                                                <span className="qp-option-check" aria-hidden="true">✓</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </article>
                        );
                    })}
                </div>

                {error && (
                    <div className="qp-error-banner" role="alert">
                        {error}
                    </div>
                )}
            </main>

            {/* Floating progress bar */}
            <footer className="qp-bottom-bar">
                <div className="qp-bottom-inner">

                    <div className="qp-progress-section">
                        <div className="qp-progress-top">
                            <span>YOUR PROGRESS</span>
                            <strong>{answeredCount}/{totalQuestions}</strong>
                        </div>

                        <div
                            className="qp-progress-wrapper"
                            style={{ '--p': `${progressPercent}%` }}
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progressPercent}
                        >
                            <div className="qp-progress-fill"></div>

                            <span className="qp-progress-label">
                                {progressPercent}% complete
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="qp-submit-btn"
                        disabled={submitting || answeredCount === 0}
                        onClick={(e) => { ripple(e); handleSubmit(); }}
                    >
                        {submitting ? (
                            <>
                                <span className="qp-button-spinner"></span>
                                Submitting...
                            </>
                        ) : (
                            <>
                                Submit Quiz
                                <span className="qp-sparkle">✦</span>
                            </>
                        )}
                    </button>
                </div>
            </footer>
        </div>
    );
}

/* =====================================================
   NAVBAR
===================================================== */

function Navbar({ onBack, center, right }) {
    return (
        <nav className="qp-navbar">
            <div className="qp-nav-left">
                <button className="qp-back-btn" onClick={onBack}>
                    <span className="qp-back-arrow">←</span>
                    <span>Back to Course</span>
                </button>

                <span className="qp-nav-divider"></span>

                <span className="qp-nav-module">Quiz Module</span>
            </div>

            <div className="qp-nav-center">{center}</div>

            <div className="qp-nav-right">{right}</div>
        </nav>
    );
}

/* =====================================================
   CONFETTI (passed state, CSS only)
===================================================== */

const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
    x: Math.round(Math.cos((i / 18) * Math.PI * 2) * (90 + (i % 3) * 45)),
    y: Math.round(Math.sin((i / 18) * Math.PI * 2) * (60 + (i % 4) * 25)) + 60,
    r: (i * 67) % 360,
    d: (i % 6) * 0.05,
    c: ['#2dd4bf', '#a855f7', '#e64483', '#5fc9ff', '#ffe7a4'][i % 5]
}));

const Confetti = memo(function Confetti() {
    return (
        <div className="qp-confetti" aria-hidden="true">
            {CONFETTI.map((p, i) => (
                <span
                    key={i}
                    style={{
                        '--x': `${p.x}px`,
                        '--y': `${p.y}px`,
                        '--r': `${p.r}deg`,
                        '--d': `${p.d}s`,
                        '--c': p.c
                    }}
                />
            ))}
        </div>
    );
});

/* =====================================================
   AMBIENT BACKGROUND
   One slowly drifting gradient layer, 3 static soft glows,
   and a few small low-opacity icons at the far left/right
   edges (hidden on screens < 1180px by the CSS).
===================================================== */

const BackgroundEffects = memo(function BackgroundEffects() {
    return (
        <div className="qp-ambient-bg" aria-hidden="true">
            <div className="qp-glow qp-glow-1"></div>
            <div className="qp-glow qp-glow-2"></div>
            <div className="qp-glow qp-glow-3"></div>
            <div className="qp-grid-lines"></div>

            <div className="qp-decor">
                <span className="qp-d qp-d-braces">{'{ }'}</span>
                <span className="qp-d qp-d-code cyan">{'</>'}</span>
                <span className="qp-d qp-d-code2">{'</>'}</span>
                <span className="qp-d qp-d-braces2 cyan">{'{ }'}</span>

                <svg className="qp-d qp-d-cap" viewBox="0 0 48 48">
                    <path d="M24 10 44 19 24 28 4 19Z" />
                    <path d="M12 24v8c0 3 6 6 12 6s12-3 12-6v-8M44 19v10" />
                </svg>

                <svg className="qp-d qp-d-net" viewBox="0 0 64 64">
                    <path d="M15 41 29 17M35 17l14 20M16 46l11 5M33 50l16-7" />
                    <circle cx="12" cy="44" r="4" />
                    <circle cx="32" cy="14" r="4" />
                    <circle cx="52" cy="40" r="4" />
                    <circle cx="30" cy="52" r="3" />
                </svg>

                <svg className="qp-d qp-d-net2 cyan" viewBox="0 0 64 64">
                    <path d="M14 20 32 34 50 16M32 34v20" />
                    <circle cx="12" cy="21" r="4" />
                    <circle cx="32" cy="34" r="4" />
                    <circle cx="52" cy="15" r="4" />
                    <circle cx="32" cy="56" r="3" />
                </svg>

                <svg className="qp-d qp-d-circuit" viewBox="0 0 120 80">
                    <path d="M0 10h40l15 15h35M0 32h30l15 15h75M0 56h50l12 12h38" />
                    <circle cx="90" cy="25" r="3" />
                    <circle cx="118" cy="47" r="3" />
                    <circle cx="100" cy="68" r="3" />
                </svg>
            </div>
        </div>
    );
});