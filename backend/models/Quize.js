import mongoose from 'mongoose';

// Sub-schema for individual quiz questions
const QuizQuestionSchema = new mongoose.Schema({
    questionId: {
        type: Number,
        required: true
    },

    question: {
        type: String,
        required: true,
        trim: true
    },

    options: [{
        type: String,
        required: true,
        trim: true
    }],

    correctAnswerIndex: {
        type: Number,
        required: true,
        min: 0,
        max: 3
    },

    correctOption: {
        type: String,
        required: true,
        trim: true
    },

    explanation: {
        type: String,
        required: true,
        trim: true
    },

    conceptTested: {
        type: String,
        trim: true,
        default: ''
    },

    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    }
}, { _id: false });


// Quiz Schema
const QuizSchema = new mongoose.Schema({

    // Reference to Course
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
        index: true
    },

    // Course slug
    courseSlug: {
        type: String,
        required: true,
        index: true,
        trim: true
    },

    // Lesson information
    lessonId: {
        type: String,
        required: true,
        index: true,
        trim: true
    },

    lessonNumber: {
        type: Number,
        required: true
    },

    lessonTitle: {
        type: String,
        required: true,
        trim: true
    },

    // Quiz information
    title: {
        type: String,
        required: true,
        trim: true
    },

    topic: {
        type: String,
        default: ''
    },

    totalQuestions: {
        type: Number,
        default: 5
    },

    passingPercentage: {
        type: Number,
        default: 60
    },

    questions: {
        type: [QuizQuestionSchema],

        validate: {
            validator: function (val) {
                return val && val.length > 0;
            },

            message: 'Quiz must contain at least one question.'
        }
    },

    generatedAt: {
        type: Date,
        default: Date.now
    },

    attemptsCount: {
        type: Number,
        default: 0
    }

}, { timestamps: true });


// Prevent duplicate quiz for the same course + lesson
QuizSchema.index(
    { courseSlug: 1, lessonId: 1 },
    { unique: true }
);


/**
 * Public Quiz
 *
 * Removes:
 * - correctAnswerIndex
 * - correctOption
 * - explanation
 *
 * Students only receive questions and options.
 */
QuizSchema.methods.toPublicQuiz = function () {

    return {
        quizId: this._id,

        courseId: this.courseId,

        courseSlug: this.courseSlug,

        lessonId: this.lessonId,

        lessonNumber: this.lessonNumber,

        lessonTitle: this.lessonTitle,

        title: this.title,

        topic: this.topic,

        totalQuestions: this.totalQuestions,

        passingPercentage: this.passingPercentage,

        generatedAt: this.generatedAt,

        questions: this.questions.map(q => ({
            questionId: q.questionId,
            question: q.question,
            options: q.options,
            conceptTested: q.conceptTested,
            difficulty: q.difficulty
        }))
    };
};


/**
 * Grade student answers
 *
 * Expected:
 * [
 *   {
 *     questionId: 1,
 *     selectedIndex: 2
 *   }
 * ]
 */
QuizSchema.methods.gradeAnswers = function (userAnswers = []) {

    const answerMap = new Map();

    userAnswers.forEach(ans => {
        answerMap.set(
            Number(ans.questionId),
            ans
        );
    });

    let correctCount = 0;

    const breakdown = [];


    for (const q of this.questions) {

        const submission =
            answerMap.get(q.questionId);

        let isCorrect = false;

        let userIndex = -1;

        let userDisplay = 'Not Answered';


        if (submission) {

            // Preferred format
            if (
                typeof submission.selectedIndex === 'number'
            ) {

                userIndex =
                    submission.selectedIndex;

                isCorrect =
                    userIndex === q.correctAnswerIndex;

                userDisplay =
                    q.options[userIndex] ||
                    `Option ${userIndex + 1}`;
            }

            // Alternative format
            else if (
                typeof submission.selectedOption === 'string'
            ) {

                const cleaned =
                    submission.selectedOption
                        .trim()
                        .toLowerCase();

                const letterToIndex = {
                    a: 0,
                    b: 1,
                    c: 2,
                    d: 3
                };

                const optLetter =
                    cleaned.replace(/[^a-d]/g, '');


                if (
                    letterToIndex[optLetter] !== undefined
                ) {

                    userIndex =
                        letterToIndex[optLetter];

                    isCorrect =
                        userIndex ===
                        q.correctAnswerIndex;

                    userDisplay =
                        q.options[userIndex];

                } else {

                    userIndex =
                        q.options.findIndex(
                            opt =>
                                opt
                                    .toLowerCase()
                                    .includes(cleaned)
                        );

                    isCorrect =
                        userIndex ===
                        q.correctAnswerIndex;

                    userDisplay =
                        submission.selectedOption;
                }
            }
        }


        if (isCorrect) {
            correctCount++;
        }


        breakdown.push({

            questionId: q.questionId,

            question: q.question,

            userAnswer: userDisplay,

            userAnswerIndex: userIndex,

            correctAnswerIndex:
                q.correctAnswerIndex,

            correctOption:
                q.correctOption,

            isCorrect,

            explanation:
                q.explanation,

            conceptTested:
                q.conceptTested
        });
    }


    const score = correctCount;

    const total = this.questions.length;

    const percentage =
        Math.round((score / total) * 100);


    return {

        quizId: this._id,

        courseId: this.courseId,

        courseSlug: this.courseSlug,

        lessonId: this.lessonId,

        lessonNumber: this.lessonNumber,

        lessonTitle: this.lessonTitle,

        score,

        totalQuestions: total,

        percentage,

        passed:
            percentage >= this.passingPercentage,

        passingPercentage:
            this.passingPercentage,

        breakdown
    };
};


const Quiz =
    mongoose.model('Quiz', QuizSchema);

export default Quiz;