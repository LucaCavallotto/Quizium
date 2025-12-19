const quizApp = {
    subjects: [
        { id: 'f1', name: 'Formula 1', icon: '🏎️', color: '#e10600', bg: '#fff1f0', booleanLabels: ['Vero', 'Falso'] },
        { id: 'cs', name: 'Computer Science', icon: '💻', color: '#3b82f6', bg: '#eff6ff', booleanLabels: ['True', 'False'] },
        { id: 'cnts', name: 'Network Technologies', icon: '🌐', color: '#10b981', bg: '#d1fae5', booleanLabels: ['True', 'False'] }
    ],
    currentSubject: null,
    questions: [],
    allAnswers: [],
    currentQuestionIndex: 0,
    selectedAnswer: null,
    correctAnswers: 0,
    wrongAnswers: 0,
    totalQuestions: 0,
    quizCompleted: false,
    subjectQuestionsCount: {}
};

async function init() {
    await loadSubjectsWithQuestionCount();
}

/* =========================================
   2. HOME & SUBJECT SELECTION
   ========================================= */
async function loadSubjectsWithQuestionCount() {
    const container = document.getElementById('subjectContainer');
    container.innerHTML = '';

    for (const subject of quizApp.subjects) {
        try {
            const response = await fetch(`data/${subject.id}.json`);
            if (response.ok) {
                const questions = await response.json();
                quizApp.subjectQuestionsCount[subject.id] = questions.length;

                // Default styles if missing
                const icon = subject.icon || '📝';
                const color = subject.color || '#6b7280';
                const bg = subject.bg || '#f3f4f6';

                const card = document.createElement('div');
                card.className = 'subject-card';
                card.style.setProperty('--card-color', color);
                card.style.setProperty('--card-bg-light', bg);
                card.onclick = () => selectSubject(subject.id);

                card.innerHTML = `
                    <div class="card-icon">${icon}</div>
                    <div class="card-content">
                        <h3 class="card-title">${subject.name}</h3>
                        <div class="card-stats"><span>${questions.length} Questions</span></div>
                    </div>
                    <div class="card-action">→</div>
                `;
                container.appendChild(card);
            }
        } catch (error) {
            console.error(`Error loading ${subject.id}:`, error);
        }
    }
}

async function selectSubject(subjectId) {
    quizApp.currentSubject = quizApp.subjects.find(s => s.id === subjectId);
    document.getElementById('selectedSubjectTitle').textContent = quizApp.currentSubject.name;
    document.getElementById('quizSubjectTitle').textContent = quizApp.currentSubject.name;

    try {
        const response = await fetch(`data/${subjectId}.json`);
        if (!response.ok) throw new Error('Failed to load questions');
        quizApp.questions = await response.json();
        setupSlider();
        showScreen('questionCountScreen');
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load questions.');
    }
}

/* =========================================
   3. SLIDER & PRESETS
   ========================================= */
function setupSlider() {
    const totalAvailable = quizApp.questions.length;
    const slider = document.getElementById('questionSlider');
    const display = document.getElementById('sliderValue');
    const maxLabel = document.getElementById('maxQuestionsLabel');

    slider.max = totalAvailable;
    const defaultValue = Math.min(10, totalAvailable);
    slider.value = defaultValue;
    display.textContent = defaultValue;
    maxLabel.textContent = totalAvailable;

    updateSliderUI(defaultValue);
    slider.oninput = function () { updateSliderUI(this.value); }
}

function updateSliderUI(value) {
    const val = parseInt(value);
    const totalAvailable = quizApp.questions.length;

    document.getElementById('sliderValue').textContent = val;

    // Time Estimate (approx 90s per question)
    const minutes = Math.ceil((val * 90) / 60);
    const timeText = minutes < 1 ? "< 1 min" : minutes + " min";
    document.getElementById('timeEstimate').innerHTML = `⏱️ ~${timeText}`;

    // Update Presets Active State
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    const btns = document.querySelectorAll('.preset-btn');

    if (val === 10 && btns[0]) btns[0].classList.add('active'); // Short
    else if (val === 50 && btns[1]) btns[1].classList.add('active'); // Normal
    else if (val === totalAvailable && val !== 10 && val !== 50 && btns[2]) btns[2].classList.add('active'); // Max
}

