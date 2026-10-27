
import mongoose from 'mongoose';

const lessonVoiceSchema = new mongoose.Schema(
    {
        courseSlug: {
            type: String,
            required: true,
            index: true
        },

        lessonId: {
            type: String,
            required: true
        },

        hinglishText: {
            type: String,
            required: true,
            maxlength: 10000
        },

        audio: {
            type: [String],
            required: true
        },

        audioFormat: {
            type: String,
            default: 'mp3'
        },

        voiceModel: {
            type: String,
            default: 'bulbul:v4-flash'
        },

        speaker: {
            type: String,
            default: 'shubh_enhi_ads'
        }
    },
    {
        timestamps: true
    }
);

// One saved voice per lesson per course
lessonVoiceSchema.index(
    { courseSlug: 1, lessonId: 1 },
    { unique: true }
);

const LessonVoice = mongoose.model(
    'LessonVoice',
    lessonVoiceSchema
);

export default LessonVoice;
