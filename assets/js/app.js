import { CONFIG } from './modules/config.js';
import { getInitialAppState } from './modules/state.js';
import { shuffleArray, formatTime } from './modules/utils.js';
import { fetchManifest, fetchQuiz, parseQuizData, validateQuizFile } from './modules/dataLoader.js';
import { showScreen, renderSubjectCard, updateProgressBar } from './modules/ui.js';
import { setupNavigationProtection, initGrillResizer, setupKeyboardSupport } from './modules/events.js';

/**
 * Main Quiz Application Class
 */
class QuizApp {
    constructor() {
        this.state = getInitialAppState();
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        await this.loadSubjects();
        this.bindGlobalEvents();
        this.setupTimerInput();
        this.setupKeyboardSupport();
        this.setupNavigationProtection();
        this.initGrillResizer();

        // Initialize WorkshopManager early for global Drag & Drop
        if (window.WorkshopManager) {
            window.WorkshopManager.init();
        }
    }

    initGrillResizer() {
        const grill = document.getElementById('quizGrill');
        const resizer = document.getElementById('quizGrillResizer');
        initGrillResizer(grill, resizer);
    }

    setupNavigationProtection() {
        setupNavigationProtection(() => {
            const quizScreen = document.getElementById(CONFIG.SCREENS.QUIZ);
            const isQuizActive = quizScreen && !quizScreen.classList.contains('hidden');

            const workshopScreen = document.getElementById(CONFIG.SCREENS.WORKSHOP);
            const isWorkshopActive = workshopScreen && !workshopScreen.classList.contains('hidden');
            const hasWorkshopContent = window.WorkshopManager && window.WorkshopManager.hasUnsavedContent();

            return (isQuizActive && !this.state.quizCompleted && !this.state.isReviewing) ||
                   (isWorkshopActive && hasWorkshopContent);
        });
    }