function setSliderValue(preset) {
    const slider = document.getElementById('questionSlider');
    const totalAvailable = quizApp.questions.length;
    let newValue = (preset === 'max') ? totalAvailable : Math.min(preset, totalAvailable);
    slider.value = newValue;
    updateSliderUI(newValue);
}

function startQuizFromSlider() {
    startQuiz(parseInt(document.getElementById('questionSlider').value));
}

/* =========================================
   4. QUIZ LOGIC
   ========================================= */
function startQuiz(questionCount) {
    const allQuestions = shuffleArray([...quizApp.questions]);
    quizApp.totalQuestions = Math.min(questionCount, allQuestions.length);
    quizApp.questions = allQuestions.slice(0, quizApp.totalQuestions);
    quizApp.currentQuestionIndex = 0;
    quizApp.correctAnswers = 0;
    quizApp.wrongAnswers = 0;
    quizApp.selectedAnswer = null;
    quizApp.allAnswers = new Array(quizApp.totalQuestions).fill(null);
    quizApp.quizCompleted = false;

    document.getElementById('correctCount').textContent = '0';
    document.getElementById('wrongCount').textContent = '0';

    renderNavigator();
    loadQuestion();
    showScreen('quizScreen');
}

function loadQuestion() {
    const question = quizApp.questions[quizApp.currentQuestionIndex];
    const savedAnswer = quizApp.allAnswers[quizApp.currentQuestionIndex];

    document.getElementById('currentQuestion').textContent = quizApp.currentQuestionIndex + 1;
    document.getElementById('questionIdDisplay').innerHTML = `ID <span class="id-val">${question.id}</span>`;
    document.getElementById('totalQuestions').textContent = quizApp.totalQuestions;

    const progress = ((quizApp.currentQuestionIndex + 1) / quizApp.totalQuestions) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('questionText').textContent = question.question;

    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';

    let options = [];
    if (question.type === 'multiple') {
        options = question.shuffledOptions || (question.shuffledOptions = shuffleArray([...question.options]));
    } else if (question.type === 'boolean') {
        const labels = quizApp.currentSubject.booleanLabels || ['True', 'False'];
        options = [
            { text: labels[0], value: true },
            { text: labels[1], value: false }
        ];
    }

    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'answer-option';

        let displayText, value;
        if (question.type === 'multiple') {
            displayText = option;
            value = question.options.indexOf(option); // Get original index
        } else {
            displayText = option.text;
            value = option.value;
        }

        button.innerHTML = `<span>${displayText}</span>`;
        button.onclick = () => selectOption(value, button, question, options);
        optionsContainer.appendChild(button);
    });

    document.getElementById('prevBtn').disabled = quizApp.currentQuestionIndex === 0;
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.textContent = (quizApp.currentQuestionIndex === quizApp.totalQuestions - 1) ? 'Finish Quiz' : 'Next';
    nextBtn.disabled = !savedAnswer && !quizApp.quizCompleted;

    if (savedAnswer !== null) showAnswer(savedAnswer, question, options);
    else document.getElementById('explanationCallout').classList.add('hidden');

    updateNavigator();
}

function selectOption(selectedValue, button, question, displayedOptions) {
    const savedAnswer = quizApp.allAnswers[quizApp.currentQuestionIndex];
    if (savedAnswer !== null) return;

    const isCorrect = selectedValue === question.answer;

    quizApp.allAnswers[quizApp.currentQuestionIndex] = { selectedValue: selectedValue, isCorrect: isCorrect };

    if (isCorrect) {
        quizApp.correctAnswers++;
        document.getElementById('correctCount').textContent = quizApp.correctAnswers;
    } else {
        quizApp.wrongAnswers++;
        document.getElementById('wrongCount').textContent = quizApp.wrongAnswers;
    }

    showAnswer(quizApp.allAnswers[quizApp.currentQuestionIndex], question, displayedOptions);
    document.getElementById('nextBtn').disabled = false;
    updateNavigator();
}

function showAnswer(answerData, question, displayedOptions) {
    const buttons = document.querySelectorAll('.answer-option');
    buttons.forEach((btn, idx) => {
        btn.disabled = true;

        let buttonValue;
        if (question.type === 'multiple') {
            buttonValue = question.options.indexOf(displayedOptions[idx]);
        } else {
            buttonValue = displayedOptions[idx].value;
        }

        if (buttonValue === question.answer) btn.classList.add('correct');
        else if (buttonValue === answerData.selectedValue && !answerData.isCorrect) btn.classList.add('wrong');
    });

    if (question.explanation) {
        const explanation = document.getElementById('explanationCallout');
        explanation.className = 'callout';
        explanation.innerHTML = `<strong>Explanation:</strong> ${question.explanation}`;
        explanation.classList.remove('hidden');
    }
}

