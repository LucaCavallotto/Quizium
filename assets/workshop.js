// assets/workshop.js
// Modularizing Workshop Logic to keep app.js clean

const WorkshopManager = (() => {
    let currentQuestions = [];
    let isInitialized = false;

    // IDE UI Elements
    let editorInput;
    let editorGutter;
    let statusEl;
    let statusPreviewEl;
    let previewContent;
    let previewPlaceholder;
    let jsonContainer;
    let jsonContent;
    let jsonGutter;
    let isJsonView = false;

    // Action Buttons
    let playBtn;
    let copyBtn;
    let dlBtn;

    const init = () => {
        if (isInitialized) return;

        editorInput = document.getElementById('workshop-editor-input');
        editorGutter = document.getElementById('workshop-editor-gutter');
        statusEl = document.getElementById('workshop-status');
        statusPreviewEl = document.getElementById('workshop-status-preview');
        previewContent = document.getElementById('workshop-preview-content');
        previewPlaceholder = document.getElementById('workshop-preview-placeholder');
        jsonContainer = document.getElementById('workshop-json-container');
        jsonContent = document.getElementById('workshop-json-content');
        jsonGutter = document.getElementById('workshop-json-gutter');

        playBtn = document.getElementById('workshop-play-btn');
        copyBtn = document.getElementById('workshop-copy-btn');
        dlBtn = document.getElementById('workshop-dl-btn');

        if (editorInput) {
            setupIDE();
        }

        isInitialized = true;
    };

    const hasUnsavedContent = () => {
        return editorInput && editorInput.value.trim().length > 0;
    };

    // --- IDE Editor Helpers ---
    const buildGutter = (lineCount, activeLine, errorLines = []) => {
        if (!editorGutter) return;
        let html = '';
        for (let i = 1; i <= Math.max(lineCount, 1); i++) {
            let cls = 'ide-line-num';
            if (i === activeLine) cls += ' active';
            if (errorLines.includes(i)) cls += ' error-line';
            html += `<span class="${cls}">${i}</span>`;
        }
        editorGutter.innerHTML = html;
    };

    const getActiveLine = () => {
        if (!editorInput) return 1;
        return editorInput.value.slice(0, editorInput.selectionStart).split('\n').length;
    };

    const setupIDE = () => {
        const refreshGutter = () => {
            const lines = editorInput.value.split('\n').length;
            // Retain error lines if they exist, but normally we clear on edit until re-validated
            buildGutter(lines, getActiveLine(), currentErrors.map(e => e.line));
            editorGutter.scrollTop = editorInput.scrollTop;
        };

        editorInput.addEventListener('input', refreshGutter);
        editorInput.addEventListener('scroll', () => {
            editorGutter.scrollTop = editorInput.scrollTop;
        });
        ['keyup', 'mouseup', 'click', 'focus'].forEach(ev => editorInput.addEventListener(ev, refreshGutter));

        editorInput.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const s = editorInput.selectionStart, end = editorInput.selectionEnd;
                editorInput.value = editorInput.value.slice(0, s) + '  ' + editorInput.value.slice(end);
                editorInput.selectionStart = editorInput.selectionEnd = s + 2;
                refreshGutter();
            }
        });

        buildGutter(1, 1);
    };

    // --- Tab Management (Mobile) ---
    const switchTab = (tabName) => {
        document.querySelectorAll('.workshop-tab').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.workshop-panel').forEach(el => el.classList.remove('active'));

        if (tabName === 'editor') {
            document.querySelectorAll('.workshop-tab')[0].classList.add('active');
            document.getElementById('workshop-panel-editor').classList.add('active');
        } else {
            document.querySelectorAll('.workshop-tab')[1].classList.add('active');
            document.getElementById('workshop-panel-preview').classList.add('active');
        }
    };

    // --- UI Status ---
    const showStatus = (msg, type) => {
        statusEl.innerHTML = msg;
        statusEl.className = `workshop-status ${type}`; // auto removes 'hidden' implicitly
        setTimeout(() => {
            // Auto hide success after 3s
            if (type === 'success') {
                statusEl.classList.add('hidden');
            }
        }, 3000);
    };

    const showPreviewStatus = (msg, type) => {
        if (!statusPreviewEl) return;
        statusPreviewEl.innerHTML = msg;
        statusPreviewEl.className = `workshop-status ${type}`;
        setTimeout(() => {
            if (type === 'success') {
                statusPreviewEl.classList.add('hidden');
            }
        }, 3000);
    };

    const hideStatus = () => {
        statusEl.classList.add('hidden');
        if (statusPreviewEl) statusPreviewEl.classList.add('hidden');
    };

    const toggleActionButtons = (enabled) => {
        if (playBtn) playBtn.disabled = !enabled;
        if (copyBtn) copyBtn.disabled = !enabled;
        if (dlBtn) dlBtn.disabled = !enabled;
    };

    // --- Logic ---
    let currentErrors = [];

    const clear = () => {
        if (!editorInput) return;
        if (confirm("Clear all input?")) {
            editorInput.value = '';
            currentQuestions = [];
            currentErrors = [];
            document.getElementById('workshopStartId').value = '1';
            buildGutter(1, 1);
            hideStatus();
            toggleActionButtons(false);

            previewPlaceholder.classList.remove('hidden');
            previewContent.classList.add('hidden');
            previewContent.innerHTML = '';
            if (jsonContainer) jsonContainer.classList.add('hidden');
            if (jsonContent) jsonContent.textContent = '';

            const toggle = document.getElementById('workshop-view-toggle');
            if (toggle) toggle.checked = false;
            isJsonView = false;
        }
    };

    const generate = (isSilent = false) => {
        if (!editorInput) return;
        const input = editorInput.value;
        const startIdStr = document.getElementById('workshopStartId').value;

        if (!isSilent) hideStatus();
        currentErrors = [];

        if (!input.trim()) {
            if (!isSilent) showStatus('Please enter some questions.', 'error');
            toggleActionButtons(false);
            renderPreview([]);
            return;
        }

        let startId = parseInt(startIdStr);
        if (isNaN(startId) || startId < 0) {
            if (!isSilent) showStatus('Invalid Starting ID.', 'error');
            return;
        }

        const rawLines = input.split('\n');
        const blocksList = [];
        let currentBlockDeets = [];

        rawLines.forEach((line, idx) => {
            if (line.trim() === '') {
                if (currentBlockDeets.length > 0) {
                    blocksList.push(currentBlockDeets);
                    currentBlockDeets = [];
                }
            } else {
                currentBlockDeets.push({ text: line.trim(), lineNum: idx + 1 });
            }
        });
        if (currentBlockDeets.length > 0) {
            blocksList.push(currentBlockDeets);
        }

        const jsonOutput = [];
        let currentId = startId;
        const errors = [];
        const errorLineNums = [];

        const mkErr = (lineNum, qNum, text) => {
            errors.push(`Line ${lineNum} (Q${qNum}): ${text}`);
            errorLineNums.push(lineNum);
            currentErrors.push({ line: lineNum, text: text });
        };

        blocksList.forEach((linesDetails, index) => {
            const qNum = index + 1;

            if (linesDetails.length < 2) {
                mkErr(linesDetails[0].lineNum, qNum, `Malformed block (too few lines).`);
                return;
            }

            const questionText = linesDetails[0].text;
            const line2Str = linesDetails[1].text.toLowerCase();
            const type = (line2Str === 'b') ? 'boolean' : 'multiple';

            if (type === 'multiple') {
                if (linesDetails.length < 3) {
                    mkErr(linesDetails[0].lineNum, qNum, `Insufficient content for multiple choice.`);
                    return;
                }
                let answerIndex = -1, optionLines = [], foundAnswerLineIndex = -1;
                let answerLineNum = -1;

                // Last Number = Answer Index logic
                for (let i = linesDetails.length - 1; i >= 1; i--) {
                    if (/^\d+$/.test(linesDetails[i].text)) {
                        foundAnswerLineIndex = i;
                        answerIndex = parseInt(linesDetails[i].text, 10);
                        answerLineNum = linesDetails[i].lineNum;
                        break;
                    }
                }

                if (foundAnswerLineIndex !== -1) {
                    for (let i = 1; i < foundAnswerLineIndex; i++) {
                        optionLines.push(linesDetails[i].text);
                    }
                }
                if (foundAnswerLineIndex === -1) {
                    mkErr(linesDetails[0].lineNum, qNum, `Could not find numeric answer index.`);
                    return;
                }
                if (optionLines.length < 2 || optionLines.length > 4) {
                    mkErr(linesDetails[1].lineNum, qNum, `Invalid number of options (${optionLines.length}). Must be 2-4.`);
                    return;
                }
                if (answerIndex < 0 || answerIndex >= optionLines.length) {
                    mkErr(answerLineNum, qNum, `Answer index ${answerIndex} out of bounds.`);
                    return;
                }

                let questionObj = { id: currentId, type, question: questionText };
                questionObj.options = optionLines;
                questionObj.answer = answerIndex;
                if (foundAnswerLineIndex + 1 < linesDetails.length) {
                    questionObj.explanation = linesDetails.slice(foundAnswerLineIndex + 1).map(l => l.text).join(' ');
                }
                jsonOutput.push(questionObj);
                currentId++;
            } else {
                // Boolean
                const contentLines = linesDetails.slice(2);
                if (contentLines.length < 1) {
                    mkErr(linesDetails[1].lineNum, qNum, `Missing answer index for boolean.`);
                    return;
                }
                const answerLineDeet = contentLines[0];
                if (!/^\d+$/.test(answerLineDeet.text)) {
                    mkErr(answerLineDeet.lineNum, qNum, `Expected numeric answer index (0 or 1).`);
                    return;
                }
                let raw = parseInt(answerLineDeet.text);
                if (raw !== 0 && raw !== 1) {
                    mkErr(answerLineDeet.lineNum, qNum, `Boolean answer index must be 1 (True) or 0 (False).`);
                    return;
                }
                let questionObj = { id: currentId, type, question: questionText };
                questionObj.answer = raw;
                if (contentLines.length > 1) {
                    questionObj.explanation = contentLines.slice(1).map(l => l.text).join(' ');
                }
                jsonOutput.push(questionObj);
                currentId++;
            }
        });

        // Highlight errors in gutter
        const linesCount = input.split('\n').length;
        buildGutter(linesCount, getActiveLine(), errorLineNums);

        if (errors.length > 0) {
            if (!isSilent) showStatus(errors.join('<br>'), 'error');
            toggleActionButtons(false);
            renderPreview([]); // Clear preview on error
            return;
        }

        currentQuestions = jsonOutput;
        renderPreview(currentQuestions);
        toggleActionButtons(true);

        if (!isSilent) {
            showStatus(`Successfully parsed ${jsonOutput.length} questions!`, 'success');
        }
    };

    // --- View Toggle ---
    const toggleViewMode = (isJson) => {
        isJsonView = isJson;
        if (currentQuestions && currentQuestions.length > 0) {
            renderPreview(currentQuestions);
        }
    };

    // --- Preview Rendering ---
    const renderPreview = (questions) => {
        if (!questions || questions.length === 0) {
            previewPlaceholder.classList.remove('hidden');
            previewContent.classList.add('hidden');
            previewContent.innerHTML = '';
            if (jsonContainer) jsonContainer.classList.add('hidden');
            if (jsonContent) jsonContent.textContent = '';
            return;
        }

        previewPlaceholder.classList.add('hidden');

        if (isJsonView) {
            previewContent.classList.add('hidden');
            if (jsonContainer) jsonContainer.classList.remove('hidden');
            if (jsonContent) {
                const jsonStr = JSON.stringify(questions, null, 2);
                jsonContent.textContent = jsonStr;

                // Construct JSON Gutter
                if (jsonGutter) {
                    const lineCount = jsonStr.split('\n').length;
                    let html = '';
                    for (let i = 1; i <= Math.max(lineCount, 1); i++) {
                        html += `<div class="ide-line-num">${i}</div>`;
                    }
                    jsonGutter.innerHTML = html;
                }
            }
            return;
        } else {
            if (jsonContainer) jsonContainer.classList.add('hidden');
            previewContent.classList.remove('hidden');
        }

        let html = '';
        questions.forEach((q, idx) => {
            let optionsHtml = '';
            if (q.type === 'multiple') {
                q.options.forEach((opt, i) => {
                    const isCorrect = i === q.answer;
                    const bClass = isCorrect ? 'answer-option correct' : 'answer-option';
                    optionsHtml += `<button class="${bClass}" disabled><span>${opt}</span></button>`;
                });
            } else {
                const isTrueCorrect = q.answer === 1;
                const isFalseCorrect = q.answer === 0;
                optionsHtml += `<button class="answer-option ${isTrueCorrect ? 'correct' : ''}" disabled><span>True</span></button>`;
                optionsHtml += `<button class="answer-option ${isFalseCorrect ? 'correct' : ''}" disabled><span>False</span></button>`;
            }

            let expHtml = '';
            if (q.explanation) {
                expHtml = `<div class="callout" style="margin-top: 12px; font-size: 0.85rem;"><span class="callout-icon">💡</span>${q.explanation}</div>`;
            }

            html += `
                <div class="question-card workshop-preview-card" style="margin-bottom: 24px; transform: none; box-shadow: var(--shadow-sm);">
                    <div class="question-meta" style="margin-bottom: 12px;">
                        <span class="q-number">Preview Item ${idx + 1}</span>
                        <span class="q-id">ID <span class="id-val">${q.id}</span></span>
                    </div>
                    <h2 class="question-text" style="font-size: 1.1rem; margin-bottom: 16px;">${q.question}</h2>
                    <div class="answer-options">
                        ${optionsHtml}
                    </div>
                    ${expHtml}
                </div>
            `;
        });

        previewContent.innerHTML = html;
    };

    // --- Actions ---
    const playQuiz = () => {
        if (currentQuestions.length === 0) return;

        // Mock a subject payload and inject into app state
        const fileName = "Workshop Session";
        quizApp.state.currentSubject = {
            id: 'workshop',
            name: fileName,
            icon: '🛠️',
            color: '#8b5cf6',
            bg: '#f3e8ff',
            lang: 'EN'
        };

        quizApp.state.flaggedQuestions.clear();

        // Set Titles
        document.getElementById('selectedSubjectTitle').textContent = fileName;
        document.getElementById('quizSubjectTitle').textContent = fileName;

        // Set Data
        quizApp.state.allQuestions = currentQuestions;
        quizApp.state.questions = [...currentQuestions];

        // Bypass Slider logic and just start max OR go to count screen. Let's go to count screen for full power:
        quizApp.setupSlider();
        quizApp.showScreen('questionCountScreen');
    };

    const copyJSON = async () => {
        const jsonString = JSON.stringify(currentQuestions, null, 2);
        try {
            await navigator.clipboard.writeText(jsonString);
            showPreviewStatus('JSON copied to clipboard!', 'success');
        } catch (err) {
            showPreviewStatus('Failed to copy JSON.', 'error');
        }
    };

    const downloadJSON = () => {
        const jsonString = JSON.stringify(currentQuestions, null, 2);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
        const a = document.createElement("a");
        a.href = dataStr;
        a.download = "workshop_quiz.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showPreviewStatus('Download started!', 'success');
    };

    return {
        init,
        hasUnsavedContent,
        switchTab,
        generate,
        clear,
        playQuiz,
        copyJSON,
        downloadJSON,
        toggleViewMode
    };
})();
