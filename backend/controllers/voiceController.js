import Course from '../models/Course.js';
import LessonVoice from '../models/Voice.js';
import { generateHinglishExplanation } from '../agents/hinglishAgent.js';

const SARVAM_API_URL = 'https://api.sarvam.ai/text-to-speech';
const SARVAM_MAX_CHARS = 450; // Sarvam API hard limit: 500 chars per request

// Extract the intro portion of text (up to SARVAM_MAX_CHARS chars, breaking at sentence boundary)
function extractIntroChunk(text, maxChars = SARVAM_MAX_CHARS) {
    if (text.length <= maxChars) return text;

    // Try to break at a sentence boundary (. ! ?)
    const sub = text.slice(0, maxChars);
    const lastSentence = Math.max(
        sub.lastIndexOf('. '),
        sub.lastIndexOf('? '),
        sub.lastIndexOf('! '),
        sub.lastIndexOf('। ')
    );

    if (lastSentence > 80) {
        // Include the punctuation character itself
        return sub.slice(0, lastSentence + 1).trim();
    }

    // Fall back: break at last space
    const lastSpace = sub.lastIndexOf(' ');
    return (lastSpace > 0 ? sub.slice(0, lastSpace) : sub).trim();
}

// ── Call Sarvam REST API directly (no SDK) ────────────────────────────────────
async function callSarvamTTS(text, apiKey) {
    const response = await fetch(SARVAM_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-subscription-key': apiKey
        },
        body: JSON.stringify({
            inputs: [text],
            target_language_code: 'hi-IN',
            speaker: 'shubh',
            model: 'bulbul:v3',
            enable_preprocessing: true
        })
    });

    const raw = await response.text();

    console.log(`[Sarvam] HTTP ${response.status} ${response.statusText}`);
    console.log('[Sarvam] Response headers:', Object.fromEntries(response.headers.entries()));

    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        console.error('[Sarvam] Response is not JSON:', raw.slice(0, 500));
        throw new Error(`Sarvam returned non-JSON response (HTTP ${response.status}): ${raw.slice(0, 200)}`);
    }

    if (!response.ok) {
        console.error('[Sarvam] Error response body:', JSON.stringify(data, null, 2));
        throw new Error(`Sarvam HTTP ${response.status}: ${data?.message || data?.error || JSON.stringify(data)}`);
    }

    console.log('[Sarvam] Response keys:', Object.keys(data));

    // Sarvam returns { audios: ["<base64>"] }
    const audio = data?.audios?.[0];

    if (!audio) {
        console.error('[Sarvam] No audio in response. Full body:', JSON.stringify(data, null, 2));
        throw new Error('Sarvam returned no audio data');
    }

    console.log(`[Sarvam] Audio received — base64 length: ${audio.length}`);
    return audio;
}

// ── Generate audio for intro only (Sarvam limit: 500 chars/request) ──────────
async function generateAudioChunks(text) {
    const apiKey = (process.env.SARVAM_API_KEY || '').trim();

    console.log('[Sarvam] API key present:', !!apiKey, '| Length:', apiKey.length);

    if (!apiKey) {
        throw new Error('SARVAM_API_KEY is missing from environment variables');
    }

    // Only send the intro (first ~450 chars) — Sarvam limit is 500 chars
    const introChunk = extractIntroChunk(text, SARVAM_MAX_CHARS);
    console.log(`[Sarvam] Intro chunk — ${introChunk.length} chars (full text: ${text.length} chars)`);

    try {
        const audio = await callSarvamTTS(introChunk, apiKey);
        console.log('[Sarvam] Intro audio OK');
        return [audio];
    } catch (err) {
        console.error('[Sarvam] Intro chunk FAILED:', err.message);
        throw err;
    }
}

