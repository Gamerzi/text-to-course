
import OpenAI from 'openai';
import youtubeUtil from '../utils/youtube.js';

// Initialize Groq client
const getGroqClient = () => {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not configured');
    }

    return new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
    });
};

// Safely parse JSON returned by AI
const safeJsonParse = (rawText) => {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error('Empty response received from AI model');
    }

    const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```/g, '')
        .trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('AI response does not contain valid JSON');
    }

    return JSON.parse(
        cleaned
            .slice(firstBrace, lastBrace + 1)
            .replace(/,\s*([\]}])/g, '$1')
    );
};

// Check whether lesson is programming/technical
const isProgrammingTopic = (courseTitle, lesson) => {
    const keywords = [
        'java', 'python', 'javascript', 'typescript',
        'c++', 'cpp', 'c#', 'golang', 'go lang',
        'rust', 'php', 'ruby', 'swift', 'kotlin',
        'sql', 'html', 'css', 'react', 'node',
        'express', 'django', 'flask', 'spring',
        'docker', 'kubernetes', 'devops', 'bash',
        'shell', 'programming', 'software development',
        'data structures', 'algorithms',
    ];

    const text = [
        courseTitle || '',
        lesson?.title || '',
        ...(lesson?.subtopics || []),
    ].join(' ').toLowerCase();

    return keywords.some((keyword) => text.includes(keyword));
};

// Detect whether the user requested a video change.
// This deliberately does not rely solely on the AI's classification.
const userRequestedVideoChange = (prompt) => {
    const text = String(prompt || '').toLowerCase();

    const mentionsVideo =
        /\b(video|youtube|tutorial|watch|lecture)\b/.test(text);

    const requestsChange =
        /\b(change|replace|another|different|new|better|update|find|search|switch|alternative|recommend|select)\b/.test(text);

    return mentionsVideo && requestsChange;
};

// Build a concise YouTube search query.
// Prefer the lesson title and course title, not the entire lesson content.
const buildVideoSearchQuery = (courseTitle, lesson, userPrompt) => {
    const course = String(courseTitle || '').trim();
    const title = String(lesson?.title || '').trim();

    // If the user specifies a particular topic for the replacement,
    // include that request without adding the entire lesson overview.
    const prompt = String(userPrompt || '')
        .replace(/\b(please|can you|could you|just|change|replace|find|search|another|different|new|better|video|youtube|tutorial|for me|the current|current video)\b/gi, ' ')
        .replace(/[^\w\s+#.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const queryParts = [course, title];

    if (prompt.length >= 3) {
        queryParts.push(prompt.slice(0, 100));
    }

    return [...new Set(queryParts.filter(Boolean))]
        .join(' ')
        .slice(0, 220)
        .trim();
};

// Lesson Update Agent
export const updateLessonContent = async (
    courseTitle,
    existingLesson,
    userPrompt
) => {
    if (!courseTitle) {
        throw new Error('Course title is required');
    }

    if (!existingLesson?.lessonId) {
        throw new Error('Valid existing lesson is required');
    }

    if (!userPrompt?.trim()) {
        throw new Error('Update prompt is required');
    }

    const client = getGroqClient();

    const isTechnical = isProgrammingTopic(
        courseTitle,
        existingLesson
    );

    const videoChangeRequested =
        userRequestedVideoChange(userPrompt);

    const existingLessonForAI = {
        lessonId: existingLesson.lessonId,
        lessonNumber: existingLesson.lessonNumber,
        title: existingLesson.title,
        learningObjective: existingLesson.learningObjective || '',
        subtopics: existingLesson.subtopics || [],
        overview: existingLesson.overview || '',
        sections: existingLesson.sections || [],
        codeSnippet: existingLesson.codeSnippet || null,
        citations: existingLesson.citations || [],
        keyTakeaways: existingLesson.keyTakeaways || [],
        video: existingLesson.video || null,
    };

    const systemPrompt = `
