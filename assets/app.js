/**
 * QuizApp Configuration
 */
const CONFIG = {
    PATHS: {
        DATA: 'data/'
    },
    SCREENS: {
        HOME: 'homeScreen',
        COUNT: 'questionCountScreen',
        QUIZ: 'quizScreen',
        RESULTS: 'resultsScreen'
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
        PREV_BTN: 'prevBtn'
    }
};

/**
 * Main Quiz Application Class
 */
class QuizApp {
    constructor() {
        this.state = {
            subjects: [
                { id: 'f1', name: 'Formula 1', icon: '🏎️', color: '#e10600', bg: '#fff1f0', booleanLabels: ['Vero', 'Falso'] },
                { id: 'cs', name: 'Computer Science', icon: '💻', color: '#3b82f6', bg: '#eff6ff', booleanLabels: ['True', 'False'] },
                { id: 'cnts', name: 'Network Tech', icon: '🌐', color: '#10b981', bg: '#d1fae5', booleanLabels: ['True', 'False'] }
            ],
            currentSubject: null,
            questions: [],
            allAnswers: [],
            currentQuestionIndex: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            totalQuestions: 0,
            quizCompleted: false,
            subjectQuestionsCount: {}
        };

        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        await this.loadSubjects();
        this.bindGlobalEvents();
    }

    /**
     * Bind global functions for HTML access
     */
    bindGlobalEvents() {
        window.goHome = () => this.showScreen(CONFIG.SCREENS.HOME);
        window.setSliderValue = (val) => this.setSliderValue(val);
        window.startQuizFromSlider = () => this.startQuizFromSlider();
        window.previousQuestion = () => this.navigateQuestion(-1);
        window.nextQuestion = () => this.navigateQuestion(1);
        window.restartQuiz = () => this.restartQuiz();
        window.selectSubject = (id) => this.selectSubject(id); // Helper for HTML onclick
    }

    /**
     * Screen Navigation Helper
     */
    showScreen(screenId) {
        Object.values(CONFIG.SCREENS).forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
    }

    /**
     * Load subjects and their question counts
     */
    async loadSubjects() {
        const container = document.getElementById(CONFIG.SELECTORS.SUBJECT_CONTAINER);
        container.innerHTML = '';

        for (const subject of this.state.subjects) {
            try {
                const response = await fetch(`${CONFIG.PATHS.DATA}${subject.id}.json`);
                if (response.ok) {
                    const questions = await response.json();
                    this.state.subjectQuestionsCount[subject.id] = questions.length;
                    this.renderSubjectCard(container, subject, questions.length);
                }
            } catch (error) {
                console.error(`Error loading subject ${subject.id}:`, error);
            }
        }
    }

    renderSubjectCard(container, subject, count) {
        // Defaults
        const icon = subject.icon || '📝';
        const color = subject.color || '#6b7280';
        const bg = subject.bg || '#f3f4f6';

        const card = document.createElement('div');
        card.className = 'subject-card';
        card.style.setProperty('--card-color', color);
        card.style.setProperty('--card-bg-light', bg);

        // Note: Using window alias for selectSubject to match existing HTML patterns, 
        // or we could add event listener directly here.
        card.onclick = () => this.selectSubject(subject.id);

        card.innerHTML = `
            <div class="card-icon">${icon}</div>
            <div class="card-content">
                <h3 class="card-title">${subject.name}</h3>
                <div class="card-stats"><span>${count} Questions</span></div>
            </div>
            <div class="card-action">→</div>
        `;
        container.appendChild(card);
    }

    async selectSubject(subjectId) {
        this.state.currentSubject = this.state.subjects.find(s => s.id === subjectId);

        // Update Titles
        document.getElementById(CONFIG.SELECTORS.SELECTED_SUBJECT_TITLE).textContent = this.state.currentSubject.name;
        document.getElementById(CONFIG.SELECTORS.QUIZ_SUBJECT_TITLE).textContent = this.state.currentSubject.name;

        try {
            const response = await fetch(`${CONFIG.PATHS.DATA}${subjectId}.json`);
            if (!response.ok) throw new Error('Failed to load questions');

            this.state.questions = await response.json();
            this.setupSlider();
            this.showScreen(CONFIG.SCREENS.COUNT);
        } catch (error) {
            console.error('Error selecting subject:', error);
            alert('Failed to load questions for this subject.');
        }
    }