// ── Main controller ───────────────────────────────────────────────────────────
async function generateLessonVoice(req, res) {
    try {
        const { courseSlug, lessonId } = req.params;
        const cleanSlug = String(courseSlug || '').trim();
        const cleanLessonId = String(lessonId || '').trim();
        const forceRefresh = req.query.refresh === 'true';

        // 1. Cache check
        if (!forceRefresh) {
            const existing = await LessonVoice.findOne({
                courseSlug: cleanSlug,
                lessonId: cleanLessonId
            });

            if (existing) {
                const hasAudio = Array.isArray(existing.audio) && existing.audio.length > 0;

                if (hasAudio) {
                    console.log(`[Voice] Cache HIT with audio — returning immediately.`);
                    return res.status(200).json({
                        success: true,
                        cached: true,
                        lessonId: cleanLessonId,
                        text: existing.hinglishText,
                        characterCount: existing.hinglishText.length,
                        audio: existing.audio,
                        audioFormat: 'mp3',
                        introLength: Math.min(SARVAM_MAX_CHARS, existing.hinglishText.length),
                        fallbackToBrowserTts: false,
                        message: 'Voice loaded from cache.'
                    });
                }

                // Stale cache with no audio — delete and retry
                console.warn('[Voice] Stale cache (no audio) — deleting and retrying Sarvam.');
                await LessonVoice.deleteOne({ courseSlug: cleanSlug, lessonId: cleanLessonId });
            }
        } else {
            await LessonVoice.deleteOne({ courseSlug: cleanSlug, lessonId: cleanLessonId });
            console.log('[Voice] Cache force-cleared.');
        }

        // 2. Find course
        const safeEscaped = cleanSlug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const course = await Course.findOne({
            $or: [
                { courseSlug: cleanSlug },
                { courseSlug: cleanSlug.toLowerCase() },
                { courseSlug: new RegExp(`^${safeEscaped}$`, 'i') }
            ]
        });

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        // 3. Find lesson
        const lesson = (course.lessons || []).find((item) => {
            const key = String(item.lessonId ?? item._id);
            return (
                key === cleanLessonId ||
                key.toLowerCase() === cleanLessonId.toLowerCase() ||
                (item.title && Course.slugify && Course.slugify(item.title) === cleanLessonId)
            );
        });

        if (!lesson) {
            return res.status(404).json({ success: false, message: 'Lesson not found' });
        }

        // 4. Generate Hinglish text via Groq
        console.log(`[Voice] Generating Hinglish text for: "${lesson.title}"`);
        const hinglishText = await generateHinglishExplanation(lesson);

        if (!hinglishText?.trim()) {
            return res.status(422).json({ success: false, message: 'Generated explanation is empty' });
        }

        const cleanText = hinglishText.trim();
        console.log(`[Voice] Hinglish text ready — ${cleanText.length} chars`);

        // 5. Try Sarvam TTS — fall back to browser TTS on any error
        let audioChunks = [];
        let fallbackToBrowserTts = false;

        try {
            audioChunks = await generateAudioChunks(cleanText);
        } catch (sarvamErr) {
            console.error('[Voice] ══ Sarvam FAILED — using browser TTS fallback ══');
            console.error('[Voice] Sarvam error:', sarvamErr.message);
            fallbackToBrowserTts = true;
        }

        // 6. Cache only on Sarvam success (don't cache empty audio)
        if (!fallbackToBrowserTts) {
            try {
                await LessonVoice.create({
                    courseSlug: cleanSlug,
                    lessonId: cleanLessonId,
                    hinglishText: cleanText,
                    audio: audioChunks,
                    audioFormat: 'mp3',
                    voiceModel: 'bulbul:v3',
                    speaker: 'shubh'
                });
                console.log('[Voice] Cached Sarvam audio successfully.');
            } catch (saveErr) {
                console.warn('[Voice] Cache save failed (non-fatal):', saveErr.message);
            }
        }

        // 7. Respond
        return res.status(200).json({
            success: true,
            cached: false,
            lessonId: cleanLessonId,
            text: cleanText,
            characterCount: cleanText.length,
            audio: audioChunks,
            audioFormat: fallbackToBrowserTts ? 'browser-tts' : 'mp3',
            introLength: fallbackToBrowserTts ? 0 : Math.min(SARVAM_MAX_CHARS, cleanText.length),
            fallbackToBrowserTts,
            message: fallbackToBrowserTts
                ? 'Sarvam TTS unavailable — use browser speech synthesis.'
                : 'Hinglish voice generated with Sarvam AI.'
        });

    } catch (error) {
        console.error('[Voice] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate lesson voice'
        });
    }
}

export default generateLessonVoice;
