/**
 * Initial state definitions
 */

export const getInitialAppState = () => ({
    subjects: [],
    currentSubject: null,
    questions: [],
    allQuestions: [], // Store full pool of questions
    allAnswers: [],
    currentQuestionIndex: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    skippedAnswers: 0,
    totalQuestions: 0,
    quizCompleted: false,
    subjectQuestionsCount: {},
    // Time State
    timeMode: 'none', // 'none', 'stopwatch', 'timer'
    timerDuration: 10, // minutes
    elapsedTime: 0, // seconds
    remainingTime: 0, // seconds

    timerInterval: null,
    // Correction Mode State
    correctionMode: 'instant', // 'instant' or 'final'
    isReviewing: false,
    flaggedQuestions: new Set(),
    shuffleQuestions: true, // Default to true
    pendingConfirmationAction: null, // 'finish' or 'exit'
    reviewIndices: [] // Stores indices of questions to review
});

export const getInitialWorkshopState = () => ({
    currentQuestions: [],
    isInitialized: false,
    isJsonView: false,
    isSyncing: false,
    alertDismissed: false,
    originalFileName: null,
    currentFileHandle: null,
    lastSavedJSON: null,
    lastSavedFileName: null,
    lastSavedStartId: null
});