    /* ===========================
       Slider Logic
       =========================== */
    setupSlider() {
        const total = this.state.questions.length;
        const slider = document.getElementById(CONFIG.SELECTORS.SLIDER);
        const display = document.getElementById(CONFIG.SELECTORS.SLIDER_VALUE);
        const maxLabel = document.getElementById(CONFIG.SELECTORS.MAX_QUESTIONS_LABEL);

        slider.max = total;
        const defaultVal = Math.min(10, total);
        slider.value = defaultVal;
        display.textContent = defaultVal;
        maxLabel.textContent = total;

        this.updateSliderUI(defaultVal);
        slider.oninput = (e) => this.updateSliderUI(e.target.value);
    }

    updateSliderUI(value) {
        const val = parseInt(value);
        const total = this.state.questions.length;

        document.getElementById(CONFIG.SELECTORS.SLIDER_VALUE).textContent = val;

        // Time Estimate (~90s per question)
        const minutes = Math.ceil((val * 90) / 60);
        const timeText = minutes < 1 ? "< 1 min" : `${minutes} min`;
        document.getElementById(CONFIG.SELECTORS.TIME_ESTIMATE).innerHTML = `⏱️ ~${timeText}`;

        // Update Buttons
        const btns = document.querySelectorAll(CONFIG.SELECTORS.PRESET_BTNS);
        btns.forEach(btn => btn.classList.remove('active'));

        if (val === 10 && btns[0]) btns[0].classList.add('active');
        else if (val === 50 && btns[1]) btns[1].classList.add('active');
        else if (val === total && val !== 10 && val !== 50 && btns[2]) btns[2].classList.add('active');
    }

    setSliderValue(preset) {
        const total = this.state.questions.length;
        const val = (preset === 'max') ? total : Math.min(preset, total);
        const slider = document.getElementById(CONFIG.SELECTORS.SLIDER);
        slider.value = val;
        this.updateSliderUI(val);
    }

    startQuizFromSlider() {
        const slider = document.getElementById(CONFIG.SELECTORS.SLIDER);
        this.startQuiz(parseInt(slider.value));
    }

