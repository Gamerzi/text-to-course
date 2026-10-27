import OpenAI from 'openai';
import Course from '../models/Course.js';

// Initialize Groq client using OpenAI compatibility
const getGroqClient = () => {
    return new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
    });
};

/**
 * Agent 1: Curriculum Architect
 * Generates structured course outline with 5 progressive lessons.
 *
 * @param {string} topic - The topic the user wants to learn
 * @returns {Promise<Object>} - Parsed JSON course outline
 */
const generateCourseOutline = async (topic) => {
    const client = getGroqClient();

    const systemPrompt = `You are a World-Class Curriculum Architect and Senior University Professor.
Your job is to transform any user topic into a structured, highly engaging online course syllabus.
Rules:
1. Divide the topic into exactly 5 progressive lessons (from foundational to advanced).
2. For each lesson, provide:
   - lessonNumber (integer 1 to 5)
   - title (clear, descriptive)
   - learningObjective (what student will achieve)
   - subtopics (array of 3-4 bullet topics to cover)
3. Return STRICT, VALID JSON ONLY. Do not wrap in markdown or backticks.`;

    const userPrompt = `Create a complete course outline for the topic: "${topic}".

Format your response as a JSON object with this exact structure:
{
  "title": "Comprehensive Course Title",
  "description": "2-3 sentence overview of the course",
  "tags": ["tag1", "tag2", "tag3"],
  "totalLessons": 5,
  "lessons": [
    {
      "lessonNumber": 1,
      "title": "Lesson Title",
      "learningObjective": "Clear objective",
      "subtopics": ["Subtopic 1", "Subtopic 2", "Subtopic 3"]
    }
  ]
}`;

    try {
        console.log(`\n🤖 [Agent 1: Curriculum Architect] Starting outline generation for: "${topic}"...`);

        const response = await client.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
        });

        const rawContent = response.choices[0].message.content;
        let parsed = JSON.parse(rawContent);

        // 🛡️ Proper Unpack: If AI wrapped the syllabus inside a parent key, extract it directly!
        if (parsed.course && typeof parsed.course === 'object') {
            parsed = parsed.course;
        } else if (parsed.course_outline && typeof parsed.course_outline === 'object') {
            parsed = parsed.course_outline;
        } else if (parsed.syllabus && typeof parsed.syllabus === 'object') {
            parsed = parsed.syllabus;
        }

        // Extract lessons array
        const rawLessons = parsed.lessons || parsed.modules || [];

        // Generate courseSlug using Course.slugify
        parsed.courseSlug = Course.slugify(parsed.title || topic);

        // Format each lesson with a clean lessonId and default state
        parsed.lessons = rawLessons.map((lesson, index) => {
            const lessonNum = lesson.lessonNumber || index + 1;
            const lessonTitle = lesson.title || `Lesson ${lessonNum}`;
            const cleanId = Course.slugify(lessonTitle);

            return {
                lessonId: cleanId || `lesson-${lessonNum}`,
                lessonNumber: lessonNum,
                title: lessonTitle,
                learningObjective: lesson.learningObjective || '',
                subtopics: Array.isArray(lesson.subtopics) ? lesson.subtopics : [],
                isEnriched: false,
            };
        });

        parsed.totalLessons = parsed.lessons.length;

        // 📢 Print the result to console for you to inspect!
        console.log('\n======================================================');
        console.log('✅ [Agent 1: Curriculum Architect] OUTLINE GENERATED:');
        console.log('======================================================');
        console.log(`📚 Title: ${parsed.title}`);
        console.log(`🔗 Course Slug: ${parsed.courseSlug}`);
        console.log(`📝 Description: ${parsed.description}`);
        console.log(`🏷️  Tags: ${parsed.tags?.join(', ')}`);
        console.log(`📖 Total Lessons: ${parsed.lessons.length}`);
        parsed.lessons.forEach((lesson) => {
            console.log(`   [ID: ${lesson.lessonId}] ${lesson.lessonNumber}. ${lesson.title}`);
            lesson.subtopics.forEach((sub) => console.log(`      - ${sub}`));
        });
        console.log('======================================================\n');

        return parsed;
    } catch (error) {
        console.error('❌ [Agent 1 Error]:', error.message);
        throw new Error(`Outline generation failed: ${error.message}`);
    }
};

// Export all functions together as default at the end
export default {
    generateCourseOutline,
};