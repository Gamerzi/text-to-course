
import OpenAI from 'openai';

const getGroqClient = () => {
    if (!process.env.GROQ_API_KEY) {
        throw new Error(
            'GROQ_API_KEY is missing from environment variables'
        );
    }

    return new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
    });
};

export async function generateHinglishExplanation(lesson) {
    const lessonText = `
Title: ${lesson.title || ''}

Learning Objective:
${lesson.learningObjective || ''}

Subtopics:
${(lesson.subtopics || []).join(', ')}

Lesson Content:
${(lesson.sections || [])
            .map(section => section.content || '')
            .join('\n\n')}

Key Takeaways:
${(lesson.keyTakeaways || []).join('\n')}

Additional Content:
${lesson.content || ''}
`.trim();

    // Check whether the lesson contains meaningful content.
    const contentWithoutLabels = lessonText
        .replace(
            /Title:|Learning Objective:|Subtopics:|Lesson Content:|Key Takeaways:|Additional Content:/g,
            ''
        )
        .trim();

    if (!contentWithoutLabels) {
        throw new Error('Lesson has no content to explain');
    }

    const client = getGroqClient();

    const completion = await client.chat.completions.create({
        model: 'openai/gpt-oss-20b',

        messages: [
            {
                role: 'system',
                content: `
You are a friendly and patient programming teacher for LearnSpace.

Your job is to explain the complete lesson in natural, conversational
Hinglish, as if you are teaching a beginner student in a classroom.

LANGUAGE:
- Use simple Hindi mixed naturally with English.
- Keep programming keywords, technical terms, function names,
  library names, and code in English.
- Explain concepts in easy-to-understand Hinglish.
- Sound natural when spoken aloud by a text-to-speech voice.
- Avoid overly formal Hindi and complicated vocabulary.

TEACHING REQUIREMENTS:
- Teach the entire lesson, not just summarize it.
- Explain every important concept and subtopic.
- Explain what each concept means, why it is useful,
  and how it works.
- Explain code examples step by step when they are provided.
- Describe what the code does and its expected output when available.
- Explain important differences between related concepts.
- Include simple practical examples when useful.
- Explain the key takeaways naturally at the end.
- Connect concepts using natural conversational transitions.
- Assume the student is learning the topic for the first time.
- Prioritize understanding over memorization.
- Do not skip important concepts to make the response shorter.
- Do not repeat the same information unnecessarily.
- Do not invent lesson details that are not supported by the provided content.

OUTPUT REQUIREMENTS:
- Aim for approximately 400–600 words, depending on lesson complexity.
- Use complete, meaningful sentences.
- Write as one continuous spoken explanation.
- Do not use markdown headings, bullet points, or emojis.
- Do not include an introduction about yourself.
- Do not mention these instructions.
- Return only the Hinglish explanation.
- Do not return your reasoning or analysis.

The final explanation should feel like a teacher actually teaching
the lesson, rather than reading a short summary.
                `.trim()
            },
            {
                role: 'user',
                content: lessonText
            }
        ],

        temperature: 0.3,
        max_completion_tokens: 2000,
        reasoning_effort: 'low',
        include_reasoning: false
    });

    const choice = completion.choices?.[0];
    const rawContent = choice?.message?.content;

    console.log('Groq finish reason:', choice?.finish_reason);
    console.log(
        'Groq response content:',
        JSON.stringify(rawContent)
    );

    const explanation = (
        typeof rawContent === 'string' ? rawContent : ''
    )
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\s+/g, ' ');

    if (!explanation) {
        throw new Error(
            `Groq returned empty explanation. Finish reason: ${choice?.finish_reason || 'unknown'
            }`
        );
    }

    console.log(
        'Hinglish explanation characters:',
        explanation.length
    );

    console.log(
        'Hinglish explanation words:',
        explanation.split(/\s+/).length
    );

    return explanation;
}