function previousQuestion() {
    if (quizApp.currentQuestionIndex > 0) {
        quizApp.currentQuestionIndex--;
        loadQuestion();
    }
}

function nextQuestion() {
    if (quizApp.currentQuestionIndex < quizApp.totalQuestions - 1) {
        quizApp.currentQuestionIndex++;
        loadQuestion();
    } else {
        if (quizApp.allAnswers.every(answer => answer !== null)) {
            quizApp.quizCompleted = true;
            showResults();
        }
    }
}

/* =========================================
   5. NAVIGATION & RESULTS
   ========================================= */
function renderNavigator() {
    const navContainer = document.getElementById('questionNavigator');
    navContainer.innerHTML = '';

    for (let i = 0; i < quizApp.totalQuestions; i++) {
        const dot = document.createElement('div');
        dot.className = 'nav-dot';
        dot.textContent = i + 1;
        dot.onclick = () => jumpToQuestion(i);
        dot.id = `nav-dot-${i}`;
        navContainer.appendChild(dot);
    }
}

function updateNavigator() {
    for (let i = 0; i < quizApp.totalQuestions; i++) {
        const dot = document.getElementById(`nav-dot-${i}`);
        if (!dot) continue;
        dot.className = 'nav-dot';

        if (i === quizApp.currentQuestionIndex) dot.classList.add('current');
        const answer = quizApp.allAnswers[i];
        if (answer) dot.classList.add(answer.isCorrect ? 'answered-correct' : 'answered-wrong');
    }
    const currentDot = document.getElementById(`nav-dot-${quizApp.currentQuestionIndex}`);
    if (currentDot) currentDot.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function jumpToQuestion(index) {
    quizApp.currentQuestionIndex = index;
    loadQuestion();
}

function showResults() {
    const percentage = Math.round((quizApp.correctAnswers / quizApp.totalQuestions) * 100);

    document.getElementById('scorePercentage').textContent = percentage + '%';
    document.getElementById('totalQuestionsResult').textContent = quizApp.totalQuestions;
    document.getElementById('correctResult').textContent = quizApp.correctAnswers;
    document.getElementById('wrongResult').textContent = quizApp.wrongAnswers;

    const title = document.getElementById('resultTitle');
    const msg = document.getElementById('resultMessage');
    const ring = document.getElementById('scoreRing');
    let color = 'var(--primary)';

    if (percentage === 100) {
        title.textContent = "Perfect Score!"; msg.textContent = "Incredible! You didn't miss a single question."; color = 'var(--success)';
    } else if (percentage >= 80) {
        title.textContent = "Great Job!"; msg.textContent = "You have a strong command of this subject."; color = 'var(--success)';
    } else if (percentage >= 50) {
        title.textContent = "Good Effort"; msg.textContent = "You passed, but there is still room for improvement."; color = '#f59e0b';
    } else {
        title.textContent = "Keep Practicing"; msg.textContent = "Don't give up. Review the material and try again."; color = 'var(--error)';
    }

    const circleCircumference = 440;
    const offset = circleCircumference - (percentage / 100 * circleCircumference);
    ring.style.strokeDashoffset = circleCircumference;
    ring.style.stroke = color;

    setTimeout(() => { ring.style.strokeDashoffset = offset; }, 100);
    showScreen('resultsScreen');
}

function restartQuiz() {
    quizApp.allAnswers = new Array(quizApp.totalQuestions).fill(null);
    quizApp.currentQuestionIndex = 0;
    quizApp.correctAnswers = 0;
    quizApp.wrongAnswers = 0;
    quizApp.quizCompleted = false;
    quizApp.questions.forEach(q => { if (q.shuffledOptions) delete q.shuffledOptions; });
    document.getElementById('correctCount').textContent = '0';
    document.getElementById('wrongCount').textContent = '0';
    showScreen('quizScreen');
    loadQuestion();
}

function goHome() { showScreen('homeScreen'); }

function showScreen(screenId) {
    ['homeScreen', 'questionCountScreen', 'quizScreen', 'resultsScreen'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

window.onload = init;