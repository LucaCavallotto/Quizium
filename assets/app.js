const quizApp = {
    subjects: [
        { id: 'f1', name: '🇮🇹 Formula 1' },
        { id: 'cs', name: '🇬🇧 Computer Science' },
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

async function loadSubjectsWithQuestionCount() {
    const container = document.getElementById('subjectContainer');
    container.innerHTML = '';
   
    for (const subject of quizApp.subjects) {
        try {
            const response = await fetch(`data/${subject.id}.json`);
            if (response.ok) {
                const questions = await response.json();
                quizApp.subjectQuestionsCount[subject.id] = questions.length;
                
                const card = document.createElement('div');
                card.className = 'subject-card';
                card.onclick = () => selectSubject(subject.id);
                card.innerHTML = `
                    <h3 class="subject-name">${subject.name}</h3>
                    <div class="subject-meta">${questions.length} questions</div>
                `;
                container.appendChild(card);
            } else {
                const card = document.createElement('div');
                card.className = 'subject-card';
                card.onclick = () => selectSubject(subject.id);
                card.innerHTML = `
                    <h3 class="subject-name">${subject.name}</h3>
                    <div class="subject-meta">Loading...</div>
                `;
                container.appendChild(card);
            }
        } catch (error) {
            console.error(`Error loading questions for ${subject.id}:`, error);
            const card = document.createElement('div');
            card.className = 'subject-card';
            card.onclick = () => selectSubject(subject.id);
            card.innerHTML = `
                <h3 class="subject-name">${subject.name}</h3>
                <div class="subject-meta">Error loading</div>
            `;
            container.appendChild(card);
        }
    }
}

async function selectSubject(subjectId) {
    quizApp.currentSubject = quizApp.subjects.find(s => s.id === subjectId);
    document.getElementById('selectedSubjectTitle').textContent = quizApp.currentSubject.name;
   
    try {
        const response = await fetch(`data/${subjectId}.json`);
        if (!response.ok) throw new Error('Failed to load questions');
        quizApp.questions = await response.json();
        showScreen('questionCountScreen');
        populateQuestionOptions();
    } catch (error) {
        console.error('Error loading questions:', error);
        alert('Failed to load questions for this subject. Please try again.');
    }
}

function populateQuestionOptions() {
    const optionCardsContainer = document.querySelector('#questionCountScreen .option-cards');
    optionCardsContainer.innerHTML = '';
    
    const totalAvailable = quizApp.questions.length;
    const percentages = [25, 50, 75, 100];
    const uniqueQuestionCounts = new Set();
    
    percentages.forEach(percentage => {
        const numQuestions = Math.max(1, Math.round((percentage / 100) * totalAvailable));
        if (!uniqueQuestionCounts.has(numQuestions)) {
            uniqueQuestionCounts.add(numQuestions);
            const optionCard = createOptionCard(numQuestions, percentage);
            optionCardsContainer.appendChild(optionCard);
        }
    });
}

function createOptionCard(numQuestions, percentage) {
    const optionCard = document.createElement('div');
    optionCard.className = 'option-card';
    optionCard.onclick = () => startQuiz(numQuestions);
    optionCard.innerHTML = `
        <div class="option-card-value">${numQuestions}</div>
        <div class="option-card-label">Questions</div>
    `;
    return optionCard;
}

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
    document.getElementById('totalQuestions').textContent = quizApp.totalQuestions;
    document.getElementById('correctCount').textContent = '0';
    document.getElementById('wrongCount').textContent = '0';
    document.getElementById('quizSubjectTitle').textContent = quizApp.currentSubject.name;
    showScreen('quizScreen');
    loadQuestion();
}

function loadQuestion() {
    const question = quizApp.questions[quizApp.currentQuestionIndex];
    const savedAnswer = quizApp.allAnswers[quizApp.currentQuestionIndex];
    document.getElementById('currentQuestion').textContent = quizApp.currentQuestionIndex + 1;
    document.getElementById('questionNumberText').textContent = quizApp.currentQuestionIndex + 1;
   
    const progress = ((quizApp.currentQuestionIndex + 1) / quizApp.totalQuestions) * 100;
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('questionText').textContent = question.question;
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    const options = question.type === 'multiple' ?
        (question.shuffledOptions || (question.shuffledOptions = shuffleArray([...question.options]))) :
        question.options;
    options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'answer-option';
        button.innerHTML = `
            <div class="option-indicator"></div>
            <span>${option}</span>
        `;
        button.onclick = () => selectOption(index, button, question, options);
        optionsContainer.appendChild(button);
    });
    // Update navigation buttons
    document.getElementById('prevBtn').disabled = quizApp.currentQuestionIndex === 0;
    document.getElementById('nextBtn').disabled = !savedAnswer && !quizApp.quizCompleted;
    
    // If we already answered this question, show the answer
    if (savedAnswer !== null) {
        showAnswer(savedAnswer, question, options);
    } else {
        document.getElementById('explanationCallout').classList.add('hidden');
    }
    
    // Update next button text: cambia in "Termina Quiz" se è l'ultima domanda E è già stata risposta
    if (quizApp.currentQuestionIndex === quizApp.totalQuestions - 1 && savedAnswer !== null) {
        document.getElementById('nextBtn').textContent = 'Termina Quiz';
    } else {
        document.getElementById('nextBtn').textContent = 'Next →';
    }
}