You are a principal software engineer and educational content editor.

Update the existing lesson according to the user's request.
Modify only what the user requested.

UPDATE TYPES:
section, overview, code, title, subtopics, full_lesson, video, mixed.

VIDEO RULES:
- Never invent a YouTube URL or video ID.
- The backend handles video search.
- If the request is video-only, preserve all lesson content.
- If the request does not ask for a video change, preserve the existing video.
- If both content and video are requested, classify as mixed.

IMMUTABLE:
lessonId must remain "${existingLesson.lessonId}".
lessonNumber must remain ${existingLesson.lessonNumber || 1}.

CONTENT RULES:
- Preserve unrelated content.
- Return the complete final lesson.
- Do not invent unnecessary changes.
${isTechnical
            ? `
PROGRAMMING:
- Preserve the programming language.
- Code must be valid and executable.
- Keep code explanations consistent with the code.
`
            : `
NON-PROGRAMMING:
- Do not introduce programming code.
- Set codeSnippet to null.
`
        }

CITATIONS:
Preserve existing useful citations. Do not invent citations.

Return strict JSON only:
{
  "updateAnalysis": {
    "updateType": "section",
    "affectedAreas": [],
    "contentChanged": true,
    "videoChangeRequested": false,
    "summary": "Short explanation"
  },
  "lesson": {
    "lessonId": "${existingLesson.lessonId}",
    "lessonNumber": ${existingLesson.lessonNumber || 1},
    "title": "",
    "learningObjective": "",
    "subtopics": [],
    "overview": "",
    "sections": [],
    "codeSnippet": null,
    "citations": [],
    "keyTakeaways": [],
    "video": null
  }
}
`;

    console.log('\n======================================================');
    console.log('🤖 [Lesson Update Agent] Starting update...');
    console.log(`📚 Course: ${courseTitle}`);
    console.log(`📖 Lesson: ${existingLesson.title}`);
    console.log(`🆔 Lesson ID: ${existingLesson.lessonId}`);
    console.log(`📝 User Request: ${userPrompt}`);
    console.log(`🎥 Video change requested: ${videoChangeRequested}`);
    console.log('======================================================\n');

    let parsedResponse;
    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await client.chat.completions.create({
                model: 'openai/gpt-oss-20b',
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: `
COURSE:
${courseTitle}

EXISTING LESSON:
${JSON.stringify(existingLessonForAI, null, 2)}

USER REQUEST:
${userPrompt.trim()}

