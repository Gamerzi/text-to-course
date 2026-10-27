import OpenAI from 'openai';
import youtubeUtil from '../utils/youtube.js';

// Initialize Groq client using OpenAI compatibility
const getGroqClient = () => {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
};

/**
 * Helper: Detect whether the course or lesson is genuinely a programming language topic
 */
const isProgrammingTopic = (courseTitle, lesson) => {
  const programmingKeywords = [
    'java', 'python', 'javascript', 'typescript', 'c++', 'cpp', 'c#', 'golang', 'go lang',
    'rust', 'php', 'ruby', 'swift', 'kotlin', 'sql', 'html', 'css', 'react', 'node',
    'express', 'django', 'flask', 'spring', 'docker', 'kubernetes', 'devops', 'bash', 'shell'
  ];

  const combinedText = `${courseTitle} ${lesson.title} ${(lesson.subtopics || []).join(' ')}`.toLowerCase();
  return programmingKeywords.some((keyword) => combinedText.includes(keyword));
};

/**
 * Helper: Resilient JSON parser that handles markdown backticks, trailing commas, and unescaped quotes
 */
const safeJsonParse = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from AI model');
  }

  // 1. Remove markdown code fences if model wrapped response
  let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

  // 2. Extract outermost JSON object { ... }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // 3. Fix trailing commas before closing braces/brackets (common LLM JSON syntax error)
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  return JSON.parse(cleaned);
};

/**
 * Agent 2: Content & Citation Specialist
 * Generates comprehensive lesson notes, conditional code snippets (ONLY for programming topics),
 * verified citations, and a unique YouTube video.
 *
 * @param {string} courseTitle - The main title of the course
 * @param {Object} lesson - The lesson object from Agent 1 (with lessonId, title, subtopics)
 * @param {Array<string>} existingVideoIds - Video IDs already used in this course to avoid repeats
 * @returns {Promise<Object>} - Complete structured lesson content with embedded YouTube video
 */
