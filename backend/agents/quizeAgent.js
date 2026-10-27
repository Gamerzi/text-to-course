import Course from '../models/Course.js';
import Quiz from '../models/Quize.js';
import OpenAI from 'openai';

const getGroqClient = () => {
    return new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
    });
};

/**
 * Agent 3: Quiz Specialist
 *
 * Generates or retrieves a quiz for ONE specific lesson.
 *
 * courseSlug -> identifies the course
 * lessonId   -> identifies the lesson inside that course
 *
 * Each lesson gets its own quiz.
 */
export async function getOrGenerateLessonQuiz(
    courseSlug,
    lessonId,
    options = {}
) {
    const { forceRegenerate = false } = options;

    // 1. Check if quiz already exists for this specific lesson
    if (!forceRegenerate) {
        const existingQuiz = await Quiz.findOne({
            courseSlug,
            lessonId
        });

        if (existingQuiz) {
            return existingQuiz;
        }
    }

    // 2. Find the course
    const course = await Course.findOne({ courseSlug });

    if (!course) {
        throw new Error(
            `Course with slug "${courseSlug}" not found in database.`
        );
    }

    // 3. Find the requested lesson
    const lesson = course.lessons.find(
        lesson => lesson.lessonId === lessonId
    );

    if (!lesson) {
        throw new Error(
            `Lesson with ID "${lessonId}" not found in course "${courseSlug}".`
        );
    }

    // 4. Collect ONLY this lesson's content
    const takeaways = (lesson.keyTakeaways || []).join('; ');

    const sectionsText = (lesson.sections || [])
        .map(s =>
            `${s.subtopic || s.heading || ''}: ${s.content || ''}`
        )
        .join('\n');

    const groundedNotes = `
Lesson Number: ${lesson.lessonNumber}
Lesson Title: ${lesson.title}

Learning Objective:
${lesson.learningObjective || 'N/A'}

Subtopics:
${(lesson.subtopics || []).join(', ')}

Key Takeaways:
${takeaways || 'N/A'}

Detailed Notes:
${sectionsText || 'Core concepts introduced.'}
`;

    // 5. AI instructions
    const systemPrompt = `You are a Principal Technical Assessor.

Generate a rigorous 5-question multiple choice assessment
STRICTLY grounded in the lesson notes provided.

Rules:
- Generate questions ONLY from this lesson.
- Do NOT use information from other lessons.
- Do NOT invent facts outside the provided notes.
- Each question must have exactly 4 options.
- Return valid JSON only.`;

    const userPrompt = `Create a 5-question quiz for:

Course:
"${course.title}" (${course.courseSlug})

Lesson:
"${lesson.title}"

Lesson Number:
${lesson.lessonNumber}

LESSON NOTES FROM DATABASE:
${groundedNotes}

Return JSON with this EXACT structure:

{
  "title": "${lesson.title} Knowledge Check",
  "questions": [
    {
      "questionId": 1,
      "question": "Question text here?",
      "options": [
        "A) Option 1",
        "B) Option 2",
        "C) Option 3",
        "D) Option 4"
      ],
      "correctAnswerIndex": 0,
      "correctOption": "A) Option 1",
      "explanation": "Clear explanation why this is correct.",
      "conceptTested": "Core topic tested",
      "difficulty": "medium"
    }
  ]
}`;

    // 6. Call Groq
    const client = getGroqClient();

    const completion = await client.chat.completions.create({
        model: 'openai/gpt-oss-20b',

        messages: [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userPrompt
            }
        ],

        response_format: {
            type: 'json_object'
        },

        temperature: 0.15,
    });

    // 7. Parse AI response
    const rawJson =
        completion.choices[0].message.content.trim();

    const parsed = JSON.parse(rawJson);

    if (!parsed || !Array.isArray(parsed.questions)) {
        throw new Error(
            'AI returned an invalid quiz payload.'
        );
    }

    // 8. Delete only this lesson's quiz when regenerating
    if (forceRegenerate) {
        await Quiz.deleteOne({
            courseSlug,
            lessonId
        });
    }

    // 9. Create lesson-specific Quiz document
    const newQuiz = new Quiz({
        courseId: course._id,

        courseSlug: course.courseSlug,

        lessonId: lesson.lessonId,

        lessonNumber: lesson.lessonNumber,

        lessonTitle: lesson.title,

        title:
            parsed.title ||
            `${lesson.title} Quiz`,

        topic: course.topic || '',

        totalQuestions:
            parsed.questions.length,

        questions: parsed.questions.map((q, idx) => ({
            questionId: idx + 1,

            question: q.question,

            options: q.options,

            correctAnswerIndex:
                q.correctAnswerIndex ?? 0,

            correctOption:
                q.correctOption ||
                q.options[0],

            explanation:
                q.explanation || '',

            conceptTested:
                q.conceptTested || '',

            difficulty:
                q.difficulty || 'medium'
        })),

        generatedAt: new Date()
    });

    // 10. Save quiz
    const savedQuiz = await newQuiz.save();

    return savedQuiz;
}
