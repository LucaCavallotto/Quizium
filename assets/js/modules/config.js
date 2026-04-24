/**
 * QuizApp Configuration
 */
export const CONFIG = {
    PATHS: {
        DATA: 'data/'
    },
    SCREENS: {
        HOME: 'homeScreen',
        COUNT: 'questionCountScreen',
        QUIZ: 'quizScreen',
        RESULTS: 'resultsScreen',
        WORKSHOP: 'workshopScreen'
    },
    SELECTORS: {
        SUBJECT_CONTAINER: 'subjectContainer',
        SLIDER: 'questionSlider',
        SLIDER_VALUE: 'sliderValue',
        TIME_ESTIMATE: 'timeEstimate',
        MAX_QUESTIONS_LABEL: 'maxQuestionsLabel',
        PRESET_BTNS: '.preset-btn',
        SELECTED_SUBJECT_TITLE: 'selectedSubjectTitle',
        QUIZ_SUBJECT_TITLE: 'quizSubjectTitle',
        CORRECT_COUNT: 'correctCount',
        WRONG_COUNT: 'wrongCount',
        PROGRESS_BAR: 'progressBar',
        CURRENT_QUESTION: 'currentQuestion',
        TOTAL_QUESTIONS: 'totalQuestions',
        QUESTION_ID: 'questionIdDisplay',
        QUESTION_TEXT: 'questionText',
        OPTIONS_CONTAINER: 'optionsContainer',
        EXPLANATION: 'explanationCallout',
        NAVIGATOR: 'questionNavigator',
        NEXT_BTN: 'nextBtn',
        PREV_BTN: 'prevBtn',
        // Time Selectors
        BTN_TIME_NONE: 'btnTimeNone',
        BTN_TIME_STOPWATCH: 'btnTimeStopwatch',
        BTN_TIME_TIMER: 'btnTimeTimer',
        TIMER_INPUT_CONTAINER: 'timerInputContainer',
        TIMER_SLIDER: 'timerSlider',
        TIMER_VALUE_DISPLAY: 'timerValueDisplay',
        TIME_DISPLAY: 'timeDisplay',
        TIME_RESULT_BADGE: 'timeResultBadge',
        TIME_RESULT: 'timeResult',
        // Correction Mode Selectors
        BTN_CORRECTION_INSTANT: 'btnCorrectionInstant',
        BTN_CORRECTION_FINAL: 'btnCorrectionFinal',
        CORRECTION_DESC: 'correctionModeDesc',
        BTN_REVIEW: 'btnReviewAnswers',
        BTN_CLOSE: 'btnQuizClose',
        BTN_REVIEW_BACK: 'btnReviewBack'
    }
};
