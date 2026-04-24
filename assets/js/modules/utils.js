/**
 * Utility functions for the Quiz application
 */

export const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

export const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const checkNonLinearIds = (questions, startId = 1) => {
    if (!questions || questions.length === 0) return false;
    for (let i = 0; i < questions.length; i++) {
        if (parseInt(questions[i].id) !== startId + i) {
            return true;
        }
    }
    return false;
};

export const reverseGenerate = (questions) => {
    return questions.map(q => {
        let block = `${q.question}\n`;
        if (q.type === 'boolean') {
            block += `b\n${q.answer}`;
        } else if (q.type === 'open') {
            block += `o\n${q.explanation || ''}`;
        } else {
            q.options.forEach(opt => block += `${opt}\n`);
            block += `${q.answer}`;
        }
        if (q.explanation && q.type !== 'open') {
            block += `\n${q.explanation}`;
        }
        return block;
    }).join('\n\n');
};

/**
 * Internal helper to wrap questions in the new metadata structure
 */
export const wrapQuestionsWithMetadata = (questions, filenameInput, originalFileName, explicitMetadata = null, subjects = []) => {
    const currentName = filenameInput ? filenameInput.value.trim() : (originalFileName || "Untitled Quiz");
    let metadata = explicitMetadata;

    if (!metadata) {
        // Try to find if this matches an existing subject
        const existingSubject = subjects.find(s => s.name === currentName || s.id === (originalFileName || "").toLowerCase());

        if (existingSubject) {
            metadata = { ...existingSubject };
            delete metadata.questions; // In case it's there
        } else {
            metadata = {
                id: (originalFileName || currentName).toLowerCase().replace(/[^a-z0-9]/g, '_'),
                name: currentName,
                icon: '🛠️',
                color: '#8b5cf6',
                bg: '#f3e8ff',
                language: 'EN',
                category: 'Other'
            };
        }
    }

    return {
        metadata: metadata,
        questions: questions
    };
};