Return the complete lesson and updateAnalysis as valid JSON.
Preserve lessonId, lessonNumber, and unrelated content.
`,
                    },
                ],
                response_format: { type: 'json_object' },
                temperature: attempt === 1 ? 0.2 : 0.1,
                max_tokens: 5000,
            });

            parsedResponse = safeJsonParse(
                response.choices?.[0]?.message?.content || ''
            );

            if (
                parsedResponse?.lesson &&
                parsedResponse?.updateAnalysis
            ) {
                break;
            }

            throw new Error(
                'AI response is missing lesson or updateAnalysis'
            );
        } catch (error) {
            lastError = error;

            console.warn(
                `⚠️ [Lesson Update Agent] Attempt ${attempt} failed:`,
                error.message
            );

            if (attempt === 2) {
                throw new Error(
                    `Failed to update lesson: ${lastError.message}`
                );
            }
        }
    }

    const updateAnalysis = parsedResponse.updateAnalysis;
    const aiLesson = parsedResponse.lesson;

    // Preserve immutable lesson fields.
    aiLesson.lessonId = existingLesson.lessonId;
    aiLesson.lessonNumber = existingLesson.lessonNumber;

    // For a video-only request, preserve the original lesson content.
    const contentChanged = videoChangeRequested
        ? false
        : updateAnalysis.contentChanged === true;

    const updatedLesson = videoChangeRequested && !contentChanged
        ? {
            ...existingLessonForAI,
        }
        : {
            ...existingLessonForAI,
            ...aiLesson,
        };

    updatedLesson.lessonId = existingLesson.lessonId;
    updatedLesson.lessonNumber = existingLesson.lessonNumber;

    updatedLesson.title =
        updatedLesson.title || existingLesson.title;

    updatedLesson.learningObjective =
        updatedLesson.learningObjective ??
        existingLesson.learningObjective ??
        '';

    updatedLesson.subtopics = Array.isArray(updatedLesson.subtopics)
        ? updatedLesson.subtopics
        : existingLesson.subtopics || [];

    updatedLesson.sections = Array.isArray(updatedLesson.sections)
        ? updatedLesson.sections
        : existingLesson.sections || [];

    updatedLesson.citations = Array.isArray(updatedLesson.citations)
        ? updatedLesson.citations
        : existingLesson.citations || [];

    updatedLesson.keyTakeaways = Array.isArray(updatedLesson.keyTakeaways)
        ? updatedLesson.keyTakeaways
        : existingLesson.keyTakeaways || [];

    if (!isTechnical) {
        updatedLesson.codeSnippet = null;
    } else {
        updatedLesson.codeSnippet =
            updatedLesson.codeSnippet ??
            existingLesson.codeSnippet ??
            null;
    }

    // VIDEO HANDLING
    let newVideo = existingLesson.video || null;
    let videoChanged = false;

    if (videoChangeRequested) {
        const searchQuery = buildVideoSearchQuery(
            courseTitle,
            updatedLesson,
            userPrompt
        );

        const existingVideoId =
            existingLesson.video?.videoId || null;

        console.log('🎥 Searching for a replacement YouTube video...');
        console.log(`🔎 Search query: "${searchQuery}"`);
        console.log(`🚫 Excluded video ID: ${existingVideoId || 'None'}`);

        try {
            const searchedVideo = await youtubeUtil.searchYouTube(
                searchQuery,
                existingVideoId ? [existingVideoId] : []
            );

            if (!searchedVideo?.videoId) {
                throw new Error(
                    'YouTube search returned no usable replacement video. Check the API key, API quota, and search results.'
                );
            }

            if (
                existingVideoId &&
                searchedVideo.videoId === existingVideoId
            ) {
                throw new Error(
                    'YouTube returned the existing video instead of a replacement.'
                );
            }

            newVideo = searchedVideo;
            videoChanged = true;

            console.log('✅ Replacement video selected:', {
                title: searchedVideo.title,
                videoId: searchedVideo.videoId,
                videoUrl: searchedVideo.videoUrl,
            });
        } catch (error) {
            console.error(
                '❌ [Lesson Update Agent] Video replacement failed:',
                error.message
            );

            throw new Error(
                `Could not replace the lesson video: ${error.message}`
            );
        }
    }

    updatedLesson.video = newVideo;
    updatedLesson.isEnriched = true;

    const finalUpdateAnalysis = {
        ...updateAnalysis,
        updateType: videoChangeRequested
            ? (contentChanged ? 'mixed' : 'video')
            : (updateAnalysis.updateType || 'mixed'),
        contentChanged,
        videoChangeRequested,
        videoChanged,
        affectedAreas: Array.isArray(updateAnalysis.affectedAreas)
            ? updateAnalysis.affectedAreas
            : [],
        summary: updateAnalysis.summary ||
            'Lesson updated successfully.',
    };

    console.log('\n======================================================');
    console.log('✅ [Lesson Update Agent] Update completed');
    console.log(`🔍 Update Type: ${finalUpdateAnalysis.updateType}`);
    console.log(`📝 Content Changed: ${contentChanged}`);
    console.log(`🎥 Video Changed: ${videoChanged}`);
    console.log(`📋 Summary: ${finalUpdateAnalysis.summary}`);
    console.log('======================================================\n');

    return {
        lesson: updatedLesson,
        updateAnalysis: finalUpdateAnalysis,
    };
};

export default {
    updateLessonContent,
};
