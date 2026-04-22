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

/**
 * Main Quiz Application Class
 */
class QuizApp {
    constructor() {
        this.state = {
            subjects: [],
            currentSubject: null,
            questions: [],
            allQuestions: [], // Store full pool of questions
            allAnswers: [],
            currentQuestionIndex: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
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
        };

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
        if (typeof WorkshopManager !== 'undefined') {
            WorkshopManager.init();
        }
    }

    initGrillResizer() {
        const grill = document.getElementById('quizGrill');
        const resizer = document.getElementById('quizGrillResizer');
        if (!grill || !resizer) return;

        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.classList.add('is-resizing');
            resizer.classList.add('active');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const grillRect = grill.getBoundingClientRect();
            let newWidth = e.clientX - grillRect.left;

            // Enforce minimum and maximum limits
            const minWidth = 200;
            const maxWidth = window.innerWidth * 0.6; // Max 60% of viewport

            if (newWidth < minWidth) newWidth = minWidth;
            if (newWidth > maxWidth) newWidth = maxWidth;

            grill.style.flex = `0 0 ${newWidth}px`;
            grill.style.maxWidth = `${newWidth}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.classList.remove('is-resizing');
                resizer.classList.remove('active');
            }
        });
    }

    setupNavigationProtection() {
        window.addEventListener('beforeunload', (e) => {
            const quizScreen = document.getElementById(CONFIG.SCREENS.QUIZ);
            const isQuizActive = !quizScreen.classList.contains('hidden');

            const workshopScreen = document.getElementById(CONFIG.SCREENS.WORKSHOP);
            const isWorkshopActive = workshopScreen && !workshopScreen.classList.contains('hidden');
            const hasWorkshopContent = WorkshopManager && WorkshopManager.hasUnsavedContent();

            // Only protect if Quiz is visible AND not completed AND not reviewing
            if ((isQuizActive && !this.state.quizCompleted && !this.state.isReviewing) ||
                (isWorkshopActive && hasWorkshopContent)) {
                // Standard way to trigger browser confirmation
                e.preventDefault();
                e.returnValue = ''; // Required for Chrome/Edge
                return '';
            }
        });
    }

    setupKeyboardSupport() {
        document.addEventListener('keydown', (e) => {
            // Only active in Quiz Screen or Review Mode
            const quizScreen = document.getElementById(CONFIG.SCREENS.QUIZ);
            if (quizScreen.classList.contains('hidden')) return;

            // Ignore if typing in an input or textarea
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // Handle Confirmation Modal
            const confirmationModal = document.getElementById('confirmationModal');
            if (confirmationModal && !confirmationModal.classList.contains('hidden')) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.confirmFinish();
                } else if (e.key === 'Backspace' || e.key === 'Escape') {
                    e.preventDefault();
                    this.hideFinishConfirmation();
                }
                return; // Block other inputs
            }

            // Escape to Exit
            if (e.key === 'Escape') {
                e.preventDefault();
                this.attemptCloseQuiz();
                return;
            }

            // Toggle Flag (f key)
            if (e.key === 'f' || e.key === 'F') {
                this.toggleFlag();
            }

            // Toggle Grill (s key)
            if (e.key === 's' || e.key === 'S') {
                this.toggleGrill();
            }

            // Navigation
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const nextBtn = document.getElementById(CONFIG.SELECTORS.NEXT_BTN);
                if (nextBtn && !nextBtn.disabled) nextBtn.click();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const prevBtn = document.getElementById(CONFIG.SELECTORS.PREV_BTN);
                if (prevBtn && !prevBtn.disabled) prevBtn.click();
            }

            // Number Keys (1-9)
            // Do not handle if modifier keys (Ctrl/Alt/Meta) are pressed to avoid conflict
            else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key >= '1' && e.key <= '9') {
                const index = parseInt(e.key) - 1;
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
        window.toggleFlag = () => this.toggleFlag();
        window.toggleShuffle = (checked) => this.toggleShuffle(checked);
        window.toggleGrill = () => this.toggleGrill();
        window.handleLocalQuizUpload = (event) => this.handleLocalQuizUpload(event); // Keep for legacy if needed, though we use persistent now
        window.handlePersistentUpload = () => this.handlePersistentUpload();
        window.openWorkshop = () => this.openWorkshop();
        window.attemptCloseWorkshop = () => this.attemptCloseWorkshop();
    }

    /**
     * Screen Navigation Helper
     */
    showScreen(screenId) {
        Object.values(CONFIG.SCREENS).forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');

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
        if (typeof WorkshopManager !== 'undefined') {
            WorkshopManager.init();
        }
    }

    editWorkshop() {
        if (!this.state.allQuestions || this.state.allQuestions.length === 0) return;
        this.showScreen(CONFIG.SCREENS.WORKSHOP);
        if (typeof WorkshopManager !== 'undefined') {
            WorkshopManager.init();
            WorkshopManager.loadQuestions(
                this.state.allQuestions,
                this.state.currentSubject.originalFileName,
                this.state.currentSubject.fileHandle
            );
        }
    }

    attemptCloseWorkshop() {
        if (typeof WorkshopManager !== 'undefined' && WorkshopManager.hasUnsavedContent()) {
            if (confirm("You have entered content in the Workshop. Are you sure you want to exit? Your progress will be lost.")) {
                WorkshopManager.reset();
                this.showScreen(CONFIG.SCREENS.HOME);
            }
        } else {
            if (typeof WorkshopManager !== 'undefined') {
                WorkshopManager.reset();
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

        let quizFiles = [];
        try {
            const manifestResponse = await fetch(`${CONFIG.PATHS.DATA}quizzes.json`);
            if (manifestResponse.ok || manifestResponse.status === 0) {
                quizFiles = await manifestResponse.json();
            } else {
                throw new Error('Manifest fetch failed');
            }
        } catch (error) {
            console.warn('Failed to load quiz manifest, using fallback list:', error);
            // Fallback to known files if manifest fails
            quizFiles = ['f1', 'cs', 'cnts'];
        }

        for (const fileId of quizFiles) {
            try {
                const response = await fetch(`${CONFIG.PATHS.DATA}${fileId}.json`);
                if (response.ok || response.status === 0) {
                    const data = await response.json();
                    // Support both new structure (with metadata) and legacy structure (array)
                    const metadata = data.metadata || { 
                        id: fileId, 
                        name: fileId.charAt(0).toUpperCase() + fileId.slice(1), 
                        category: 'Other' 
                    };
                    const questions = data.questions || data;
                    
                    // Add to state if not already there
                    if (!this.state.subjects.find(s => s.id === metadata.id)) {
                        this.state.subjects.push(metadata);
                    }
                    
                    this.state.subjectQuestionsCount[metadata.id] = questions.length;
                    subjectCardsCache.push({subject: metadata, count: questions.length});
                }
            } catch (error) {
                console.error(`Error loading quiz file ${fileId}:`, error);
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
                this.renderSubjectCard(grid, item.subject, item.count);
            }
            section.appendChild(grid);
            container.appendChild(section);
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
        if (this.state.currentSubject) {
            this.state.currentSubject.originalFileName = this.state.currentSubject.name;
        }
        this.state.flaggedQuestions.clear(); // Ensure flags are cleared on new subject selection

        // Update Titles
        document.getElementById(CONFIG.SELECTORS.SELECTED_SUBJECT_TITLE).textContent = this.state.currentSubject.name;
        document.getElementById(CONFIG.SELECTORS.QUIZ_SUBJECT_TITLE).textContent = this.state.currentSubject.name;

        try {
            const response = await fetch(`${CONFIG.PATHS.DATA}${subjectId}.json`);
            if (!response.ok) throw new Error('Failed to load questions');

            const data = await response.json();
            this.state.allQuestions = data.questions || data;
            this.state.questions = [...this.state.allQuestions]; // Initialize with all questions
            this.setupSlider();
            this.showScreen(CONFIG.SCREENS.COUNT);
        } catch (error) {
            console.error('Error selecting subject:', error);
            alert('Failed to load questions for this subject.');
        }
    }

    async handlePersistentUpload() {
        if (!window.showOpenFilePicker) {
            // Fallback for browsers that don't support File System Access API
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
            if (!content) {
                throw new Error("The selected file is empty.");
            }

            let data;
            try {
                data = JSON.parse(content);
            } catch (parseErr) {
                console.error("JSON Parse Error:", parseErr, "Content starts with:", content.substring(0, 50));
                throw new Error("The file contains invalid JSON data.");
            }

            // Validation & Extraction
            const questions = data.questions || (Array.isArray(data) ? data : null);
            if (!questions || !Array.isArray(questions) || questions.length === 0) {
                throw new Error("Invalid Quiz File: Not a valid array of questions.");
            }

            // Check signature on first question (for both wrapped and unwrapped)
            const firstQ = questions[0];
            if (!firstQ || (!firstQ.hasOwnProperty('question') || !firstQ.hasOwnProperty('type') || !firstQ.hasOwnProperty('answer'))) {
                throw new Error("Invalid Quiz File: Missing required question properties.");
            }

            const metadata = data.metadata || null;

            const fileName = (metadata && metadata.name) ? metadata.name : file.name.replace(/\.[^/.]+$/, "");
            this.state.currentSubject = metadata || {
                id: 'local',
                name: fileName,
                icon: '📁',
                color: '#3b82f6',
                bg: '#eff6ff',
                lang: 'EN',
                originalFileName: fileName, // Store without extension
                fileHandle: handle // Store for persistent saving
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

                // Validation & Extraction
                const questions = data.questions || (Array.isArray(data) ? data : null);
                if (!questions || !Array.isArray(questions) || questions.length === 0) {
                    throw new Error("Invalid Quiz File: Not a valid array of questions.");
                }

                // Check a basic signature on the first item
                const signatureObj = questions[0];
                if (!signatureObj.hasOwnProperty('question') || !signatureObj.hasOwnProperty('type') || !signatureObj.hasOwnProperty('answer')) {
                    throw new Error("Invalid Quiz File: Missing required properties (question, type, answer).");
                }

                const metadata = data.metadata || null;

                // Clean up input value so the same file could be loaded again
                event.target.value = '';

                // Create a pseudo-subject for the custom quiz
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

                // Set Titles
                document.getElementById(CONFIG.SELECTORS.SELECTED_SUBJECT_TITLE).textContent = fileName;
                document.getElementById(CONFIG.SELECTORS.QUIZ_SUBJECT_TITLE).textContent = fileName;

                // Set Data
                this.state.allQuestions = questions;
                this.state.questions = [...questions];

                this.setupSlider();
                this.showScreen(CONFIG.SCREENS.COUNT);

            } catch (err) {
                console.error("Local Quiz Upload Error:", err);
                alert("Invalid Quiz File. Please check that the file is a properly formatted Quizium JSON.");
                // Ensure reset on fail too
                event.target.value = '';
            }
        };

        reader.readAsText(file);
    }

    /* ===========================
       Slider & Time Logic
       =========================== */
    setupSlider() {
        const total = this.state.questions.length;
        const slider = document.getElementById(CONFIG.SELECTORS.SLIDER);
        const input = document.getElementById(CONFIG.SELECTORS.SLIDER_VALUE); // Now an input
        const maxLabel = document.getElementById(CONFIG.SELECTORS.MAX_QUESTIONS_LABEL);

        slider.max = total;
        input.max = total;

        const defaultVal = Math.min(10, total);
        slider.value = defaultVal;
        input.value = defaultVal;
        maxLabel.textContent = total;

        this.updateSliderUI(defaultVal);

        // Slider interaction
        slider.oninput = (e) => this.updateSliderUI(e.target.value);

        // Manual Input interaction
        input.oninput = (e) => {
            // Allow empty while typing, otherwise sync logic
            if (e.target.value !== '') {
                // Sync slider visual only, validate on blur
                slider.value = e.target.value;
                this.updateSliderUI(e.target.value, false); // Don't update input value recursively
            }
        };

        input.onblur = () => {
            let val = parseInt(input.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > total) val = total;

            this.setSliderValue(val);
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        };

        // Mobile focus fix
        input.addEventListener('touchend', (e) => {
            input.focus();
        });
    }

    updateSliderUI(value, updateInput = true) {
        const val = parseInt(value);
        const total = this.state.questions.length;

        if (updateInput) {
            document.getElementById(CONFIG.SELECTORS.SLIDER_VALUE).value = val;
        }

        // Time Estimate (~90s per question)
        const minutes = Math.ceil((val * 90) / 60);
        const timeText = minutes < 1 ? "< 1 min" : `${minutes} min`;
        document.getElementById(CONFIG.SELECTORS.TIME_ESTIMATE).innerHTML = `⏱️ ~${timeText}`;

        // Update Buttons
        const btns = document.querySelectorAll(CONFIG.SELECTORS.PRESET_BTNS);
        // Note: This targets all preset-btns including time ones if not careful. 
        // Better to scope to question count buttons only.
        // Assuming the first 3 are question count. safely we can use ID based logic or check parent.
        // For now, let's just protect against errors if selector matches more.

        // ID based selection for safety
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

    /* Time Mode Selection */
    selectTimeMode(mode) {
        this.state.timeMode = mode;

        // Update UI
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
        const input = document.getElementById(CONFIG.SELECTORS.TIMER_VALUE_DISPLAY); // Now input

        const updateTimerUI = (val, updateInput = true) => {
            // Auto switch to Timer mode if trying to change value in other modes
            if (this.state.timeMode !== 'timer') {
                this.selectTimeMode('timer');
            }
            if (updateInput) input.value = val;
            this.state.timerDuration = parseInt(val);
        };

        slider.oninput = (e) => {
            updateTimerUI(e.target.value);
        };

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
            if (e.key === 'Enter') {
                input.blur();
            }
        };

        input.value = this.state.timerDuration;
    }

    /* Correction Mode Selection */
    selectCorrectionMode(mode) {
        this.state.correctionMode = mode;

        // Update UI
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

    /* ===========================
       Quiz Logic
       =========================== */
    startQuiz(count) {
        // Always sample from the full pool (allQuestions)
        const questionsToUse = (this.state.allQuestions && this.state.allQuestions.length > 0)
            ? [...this.state.allQuestions]
            : [...this.state.questions];

        const shuffled = this.state.shuffleQuestions ? this.shuffleArray(questionsToUse) : questionsToUse;
        this.state.totalQuestions = Math.min(count, shuffled.length);
        this.state.questions = shuffled.slice(0, this.state.totalQuestions);

        // Reset State
        this.state.currentQuestionIndex = 0;
        this.state.correctAnswers = 0;
        this.state.wrongAnswers = 0;
        this.state.allAnswers = new Array(this.state.totalQuestions).fill(null);
        this.state.quizCompleted = false;
        this.state.isReviewing = false;
        this.state.flaggedQuestions.clear();

        // Reset UI
        // Show/Hide counts based on correction mode
        if (this.state.correctionMode === 'final') {
            document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).parentElement.classList.add('hidden');
            document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).parentElement.classList.add('hidden');
        } else {
            document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).parentElement.classList.remove('hidden');
            document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).parentElement.classList.remove('hidden');
        }
        document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).textContent = '0';
        document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).textContent = '0';

        // Start Timer
        this.startTimerLogic();

        this.showScreen(CONFIG.SCREENS.QUIZ);

        // Render navigator and load question AFTER showing screen to ensure scroll logic works (elements must be visible)
        this.renderNavigator();
        this.loadQuestion();

        // Explicitly force scroll to start
        const nav = document.getElementById(CONFIG.SELECTORS.NAVIGATOR);
        if (nav) nav.scrollLeft = 0;

        // Init and render grill (desktop only)
        this.initGrill();
        this.renderGrill();
    }

    startTimerLogic() {
        this.stopTimer(); // specific clear

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
                display.textContent = this.formatTime(this.state.elapsedTime);
            }, 1000);
        } else if (this.state.timeMode === 'timer') {
            this.state.remainingTime = this.state.timerDuration * 60;
            display.textContent = this.formatTime(this.state.remainingTime);
            this.state.timerInterval = setInterval(() => {
                this.state.remainingTime--;
                display.textContent = this.formatTime(this.state.remainingTime);
                if (this.state.remainingTime <= 0) {
                    this.finishQuiz(true); // time out
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

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    finishQuiz(isTimeOut = false) {
        this.state.quizCompleted = true;
        this.stopTimer();
        this.showResults(isTimeOut);
    }

    updateProgressBar() {
        const answeredCount = this.state.allAnswers.filter(a => a !== null).length;
        // In review mode, progress bar reflects progress through review set
        const total = this.state.totalQuestions;
        const progress = (answeredCount / total) * 100;

        // Use a clearer logic for review mode if needed, but standard logic works if totalQuestions is updated.
        // Actually answeredCount is from allAnswers (global). 
        // In review mode, we might want purely visual progress 1..N?
        // Let's stick to standard for now, as updating totalQuestions makes this consistent for "current session".
        document.getElementById(CONFIG.SELECTORS.PROGRESS_BAR).style.width = `${progress}%`;
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

        // Update Meta
        // Update Meta
        let displayCurrent = this.state.currentQuestionIndex + 1;
        let displayTotal = this.state.totalQuestions;

        if (this.state.isReviewing) {
            displayCurrent = realIndex + 1;
            displayTotal = this.state.originalTotalQuestions || this.state.questions.length;
        }

        document.getElementById(CONFIG.SELECTORS.CURRENT_QUESTION).textContent = displayCurrent;
        document.getElementById(CONFIG.SELECTORS.TOTAL_QUESTIONS).textContent = displayTotal;
        document.getElementById(CONFIG.SELECTORS.QUESTION_ID).innerHTML = `ID <span class="id-val">${question.id}</span>`;

        // Progress Bar (Update based on answered count)
        this.updateProgressBar();

        document.getElementById(CONFIG.SELECTORS.QUESTION_TEXT).textContent = question.question;

        // Render Options
        this.renderOptions(question);

        // Update Buttons
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

        // In Final Mode, next is enabled if answered. In Review, always enabled.
        // In Final Mode, next is enabled if answered. In Review, always enabled.
        // User Request: Always enable Next button to allow skipping.
        // User Request: Always enable Next button to allow skipping.
        // Fix: If in review mode, always enable. If quiz completed (and not reviewing), disable.
        nextBtn.disabled = this.state.quizCompleted && !this.state.isReviewing;

        // Restore State or Hide Explanation
        if (this.state.isReviewing) {
            // In review mode, show full state (Correct/Wrong + Explanation)
            if (savedAnswer) {
                this.showAnswerState(savedAnswer, question, true); // Force feedback
            } else {
                // Unanswered question in review (shouldn't happen ideally but handle it)
                this.showAnswerState({ selectedValue: null, isCorrect: false }, question, true);
            }
        } else if (savedAnswer !== null) {
            // Restore locked state
            this.showAnswerState(savedAnswer, question, false); // respect correction mode inside
        } else {
            document.getElementById(CONFIG.SELECTORS.EXPLANATION).classList.add('hidden');
        }

        // Handle Flag Button Visibility and State
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

        // Header Buttons
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
                
                // Hide if already confirmed
                if (savedAnswer && savedAnswer.confirmed) {
                    confirmBtn.classList.add('hidden');
                }
                
                container.appendChild(confirmBtn);
            }
            return;
        }

        let options = [];
        this.currentOptions = []; // Store for reference

        if (question.type === 'multiple') {
            if (!question._shuffledOptions) {
                question._shuffledOptions = this.shuffleArray([...question.options]);
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

    handleOpenAnswer(value, question) {
        // If reviewing, ignore
        if (this.state.isReviewing) return;

        // Save Answer
        // For open questions, isCorrect is always true since it's self-assessed
        const currentAnswer = this.state.allAnswers[this.state.currentQuestionIndex] || {};
        this.state.allAnswers[this.state.currentQuestionIndex] = { 
            selectedValue: value, 
            isCorrect: true,
            confirmed: currentAnswer.confirmed || false
        };

        this.updateNavigator();
        this.updateProgressBar();

        // Only show feedback if already confirmed
        if (this.state.correctionMode === 'instant' && this.state.allAnswers[this.state.currentQuestionIndex].confirmed) {
            this.showAnswerState(this.state.allAnswers[this.state.currentQuestionIndex], question, false);
        }
    }

    confirmOpenAnswer(question) {
        const index = this.state.currentQuestionIndex;
        const answer = this.state.allAnswers[index];
        
        if (!answer || (!answer.selectedValue || !answer.selectedValue.trim())) {
            // Optional: could show a toast "Please type something first"
            return;
        }

        answer.confirmed = true;
        this.showAnswerState(answer, question, false);
        
        // Disable next button if it was disabled (though it's usually always enabled now)
        document.getElementById(CONFIG.SELECTORS.NEXT_BTN).disabled = false;
        
        this.updateNavigator();
    }

    handleOptionSelect(selectedValue, question) {
        // If reviewing or completed in instant mode, ignore
        if (this.state.isReviewing || (this.state.correctionMode === 'instant' && this.state.allAnswers[this.state.currentQuestionIndex] !== null)) return;


        // Check if we are in Final Correction mode and if the same answer is being clicked
        if (this.state.correctionMode === 'final') {
            const currentAnswer = this.state.allAnswers[this.state.currentQuestionIndex];

            // If clicking the already selected answer, deselect it
            if (currentAnswer && currentAnswer.selectedValue === selectedValue) {
                this.state.allAnswers[this.state.currentQuestionIndex] = null;

                // Update UI to clear selection
                this.showAnswerState({ selectedValue: null, isCorrect: false }, question, false);
                this.updateNavigator();
                this.updateProgressBar();
                return;
            }
        }

        const isCorrect = (selectedValue === question.answer);

        // Update Score (Only if Instant Mode - in Final, calculate at end)
        if (this.state.correctionMode === 'instant') {
            // If already answered, don't update score (prevent double counting if bug)
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

        // Save Answer
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
                // Lock if reviewing, quiz completed, or confirmed in instant mode
                textarea.disabled = this.state.isReviewing || this.state.quizCompleted || (this.state.correctionMode === 'instant' && answerData && answerData.confirmed);
                
                if (answerData && answerData.selectedValue !== null && textarea.value !== answerData.selectedValue) {
                    textarea.value = answerData.selectedValue;
                }
            }
            if (confirmBtn && answerData && answerData.confirmed) {
                confirmBtn.classList.add('hidden');
            }
        } else {
            const buttons = container ? container.querySelectorAll('.answer-option') : [];

            buttons.forEach((btn, idx) => {
                // Disable if showing feedback OR if Instant mode (locked)
                // In Final mode during quiz, do NOT disable (allow change)
                if (showFeedback || this.state.correctionMode === 'instant') {
                    btn.disabled = true;
                } else {
                    btn.disabled = false;
                    // Restore active state visual (remove old classes first)
                    btn.className = 'answer-option';
                }

                // Resolve value
                let btnValue;
                if (question.type === 'multiple') {
                    const displayedOpt = this.currentOptions[idx];
                    btnValue = question.options.indexOf(displayedOpt);
                } else {
                    btnValue = this.currentOptions[idx].value;
                }

                // Clean classes
                btn.classList.remove('correct', 'wrong', 'selected');

                if (showFeedback) {
                    if (btnValue === question.answer) {
                        btn.classList.add('correct');
                    } else if (btnValue === answerData.selectedValue && !answerData.isCorrect) {
                        btn.classList.add('wrong');
                    } else if (btnValue === answerData.selectedValue && answerData.isCorrect) {
                        // Correct selected
                        btn.classList.add('correct');
                    }
                } else {
                    // Final Mode (During Quiz) - just show selected
                    if (btnValue === answerData.selectedValue) {
                        btn.classList.add('selected');
                    }
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
            // Finish
            if (this.state.isReviewing) {
                this.exitReview();
            } else {
                // Allow finishing even if not all answered
                this.showFinishConfirmation();
            }
        }
    }

    attemptCloseQuiz() {
        // If the close button is clicked, we are in an active quiz.
        // The button is hidden in review mode (handled via CSS/JS toggle).

        // Double check if quiz is completed but somehow we are here?
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

    // Legacy wrapper if needed, or we just update calls
    showFinishConfirmation() {
        this.showConfirmation('finish');
    }

    hideFinishConfirmation() {
        document.getElementById('confirmationModal').classList.add('hidden');
        this.state.pendingConfirmationAction = null;
    }

    confirmFinish() {
        const action = this.state.pendingConfirmationAction;
        this.hideFinishConfirmation();

        if (action === 'exit') {
            this.showScreen(CONFIG.SCREENS.COUNT);
        } else {
            this.finishQuiz();
        }
    }

    jumpToQuestion(index) {
        this.state.currentQuestionIndex = index;
        this.loadQuestion();
    }

    toggleFlag() {
        if (this.state.correctionMode !== 'final' || this.state.quizCompleted) return;

        const idx = this.getRealQuestionIndex();
        if (this.state.flaggedQuestions.has(idx)) {
            this.state.flaggedQuestions.delete(idx);
        } else {
            this.state.flaggedQuestions.add(idx);
        }

        this.loadQuestion(); // Re-render to update icon
        this.updateNavigator();
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

            // Use original ID index + 1 if reviewing
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

            dot.className = 'nav-dot'; // Reset
            dot.removeAttribute('style'); // Clear inline styles
            if (i === this.state.currentQuestionIndex) dot.classList.add('current');

            const ans = this.state.allAnswers[realIndex];

            // In Final Mode (during quiz), show answered state but not correct/wrong colors?
            // User requested: "do not show any correctness feedback during the quiz"
            // So dot should just look 'completed'.
            if (ans) {
                if (this.state.correctionMode === 'final' && !this.state.quizCompleted && !this.state.isReviewing) {
                    // Just show a neutral 'answered' state
                    dot.classList.add('answered-neutral');
                } else if (this.state.questions[realIndex].type === 'open') {
                    // Open questions are always neutral answered state
                    dot.classList.add('answered-neutral');
                } else {
                    dot.classList.add(ans.isCorrect ? 'answered-correct' : 'answered-wrong');
                }
            } else if (!this.state.quizCompleted && this.state.currentQuestionIndex !== i) {
                // Not answered and not current -> ensure no class (or skipped style if we want)
                // If it's the current one, it gets 'current' class above.
            } else if (this.state.quizCompleted) {
                // Quiz over, if null it's skipped
                dot.classList.add('answered-skipped');
            }

            // Apply flagged status to dots
            if (this.state.flaggedQuestions.has(realIndex)) {
                dot.classList.add('flagged');
            }
        }

        const currentDot = document.getElementById(`nav-dot-${this.state.currentQuestionIndex}`);
        if (currentDot) {
            currentDot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        // Update grill in sync
        this.updateGrill();
    }

    /* ===========================
       Desktop Question Grill
       =========================== */

    /** Returns true only if we are on a desktop (≥ 768px). */
    isDesktop() {
        return window.matchMedia('(min-width: 768px)').matches;
    }

    /** Set up grill state when a new quiz starts. */
    initGrill() {
        this.grillVisible = true; // Default to visible on desktop

        const grill = document.getElementById('quizGrill');
        const navContainer = document.getElementById('navigatorContainer');
        const toggleBtn = document.getElementById('btnToggleGrill');

        if (!this.isDesktop()) return;

        // Ensure everything starts in the 'shown' state if desktop
        if (grill && grill.classList) {
            grill.classList.remove('grill-hidden');
        }
        if (navContainer && navContainer.classList) {
            navContainer.classList.add('grill-active');
        }
        if (toggleBtn && toggleBtn.classList) {
            toggleBtn.classList.add('active');
        }
    }

    /** Render all grill dots from scratch. */
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

    /** Update grill dot states (current / correct / wrong / answered). */
    updateGrill() {
        const map = document.getElementById('grillQuestionMap');
        if (!map) return;

        let answeredCount = 0;

        for (let i = 0; i < this.state.totalQuestions; i++) {
            const dot = document.getElementById(`grill-dot-${i}`);
            if (!dot) continue;

            const realIndex = this.getRealQuestionIndex(i);
            const ans = this.state.allAnswers[realIndex];

            // Reset classes
            dot.className = 'grill-dot';

            if (i === this.state.currentQuestionIndex) {
                dot.classList.add('grill-dot-current');
            }

            if (ans) {
                answeredCount++;
                if (this.state.correctionMode === 'final' && !this.state.quizCompleted && !this.state.isReviewing) {
                    dot.classList.add('grill-dot-answered');
                } else if (this.state.questions[realIndex].type === 'open') {
                    // Open questions are always neutral in grill as well
                    dot.classList.add('grill-dot-answered');
                } else {
                    dot.classList.add(ans.isCorrect ? 'grill-dot-correct' : 'grill-dot-wrong');
                }
            }

            // Flagged questions
            if (this.state.flaggedQuestions.has(realIndex)) {
                dot.classList.add('flagged');
            }
        }

        // Update completed count label
        const countEl = document.getElementById('grillCompletedCount');
        if (countEl) {
            countEl.textContent = `${answeredCount} / ${this.state.totalQuestions}`;
        }

        const currentGrillDot = document.getElementById(`grill-dot-${this.state.currentQuestionIndex}`);
        if (currentGrillDot) {
            currentGrillDot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /** Toggle the grill panel visibility. */
    toggleGrill() {
        if (!this.isDesktop()) return;

        const grill = document.getElementById('quizGrill');
        const navContainer = document.getElementById('navigatorContainer');
        const toggleBtn = document.getElementById('btnToggleGrill');

        this.grillVisible = !this.grillVisible;

        if (this.grillVisible) {
            grill.classList.remove('grill-hidden');
            navContainer.classList.add('grill-active');
            if (toggleBtn) toggleBtn.classList.add('active'); // Optional visual feedback
        } else {
            grill.classList.add('grill-hidden');
            navContainer.classList.remove('grill-active');
            if (toggleBtn) toggleBtn.classList.remove('active');
        }
    }

    showResults(isTimeOut = false) {
        this.stopTimer(); // Ensure timer stops



        // Calculate score for Final Mode
        this.state.correctAnswers = this.state.allAnswers.filter(a => a && a.isCorrect).length;
        this.state.wrongAnswers = this.state.allAnswers.filter(a => a && !a.isCorrect).length; // Actual wrong answers
        this.state.skippedAnswers = this.state.allAnswers.filter(a => a === null).length;

        const percent = Math.round((this.state.correctAnswers / this.state.totalQuestions) * 100);

        document.getElementById('scorePercentage').textContent = `${percent}%`;
        document.getElementById('totalQuestionsResult').textContent = this.state.totalQuestions;
        document.getElementById('correctResult').textContent = this.state.correctAnswers;
        document.getElementById('wrongResult').textContent = this.state.wrongAnswers;

        // Update Skipped Count if element exists (will be added to HTML)
        const skippedEl = document.getElementById('skippedResult');
        if (skippedEl) skippedEl.textContent = this.state.skippedAnswers;

        // Show Review Button group
        document.getElementById(CONFIG.SELECTORS.BTN_REVIEW).classList.remove('hidden');

        // Update Review Wrong Button visibility
        const btnWrong = document.getElementById('btnReviewWrong');
        const actionableCount = this.state.wrongAnswers + this.state.skippedAnswers;

        if (actionableCount > 0) {
            btnWrong.classList.remove('hidden');
            btnWrong.textContent = 'Review Wrong';
        } else {
            btnWrong.classList.add('hidden');
        }

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

        // Time Result
        const timeBadge = document.getElementById(CONFIG.SELECTORS.TIME_RESULT_BADGE);
        if (this.state.timeMode !== 'none') {
            timeBadge.classList.remove('hidden');
            let displayedTime = "00:00";
            if (this.state.timeMode === 'stopwatch') {
                displayedTime = this.formatTime(this.state.elapsedTime);
            } else {
                // Timer: Show actual time taken
                const totalSeconds = this.state.timerDuration * 60;
                // If remainingTime < 0 (timed out), taken is full duration
                const left = Math.max(0, this.state.remainingTime);
                const taken = totalSeconds - left;
                displayedTime = this.formatTime(taken);
            }
            document.getElementById(CONFIG.SELECTORS.TIME_RESULT).textContent = displayedTime;
        } else {
            timeBadge.classList.add('hidden');
        }

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

        this.state.questions.forEach(q => { delete q._shuffledOptions; });

        this.startQuiz(this.state.totalQuestions);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    startReview(filter = 'all') {
        this.state.isReviewing = true;
        this.state.currentQuestionIndex = 0;

        // Populate Indices based on filter
        if (filter === 'wrong') {
            this.state.reviewIndices = this.state.allAnswers
                .map((ans, idx) => ((!ans || !ans.isCorrect) ? idx : -1)) // Include null (skipped) OR wrong
                .filter(idx => idx !== -1);
        } else {
            // All questions
            this.state.reviewIndices = this.state.questions.map((_, idx) => idx);
        }

        // Temporarily override totalQuestions for the navigator/progress to work naturally
        this.state.originalTotalQuestions = this.state.totalQuestions; // Backup
        this.state.totalQuestions = this.state.reviewIndices.length;

        // Show correct/wrong counts in header for review
        document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).parentElement.classList.remove('hidden');
        document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).parentElement.classList.remove('hidden');
        document.getElementById(CONFIG.SELECTORS.CORRECT_COUNT).textContent = this.state.correctAnswers;
        document.getElementById(CONFIG.SELECTORS.WRONG_COUNT).textContent = this.state.wrongAnswers;

        this.renderNavigator();
        this.renderGrill();
        this.loadQuestion();
        this.showScreen(CONFIG.SCREENS.QUIZ);

        // Reset scroll
        const nav = document.getElementById(CONFIG.SELECTORS.NAVIGATOR);
        if (nav) nav.scrollLeft = 0;
    }

    exitReview() {
        this.state.isReviewing = false;
        // Restore total questions
        if (this.state.originalTotalQuestions) {
            this.state.totalQuestions = this.state.originalTotalQuestions;
        }
        this.showScreen(CONFIG.SCREENS.RESULTS);
    }

    toggleShuffle(checked) {
        this.state.shuffleQuestions = checked;
    }
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    window.quizApp = new QuizApp();
});