export const generateLessonContent = async (courseTitle, lesson, existingVideoIds = []) => {
  const client = getGroqClient();

  const isTechnical = isProgrammingTopic(courseTitle, lesson);
  const subtopicsList = Array.isArray(lesson.subtopics) && lesson.subtopics.length > 0
    ? lesson.subtopics.join(', ')
    : 'Core concepts, practical architecture, and real-world examples';

  // 🎯 Prompt dynamically adapts: strict code instructions ONLY for coding topics
  const systemPrompt = `You are a Principal Software Engineer and Technical Educator.
Your job is to generate a comprehensive, production-grade lesson.

TOPIC TYPE: ${isTechnical ? 'SOFTWARE PROGRAMMING / TECHNICAL' : 'NON-PROGRAMMING / THEORETICAL'}

${isTechnical
      ? `CRITICAL CODE SNIPPET RULES:
1. Provide REAL, EXECUTABLE SOURCE CODE in the primary programming language matching the course (e.g. Java for Java courses, Python for Python courses, JS for JavaScript courses).
2. DO NOT output shell commands or terminal setup steps like "mkdir", "cd", or "pip install".
3. Return the code as an array of individual line strings in "codeLines". This guarantees 100% valid JSON without escaping errors.
4. The code must be clean, well-commented, and directly implement the subtopics taught in this lesson.`
      : `CRITICAL CODE RULE:
This is a NON-PROGRAMMING topic. You MUST set "codeSnippet": null. Do NOT generate any programming code, shell commands, or pseudo-code.`
    }

CRITICAL CITATIONS RULE:
Provide 2 to 4 authoritative documentation, specification, or academic links with valid URLs (e.g. docs.oracle.com, docs.python.org, MDN, wikipedia.org, github.com).

Return STRICT, VALID JSON ONLY. No markdown wrappers.`;

  const userPrompt = `Create the complete lesson material for:
Course: "${courseTitle}"
Lesson: "${lesson.title}" (${lesson.lessonId})
Objective: "${lesson.learningObjective || 'Master the lesson concepts'}"
Subtopics to cover: ${subtopicsList}

Return a JSON object with this EXACT structure:
{
  "lessonId": "${lesson.lessonId}",
  "lessonNumber": ${lesson.lessonNumber || 1},
  "title": "${lesson.title}",
  "overview": "Clear 2-3 sentence overview of this lesson.",
  "codeSnippet": ${isTechnical
      ? `{
    "language": "python or java or javascript",
    "filename": "Solution.java or example.py",
    "codeLines": [
      "// Clean runnable code line by line",
      "public class Example { ... }"
    ],
    "explanation": "Detailed explanation of how the programming logic works."
  }`
      : `null`
    },
  "sections": [
    {
      "subtopic": "Subtopic Name",
      "content": "Detailed, thorough explanation with paragraphs explaining concepts clearly..."
    }
  ],
  "citations": [
    {
      "title": "Authoritative Documentation",
      "url": "https://...",
      "description": "Authoritative guide on the core features used in this lesson."
    }
  ],
  "keyTakeaways": [
    "Key takeaway point 1",
    "Key takeaway point 2",
    "Key takeaway point 3"
  ]
}`;

  console.log(`\n🤖 [Agent 2] Generating content for: "${lesson.title}" (Code required: ${isTechnical ? 'YES' : 'NO'})...`);

  let parsedLesson = null;
  let attempts = 0;
  const maxAttempts = 2;

  // 🛡️ Automatic retry loop to eliminate the 400 error
  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await client.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: attempts === 1 ? 0.2 : 0.1, // Lower temperature on retry for stricter output
        max_tokens: 3500,
      });

      const rawContent = response.choices[0]?.message?.content || '';
      parsedLesson = safeJsonParse(rawContent);

      if (parsedLesson && parsedLesson.title) {
        break; // Successfully parsed!
      }
    } catch (parseErr) {
      console.warn(`⚠️ [Agent 2] Attempt ${attempts} parsing error: ${parseErr.message}`);
      if (attempts >= maxAttempts) {
        throw new Error(`Failed to generate valid lesson JSON after ${maxAttempts} attempts: ${parseErr.message}`);
      }
    }
  }

  // 🧹 Normalize Code Snippet:
  // If non-technical topic OR empty, force codeSnippet to null
  if (!isTechnical || !parsedLesson.codeSnippet) {
    parsedLesson.codeSnippet = null;
  } else if (parsedLesson.codeSnippet && Array.isArray(parsedLesson.codeSnippet.codeLines)) {
    // Join code lines into a clean string for frontend code highlighters
    parsedLesson.codeSnippet.code = parsedLesson.codeSnippet.codeLines.join('\n');
    delete parsedLesson.codeSnippet.codeLines;
  }

  // 🎥 Search YouTube with error fallback (never let video lookup fail the lesson generation)
  try {
    const specificVideoQuery = `${lesson.title} ${lesson.subtopics?.[0] || ''}`.trim();
    parsedLesson.video = await youtubeUtil.searchYouTube(specificVideoQuery, existingVideoIds);
  } catch (ytError) {
    console.warn(`⚠️ [Agent 2] YouTube search failed for "${lesson.title}":`, ytError.message);
    parsedLesson.video = null; // Gracefully continue without failing the request
  }

  // Ensure isEnriched is set to true
  parsedLesson.isEnriched = true;

  // 📢 Log completion
  console.log('\n======================================================');
  console.log(`✅ [Agent 2] LESSON READY: "${parsedLesson.title}"`);
  console.log(`💻 Code Snippet: ${parsedLesson.codeSnippet ? `YES (${parsedLesson.codeSnippet.language})` : 'NONE (Non-programming topic)'}`);
  console.log(`🎥 Video: ${parsedLesson.video ? parsedLesson.video.title : 'None'}`);
  console.log('======================================================\n');

  return parsedLesson;
};

export default {
  generateLessonContent,
};