    setupKeyboardSupport() {
        setupKeyboardSupport({
            shouldIgnore: (e) => {
                const quizScreen = document.getElementById(CONFIG.SCREENS.QUIZ);
                if (quizScreen.classList.contains('hidden')) return true;
                const target = e.target;
                return (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
            },
            handleModal: (e) => {
                const confirmationModal = document.getElementById('confirmationModal');
                if (confirmationModal && !confirmationModal.classList.contains('hidden')) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.confirmFinish();
                    } else if (e.key === 'Backspace' || e.key === 'Escape') {
                        e.preventDefault();
                        this.hideFinishConfirmation();
                    }
                    return true;
                }
                return false;
            },
            onEscape: () => this.attemptCloseQuiz(),
            onToggleFlag: () => this.toggleFlag(),
            onToggleGrill: () => this.toggleGrill(),
            onNext: () => {
                const nextBtn = document.getElementById(CONFIG.SELECTORS.NEXT_BTN);
                if (nextBtn && !nextBtn.disabled) nextBtn.click();
            },
            onPrev: () => {
                const prevBtn = document.getElementById(CONFIG.SELECTORS.PREV_BTN);
                if (prevBtn && !prevBtn.disabled) prevBtn.click();
            },
            onNumber: (index) => {
                const container = document.getElementById(CONFIG.SELECTORS.OPTIONS_CONTAINER);
                const options = container ? container.querySelectorAll('.answer-option') : [];
                if (options[index] && !options[index].disabled) {
                    options[index].click();
                }
            }
        });
    }

    /**
     * Bind global functions for HTML access
     */
    bindGlobalEvents() {
        window.goHome = () => this.showScreen(CONFIG.SCREENS.HOME);
        window.backToSetup = () => this.showScreen(CONFIG.SCREENS.COUNT);
        window.attemptCloseQuiz = () => this.attemptCloseQuiz();
        window.setSliderValue = (val) => this.setSliderValue(val);
        window.startQuizFromSlider = () => this.startQuizFromSlider();
        window.previousQuestion = () => this.navigateQuestion(-1);
        window.nextQuestion = () => this.navigateQuestion(1);
        window.restartQuiz = () => this.restartQuiz();
        window.selectSubject = (id) => this.selectSubject(id);
        window.selectTimeMode = (mode) => this.selectTimeMode(mode);
        window.selectCorrectionMode = (mode) => this.selectCorrectionMode(mode);
        window.startReview = (filter) => this.startReview(filter);
        window.exitReview = () => this.exitReview();
        window.showFinishConfirmation = () => this.showFinishConfirmation();
        window.hideFinishConfirmation = () => this.hideFinishConfirmation();
        window.confirmFinish = () => this.confirmFinish();
        window.toggleFlag = () => this.toggleFlag();
        window.toggleShuffle = (checked) => this.toggleShuffle(checked);
        window.toggleGrill = () => this.toggleGrill();
        window.handleLocalQuizUpload = (event) => this.handleLocalQuizUpload(event);
        window.handlePersistentUpload = () => this.handlePersistentUpload();
        window.openWorkshop = () => this.openWorkshop();
        window.attemptCloseWorkshop = () => this.attemptCloseWorkshop();
    }

    /**
     * Screen Navigation Helper
     */
    showScreen(screenId) {
        showScreen(screenId);
        // Stop timer if leaving quiz screen (except to results)
        if (screenId !== CONFIG.SCREENS.QUIZ && screenId !== CONFIG.SCREENS.RESULTS) {
            this.stopTimer();
        }
    }

    /**
     * Workshop Navigation
     */
    openWorkshop() {
        this.showScreen(CONFIG.SCREENS.WORKSHOP);
        if (window.WorkshopManager) {
            window.WorkshopManager.init();
        }
    }

    editWorkshop() {
        if (!this.state.allQuestions || this.state.allQuestions.length === 0) return;
        this.showScreen(CONFIG.SCREENS.WORKSHOP);
        if (window.WorkshopManager) {
            window.WorkshopManager.init();
            window.WorkshopManager.loadQuestions(
                this.state.allQuestions,
                this.state.currentSubject.originalFileName,
                this.state.currentSubject.fileHandle
            );
        }
    }

    attemptCloseWorkshop() {
        if (window.WorkshopManager && window.WorkshopManager.hasUnsavedContent()) {
            if (confirm("You have entered content in the Workshop. Are you sure you want to exit? Your progress will be lost.")) {
                window.WorkshopManager.reset();
                this.showScreen(CONFIG.SCREENS.HOME);
            }
        } else {
            if (window.WorkshopManager) {
                window.WorkshopManager.reset();
            }
            this.showScreen(CONFIG.SCREENS.HOME);
        }
    }

    /**
     * Load subjects and their question counts
     */
    async loadSubjects() {
        const container = document.getElementById(CONFIG.SELECTORS.SUBJECT_CONTAINER);
        container.innerHTML = `
            <div id="loadingSpinner" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; padding: 3rem 0; grid-column: 1 / -1;">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div style="margin-top: 12px; color: var(--text-secondary); font-weight: 600;">Loading JSON files...</div>
            </div>
        `;

        const subjectCardsCache = [];
        const quizFiles = await fetchManifest();

        for (const fileId of quizFiles) {
            const data = await fetchQuiz(fileId);
            if (data) {
                const { metadata, questions } = parseQuizData(data, fileId);
                
                // Add to state if not already there
                if (!this.state.subjects.find(s => s.id === metadata.id)) {
                    this.state.subjects.push(metadata);
                }
                
                this.state.subjectQuestionsCount[metadata.id] = questions.length;
                subjectCardsCache.push({subject: metadata, count: questions.length});
            }
        }

        container.innerHTML = '';

        // Group subjects by category
        const categoryMap = {};
        for (const item of subjectCardsCache) {
            const cat = item.subject.category || 'Other';
            if (!categoryMap[cat]) categoryMap[cat] = [];
            categoryMap[cat].push(item);
        }

        // Render each category section
        for (const [category, items] of Object.entries(categoryMap)) {
            const section = document.createElement('div');
            section.className = 'category-section';

            const header = document.createElement('div');
            header.className = 'category-header';
            header.innerHTML = `<span class="category-title">${category}</span><span class="section-line"></span>`;
            section.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'subjects-grid';
            for (const item of items) {
                renderSubjectCard(grid, item.subject, item.count, () => this.selectSubject(item.subject.id));
            }
            section.appendChild(grid);
            container.appendChild(section);
        }
    }

    async selectSubject(subjectId) {
        this.state.currentSubject = this.state.subjects.find(s => s.id === subjectId);
        if (this.state.currentSubject) {
            this.state.currentSubject.originalFileName = this.state.currentSubject.name;
        }
        this.state.flaggedQuestions.clear();

        // Update Titles
        document.getElementById(CONFIG.SELECTORS.SELECTED_SUBJECT_TITLE).textContent = this.state.currentSubject.name;
        document.getElementById(CONFIG.SELECTORS.QUIZ_SUBJECT_TITLE).textContent = this.state.currentSubject.name;

        try {
            const data = await fetchQuiz(subjectId);
            if (!data) throw new Error('Failed to load questions');

            const { questions } = parseQuizData(data, subjectId);
            this.state.allQuestions = questions;
            this.state.questions = [...this.state.allQuestions];
            this.setupSlider();
            this.showScreen(CONFIG.SCREENS.COUNT);
        } catch (error) {
            console.error('Error selecting subject:', error);
            alert('Failed to load questions for this subject.');
        }
    }

    async handlePersistentUpload() {
        if (!window.showOpenFilePicker) {
            document.getElementById('local-file-input').click();
            return;
        }

        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Quizium JSON Files',
                    accept: { 'application/json': ['.json'] }
                }],
                multiple: false
            });

            const file = await handle.getFile();
            const content = (await file.text()).trim();
            if (!content) throw new Error("The selected file is empty.");

            const data = JSON.parse(content);
            const questions = validateQuizFile(data);
            const metadata = data.metadata || null;

            const fileName = (metadata && metadata.name) ? metadata.name : file.name.replace(/\.[^/.]+$/, "");
            this.state.currentSubject = metadata || {
                id: 'local',
                name: fileName,
                icon: '📁',
                color: '#3b82f6',
                bg: '#eff6ff',
                lang: 'EN',
                originalFileName: fileName,
                fileHandle: handle
            };

            this.state.flaggedQuestions.clear();
            document.getElementById(CONFIG.SELECTORS.SELECTED_SUBJECT_TITLE).textContent = fileName;
            document.getElementById(CONFIG.SELECTORS.QUIZ_SUBJECT_TITLE).textContent = fileName;

            this.state.allQuestions = questions;
            this.state.questions = [...questions];

            this.setupSlider();
            this.showScreen(CONFIG.SCREENS.COUNT);

        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error("Local Quiz Upload Error:", err);
            alert("Error loading file: " + err.message);
        }
    }

    handleLocalQuizUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = (e.target.result || "").trim();
                if (!content) throw new Error("File is empty.");
                const data = JSON.parse(content);

                const questions = validateQuizFile(data);
                const metadata = data.metadata || null;

                event.target.value = '';

                const fileName = (metadata && metadata.name) ? metadata.name : file.name.replace(/\.[^/.]+$/, "");
                this.state.currentSubject = metadata || {
                    id: 'local',
                    name: fileName,
                    icon: '📁',
                    color: '#3b82f6',
                    bg: '#eff6ff',
                    lang: 'EN',
                    originalFileName: file.name
                };

                this.state.flaggedQuestions.clear();
                document.getElementById(CONFIG.SELECTORS.SELECTED_SUBJECT_TITLE).textContent = fileName;
                document.getElementById(CONFIG.SELECTORS.QUIZ_SUBJECT_TITLE).textContent = fileName;

                this.state.allQuestions = questions;
                this.state.questions = [...questions];

                this.setupSlider();
                this.showScreen(CONFIG.SCREENS.COUNT);

            } catch (err) {
                console.error("Local Quiz Upload Error:", err);
                alert("Invalid Quiz File. Please check that the file is a properly formatted Quizium JSON.");
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    }

    setupSlider() {
        const total = this.state.questions.length;
        const slider = document.getElementById(CONFIG.SELECTORS.SLIDER);
        const input = document.getElementById(CONFIG.SELECTORS.SLIDER_VALUE);
        const maxLabel = document.getElementById(CONFIG.SELECTORS.MAX_QUESTIONS_LABEL);

        slider.max = total;
        input.max = total;

        const defaultVal = Math.min(10, total);
        slider.value = defaultVal;
        input.value = defaultVal;
        maxLabel.textContent = total;

        this.updateSliderUI(defaultVal);

        slider.oninput = (e) => this.updateSliderUI(e.target.value);

        input.oninput = (e) => {
            if (e.target.value !== '') {
                slider.value = e.target.value;
                this.updateSliderUI(e.target.value, false);
            }
        };

        input.onblur = () => {
            let val = parseInt(input.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > total) val = total;
            this.setSliderValue(val);
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') input.blur();
        };

        input.addEventListener('touchend', () => input.focus());
    }

    updateSliderUI(value, updateInput = true) {
        const val = parseInt(value);
        const total = this.state.questions.length;

        if (updateInput) {
            document.getElementById(CONFIG.SELECTORS.SLIDER_VALUE).value = val;
        }

        const minutes = Math.ceil((val * 90) / 60);
        const timeText = minutes < 1 ? "< 1 min" : `${minutes} min`;
        document.getElementById(CONFIG.SELECTORS.TIME_ESTIMATE).innerHTML = `⏱️ ~${timeText}`;

        const countBtns = document.querySelector('.slider-wrapper .preset-buttons').querySelectorAll('.preset-btn');
        countBtns.forEach(btn => btn.classList.remove('active'));

        if (val === 10 && countBtns[0]) countBtns[0].classList.add('active');
        else if (val === 50 && countBtns[1]) countBtns[1].classList.add('active');
        else if (val === total && val !== 10 && val !== 50 && countBtns[2]) countBtns[2].classList.add('active');
    }

    setSliderValue(preset) {
        const total = this.state.questions.length;
        const val = (preset === 'max') ? total : Math.min(preset, total);
        const slider = document.getElementById(CONFIG.SELECTORS.SLIDER);
        slider.value = val;
        this.updateSliderUI(val);
    }

    selectTimeMode(mode) {
        this.state.timeMode = mode;
        document.getElementById(CONFIG.SELECTORS.BTN_TIME_NONE).classList.toggle('active', mode === 'none');
        document.getElementById(CONFIG.SELECTORS.BTN_TIME_STOPWATCH).classList.toggle('active', mode === 'stopwatch');
        document.getElementById(CONFIG.SELECTORS.BTN_TIME_TIMER).classList.toggle('active', mode === 'timer');

        const timerInput = document.getElementById(CONFIG.SELECTORS.TIMER_INPUT_CONTAINER);
        if (mode === 'timer') {
            timerInput.classList.remove('slider-dimmed');
        } else {
            timerInput.classList.add('slider-dimmed');
        }
    }

    setupTimerInput() {
        const slider = document.getElementById(CONFIG.SELECTORS.TIMER_SLIDER);
        const input = document.getElementById(CONFIG.SELECTORS.TIMER_VALUE_DISPLAY);

        const updateTimerUI = (val, updateInput = true) => {
            if (this.state.timeMode !== 'timer') this.selectTimeMode('timer');
            if (updateInput) input.value = val;
            this.state.timerDuration = parseInt(val);
        };

        slider.oninput = (e) => updateTimerUI(e.target.value);
        input.oninput = (e) => {
            if (e.target.value !== '') {
                slider.value = e.target.value;
                updateTimerUI(e.target.value, false);
            }
        };
        input.onblur = () => {
            let val = parseInt(input.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 60) val = 60;
            input.value = val;
            slider.value = val;
            updateTimerUI(val, false);
        };
        input.onkeydown = (e) => {
            if (e.key === 'Enter') input.blur();
        };
        input.value = this.state.timerDuration;
    }

    selectCorrectionMode(mode) {
        this.state.correctionMode = mode;
        document.getElementById(CONFIG.SELECTORS.BTN_CORRECTION_INSTANT).classList.toggle('active', mode === 'instant');
        document.getElementById(CONFIG.SELECTORS.BTN_CORRECTION_FINAL).classList.toggle('active', mode === 'final');

        const desc = document.getElementById(CONFIG.SELECTORS.CORRECTION_DESC);
        if (mode === 'instant') {
            desc.textContent = "Instant feedback after each answer.";
        } else {
            desc.textContent = "Review answers only after the quiz.";
        }
    }

    startQuizFromSlider() {
        const slider = document.getElementById(CONFIG.SELECTORS.SLIDER);
        this.startQuiz(parseInt(slider.value));
    }

    startQuiz(count) {
        const questionsToUse = (this.state.allQuestions && this.state.allQuestions.length > 0)
            ? [...this.state.allQuestions]
            : [...this.state.questions];

        const shuffled = this.state.shuffleQuestions ? shuffleArray(questionsToUse) : questionsToUse;
        this.state.totalQuestions = Math.min(count, shuffled.length);
        this.state.questions = shuffled.slice(0, this.state.totalQuestions);

        this.state.currentQuestionIndex = 0;
        this.state.correctAnswers = 0;
        this.state.wrongAnswers = 0;
        this.state.allAnswers = new Array(this.state.totalQuestions).fill(null);
        this.state.quizCompleted = false;
        this.state.isReviewing = false;
        this.state.flaggedQuestions.clear();

        if (this.state.correctionMode === 'final') {
            document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).parentElement.classList.add('hidden');
            document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).parentElement.classList.add('hidden');
        } else {
            document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).parentElement.classList.remove('hidden');
            document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).parentElement.classList.remove('hidden');
        }
        document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).textContent = '0';
        document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).textContent = '0';

        this.startTimerLogic();
        this.showScreen(CONFIG.SCREENS.QUIZ);

        this.renderNavigator();
        this.loadQuestion();

        const nav = document.getElementById(CONFIG.SELECTORS.NAVIGATOR);
        if (nav) nav.scrollLeft = 0;

        this.initGrill();
        this.renderGrill();
    }

    startTimerLogic() {
        this.stopTimer();
        const display = document.getElementById(CONFIG.SELECTORS.TIME_DISPLAY);
        display.classList.remove('hidden');

        if (this.state.timeMode === 'none') {
            display.classList.add('hidden');
            return;
        }

        if (this.state.timeMode === 'stopwatch') {
            this.state.elapsedTime = 0;
            display.textContent = "00:00";
            this.state.timerInterval = setInterval(() => {
                this.state.elapsedTime++;
                display.textContent = formatTime(this.state.elapsedTime);
            }, 1000);
        } else if (this.state.timeMode === 'timer') {
            this.state.remainingTime = this.state.timerDuration * 60;
            display.textContent = formatTime(this.state.remainingTime);
            this.state.timerInterval = setInterval(() => {
                this.state.remainingTime--;
                display.textContent = formatTime(this.state.remainingTime);
                if (this.state.remainingTime <= 0) {
                    this.finishQuiz(true);
                }
            }, 1000);
        }
    }

    stopTimer() {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }
    }

    finishQuiz(isTimeOut = false) {
        this.state.quizCompleted = true;
        this.stopTimer();
        this.showResults(isTimeOut);
    }

    updateProgressBar() {
        const answeredCount = this.state.allAnswers.filter(a => a !== null).length;
        updateProgressBar(answeredCount, this.state.totalQuestions);
    }

    getRealQuestionIndex(viewIndex = this.state.currentQuestionIndex) {
        if (this.state.isReviewing && this.state.reviewIndices && this.state.reviewIndices.length > 0) {
            return this.state.reviewIndices[viewIndex];
        }
        return viewIndex;
    }

    loadQuestion() {
        const realIndex = this.getRealQuestionIndex();
        const question = this.state.questions[realIndex];
        const savedAnswer = this.state.allAnswers[realIndex];

        let displayCurrent = this.state.currentQuestionIndex + 1;
        let displayTotal = this.state.totalQuestions;

        if (this.state.isReviewing) {
            displayCurrent = realIndex + 1;
            displayTotal = this.state.originalTotalQuestions || this.state.questions.length;
        }

        document.getElementById(CONFIG.SELECTORS.CURRENT_QUESTION).textContent = displayCurrent;
        document.getElementById(CONFIG.SELECTORS.TOTAL_QUESTIONS).textContent = displayTotal;
        document.getElementById(CONFIG.SELECTORS.QUESTION_ID).innerHTML = `ID <span class="id-val">${question.id}</span>`;

        this.updateProgressBar();
        document.getElementById(CONFIG.SELECTORS.QUESTION_TEXT).textContent = question.question;

        this.renderOptions(question);

        document.getElementById(CONFIG.SELECTORS.PREV_BTN).disabled = (this.state.currentQuestionIndex === 0);

        const nextBtn = document.getElementById(CONFIG.SELECTORS.NEXT_BTN);
        if (this.state.currentQuestionIndex === this.state.totalQuestions - 1) {
            nextBtn.textContent = this.state.isReviewing ? 'Finish Review' : 'Finish Quiz';
            nextBtn.onclick = () => {
                if (this.state.isReviewing) this.exitReview();
                else this.showFinishConfirmation();
            };
        } else {
            nextBtn.textContent = 'Next';
            nextBtn.onclick = () => this.navigateQuestion(1);
        }

        nextBtn.disabled = this.state.quizCompleted && !this.state.isReviewing;

        if (this.state.isReviewing) {
            if (savedAnswer) {
                this.showAnswerState(savedAnswer, question, true);
            } else {
                this.showAnswerState({ selectedValue: null, isCorrect: false }, question, true);
            }
        } else if (savedAnswer !== null) {
            this.showAnswerState(savedAnswer, question, false);
        } else {
            document.getElementById(CONFIG.SELECTORS.EXPLANATION).classList.add('hidden');
        }

        const flagBtn = document.getElementById('btnFlagQuestion');
        if (this.state.correctionMode === 'final' && !this.state.quizCompleted && !this.state.isReviewing) {
            flagBtn.classList.remove('hidden');
            const isFlagged = this.state.flaggedQuestions.has(realIndex);
            if (isFlagged) {
                flagBtn.classList.add('active');
                flagBtn.querySelector('svg').setAttribute('fill', '#f59e0b');
            } else {
                flagBtn.classList.remove('active');
                flagBtn.querySelector('svg').setAttribute('fill', 'none');
            }
        } else {
            flagBtn.classList.add('hidden');
        }

        this.updateNavigator();

        document.getElementById(CONFIG.SELECTORS.BTN_CLOSE).classList.toggle('hidden', this.state.isReviewing);
        document.getElementById(CONFIG.SELECTORS.BTN_REVIEW_BACK).classList.toggle('hidden', !this.state.isReviewing);
    }

    renderOptions(question) {
        const container = document.getElementById(CONFIG.SELECTORS.OPTIONS_CONTAINER);
        container.innerHTML = '';

        if (question.type === 'open') {
            const textarea = document.createElement('textarea');
            textarea.className = 'open-answer-input';
            textarea.placeholder = 'Insert your answer here...';
            const savedAnswer = this.state.allAnswers[this.state.currentQuestionIndex];
            if (savedAnswer && savedAnswer.selectedValue !== undefined) {
                textarea.value = savedAnswer.selectedValue;
            }
            textarea.oninput = (e) => this.handleOpenAnswer(e.target.value, question);
            container.appendChild(textarea);

            if (this.state.correctionMode === 'instant' && !this.state.isReviewing && !this.state.quizCompleted) {
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'btn btn-primary full-width';
                confirmBtn.style.marginTop = '16px';
                confirmBtn.id = 'btnConfirmOpen';
                confirmBtn.textContent = 'Confirm Answer';
                confirmBtn.onclick = () => this.confirmOpenAnswer(question);
                
                if (savedAnswer && savedAnswer.confirmed) {
                    confirmBtn.classList.add('hidden');
                }
                
                container.appendChild(confirmBtn);
            }
            return;
        }

        let options = [];
        this.currentOptions = [];

        if (question.type === 'multiple') {
            if (!question._shuffledOptions) {
                question._shuffledOptions = shuffleArray([...question.options]);
            }
            options = question._shuffledOptions;
        } else if (question.type === 'boolean') {
            const isItalian = (this.state.currentSubject.lang === 'IT');
            const labels = isItalian ? ['Vero', 'Falso'] : ['True', 'False'];

            options = [
                { text: labels[0], value: 1 },
                { text: labels[1], value: 0 }
            ];
        }

        this.currentOptions = options;

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

    handleOpenAnswer(value, question) {
        if (this.state.isReviewing) return;
        const currentAnswer = this.state.allAnswers[this.state.currentQuestionIndex] || {};
        this.state.allAnswers[this.state.currentQuestionIndex] = { 
            selectedValue: value, 
            isCorrect: true,
            confirmed: currentAnswer.confirmed || false
        };
        this.updateNavigator();
        this.updateProgressBar();

        if (this.state.correctionMode === 'instant' && this.state.allAnswers[this.state.currentQuestionIndex].confirmed) {
            this.showAnswerState(this.state.allAnswers[this.state.currentQuestionIndex], question, false);
        }
    }

    confirmOpenAnswer(question) {
        const index = this.state.currentQuestionIndex;
        const answer = this.state.allAnswers[index];
        if (!answer || (!answer.selectedValue || !answer.selectedValue.trim())) return;
        answer.confirmed = true;
        this.showAnswerState(answer, question, false);
        document.getElementById(CONFIG.SELECTORS.NEXT_BTN).disabled = false;
        this.updateNavigator();
    }

    handleOptionSelect(selectedValue, question) {
        if (this.state.isReviewing || (this.state.correctionMode === 'instant' && this.state.allAnswers[this.state.currentQuestionIndex] !== null)) return;

        if (this.state.correctionMode === 'final') {
            const currentAnswer = this.state.allAnswers[this.state.currentQuestionIndex];
            if (currentAnswer && currentAnswer.selectedValue === selectedValue) {
                this.state.allAnswers[this.state.currentQuestionIndex] = null;
                this.showAnswerState({ selectedValue: null, isCorrect: false }, question, false);
                this.updateNavigator();
                this.updateProgressBar();
                return;
            }
        }

        const isCorrect = (selectedValue === question.answer);

        if (this.state.correctionMode === 'instant') {
            if (!this.state.allAnswers[this.state.currentQuestionIndex]) {
                if (isCorrect) {
                    this.state.correctAnswers++;
                    document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).textContent = this.state.correctAnswers;
                } else {
                    this.state.wrongAnswers++;
                    document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).textContent = this.state.wrongAnswers;
                }
            }
        }

        this.state.allAnswers[this.state.currentQuestionIndex] = { selectedValue, isCorrect };
        this.showAnswerState({ selectedValue, isCorrect }, question, false);
        document.getElementById(CONFIG.SELECTORS.NEXT_BTN).disabled = false;
        this.updateNavigator();
        this.updateProgressBar();
    }

    showAnswerState(answerData, question, forceShowFeedback = false) {
        const container = document.getElementById(CONFIG.SELECTORS.OPTIONS_CONTAINER);
        let showFeedback = forceShowFeedback || this.state.quizCompleted;
        
        if (this.state.correctionMode === 'instant') {
            if (question.type === 'open') {
                showFeedback = showFeedback || (answerData && answerData.confirmed);
            } else {
                showFeedback = true;
            }
        }

        if (question.type === 'open') {
            const textarea = container.querySelector('.open-answer-input');
            const confirmBtn = container.querySelector('#btnConfirmOpen');
            if (textarea) {
                textarea.disabled = this.state.isReviewing || this.state.quizCompleted || (this.state.correctionMode === 'instant' && answerData && answerData.confirmed);
                if (answerData && answerData.selectedValue !== null && textarea.value !== answerData.selectedValue) {
                    textarea.value = answerData.selectedValue;
                }
            }
            if (confirmBtn && answerData && answerData.confirmed) confirmBtn.classList.add('hidden');
        } else {
            const buttons = container ? container.querySelectorAll('.answer-option') : [];
            buttons.forEach((btn, idx) => {
                if (showFeedback || this.state.correctionMode === 'instant') {
                    btn.disabled = true;
                } else {
                    btn.disabled = false;
                    btn.className = 'answer-option';
                }

                let btnValue;
                if (question.type === 'multiple') {
                    const displayedOpt = this.currentOptions[idx];
                    btnValue = question.options.indexOf(displayedOpt);
                } else {
                    btnValue = this.currentOptions[idx].value;
                }

                btn.classList.remove('correct', 'wrong', 'selected');

                if (showFeedback) {
                    if (btnValue === question.answer) btn.classList.add('correct');
                    else if (btnValue === answerData.selectedValue && !answerData.isCorrect) btn.classList.add('wrong');
                    else if (btnValue === answerData.selectedValue && answerData.isCorrect) btn.classList.add('correct');
                } else {
                    if (btnValue === answerData.selectedValue) btn.classList.add('selected');
                }
            });
        }

        if (showFeedback && question.explanation) {
            const exp = document.getElementById(CONFIG.SELECTORS.EXPLANATION);
            exp.className = 'callout';
            exp.innerHTML = `<strong>Explanation:</strong> ${question.explanation}`;
            exp.classList.remove('hidden');
        } else {
            document.getElementById(CONFIG.SELECTORS.EXPLANATION).classList.add('hidden');
        }
    }

    navigateQuestion(direction) {
        const newIndex = this.state.currentQuestionIndex + direction;
        if (newIndex >= 0 && newIndex < this.state.totalQuestions) {
            this.state.currentQuestionIndex = newIndex;
            this.loadQuestion();
        } else if (direction > 0 && newIndex === this.state.totalQuestions) {
            if (this.state.isReviewing) this.exitReview();
            else this.showFinishConfirmation();
        }
    }

    attemptCloseQuiz() {
        if (this.state.quizCompleted) {
            this.showScreen(CONFIG.SCREENS.COUNT);
            return;
        }
        this.showConfirmation('exit');
    }

    showConfirmation(action = 'finish') {
        if (this.state.isReviewing && action === 'finish') {
            this.exitReview();
            return;
        }
        this.state.pendingConfirmationAction = action;
        const modal = document.getElementById('confirmationModal');
        const title = modal.querySelector('.modal-title');
        const text = modal.querySelector('.modal-text');
        if (action === 'exit') {
            title.textContent = 'Exit Quiz?';
            text.textContent = 'Are you sure you want to exit and lose the current progress?';
        } else {
            title.textContent = 'Finish Quiz?';
            text.textContent = "Are you sure you want to finish the quiz? You can't change your answers after submitting.";
        }
        modal.classList.remove('hidden');
    }

    showFinishConfirmation() { this.showConfirmation('finish'); }
    hideFinishConfirmation() {
        document.getElementById('confirmationModal').classList.add('hidden');
        this.state.pendingConfirmationAction = null;
    }

    confirmFinish() {
        const action = this.state.pendingConfirmationAction;
        this.hideFinishConfirmation();
        if (action === 'exit') this.showScreen(CONFIG.SCREENS.COUNT);
        else this.finishQuiz();
    }

    jumpToQuestion(index) {
        this.state.currentQuestionIndex = index;
        this.loadQuestion();
    }

    toggleFlag() {
        if (this.state.correctionMode !== 'final' || this.state.quizCompleted) return;
        const idx = this.getRealQuestionIndex();
        if (this.state.flaggedQuestions.has(idx)) this.state.flaggedQuestions.delete(idx);
        else this.state.flaggedQuestions.add(idx);
        this.loadQuestion();
        this.updateNavigator();
    }

    renderNavigator() {
        const nav = document.getElementById(CONFIG.SELECTORS.NAVIGATOR);
        nav.innerHTML = '';
        for (let i = 0; i < this.state.totalQuestions; i++) {
            const dot = document.createElement('div');
            dot.className = 'nav-dot';
            let displayNum = i + 1;
            if (this.state.isReviewing && this.state.reviewIndices && this.state.reviewIndices[i] !== undefined) {
                displayNum = this.state.reviewIndices[i] + 1;
            }
            dot.textContent = displayNum;
            dot.id = `nav-dot-${i}`;
            dot.onclick = () => this.jumpToQuestion(i);
            nav.appendChild(dot);
        }
    }

    updateNavigator() {
        for (let i = 0; i < this.state.totalQuestions; i++) {
            const dot = document.getElementById(`nav-dot-${i}`);
            if (!dot) continue;
            const realIndex = this.getRealQuestionIndex(i);
            dot.className = 'nav-dot';
            dot.removeAttribute('style');
            if (i === this.state.currentQuestionIndex) dot.classList.add('current');
            const ans = this.state.allAnswers[realIndex];
            if (ans) {
                if (this.state.correctionMode === 'final' && !this.state.quizCompleted && !this.state.isReviewing) dot.classList.add('answered-neutral');
                else if (this.state.questions[realIndex].type === 'open') dot.classList.add('answered-neutral');
                else dot.classList.add(ans.isCorrect ? 'answered-correct' : 'answered-wrong');
            } else if (this.state.quizCompleted) dot.classList.add('answered-skipped');
            if (this.state.flaggedQuestions.has(realIndex)) dot.classList.add('flagged');
        }
        const currentDot = document.getElementById(`nav-dot-${this.state.currentQuestionIndex}`);
        if (currentDot) currentDot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        this.updateGrill();
    }

    isDesktop() { return window.matchMedia('(min-width: 768px)').matches; }

    initGrill() {
        this.grillVisible = true;
        const grill = document.getElementById('quizGrill');
        const navContainer = document.getElementById('navigatorContainer');
        const toggleBtn = document.getElementById('btnToggleGrill');
        if (!this.isDesktop()) return;
        if (grill) grill.classList.remove('grill-hidden');
        if (navContainer) navContainer.classList.add('grill-active');
        if (toggleBtn) toggleBtn.classList.add('active');
    }

    renderGrill() {
        const map = document.getElementById('grillQuestionMap');
        if (!map) return;
        map.innerHTML = '';
        for (let i = 0; i < this.state.totalQuestions; i++) {
            const dot = document.createElement('button');
            dot.className = 'grill-dot';
            dot.id = `grill-dot-${i}`;
            let displayNum = i + 1;
            if (this.state.isReviewing && this.state.reviewIndices && this.state.reviewIndices[i] !== undefined) {
                displayNum = this.state.reviewIndices[i] + 1;
            }
            dot.textContent = displayNum;
            dot.setAttribute('aria-label', `Go to question ${displayNum}`);
            dot.onclick = () => this.jumpToQuestion(i);
            map.appendChild(dot);
        }
        this.updateGrill();
    }

    updateGrill() {
        const map = document.getElementById('grillQuestionMap');
        if (!map) return;
        let answeredCount = 0;
        for (let i = 0; i < this.state.totalQuestions; i++) {
            const dot = document.getElementById(`grill-dot-${i}`);
            if (!dot) continue;
            const realIndex = this.getRealQuestionIndex(i);
            const ans = this.state.allAnswers[realIndex];
            dot.className = 'grill-dot';
            if (i === this.state.currentQuestionIndex) dot.classList.add('grill-dot-current');
            if (ans) {
                answeredCount++;
                if (this.state.correctionMode === 'final' && !this.state.quizCompleted && !this.state.isReviewing) dot.classList.add('grill-dot-answered');
                else if (this.state.questions[realIndex].type === 'open') dot.classList.add('grill-dot-answered');
                else dot.classList.add(ans.isCorrect ? 'grill-dot-correct' : 'grill-dot-wrong');
            }
            if (this.state.flaggedQuestions.has(realIndex)) dot.classList.add('flagged');
        }
        const countEl = document.getElementById('grillCompletedCount');
        if (countEl) countEl.textContent = `${answeredCount} / ${this.state.totalQuestions}`;
        const currentGrillDot = document.getElementById(`grill-dot-${this.state.currentQuestionIndex}`);
        if (currentGrillDot) currentGrillDot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    toggleGrill() {
        if (!this.isDesktop()) return;
        const grill = document.getElementById('quizGrill');
        const navContainer = document.getElementById('navigatorContainer');
        const toggleBtn = document.getElementById('btnToggleGrill');
        this.grillVisible = !this.grillVisible;
        if (this.grillVisible) {
            grill.classList.remove('grill-hidden');
            navContainer.classList.add('grill-active');
            if (toggleBtn) toggleBtn.classList.add('active');
        } else {
            grill.classList.add('grill-hidden');
            navContainer.classList.remove('grill-active');
            if (toggleBtn) toggleBtn.classList.remove('active');
        }
    }

    showResults(isTimeOut = false) {
        this.stopTimer();
        this.state.correctAnswers = this.state.allAnswers.filter(a => a && a.isCorrect).length;
        this.state.wrongAnswers = this.state.allAnswers.filter(a => a && !a.isCorrect).length;
        this.state.skippedAnswers = this.state.allAnswers.filter(a => a === null).length;

        const percent = Math.round((this.state.correctAnswers / this.state.totalQuestions) * 100);
        document.getElementById('scorePercentage').textContent = `${percent}%`;
        document.getElementById('totalQuestionsResult').textContent = this.state.totalQuestions;
        document.getElementById('correctResult').textContent = this.state.correctAnswers;
        document.getElementById('wrongResult').textContent = this.state.wrongAnswers;

        const skippedEl = document.getElementById('skippedResult');
        if (skippedEl) skippedEl.textContent = this.state.skippedAnswers;

        document.getElementById(CONFIG.SELECTORS.BTN_REVIEW).classList.remove('hidden');
        const btnWrong = document.getElementById('btnReviewWrong');
        const actionableCount = this.state.wrongAnswers + this.state.skippedAnswers;
        if (actionableCount > 0) {
            btnWrong.classList.remove('hidden');
            btnWrong.textContent = 'Review Wrong';
        } else btnWrong.classList.add('hidden');

        const title = document.getElementById('resultTitle');
        const msg = document.getElementById('resultMessage');
        const ring = document.getElementById('scoreRing');
        let color = 'var(--primary)';

        if (isTimeOut) {
            title.textContent = "Time's Up!";
            msg.textContent = "You ran out of time.";
            color = 'var(--error)';
        } else if (percent === 100) {
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

        const timeBadge = document.getElementById(CONFIG.SELECTORS.TIME_RESULT_BADGE);
        if (this.state.timeMode !== 'none') {
            timeBadge.classList.remove('hidden');
            let displayedTime = "00:00";
            if (this.state.timeMode === 'stopwatch') displayedTime = formatTime(this.state.elapsedTime);
            else {
                const totalSeconds = this.state.timerDuration * 60;
                const left = Math.max(0, this.state.remainingTime);
                displayedTime = formatTime(totalSeconds - left);
            }
            document.getElementById(CONFIG.SELECTORS.TIME_RESULT).textContent = displayedTime;
        } else timeBadge.classList.add('hidden');

        setTimeout(() => { ring.style.strokeDashoffset = offset; }, 100);
        this.showScreen(CONFIG.SCREENS.RESULTS);
    }

    restartQuiz() {
        this.state.allAnswers = new Array(this.state.totalQuestions).fill(null);
        this.state.currentQuestionIndex = 0;
        this.state.correctAnswers = 0;
        this.state.wrongAnswers = 0;
        this.state.quizCompleted = false;
        this.state.questions.forEach(q => { delete q._shuffledOptions; });
        this.startQuiz(this.state.totalQuestions);
    }

    startReview(filter = 'all') {
        this.state.isReviewing = true;
        this.state.currentQuestionIndex = 0;
        if (filter === 'wrong') {
            this.state.reviewIndices = this.state.allAnswers
                .map((ans, idx) => ((!ans || !ans.isCorrect) ? idx : -1))
                .filter(idx => idx !== -1);
        } else {
            this.state.reviewIndices = this.state.questions.map((_, idx) => idx);
        }
        this.state.originalTotalQuestions = this.state.totalQuestions;
        this.state.totalQuestions = this.state.reviewIndices.length;

        document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).parentElement.classList.remove('hidden');
        document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).parentElement.classList.remove('hidden');
        document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).textContent = this.state.correctAnswers;
        document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).textContent = this.state.wrongAnswers;

        this.renderNavigator();
        this.renderGrill();
        this.loadQuestion();
        this.showScreen(CONFIG.SCREENS.QUIZ);

        const nav = document.getElementById(CONFIG.SELECTORS.NAVIGATOR);
        if (nav) nav.scrollLeft = 0;
    }

    exitReview() {
        this.state.isReviewing = false;
        if (this.state.originalTotalQuestions) this.state.totalQuestions = this.state.originalTotalQuestions;
        this.showScreen(CONFIG.SCREENS.RESULTS);
    }

    toggleShuffle(checked) { this.state.shuffleQuestions = checked; }
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    window.quizApp = new QuizApp();
});