import { CONFIG } from './modules/config.js';
import { getInitialWorkshopState } from './modules/state.js';
import { checkNonLinearIds, reverseGenerate, wrapQuestionsWithMetadata } from './modules/utils.js';
import { showStatus, hideStatus, toggleActionButtons } from './modules/ui.js';

const WorkshopManager = (() => {
    let state = getInitialWorkshopState();

    // IDE UI Elements
    let editorInput;
    let editorGutter;
    let statusEl;
    let statusPreviewEl;
    let previewContent;
    let previewPlaceholder;
    let jsonContainer;
    let jsonInput;
    let jsonGutter;
    let hintOverlay;
    let hintBar;
    let filenameInput;

    // Action Buttons
    let playBtn;
    let copyBtn;
    let saveBtn;

    const init = () => {
        if (state.isInitialized) return;

        editorInput = document.getElementById('workshop-editor-input');
        editorGutter = document.getElementById('workshop-editor-gutter');
        statusEl = document.getElementById('workshop-status');
        statusPreviewEl = document.getElementById('workshop-status-preview');
        previewContent = document.getElementById('workshop-preview-content');
        previewPlaceholder = document.getElementById('workshop-preview-placeholder');
        jsonContainer = document.getElementById('workshop-json-container');
        jsonInput = document.getElementById('workshop-json-input');
        jsonGutter = document.getElementById('workshop-json-gutter');
        hintOverlay = document.getElementById('workshop-hint-overlay');
        hintBar = document.getElementById('workshop-hint-bar');
        filenameInput = document.getElementById('workshop-filename-input');

        playBtn = document.getElementById('workshop-play-btn');
        copyBtn = document.getElementById('workshop-copy-btn');
        saveBtn = document.getElementById('workshop-save-btn');

        if (editorInput) {
            setupIDE();
            SmartSuggestion.init(editorInput, hintOverlay, hintBar);

            editorInput.addEventListener('input', () => {
                if (!state.isSyncing) {
                    state.isSyncing = true;
                    generate(true);
                    state.isSyncing = false;
                }
            });

            document.getElementById('workshopStartId')?.addEventListener('input', () => {
                if (!state.isSyncing) {
                    renderPreview(state.currentQuestions);
                    updateSaveButtonState(state.currentQuestions);
                }
            });
        }

        if (filenameInput) {
            filenameInput.addEventListener('input', () => {
                state.originalFileName = filenameInput.value.trim() || null;
                updateSaveButtonState(state.currentQuestions);
            });
        }

        if (jsonInput) {
            setupJsonIDE();
        }

        // Global Drag and Drop
        let dragCounter = 0;
        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            document.body.classList.add('drag-active');
        });

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter--;
            if (dragCounter === 0) {
                document.body.classList.remove('drag-active');
            }
        });

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        window.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            document.body.classList.remove('drag-active');

            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                let handle = null;
                if (e.dataTransfer.items && e.dataTransfer.items[0] && e.dataTransfer.items[0].getAsFileSystemHandle) {
                    try {
                        handle = await e.dataTransfer.items[0].getAsFileSystemHandle();
                    } catch (err) {
                        console.warn("Failed to get FileSystemHandle on drop:", err);
                    }
                }
                handleFileDrop(files[0], handle);
            }
        });

        state.lastSavedJSON = JSON.stringify(state.currentQuestions);
        state.lastSavedFileName = filenameInput ? filenameInput.value.trim() : null;
        state.lastSavedStartId = document.getElementById('workshopStartId')?.value || '1';
        updateSaveButtonState(state.currentQuestions);

        state.isInitialized = true;
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
            buildGutter(lines, getActiveLine(), currentErrors.map(e => e.line));
            editorGutter.scrollTop = editorInput.scrollTop;
        };

        editorInput.addEventListener('input', refreshGutter);
        editorInput.addEventListener('scroll', () => {
            editorGutter.scrollTop = editorInput.scrollTop;
            if (hintOverlay) hintOverlay.scrollTop = editorInput.scrollTop;
        });

        editorGutter.addEventListener('wheel', (e) => {
            editorInput.scrollTop += e.deltaY;
            e.preventDefault();
        }, { passive: false });
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

        editorInput.addEventListener('scroll', () => {
            if (hintOverlay) hintOverlay.scrollTop = editorInput.scrollTop;
        });
    };

    const setupJsonIDE = () => {
        const refreshJsonGutter = () => {
            const lines = jsonInput.value.split('\n').length;
            let html = '';
            for (let i = 1; i <= Math.max(lines, 1); i++) {
                html += `<span class="ide-line-num">${i}</span>`;
            }
            jsonGutter.innerHTML = html;
            jsonGutter.scrollTop = jsonInput.scrollTop;
        };

        jsonInput.addEventListener('input', () => {
            refreshJsonGutter();
            if (!state.isSyncing) {
                state.isSyncing = true;
                onJsonInput();
                state.isSyncing = false;
            }
        });

        jsonInput.addEventListener('scroll', () => {
            jsonGutter.scrollTop = jsonInput.scrollTop;
        });

        ['keyup', 'mouseup', 'click', 'focus'].forEach(ev => jsonInput.addEventListener(ev, refreshJsonGutter));
        refreshJsonGutter();
    };

    const onJsonInput = () => {
        const val = jsonInput.value.trim();
        hideStatus([statusEl, statusPreviewEl]);

        if (!val) {
            state.currentQuestions = [];
            editorInput.value = '';
            renderPreview([]);
            toggleActionButtons([playBtn, copyBtn], false);
            return;
        }

        try {
            const parsed = JSON.parse(val);
            const metadata = parsed.metadata || null;
            const questions = parsed.questions || (Array.isArray(parsed) ? parsed : null);

            if (!questions || !Array.isArray(questions)) {
                throw new Error("JSON must be an array of questions or an object with a 'questions' array.");
            }

            state.currentQuestions = questions;
            if (metadata) {
                if (filenameInput) filenameInput.value = metadata.name || metadata.id || "";
                state.originalFileName = metadata.name || metadata.id || "";
            }

            editorInput.value = reverseGenerate(state.currentQuestions);
            renderPreview(state.currentQuestions);
            toggleActionButtons([playBtn, copyBtn], true);

            const lines = editorInput.value.split('\n').length;
            buildGutter(lines, getActiveLine());
            SmartSuggestion.update();

        } catch (e) {
            showStatus(statusPreviewEl, `Invalid JSON: ${e.message}`, 'error');
            toggleActionButtons([playBtn, copyBtn], false);
        }
    };

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

    const updateSaveButtonState = (questions) => {
        if (!saveBtn) return;
        const currentJSON = JSON.stringify(questions);
        const currentFileName = filenameInput ? filenameInput.value.trim() : null;
        const currentStartId = document.getElementById('workshopStartId')?.value || '1';

        const isJSONDirty = currentJSON !== state.lastSavedJSON;
        const isFileNameDirty = currentFileName !== state.lastSavedFileName;
        const isStartIdDirty = currentStartId !== state.lastSavedStartId;

        const isDirty = isJSONDirty || isFileNameDirty || isStartIdDirty;
        saveBtn.disabled = !isDirty;
        saveBtn.classList.toggle('btn-tool-disabled', !isDirty);
    };

    let currentErrors = [];

    const SmartSuggestion = (() => {
        let _textarea, _overlay, _bar;
        const HINTS = {
            question: { icon: '💬', label: 'Question text', cls: '' },
            optionFirst: { icon: '🅰️', label: 'Option A  —  or type "b" for boolean / "o" for open', cls: '' },
            optionNext: { icon: '➕', label: 'Option B / C / D', cls: '' },
            optionOrAns: { icon: '➕', label: 'Another option (max 4)  or answer index (number)', cls: 'hint-pill-warn' },
            answerIdx: { icon: '✅', label: 'Answer index (0-based number)', cls: 'hint-pill-warn' },
            boolAnswer: { icon: '🔘', label: '0 = False  |  1 = True', cls: 'hint-pill-next' },
            openExpl: { icon: '💡', label: 'Explanation for self-assessment', cls: 'hint-pill-done' },
            explanation: { icon: '💡', label: 'Explanation (optional)  —  or blank line for next question', cls: 'hint-pill-done' },
            nextQ: { icon: '↵', label: 'Blank line to start next question', cls: 'hint-pill-done' },
        };

        const parseBlock = (value, cursorPos) => {
            const allLines = value.split('\n');
            const cursorLineIdx = value.slice(0, cursorPos).split('\n').length - 1;
            let blockStart = cursorLineIdx;
            while (blockStart > 0 && allLines[blockStart - 1].trim() !== '') blockStart--;
            const blockLines = allLines.slice(blockStart, cursorLineIdx + 1);
            const cursorIndexInBlock = cursorLineIdx - blockStart;
            return { blockLines, cursorIndexInBlock };
        };

        const getHint = (blockLines, cursorIndexInBlock) => {
            const trimmed = (i) => (blockLines[i] !== undefined ? blockLines[i].trim() : '');
            const isBoolean = trimmed(1).toLowerCase() === 'b';
            const isOpen = trimmed(1).toLowerCase() === 'o';
            if (isBoolean) {
                if (cursorIndexInBlock === 0) return HINTS.question;
                if (cursorIndexInBlock === 1 || cursorIndexInBlock === 2) return HINTS.boolAnswer;
                return HINTS.explanation;
            }
            if (isOpen) {
                if (cursorIndexInBlock === 0) return HINTS.question;
                return HINTS.openExpl;
            }
            if (cursorIndexInBlock === 0) return HINTS.question;
            if (cursorIndexInBlock === 1) return HINTS.optionFirst;
            let answerLineIdx = -1;
            for (let i = blockLines.length - 1; i >= 1; i--) {
                if (/^\d+$/.test(trimmed(i))) { answerLineIdx = i; break; }
            }
            if (answerLineIdx !== -1 && cursorIndexInBlock >= answerLineIdx) return HINTS.explanation;
            const optionsSoFar = blockLines.slice(1, cursorIndexInBlock).filter(l => !/^\d+$/.test(l.trim())).length;
            if (optionsSoFar < 1) return HINTS.optionFirst;
            if (optionsSoFar === 1) return HINTS.optionNext;
            if (optionsSoFar === 2 || optionsSoFar === 3) return HINTS.optionOrAns;
            return HINTS.answerIdx;
        };

        const renderOverlay = (value, cursorPos, hintText) => {
            if (!_overlay) return;
            const cursorLineIdx = value.slice(0, cursorPos).split('\n').length - 1;
            const allLines = value.split('\n');
            let html = '';
            allLines.forEach((line, i) => {
                const safe = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                if (i < cursorLineIdx) html += safe + '\n';
                else if (i === cursorLineIdx) {
                    const safeHint = hintText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    html += safe + '<span class="hint-ghost">' + safeHint + '</span>\n';
                } else html += safe + '\n';
            });
            _overlay.innerHTML = html;
            _overlay.scrollTop = _textarea.scrollTop;
        };

        const renderBar = (hint) => {
            if (!_bar) return;
            _bar.innerHTML = `<span class="hint-pill ${hint.cls}">${hint.icon} ${hint.label}</span>`;
        };

        const update = () => {
            const value = _textarea.value;
            if (!value) {
                if (_overlay) _overlay.innerHTML = '';
                if (_bar) _bar.classList.add('hidden');
                return;
            }
            if (_bar) _bar.classList.remove('hidden');
            const cursorPos = _textarea.selectionStart;
            const { blockLines, cursorIndexInBlock } = parseBlock(value, cursorPos);
            const lines = value.split('\n');
            const cursorLineIdx = value.slice(0, cursorPos).split('\n').length - 1;
            const cursorLineContent = lines[cursorLineIdx] || '';
            if (cursorLineContent.trim() === '' && blockLines.every(l => l.trim() === '')) {
                const restartHint = HINTS.question;
                renderBar(restartHint);
                renderOverlay(value, cursorPos, '  ← ' + restartHint.icon + ' ' + restartHint.label);
                return;
            }
            const hint = getHint(blockLines, cursorIndexInBlock);
            const afterCursor = cursorPos - value.lastIndexOf('\n', cursorPos - 1) - 1;
            const lineLen = cursorLineContent.length;
            const ghostText = (afterCursor >= lineLen) ? '  ← ' + hint.icon + ' ' + hint.label : '';
            renderOverlay(value, cursorPos, ghostText);
            renderBar(hint);
        };

        const init = (textarea, overlay, bar) => {
            _textarea = textarea; _overlay = overlay; _bar = bar;
            if (!_textarea) return;
            if (_bar) _bar.classList.add('hidden');
            ['input', 'keyup', 'mouseup', 'click', 'focus', 'selectionchange'].forEach(ev => _textarea.addEventListener(ev, update));
        };
        return { init, update };
    })();

    const performReset = () => {
        if (!editorInput) return;
        editorInput.value = '';
        state.currentQuestions = [];
        currentErrors = [];
        const startIdEl = document.getElementById('workshopStartId');
        if (startIdEl) startIdEl.value = '1';
        buildGutter(1, 1);
        hideStatus([statusEl, statusPreviewEl]);
        toggleActionButtons([playBtn, copyBtn], false);
        if (previewPlaceholder) previewPlaceholder.classList.remove('hidden');
        if (previewContent) { previewContent.classList.add('hidden'); previewContent.innerHTML = ''; }
        if (jsonContainer) jsonContainer.classList.add('hidden');
        if (jsonInput) jsonInput.value = '';
        const toggle = document.getElementById('workshop-view-toggle');
        if (toggle) toggle.checked = false;
        if (filenameInput) filenameInput.value = '';
        state.isJsonView = false;
        state.originalFileName = null;
        state.currentFileHandle = null;
        state.lastSavedJSON = null;
        state.lastSavedFileName = null;
        state.lastSavedStartId = '1';
        const alertContainer = document.getElementById('workshop-alert-container');
        if (alertContainer) alertContainer.innerHTML = '';
        state.alertDismissed = false;
        if (window.quizApp && window.quizApp.state.currentSubject) {
            window.quizApp.state.currentSubject.fileHandle = null;
            window.quizApp.state.currentSubject.originalFileName = null;
        }
        SmartSuggestion.update();
    };

    const closeFile = () => {
        const hasContent = (editorInput && editorInput.value.trim() !== '') || (jsonInput && jsonInput.value.trim() !== '') || state.currentQuestions.length > 0;
        if (!hasContent) { performReset(); return; }
        if (confirm("Are you sure you want to close this file? Any unsaved changes will be lost.")) {
            performReset();
            showStatus(statusPreviewEl, 'File closed.', 'success');
        }
    };

    const generate = (isSilent = false) => {
        if (!editorInput) return;
        const input = editorInput.value;
        const startIdStr = document.getElementById('workshopStartId').value;
        currentErrors = [];
        if (!input.trim()) {
            if (!isSilent) showStatus(statusEl, 'Please enter some questions.', 'error');
            else hideStatus([statusEl, statusPreviewEl]);
            toggleActionButtons([playBtn, copyBtn], false);
            renderPreview([]);
            return;
        }
        let startId = parseInt(startIdStr);
        if (isNaN(startId) || startId < 0) { showStatus(statusEl, 'Invalid Starting ID.', 'error'); return; }
        const rawLines = input.split('\n');
        const blocksList = [];
        let currentBlockDeets = [];
        rawLines.forEach((line, idx) => {
            if (line.trim() === '') {
                if (currentBlockDeets.length > 0) { blocksList.push(currentBlockDeets); currentBlockDeets = []; }
            } else currentBlockDeets.push({ text: line.trim(), lineNum: idx + 1 });
        });
        if (currentBlockDeets.length > 0) blocksList.push(currentBlockDeets);
        const jsonOutput = [];
        let currentId = startId;
        const errors = [];
        const errorLineNums = [];
        const mkErr = (lineNum, qNum, text) => { errors.push(`Line ${lineNum} (Q${qNum}): ${text}`); errorLineNums.push(lineNum); currentErrors.push({ line: lineNum, text: text }); };
        blocksList.forEach((linesDetails, index) => {
            const qNum = index + 1;
            if (linesDetails.length < 2) { mkErr(linesDetails[0].lineNum, qNum, `Malformed block (too few lines).`); return; }
            const questionText = linesDetails[0].text;
            const line2Str = linesDetails[1].text.toLowerCase();
            let type = 'multiple';
            if (line2Str === 'b') type = 'boolean';
            else if (line2Str === 'o') type = 'open';
            if (type === 'multiple') {
                if (linesDetails.length < 3) { mkErr(linesDetails[0].lineNum, qNum, `Insufficient content for multiple choice.`); return; }
                let answerIndex = -1, optionLines = [], foundAnswerLineIndex = -1, answerLineNum = -1;
                for (let i = linesDetails.length - 1; i >= 1; i--) {
                    if (/^\d+$/.test(linesDetails[i].text)) { foundAnswerLineIndex = i; answerIndex = parseInt(linesDetails[i].text, 10); answerLineNum = linesDetails[i].lineNum; break; }
                }
                if (foundAnswerLineIndex !== -1) { for (let i = 1; i < foundAnswerLineIndex; i++) optionLines.push(linesDetails[i].text); }
                if (foundAnswerLineIndex === -1) { mkErr(linesDetails[0].lineNum, qNum, `Could not find numeric answer index.`); return; }
                if (optionLines.length < 2 || optionLines.length > 4) { mkErr(linesDetails[1].lineNum, qNum, `Invalid number of options (${optionLines.length}). Must be 2-4.`); return; }
                if (answerIndex < 0 || answerIndex >= optionLines.length) { mkErr(answerLineNum, qNum, `Answer index ${answerIndex} out of bounds.`); return; }
                let questionObj = { id: currentId, type, question: questionText, options: optionLines, answer: answerIndex };
                if (foundAnswerLineIndex + 1 < linesDetails.length) questionObj.explanation = linesDetails.slice(foundAnswerLineIndex + 1).map(l => l.text).join(' ');
                jsonOutput.push(questionObj); currentId++;
            } else if (type === 'open') {
                let questionObj = { id: currentId, type, question: questionText };
                if (linesDetails.length > 1) {
                    questionObj.explanation = linesDetails.slice(1).map(l => l.text).join(' ');
                    if (linesDetails[1].text.toLowerCase() === 'o') questionObj.explanation = linesDetails.slice(2).map(l => l.text).join(' ');
                }
                jsonOutput.push(questionObj); currentId++;
            } else {
                const contentLines = linesDetails.slice(2);
                if (contentLines.length < 1) { mkErr(linesDetails[1].lineNum, qNum, `Missing answer index for boolean.`); return; }
                const answerLineDeet = contentLines[0];
                if (!/^\d+$/.test(answerLineDeet.text)) { mkErr(answerLineDeet.lineNum, qNum, `Expected numeric answer index (0 or 1).`); return; }
                let raw = parseInt(answerLineDeet.text);
                if (raw !== 0 && raw !== 1) { mkErr(answerLineDeet.lineNum, qNum, `Boolean answer index must be 1 (True) or 0 (False).`); return; }
                let questionObj = { id: currentId, type, question: questionText, answer: raw };
                if (contentLines.length > 1) questionObj.explanation = contentLines.slice(1).map(l => l.text).join(' ');
                jsonOutput.push(questionObj); currentId++;
            }
        });
        buildGutter(input.split('\n').length, getActiveLine(), errorLineNums);
        if (errors.length > 0) { showStatus(statusEl, errors.join('<br>'), 'error'); toggleActionButtons([playBtn, copyBtn], false); renderPreview([]); return; }
        hideStatus([statusEl, statusPreviewEl]);
        state.currentQuestions = jsonOutput;
        renderPreview(state.currentQuestions);
        toggleActionButtons([playBtn, copyBtn], true);
        if (!isSilent) showStatus(statusEl, `Successfully parsed ${jsonOutput.length} questions!`, 'success');
    };

    const toggleViewMode = (isJson) => { state.isJsonView = isJson; renderPreview(state.currentQuestions); };

    const renderPreview = (questions) => {
        const alertContainer = document.getElementById('workshop-alert-container');
        if (questions && questions.length > 0) {
            const startIdEl = document.getElementById('workshopStartId');
            const startId = startIdEl ? parseInt(startIdEl.value) || 1 : 1;
            const isNonLinear = checkNonLinearIds(questions, startId);
            if (alertContainer) {
                if (state.alertDismissed || !isNonLinear) alertContainer.innerHTML = '';
                else if (isNonLinear && !alertContainer.querySelector('.reorder-alert')) showReorderSuggestion();
            }
        }
        if (state.isJsonView) {
            previewPlaceholder.classList.add('hidden'); previewContent.classList.add('hidden');
            if (jsonContainer) jsonContainer.classList.remove('hidden');
            if (jsonInput) {
                const jsonStr = JSON.stringify(questions, null, 2);
                if (document.activeElement !== jsonInput && jsonInput.value !== jsonStr) jsonInput.value = jsonStr;
                updateSaveButtonState(questions);
                if (jsonGutter) {
                    const lineCount = jsonInput.value.split('\n').length;
                    let html = '';
                    for (let i = 1; i <= Math.max(lineCount, 1); i++) html += `<span class="ide-line-num">${i}</span>`;
                    jsonGutter.innerHTML = html;
                }
            }
            return;
        }
        previewPlaceholder.classList.add('hidden');
        if (jsonContainer) jsonContainer.classList.add('hidden');
        previewContent.classList.remove('hidden');
        let html = '';
        questions.forEach((q, idx) => {
            let optionsHtml = '';
            if (q.type === 'multiple') {
                q.options.forEach((opt, i) => {
                    const isCorrect = i === q.answer;
                    const bClass = isCorrect ? 'answer-option correct' : 'answer-option';
                    optionsHtml += `<button class="${bClass}" disabled><span>${opt}</span></button>`;
                });
            } else if (q.type === 'open') optionsHtml += `<textarea class="open-answer-input" placeholder="User will insert answer here..." disabled style="margin-top: 4px;"></textarea>`;
            else {
                const isTrueCorrect = q.answer === 1;
                const isFalseCorrect = q.answer === 0;
                optionsHtml += `<button class="answer-option ${isTrueCorrect ? 'correct' : ''}" disabled><span>True</span></button>`;
                optionsHtml += `<button class="answer-option ${isFalseCorrect ? 'correct' : ''}" disabled><span>False</span></button>`;
            }
            let expHtml = q.explanation ? `<div class="callout" style="margin-top: 12px; font-size: 0.85rem;"><span class="callout-icon">💡</span>${q.explanation}</div>` : '';
            html += `<div class="question-card workshop-preview-card" style="margin-bottom: 24px; transform: none; box-shadow: var(--shadow-sm);">
                <div class="question-meta" style="margin-bottom: 12px;"><span class="q-number">Preview Item ${idx + 1}</span><span class="q-id">ID <span class="id-val">${q.id}</span></span></div>
                <h2 class="question-text" style="font-size: 1.1rem; margin-bottom: 16px;">${q.question}</h2>
                <div class="answer-options">${optionsHtml}</div>${expHtml}</div>`;
        });
        previewContent.innerHTML = html;
        updateSaveButtonState(questions);
    };

    const playQuiz = () => {
        if (state.currentQuestions.length === 0) return;
        const inputName = filenameInput ? filenameInput.value.trim() : "";
        const fileName = inputName || "Workshop Quiz";
        window.quizApp.state.currentSubject = { id: 'workshop', name: fileName, icon: '🛠️', color: '#8b5cf6', bg: '#f3e8ff', lang: 'EN', fileHandle: state.currentFileHandle, originalFileName: state.originalFileName };
        window.quizApp.state.flaggedQuestions.clear();
        document.getElementById('selectedSubjectTitle').textContent = fileName;
        document.getElementById('quizSubjectTitle').textContent = fileName;
        window.quizApp.state.allQuestions = state.currentQuestions;
        window.quizApp.state.questions = [...state.currentQuestions];
        window.quizApp.setupSlider();
        window.quizApp.showScreen('questionCountScreen');
    };

    const copyJSON = async () => {
        const payload = wrapQuestionsWithMetadata(state.currentQuestions, filenameInput, state.originalFileName, null, window.quizApp ? window.quizApp.state.subjects : []);
        const jsonString = JSON.stringify(payload, null, 2);
        try { await navigator.clipboard.writeText(jsonString); showStatus(statusPreviewEl, 'JSON copied to clipboard!', 'success'); }
        catch (err) { showStatus(statusPreviewEl, 'Failed to copy JSON.', 'error'); }
    };

    const downloadJSON = () => {
        const payload = wrapQuestionsWithMetadata(state.currentQuestions, filenameInput, state.originalFileName, null, window.quizApp ? window.quizApp.state.subjects : []);
        const jsonString = JSON.stringify(payload, null, 2);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
        let fileName = state.originalFileName || "untitled_quiz";
        if (!fileName.toLowerCase().endsWith('.json')) fileName += '.json';
        const a = document.createElement("a"); a.href = dataStr; a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        state.lastSavedJSON = JSON.stringify(state.currentQuestions);
        state.lastSavedFileName = filenameInput ? filenameInput.value.trim() : null;
        state.lastSavedStartId = document.getElementById('workshopStartId')?.value || '1';
        updateSaveButtonState(state.currentQuestions);
        showStatus(statusPreviewEl, 'Download started!', 'success');
    };

    const handleFileDrop = (file, handle = null) => {
        if (!file.name.toLowerCase().endsWith('.json')) {
            const workshopScreen = document.getElementById('workshopScreen');
            const isWorkshopVisible = workshopScreen && !workshopScreen.classList.contains('hidden');
            const msg = 'Rejected: Only .json files are admitted.';
            if (isWorkshopVisible) showStatus(statusPreviewEl, msg, 'error'); else alert(msg);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = (e.target.result || "").trim();
                if (!content) throw new Error("File is empty.");
                const parsed = JSON.parse(content);
                const questions = parsed.questions || (Array.isArray(parsed) ? parsed : null);
                if (!questions || !Array.isArray(questions)) throw new Error("File content must be a JSON array of questions or an object with a 'questions' array.");
                const metadata = parsed.metadata || null;
                const workshopScreen = document.getElementById('workshopScreen');
                const isWorkshopVisible = workshopScreen && !workshopScreen.classList.contains('hidden');
                if (isWorkshopVisible) { loadQuestions(questions, file.name, handle, metadata); showStatus(statusPreviewEl, `File "${file.name}" opened in Workshop!`, 'success'); }
                else if (window.quizApp) {
                    const fileName = file.name.replace(/\.[^/.]+$/, "");
                    window.quizApp.state.allQuestions = questions; window.quizApp.state.questions = [...questions];
                    window.quizApp.state.currentSubject = metadata || { id: 'dropped', name: fileName, icon: '📂', color: '#6366f1', bg: '#eef2ff', lang: 'EN', originalFileName: fileName, fileHandle: handle };
                    window.quizApp.setupSlider(); window.quizApp.showScreen('questionCountScreen');
                }
            } catch (err) { alert(`Invalid File Content: ${err.message}`); }
        };
        reader.readAsText(file);
    };

    const reorderIds = () => {
        if (!state.currentQuestions || state.currentQuestions.length === 0) return;
        const startIdEl = document.getElementById('workshopStartId');
        const startId = startIdEl ? parseInt(startIdEl.value) || 1 : 1;
        state.currentQuestions = state.currentQuestions.map((q, idx) => ({ ...q, id: startId + idx }));
        state.alertDismissed = false;
        if (editorInput && !state.isJsonView) {
            editorInput.value = reverseGenerate(state.currentQuestions);
            buildGutter(editorInput.value.split('\n').length, getActiveLine()); SmartSuggestion.update();
        } else if (jsonInput && state.isJsonView) jsonInput.value = JSON.stringify(state.currentQuestions, null, 2);
        renderPreview(state.currentQuestions); updateSaveButtonState(state.currentQuestions);
        if (!state.isJsonView) generate(true);
        showStatus(statusPreviewEl, 'IDs reordered sequentially!', 'success');
    };

    const dismissReorderAlert = () => { state.alertDismissed = true; const alertContainer = document.getElementById('workshop-alert-container'); if (alertContainer) alertContainer.innerHTML = ''; };

    const showReorderSuggestion = () => {
        const alertContainer = document.getElementById('workshop-alert-container');
        if (!alertContainer || alertContainer.querySelector('.reorder-alert')) return;
        alertContainer.innerHTML = `<div class="reorder-alert"><div class="reorder-alert-content"><div class="reorder-alert-icon">🔢</div><div class="reorder-alert-text"><div class="reorder-alert-title">Non-linear IDs</div><div class="reorder-alert-desc">Would you like to reorder them?</div></div></div><div class="reorder-alert-actions"><button class="btn-reorder" onclick="WorkshopManager.reorderIds()">Reorder IDs</button><button class="reorder-dismiss-btn" onclick="WorkshopManager.dismissReorderAlert()" title="Dismiss">×</button></div></div>`;
    };

    const loadQuestions = (questions, fileName = null, fileHandle = null, metadata = null) => {
        state.currentQuestions = [...questions];
        currentErrors = []; state.alertDismissed = false;
        const displayName = (metadata && metadata.name) ? metadata.name : (fileName ? fileName.replace(/\.[^/.]+$/, "") : "Untitled Quiz");
        state.lastSavedJSON = JSON.stringify(wrapQuestionsWithMetadata(state.currentQuestions, filenameInput, state.originalFileName, metadata, window.quizApp ? window.quizApp.state.subjects : []));
        state.lastSavedFileName = displayName; state.lastSavedStartId = document.getElementById('workshopStartId')?.value || '1';
        state.originalFileName = displayName; state.currentFileHandle = fileHandle;
        if (filenameInput) filenameInput.value = displayName || '';
        if (editorInput) { editorInput.value = reverseGenerate(state.currentQuestions); buildGutter(editorInput.value.split('\n').length, getActiveLine()); SmartSuggestion.update(); }
        renderPreview(state.currentQuestions); toggleActionButtons([playBtn, copyBtn], true);
        if (window.quizApp && window.quizApp.state.currentSubject) {
            window.quizApp.state.allQuestions = state.currentQuestions; window.quizApp.state.questions = [...state.currentQuestions];
            window.quizApp.state.currentSubject.fileHandle = fileHandle; window.quizApp.state.currentSubject.originalFileName = state.originalFileName;
        }
    };

    const saveJSON = async () => {
        if (!state.isJsonView && editorInput) generate(true);
        if (currentErrors && currentErrors.length > 0) { showStatus(statusPreviewEl, 'Cannot save: Please fix the errors in the editor first.', 'error'); return; }
        if (state.currentQuestions.length === 0) { showStatus(statusPreviewEl, 'Cannot save: No questions in the quiz.', 'error'); return; }
        if (!state.currentFileHandle && window.showSaveFilePicker) {
            try {
                let suggestedName = (state.originalFileName || "untitled_quiz");
                if (!suggestedName.toLowerCase().endsWith('.json')) suggestedName += '.json';
                state.currentFileHandle = await window.showSaveFilePicker({ suggestedName: suggestedName, types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }] });
                if (window.quizApp && window.quizApp.state.currentSubject) { window.quizApp.state.currentSubject.fileHandle = state.currentFileHandle; window.quizApp.state.currentSubject.originalFileName = state.currentFileHandle.name; }
            } catch (err) { if (err.name === 'AbortError') return; }
        }
        if (state.currentFileHandle) {
            try {
                const payload = wrapQuestionsWithMetadata(state.currentQuestions, filenameInput, state.originalFileName, null, window.quizApp ? window.quizApp.state.subjects : []);
                const jsonString = JSON.stringify(payload, null, 2);
                const writable = await state.currentFileHandle.createWritable(); await writable.write(jsonString); await writable.close();
                state.lastSavedJSON = JSON.stringify(payload); state.lastSavedFileName = filenameInput ? filenameInput.value.trim() : null;
                state.lastSavedStartId = document.getElementById('workshopStartId')?.value || '1'; updateSaveButtonState(state.currentQuestions);
                showStatus(statusPreviewEl, 'File saved successfully!', 'success');
            } catch (err) { showStatus(statusPreviewEl, `Failed to save: ${err.message}`, 'error'); }
        } else downloadJSON();
    };

    return { init, hasUnsavedContent, switchTab, generate, clear: () => confirm("Clear all input?") && performReset(), playQuiz, copyJSON, toggleViewMode, loadQuestions, saveJSON, reset: performReset, reorderIds, dismissReorderAlert, closeFile };
})();

window.WorkshopManager = WorkshopManager;