function selectOption(index, button, question, displayedOptions) {
    const savedAnswer = quizApp.allAnswers[quizApp.currentQuestionIndex];
    if (savedAnswer !== null) return; // Already answered
    quizApp.allAnswers[quizApp.currentQuestionIndex] = {
        selectedIndex: index,
        selectedOption: displayedOptions[index],
        isCorrect: displayedOptions[index] === question.answer
    };
    const isCorrect = displayedOptions[index] === question.answer;
    if (isCorrect) {
        quizApp.correctAnswers++;
        document.getElementById('correctCount').textContent = quizApp.correctAnswers;
    } else {
        quizApp.wrongAnswers++;
        document.getElementById('wrongCount').textContent = quizApp.wrongAnswers;
    }
    showAnswer(quizApp.allAnswers[quizApp.currentQuestionIndex], question, displayedOptions);
    document.getElementById('nextBtn').disabled = false;
}

function showAnswer(answerData, question, displayedOptions) {
    const buttons = document.querySelectorAll('.answer-option');
    buttons.forEach((btn, idx) => {
        btn.disabled = true;
        const indicator = btn.querySelector('.option-indicator');
       
        if (displayedOptions[idx] === question.answer) {
            btn.classList.add('correct');
            indicator.textContent = '✓';
        } else if (idx === answerData.selectedIndex && !answerData.isCorrect) {
            btn.classList.add('wrong');
            indicator.textContent = '✗';
        }
    });
    if (question.explanation) {
        const explanation = document.getElementById('explanationCallout');
        explanation.className = 'callout info';
        explanation.innerHTML = `
            <div>${question.explanation}</div>
        `;
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
        // Check if all questions are answered
        const allAnswered = quizApp.allAnswers.every(answer => answer !== null);
        if (allAnswered) {
            quizApp.quizCompleted = true;
            showResults();
        }
    }
}

function showResults() {
    const percentage = Math.round((quizApp.correctAnswers / quizApp.totalQuestions) * 100);
   
    document.getElementById('scorePercentage').textContent = percentage + '%';
    document.getElementById('totalQuestionsResult').textContent = quizApp.totalQuestions;
    document.getElementById('correctResult').textContent = quizApp.correctAnswers;
    document.getElementById('wrongResult').textContent = quizApp.wrongAnswers;
    showScreen('resultsScreen');
}

function restartQuiz() {
    quizApp.allAnswers = new Array(quizApp.totalQuestions).fill(null);
    quizApp.currentQuestionIndex = 0;
    quizApp.correctAnswers = 0;
    quizApp.wrongAnswers = 0;
    quizApp.quizCompleted = false;
   
    // Re-shuffle questions
    quizApp.questions.forEach(q => {
        if (q.shuffledOptions) delete q.shuffledOptions;
    });
   
    document.getElementById('correctCount').textContent = '0';
    document.getElementById('wrongCount').textContent = '0';
   
    showScreen('quizScreen');
    loadQuestion();
}

function goHome() {
    showScreen('homeScreen');
}

function showScreen(screenId) {
    const screens = ['homeScreen', 'questionCountScreen', 'quizScreen', 'resultsScreen'];
    screens.forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

window.onload = init;