    /* ===========================
       Quiz Logic
       =========================== */
    startQuiz(count) {
        const shuffled = this.shuffleArray([...this.state.questions]);
        this.state.totalQuestions = Math.min(count, shuffled.length);
        this.state.questions = shuffled.slice(0, this.state.totalQuestions);

        // Reset State
        this.state.currentQuestionIndex = 0;
        this.state.correctAnswers = 0;
        this.state.wrongAnswers = 0;
        this.state.allAnswers = new Array(this.state.totalQuestions).fill(null);
        this.state.quizCompleted = false;

        // Reset UI
        document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).textContent = '0';
        document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).textContent = '0';

        this.renderNavigator();
        this.loadQuestion();
        this.showScreen(CONFIG.SCREENS.QUIZ);
    }

    loadQuestion() {
        const question = this.state.questions[this.state.currentQuestionIndex];
        const savedAnswer = this.state.allAnswers[this.state.currentQuestionIndex];

        // Update Meta
        document.getElementById(CONFIG.SELECTORS.CURRENT_QUESTION).textContent = this.state.currentQuestionIndex + 1;
        document.getElementById(CONFIG.SELECTORS.TOTAL_QUESTIONS).textContent = this.state.totalQuestions;
        document.getElementById(CONFIG.SELECTORS.QUESTION_ID).innerHTML = `ID <span class="id-val">${question.id}</span>`;

        // Progress Bar
        const progress = ((this.state.currentQuestionIndex + 1) / this.state.totalQuestions) * 100;
        document.getElementById(CONFIG.SELECTORS.PROGRESS_BAR).style.width = `${progress}%`;

        document.getElementById(CONFIG.SELECTORS.QUESTION_TEXT).textContent = question.question;

        // Render Options
        this.renderOptions(question);

        // Update Buttons
        document.getElementById(CONFIG.SELECTORS.PREV_BTN).disabled = (this.state.currentQuestionIndex === 0);

        const nextBtn = document.getElementById(CONFIG.SELECTORS.NEXT_BTN);
        nextBtn.textContent = (this.state.currentQuestionIndex === this.state.totalQuestions - 1) ? 'Finish Quiz' : 'Next';
        nextBtn.disabled = !savedAnswer && !this.state.quizCompleted;

        // Restore State or Hide Explanation
        if (savedAnswer !== null) {
            this.showAnswerState(savedAnswer, question);
        } else {
            document.getElementById(CONFIG.SELECTORS.EXPLANATION).classList.add('hidden');
        }

        this.updateNavigator();
    }

    renderOptions(question) {
        const container = document.getElementById(CONFIG.SELECTORS.OPTIONS_CONTAINER);
        container.innerHTML = '';

        let options = [];
        this.currentOptions = []; // Store for reference

        if (question.type === 'multiple') {
            // Shuffle only if not already shuffled for this session/question instance
            // Ideally we should store shuffled options in state to persist order on revisit but simplified here:
            // Actually, wait, if we go back/forward, reshuffling will break "selected index".
            // We need to persist the shuffled order if it's not determined.
            if (!question._shuffledOptions) {
                question._shuffledOptions = this.shuffleArray([...question.options]);
            }
            options = question._shuffledOptions;
        } else if (question.type === 'boolean') {
            const labels = this.state.currentSubject.booleanLabels || ['True', 'False'];
            options = [
                { text: labels[0], value: true },
                { text: labels[1], value: false }
            ];
        }

        this.currentOptions = options; // Keep reference to current displayed options order

        options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'answer-option';

            let displayText = (question.type === 'multiple') ? opt : opt.text;
            let value = (question.type === 'multiple') ? question.options.indexOf(opt) : opt.value;

            btn.innerHTML = `<span>${displayText}</span>`;
            btn.onclick = () => this.handleOptionSelect(value, question);
            container.appendChild(btn);
        });
    }

    handleOptionSelect(selectedValue, question) {
        if (this.state.allAnswers[this.state.currentQuestionIndex] !== null) return;

        const isCorrect = (selectedValue === question.answer);

        // Save Answer
        this.state.allAnswers[this.state.currentQuestionIndex] = { selectedValue, isCorrect };

        // Update Score
        if (isCorrect) {
            this.state.correctAnswers++;
            document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).textContent = this.state.correctAnswers;
        } else {
            this.state.wrongAnswers++;
            document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).textContent = this.state.wrongAnswers;
        }

        this.showAnswerState({ selectedValue, isCorrect }, question);
        document.getElementById(CONFIG.SELECTORS.NEXT_BTN).disabled = false;
        this.updateNavigator();
    }

    showAnswerState(answerData, question) {
        const buttons = document.querySelectorAll('.answer-option');

        buttons.forEach((btn, idx) => {
            btn.disabled = true;

            // Resolve value based on type
            let btnValue;
            if (question.type === 'multiple') {
                // Map displayed option back to original value/index
                const displayedOpt = this.currentOptions[idx];
                btnValue = question.options.indexOf(displayedOpt);
            } else {
                btnValue = this.currentOptions[idx].value;
            }

            if (btnValue === question.answer) {
                btn.classList.add('correct');
            } else if (btnValue === answerData.selectedValue && !answerData.isCorrect) {
                btn.classList.add('wrong');
            }
        });

        if (question.explanation) {
            const exp = document.getElementById(CONFIG.SELECTORS.EXPLANATION);
            exp.className = 'callout';
            exp.innerHTML = `<strong>Explanation:</strong> ${question.explanation}`;
            exp.classList.remove('hidden');
        }
    }

    navigateQuestion(direction) {
        const newIndex = this.state.currentQuestionIndex + direction;

        if (newIndex >= 0 && newIndex < this.state.totalQuestions) {
            this.state.currentQuestionIndex = newIndex;
            this.loadQuestion();
        } else if (direction > 0 && newIndex === this.state.totalQuestions) {
            // Finish
            if (this.state.allAnswers.every(a => a !== null)) {
                this.state.quizCompleted = true;
                this.showResults();
            }
        }
    }

    jumpToQuestion(index) {
        this.state.currentQuestionIndex = index;
        this.loadQuestion();
    }

    /* ===========================
       Navigator & Results
       =========================== */
    renderNavigator() {
        const nav = document.getElementById(CONFIG.SELECTORS.NAVIGATOR);
        nav.innerHTML = '';

        for (let i = 0; i < this.state.totalQuestions; i++) {
            const dot = document.createElement('div');
            dot.className = 'nav-dot';
            dot.textContent = i + 1;
            dot.id = `nav-dot-${i}`;
            dot.onclick = () => this.jumpToQuestion(i);
            nav.appendChild(dot);
        }
    }

    updateNavigator() {
        for (let i = 0; i < this.state.totalQuestions; i++) {
            const dot = document.getElementById(`nav-dot-${i}`);
            if (!dot) continue;

            dot.className = 'nav-dot'; // Reset
            if (i === this.state.currentQuestionIndex) dot.classList.add('current');

            const ans = this.state.allAnswers[i];
            if (ans) {
                dot.classList.add(ans.isCorrect ? 'answered-correct' : 'answered-wrong');
            }
        }

        const currentDot = document.getElementById(`nav-dot-${this.state.currentQuestionIndex}`);
        if (currentDot) {
            currentDot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    showResults() {
        const percent = Math.round((this.state.correctAnswers / this.state.totalQuestions) * 100);

        document.getElementById('scorePercentage').textContent = `${percent}%`;
        document.getElementById('totalQuestionsResult').textContent = this.state.totalQuestions;
        document.getElementById('correctResult').textContent = this.state.correctAnswers;
        document.getElementById('wrongResult').textContent = this.state.wrongAnswers;

        const title = document.getElementById('resultTitle');
        const msg = document.getElementById('resultMessage');
        const ring = document.getElementById('scoreRing');
        let color = 'var(--primary)';

        if (percent === 100) {
            title.textContent = "Perfect Score!";
            msg.textContent = "Incredible! You didn't miss a single question.";
            color = 'var(--success)';
        } else if (percent >= 80) {
            title.textContent = "Great Job!";
            msg.textContent = "You have a strong command of this subject.";
            color = 'var(--success)';
        } else if (percent >= 50) {
            title.textContent = "Good Effort";
            msg.textContent = "You passed, but there is still room for improvement.";
            color = '#f59e0b';
        } else {
            title.textContent = "Keep Practicing";
            msg.textContent = "Don't give up. Review the material and try again.";
            color = 'var(--error)';
        }

        const circumference = 440;
        const offset = circumference - (percent / 100 * circumference);

        ring.style.strokeDashoffset = circumference;
        ring.style.stroke = color;

        // Animate
        setTimeout(() => { ring.style.strokeDashoffset = offset; }, 100);
        this.showScreen(CONFIG.SCREENS.RESULTS);
    }

    restartQuiz() {
        // Reset Logic
        this.state.allAnswers = new Array(this.state.totalQuestions).fill(null);
        this.state.currentQuestionIndex = 0;
        this.state.correctAnswers = 0;
        this.state.wrongAnswers = 0;
        this.state.quizCompleted = false;

        // Remove shuffled state so questions get re-shuffled freshly on next start? 
        // Or re-shuffle logic happens in startQuiz anyway.
        // We do need to clear the _shuffledOptions from existing questions if we want fresh options order.
        this.state.questions.forEach(q => { delete q._shuffledOptions; });

        this.startQuiz(this.state.totalQuestions); // Restart with same count? Or strict restart requires re-selection.
        // Usually restart just restarts the current session.
        // HTML restart calls restartQuiz() which in old code did exactly this.
        // But wait, the standard usually just shows quiz screen again.

        document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).textContent = '0';
        document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).textContent = '0';

        this.showScreen(CONFIG.SCREENS.QUIZ);
        this.loadQuestion();
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    window.quizApp = new QuizApp();
});