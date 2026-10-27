
import Course from '../models/Course.js';
import LessonVoice from '../models/Voice.js';
import { generateHinglishExplanation } from '../agents/hinglishAgent.js';
import { SarvamAIClient } from 'sarvamai';

const sarvamClient = new SarvamAIClient({
    apiSubscriptionKey: process.env.SARVAM_API_KEY
});

const MAX_CHARS = 2500;

// Split text at sentence boundaries when possible.
// Never send more than MAX_CHARS to Sarvam in one request.
function splitTextIntoChunks(text, maxChars = MAX_CHARS) {
    const sentences = text.match(/[^.!?।]+[.!?।]*/g) || [text];
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        const part = sentence.trim();

        if (!part) continue;

        // Handle a single sentence longer than the limit.
        if (part.length > maxChars) {
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = '';
            }

            // Split long sentences at word boundaries where possible.
            let remaining = part;

            while (remaining.length > maxChars) {
                let splitAt = remaining.lastIndexOf(' ', maxChars);

                if (splitAt <= 0) {
                    splitAt = maxChars;
                }

                chunks.push(remaining.slice(0, splitAt).trim());
                remaining = remaining.slice(splitAt).trim();
            }

            if (remaining) {
                currentChunk = remaining;
            }

            continue;
        }

        const combined = currentChunk
            ? `${currentChunk} ${part}`
            : part;

        if (combined.length > maxChars) {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = part;
        } else {
            currentChunk = combined;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

async function generateAudioChunks(text) {
    const textChunks = splitTextIntoChunks(text);
    const audioChunks = [];

    for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];

        console.log(
            `Generating audio chunk ${i + 1}/${textChunks.length} (${chunk.length} characters)`
        );

        const audioResponse = await sarvamClient.textToSpeech.convert({
            text: chunk,
            language_code: 'hi-IN',
            model: 'bulbul:v4-flash',
            speaker: 'shubh_enhi_ads',
            output_audio_codec: 'mp3'
        });

        const audio = audioResponse.audios?.[0];

        if (!audio) {
            throw new Error(
                `Sarvam returned no audio for chunk ${i + 1}`
            );
        }

        audioChunks.push(audio);
    }

    return audioChunks;
}

async function generateLessonVoice(req, res) {
    try {
        const { courseSlug, lessonId } = req.params;

        // 1. Return saved voice if it already exists.
        const existingVoice = await LessonVoice.findOne({
            courseSlug,
            lessonId
        });

        if (existingVoice) {
            return res.status(200).json({
                success: true,
                cached: true,
                lessonId,
                text: existingVoice.hinglishText,
                characterCount: existingVoice.hinglishText.length,
                audio: existingVoice.audio,
                audioFormat: existingVoice.audioFormat
            });
        }

        // 2. Find course.
        const course = await Course.findOne({ courseSlug });

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // 3. Find lesson.
        const lesson = course.lessons.find(
            item => item.lessonId === lessonId
        );

        if (!lesson) {
            return res.status(404).json({
                success: false,
                message: 'Lesson not found'
            });
        }

        // 4. Generate full Hinglish explanation using Groq.
        const hinglishText =
            await generateHinglishExplanation(lesson);

        if (!hinglishText?.trim()) {
            return res.status(422).json({
                success: false,
                message: 'Generated explanation is empty'
            });
        }

        const cleanText = hinglishText.trim();

        // 5. Generate audio in Sarvam-compatible chunks.
        const audioChunks = await generateAudioChunks(cleanText);

        // 6. Save explanation and audio chunks in MongoDB.
        const savedVoice = await LessonVoice.create({
            courseSlug,
            lessonId,
            hinglishText: cleanText,
            audio: audioChunks,
            audioFormat: 'mp3',
            voiceModel: 'bulbul:v4-flash',
            speaker: 'shubh_enhi_ads'
        });

        // 7. Return saved result.
        return res.status(200).json({
            success: true,
            cached: false,
            lessonId,
            text: savedVoice.hinglishText,
            characterCount: savedVoice.hinglishText.length,
            audio: savedVoice.audio,
            audioFormat: savedVoice.audioFormat
        });

    } catch (error) {
        // A concurrent request may have saved the same lesson.
        if (error.code === 11000) {
            try {
                const { courseSlug, lessonId } = req.params;

                const savedVoice = await LessonVoice.findOne({
                    courseSlug,
                    lessonId
                });

                if (savedVoice) {
                    return res.status(200).json({
                        success: true,
                        cached: true,
                        lessonId,
                        text: savedVoice.hinglishText,
                        characterCount: savedVoice.hinglishText.length,
                        audio: savedVoice.audio,
                        audioFormat: savedVoice.audioFormat
                    });
                }
            } catch (lookupError) {
                console.error(
                    'Saved voice lookup failed:',
                    lookupError
                );
            }
        }

        console.error('Voice Generation Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to generate lesson voice'
        });
    }
}

export default generateLessonVoice;
