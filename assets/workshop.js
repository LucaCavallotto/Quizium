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
    let jsonInput;
    let jsonGutter;
    let hintOverlay;
    let hintBar;
    let filenameInput;
    let isJsonView = false;
    let isSyncing = false; // Prevent circular sync loops
    let alertDismissed = false; // Allow users to hide the reorder suggestion

    // Action Buttons
    let playBtn;
    let copyBtn;
    let dlBtn;
    let saveBtn;
    let originalFileName = null;
    let currentFileHandle = null;
    let lastSavedJSON = null;

    const init = () => {
        if (isInitialized) return;

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
        dlBtn = document.getElementById('workshop-dl-btn');
        saveBtn = document.getElementById('workshop-save-btn');

        if (editorInput) {
            setupIDE();
            SmartSuggestion.init(editorInput, hintOverlay, hintBar);

            // Real-time generation from text editor
            editorInput.addEventListener('input', () => {
                if (!isSyncing) {
                    isSyncing = true;
                    generate(true);
                    isSyncing = false;
                }
            });

            document.getElementById('workshopStartId')?.addEventListener('input', () => {
                if (!isSyncing) {
                    renderPreview(currentQuestions);
                }
            });
        }

        if (filenameInput) {
            filenameInput.addEventListener('input', () => {
                originalFileName = filenameInput.value.trim() || null;
            });
        }

        if (jsonInput) {
            setupJsonIDE();
        }

        // Global Drag and Drop
        let dragCounter = 0; // Prevent flickering with children
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
                // Try to get FileSystemHandle if supported
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

        lastSavedJSON = JSON.stringify(currentQuestions);
        updateSaveButtonState(currentQuestions);

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
            if (hintOverlay) hintOverlay.scrollTop = editorInput.scrollTop;
        });

        // Sync scroll from gutter to textarea (wheel/trackpad)
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

        // Keep hint overlay scroll in sync with textarea
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
            if (!isSyncing) {
                isSyncing = true;
                onJsonInput();
                isSyncing = false;
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
        hideStatus(); // Clear phantom errors immediately when typing starts

        if (!val) {
            currentQuestions = [];
            editorInput.value = '';
            renderPreview([]);
            toggleActionButtons(false);
            return;
        }

        try {
            const parsed = JSON.parse(val);
            if (!Array.isArray(parsed)) throw new Error("JSON must be an array of questions.");

            currentQuestions = parsed;
            // Sync back to text editor
            editorInput.value = reverseGenerate(currentQuestions);

            // Update UI/Preview
            renderPreview(currentQuestions);
            toggleActionButtons(true);

            // Re-build text gutter and hints
            const lines = editorInput.value.split('\n').length;
            buildGutter(lines, getActiveLine());
            SmartSuggestion.update();

        } catch (e) {
            showPreviewStatus(`Invalid JSON: ${e.message}`, 'error');
            toggleActionButtons(false);
            // Don't clear preview, just show error
        }
    };

    const reverseGenerate = (questions) => {
        return questions.map(q => {
            let block = `${q.question}\n`;
            if (q.type === 'boolean') {
                block += `b\n${q.answer}`;
            } else {
                q.options.forEach(opt => block += `${opt}\n`);
                block += `${q.answer}`;
            }
            if (q.explanation) {
                block += `\n${q.explanation}`;
            }
            return block;
        }).join('\n\n');
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
        // saveBtn state is managed separately by updateSaveButtonState
    };

    const updateSaveButtonState = (questions) => {
        if (!saveBtn) return;
        const currentJSON = JSON.stringify(questions);
        const isDirty = currentJSON !== lastSavedJSON;
        saveBtn.disabled = !isDirty;

        // Visual feedback for disabled state
        if (!isDirty) {
            saveBtn.classList.add('btn-tool-disabled');
        } else {
            saveBtn.classList.remove('btn-tool-disabled');
        }
    };

    // --- Logic ---
    let currentErrors = [];

    // ── Smart Suggestion Module ──────────────────────────────────────────────
    const SmartSuggestion = (() => {
        let _textarea, _overlay, _bar;

        // Definitions for each hint type
        const HINTS = {
            question: { icon: '💬', label: 'Question text', cls: '' },
            optionFirst: { icon: '🅰️', label: 'Option A  —  or type "b" for boolean', cls: '' },
            optionNext: { icon: '➕', label: 'Option B / C / D', cls: '' },
            optionOrAns: { icon: '➕', label: 'Another option (max 4)  or answer index (number)', cls: 'hint-pill-warn' },
            answerIdx: { icon: '✅', label: 'Answer index (0-based number)', cls: 'hint-pill-warn' },
            boolAnswer: { icon: '🔘', label: '0 = False  |  1 = True', cls: 'hint-pill-next' },
            explanation: { icon: '💡', label: 'Explanation (optional)  —  or blank line for next question', cls: 'hint-pill-done' },
            nextQ: { icon: '↵', label: 'Blank line to start next question', cls: 'hint-pill-done' },
        };

        /**
         * Given the full textarea value and cursor position, extract the lines
         * belonging to the current question block (lines since last blank line up
         * to and including the cursor line).
         * Returns { blockLines, cursorIndexInBlock, cursorLineContent }
         */
        const parseBlock = (value, cursorPos) => {
            const allLines = value.split('\n');
            const cursorLineIdx = value.slice(0, cursorPos).split('\n').length - 1;

            // Walk backwards to find the start of this block
            let blockStart = cursorLineIdx;
            while (blockStart > 0 && allLines[blockStart - 1].trim() !== '') {
                blockStart--;
            }

            // Collect block lines from blockStart up to cursorLineIdx (inclusive)
            const blockLines = allLines.slice(blockStart, cursorLineIdx + 1);
            const cursorIndexInBlock = cursorLineIdx - blockStart;
            const cursorLineContent = allLines[cursorLineIdx];

            return { blockLines, cursorIndexInBlock, cursorLineContent };
        };

        /**
         * Determine which hint applies, given the parsed block context.
         */
        const getHint = (blockLines, cursorIndexInBlock) => {
            const trimmed = (i) => (blockLines[i] !== undefined ? blockLines[i].trim() : '');
            const isBoolean = trimmed(1).toLowerCase() === 'b';

            // ── BOOLEAN path ────────────────────────────────────────────────────
            if (isBoolean) {
                if (cursorIndexInBlock === 0) return HINTS.question;
                if (cursorIndexInBlock === 1) return HINTS.boolAnswer;  // still on "b" line or just after
                if (cursorIndexInBlock === 2) return HINTS.boolAnswer;  // answer line
                return HINTS.explanation; // line 3+
            }

            // ── MULTIPLE CHOICE path ─────────────────────────────────────────
            if (cursorIndexInBlock === 0) return HINTS.question;
            if (cursorIndexInBlock === 1) return HINTS.optionFirst;

            // Count options: lines 1..last that are NOT a pure number
            // The answer index is the LAST pure-number line
            let answerLineIdx = -1;
            for (let i = blockLines.length - 1; i >= 1; i--) {
                if (/^\d+$/.test(trimmed(i))) {
                    answerLineIdx = i;
                    break;
                }
            }

            // If the cursor is ON the answer line or after it → explanation hint
            if (answerLineIdx !== -1 && cursorIndexInBlock >= answerLineIdx) {
                return HINTS.explanation;
            }

            // Count options so far (lines 1..cursorIndexInBlock, excluding pure digits)
            const optionsSoFar = blockLines.slice(1, cursorIndexInBlock).filter(l => !/^\d+$/.test(l.trim())).length;

            if (optionsSoFar < 1) return HINTS.optionFirst;
            if (optionsSoFar === 1) return HINTS.optionNext;   // Need option B at minimum
            if (optionsSoFar === 2) return HINTS.optionOrAns;  // Can add C or answer
            if (optionsSoFar === 3) return HINTS.optionOrAns;  // Can add D or answer
            // 4 options filled — must give answer index
            return HINTS.answerIdx;
        };

        /**
         * Render ghost text inside the overlay div.
         * We build an HTML string: for each line before the cursor we output a
         * span with the text (in transparent colour), and on the cursor line we
         * append the ghost hint after the user's text.
         */
        const renderOverlay = (value, cursorPos, hintText) => {
            if (!_overlay) return;
            const cursorLineIdx = value.slice(0, cursorPos).split('\n').length - 1;
            const allLines = value.split('\n');

            let html = '';
            allLines.forEach((line, i) => {
                // Escape html special chars to prevent XSS
                const safe = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                if (i < cursorLineIdx) {
                    html += safe + '\n';
                } else if (i === cursorLineIdx) {
                    const safeHint = hintText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    html += safe + '<span class="hint-ghost">' + safeHint + '</span>\n';
                } else {
                    html += safe + '\n';
                }
            });
            _overlay.innerHTML = html;
            // Keep scroll in sync
            _overlay.scrollTop = _textarea.scrollTop;
        };

        /**
         * Render hint bar pill.
         */
        const renderBar = (hint) => {
            if (!_bar) return;
            _bar.innerHTML = `<span class="hint-pill ${hint.cls}">${hint.icon} ${hint.label}</span>`;
        };

        /**
         * Main update function — called on every textarea event.
         */
        const update = () => {
            const value = _textarea.value;

            // Hide everything when empty
            if (!value) {
                if (_overlay) _overlay.innerHTML = '';
                if (_bar) _bar.classList.add('hidden');
                return;
            }

            if (_bar) _bar.classList.remove('hidden');

            const cursorPos = _textarea.selectionStart;
            const { blockLines, cursorIndexInBlock } = parseBlock(value, cursorPos);

            // If cursor is ON a blank line (between blocks), show restart hint
            const cursorLineContent = value.split('\n')[value.slice(0, cursorPos).split('\n').length - 1];
            if (cursorLineContent.trim() === '' && blockLines.every(l => l.trim() === '')) {
                const restartHint = HINTS.question;
                renderBar(restartHint);
                renderOverlay(value, cursorPos, '  ← ' + restartHint.icon + ' ' + restartHint.label);
                return;
            }

            const hint = getHint(blockLines, cursorIndexInBlock);

            // Only show ghost text if the current line is "active" (cursor at EOL)
            const lines = value.split('\n');
            const cursorLineIdx = value.slice(0, cursorPos).split('\n').length - 1;
            const afterCursor = cursorPos - value.lastIndexOf('\n', cursorPos - 1) - 1;
            const lineLen = lines[cursorLineIdx] ? lines[cursorLineIdx].length : 0;
            const ghostText = (afterCursor >= lineLen) ? '  ← ' + hint.icon + ' ' + hint.label : '';

            renderOverlay(value, cursorPos, ghostText);
            renderBar(hint);
        };

        const init = (textarea, overlay, bar) => {
            _textarea = textarea;
            _overlay = overlay;
            _bar = bar;

            if (!_textarea) return;

            // Hide bar initially
            if (_bar) _bar.classList.add('hidden');

            const events = ['input', 'keyup', 'mouseup', 'click', 'focus', 'selectionchange'];
            events.forEach(ev => _textarea.addEventListener(ev, update));
        };

        return { init, update };
    })();

    const performReset = () => {
        if (!editorInput) return;
        editorInput.value = '';
        currentQuestions = [];
        currentErrors = [];
        const startIdEl = document.getElementById('workshopStartId');
        if (startIdEl) startIdEl.value = '1';
        buildGutter(1, 1);
        hideStatus();
        toggleActionButtons(false);

        if (previewPlaceholder) previewPlaceholder.classList.remove('hidden');
        if (previewContent) {
            previewContent.classList.add('hidden');
            previewContent.innerHTML = '';
        }
        if (jsonContainer) jsonContainer.classList.add('hidden');
        if (jsonInput) jsonInput.value = '';

        const toggle = document.getElementById('workshop-view-toggle');
        if (toggle) toggle.checked = false;
        if (filenameInput) filenameInput.value = '';
        isJsonView = false;
        originalFileName = null;
        currentFileHandle = null;
        lastSavedJSON = null;

        // Clear alert dismissal state
        alertDismissed = false;

        // Keep app state in sync
        if (window.quizApp && window.quizApp.state.currentSubject) {
            window.quizApp.state.currentSubject.fileHandle = null;
            window.quizApp.state.currentSubject.originalFileName = null;
        }

        // Reset smart suggestion state immediately
        if (typeof SmartSuggestion !== 'undefined' && SmartSuggestion.update) {
            SmartSuggestion.update();
        }
    };

    const closeFile = () => {
        const hasContent = (editorInput && editorInput.value.trim() !== '') ||
            (jsonInput && jsonInput.value.trim() !== '') ||
            currentQuestions.length > 0;

        if (!hasContent) {
            performReset();
            return;
        }

        if (confirm("Are you sure you want to close this file? Any unsaved changes will be lost.")) {
            performReset();
            showPreviewStatus('File closed.', 'success');
        }
    };

    const reset = () => {
        performReset();
    };

    const clear = () => {
        if (!editorInput) return;
        if (confirm("Clear all input?")) {
            performReset();
        }
    };

    const generate = (isSilent = false) => {
        if (!editorInput) return;
        const input = editorInput.value;
        const startIdStr = document.getElementById('workshopStartId').value;

        // Reset error state
        currentErrors = [];

        if (!input.trim()) {
            if (!isSilent) showStatus('Please enter some questions.', 'error');
            else hideStatus(); // Clear previous errors if the input is now empty
            toggleActionButtons(false);
            renderPreview([]);
            return;
        }

        let startId = parseInt(startIdStr);
        if (isNaN(startId) || startId < 0) {
            showStatus('Invalid Starting ID.', 'error');
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
            showStatus(errors.join('<br>'), 'error');
            toggleActionButtons(false);
            renderPreview([]); // Clear preview on error
            return;
        }

        // Fixed! Clear any existing error messages
        hideStatus();

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
        // Always render preview to update visibility of placeholders/inputs
        renderPreview(currentQuestions);
    };

    // --- Preview Rendering ---
    const renderPreview = (questions) => {
        const alertContainer = document.getElementById('workshop-alert-container');
        if (alertContainer) alertContainer.innerHTML = '';

        if ((!questions || questions.length === 0) && !isJsonView) {
            previewPlaceholder.classList.remove('hidden');
            previewContent.classList.add('hidden');
            if (jsonContainer) jsonContainer.classList.add('hidden');
            if (jsonInput) {
                jsonInput.value = '';
            }
            updateSaveButtonState(questions || []);
            return;
        }

        // Show reorder suggestion if needed and not dismissed
        // This now happens before the isJsonView return so it's visible in both views
        if (!alertDismissed && checkNonLinearIds(questions)) {
            showReorderSuggestion();
        }

        if (isJsonView) {
            previewPlaceholder.classList.add('hidden');
            previewContent.classList.add('hidden');
            if (jsonContainer) jsonContainer.classList.remove('hidden');
            if (jsonInput) {
                const jsonStr = JSON.stringify(questions, null, 2);
                // Update if not typing, or if content is significantly different
                if (document.activeElement !== jsonInput && jsonInput.value !== jsonStr) {
                    jsonInput.value = jsonStr;
                }

                updateSaveButtonState(questions);

                // Construct JSON Gutter
                if (jsonGutter) {
                    const lineCount = jsonInput.value.split('\n').length;
                    let html = '';
                    for (let i = 1; i <= Math.max(lineCount, 1); i++) {
                        html += `<span class="ide-line-num">${i}</span>`;
                    }
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
        updateSaveButtonState(questions);
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

        let fileName = originalFileName || "untitled_quiz";
        if (!fileName.toLowerCase().endsWith('.json')) {
            fileName += '.json';
        }

        const a = document.createElement("a");
        a.href = dataStr;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        lastSavedJSON = jsonString;
        updateSaveButtonState(currentQuestions);
        showPreviewStatus('Download started!', 'success');
    };

    const handleFileDrop = (file, handle = null) => {
        if (!file.name.toLowerCase().endsWith('.json')) {
            const workshopScreen = document.getElementById('workshopScreen');
            const isWorkshopVisible = workshopScreen && !workshopScreen.classList.contains('hidden');
            const msg = 'Rejected: Only .json files are admitted.';
            if (isWorkshopVisible) {
                showPreviewStatus(msg, 'error');
            } else {
                alert(msg);
            }
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = (e.target.result || "").trim();
                if (!content) throw new Error("File is empty.");
                const parsed = JSON.parse(content);
                if (!Array.isArray(parsed)) throw new Error("File content must be a JSON array of questions.");

                // Check where we are to decide destination
                const workshopScreen = document.getElementById('workshopScreen');
                const isWorkshopVisible = workshopScreen && !workshopScreen.classList.contains('hidden');

                if (isWorkshopVisible) {
                    // Success! Load it in workshop
                    loadQuestions(parsed, file.name, handle);
                    showPreviewStatus(`File "${file.name}" opened in Workshop!`, 'success');
                } else {
                    // We are likely in main-content. Open in quizApp
                    if (window.quizApp) {
                        const fileName = file.name.replace(/\.[^/.]+$/, "");
                        window.quizApp.state.allQuestions = parsed;
                        window.quizApp.state.questions = [...parsed];
                        window.quizApp.state.currentSubject = {
                            id: 'dropped',
                            name: fileName,
                            icon: '📂',
                            color: '#6366f1',
                            bg: '#eef2ff',
                            lang: 'EN',
                            originalFileName: fileName,
                            fileHandle: handle
                        };
                        window.quizApp.setupSlider();
                        window.quizApp.showScreen('questionCountScreen');
                    } else {
                        // Fallback: just open workshop
                        loadQuestions(parsed, file.name, handle);
                        if (window.quizApp) window.quizApp.showScreen('workshopScreen');
                    }
                }
            } catch (err) {
                const workshopScreen = document.getElementById('workshopScreen');
                const isWorkshopVisible = workshopScreen && !workshopScreen.classList.contains('hidden');

                const msg = `Invalid File Content: ${err.message}`;
                if (isWorkshopVisible) {
                    showPreviewStatus(msg, 'error');
                } else {
                    alert(msg);
                }
            }
        };
        reader.onerror = () => {
            const workshopScreen = document.getElementById('workshopScreen');
            const isWorkshopVisible = workshopScreen && !workshopScreen.classList.contains('hidden');
            const msg = 'Error reading file.';
            if (isWorkshopVisible) {
                showPreviewStatus(msg, 'error');
            } else {
                alert(msg);
            }
        };
        reader.readAsText(file);
    };

    const checkNonLinearIds = (questions) => {
        if (!questions || questions.length === 0) return false;

        const startIdEl = document.getElementById('workshopStartId');
        const startId = startIdEl ? parseInt(startIdEl.value) || 1 : 1;

        for (let i = 0; i < questions.length; i++) {
            if (parseInt(questions[i].id) !== startId + i) {
                return true;
            }
        }
        return false;
    };

    const reorderIds = () => {
        if (!currentQuestions || currentQuestions.length === 0) return;

        const startIdEl = document.getElementById('workshopStartId');
        const startId = startIdEl ? parseInt(startIdEl.value) || 1 : 1;

        currentQuestions = currentQuestions.map((q, idx) => ({
            ...q,
            id: startId + idx
        }));

        // Reset alert state on manual fix
        alertDismissed = false;

        // Update editor and preview
        if (editorInput && !isJsonView) {
            editorInput.value = reverseGenerate(currentQuestions);
            const lines = editorInput.value.split('\n').length;
            buildGutter(lines, getActiveLine());
            SmartSuggestion.update();
        } else if (jsonInput && isJsonView) {
            jsonInput.value = JSON.stringify(currentQuestions, null, 2);
            const lines = jsonInput.value.split('\n').length;
            if (jsonGutter) {
                let html = '';
                for (let i = 1; i <= Math.max(lines, 1); i++) {
                    html += `<span class="ide-line-num">${i}</span>`;
                }
                jsonGutter.innerHTML = html;
            }
        }

        renderPreview(currentQuestions);
        updateSaveButtonState(currentQuestions);

        // Ensure internal state consistency
        if (!isJsonView) generate(true);

        showPreviewStatus('IDs reordered sequentially!', 'success');
    };

    const dismissReorderAlert = () => {
        alertDismissed = true;
        const alertContainer = document.getElementById('workshop-alert-container');
        if (alertContainer) alertContainer.innerHTML = '';
    };

    const showReorderSuggestion = () => {
        const alertContainer = document.getElementById('workshop-alert-container');
        if (!alertContainer) return;

        // Prevent duplicate alerts
        if (alertContainer.querySelector('.reorder-alert')) return;

        alertContainer.innerHTML = `
            <div class="reorder-alert">
                <div class="reorder-alert-content">
                    <div class="reorder-alert-icon">🔢</div>
                    <div class="reorder-alert-text">
                        <div class="reorder-alert-title">Non-linear IDs Detected</div>
                        <div class="reorder-alert-desc">The question IDs aren't sequential. Would you like to fix them automatically?</div>
                    </div>
                </div>
                <div class="reorder-alert-actions">
                    <button class="btn-reorder" onclick="WorkshopManager.reorderIds()">
                        <span>🪄</span> Reorder Now
                    </button>
                    <button class="btn-tool btn-tool-outline" style="padding: 6px 14px; font-size: 0.82rem;" onclick="WorkshopManager.dismissReorderAlert()">Dismiss</button>
                </div>
            </div>
        `;
    };

    const loadQuestions = (questions, fileName = null, fileHandle = null) => {
        currentQuestions = [...questions];
        currentErrors = []; // Clear any previous errors
        alertDismissed = false; // Reset dismissal on new file load
        lastSavedJSON = JSON.stringify(currentQuestions);

        // Strip extension if present for display
        const displayName = fileName ? fileName.replace(/\.[^/.]+$/, "") : null;
        originalFileName = displayName;
        currentFileHandle = fileHandle;

        if (filenameInput) {
            filenameInput.value = displayName || '';
        }

        if (editorInput) {
            editorInput.value = reverseGenerate(currentQuestions);
            const lines = editorInput.value.split('\n').length;
            buildGutter(lines, getActiveLine());
            SmartSuggestion.update();
        }

        renderPreview(currentQuestions);
        toggleActionButtons(true);

        // Keep app state in sync
        if (window.quizApp && window.quizApp.state.currentSubject) {
            window.quizApp.state.allQuestions = currentQuestions;
            window.quizApp.state.questions = [...currentQuestions];
            window.quizApp.state.currentSubject.fileHandle = fileHandle;
            window.quizApp.state.currentSubject.originalFileName = originalFileName;
        }
    };

    const saveJSON = async () => {
        // Validation check without reordering
        if (!isJsonView && editorInput) {
            generate(true);
        }

        // Check for syntax or logic errors
        if (currentErrors && currentErrors.length > 0) {
            showPreviewStatus('Cannot save: Please fix the errors in the editor first.', 'error');
            return;
        }

        if (currentQuestions.length === 0) {
            showPreviewStatus('Cannot save: No questions in the quiz.', 'error');
            return;
        }

        // If no handle, try to get one via showSaveFilePicker
        if (!currentFileHandle && window.showSaveFilePicker) {
            try {
                let suggestedName = (originalFileName || "untitled_quiz");
                if (!suggestedName.toLowerCase().endsWith('.json')) suggestedName += '.json';

                currentFileHandle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] },
                    }],
                });

                // Sync back to QuizApp state
                if (window.quizApp && window.quizApp.state.currentSubject) {
                    window.quizApp.state.currentSubject.fileHandle = currentFileHandle;
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error("Failed to get save handle:", err);
            }
        }

        if (currentFileHandle) {
            try {
                const jsonString = JSON.stringify(currentQuestions, null, 2);
                if (!jsonString || jsonString.trim() === '') {
                    throw new Error("Generated JSON is empty.");
                }
                const writable = await currentFileHandle.createWritable();
                await writable.write(jsonString);
                await writable.close();
                lastSavedJSON = jsonString;
                updateSaveButtonState(currentQuestions);
                showPreviewStatus('File saved successfully!', 'success');
            } catch (err) {
                console.error("Failed to save file:", err);
                showPreviewStatus(`Failed to save: ${err.message}`, 'error');
                if (confirm("Direct save failed. Download instead?")) {
                    downloadJSON();
                }
            }
        } else {
            // Last fallback if API not supported or cancelled
            downloadJSON();
        }
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
        toggleViewMode,
        loadQuestions,
        saveJSON,
        reset,
        reorderIds,
        dismissReorderAlert,
        closeFile
    };
})();
