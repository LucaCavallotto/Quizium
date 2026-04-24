/**
 * Data loading and fetching logic
 */
import { CONFIG } from './config.js';

export const fetchManifest = async () => {
    try {
        const response = await fetch(`${CONFIG.PATHS.DATA}quizzes.json`);
        if (response.ok || response.status === 0) {
            return await response.json();
        }
        throw new Error('Manifest fetch failed');
    } catch (error) {
        console.warn('Failed to load quiz manifest, using fallback list:', error);
        return ['f1', 'cs', 'cnts'];
    }
};

export const fetchQuiz = async (fileId) => {
    try {
        const response = await fetch(`${CONFIG.PATHS.DATA}${fileId}.json`);
        if (response.ok || response.status === 0) {
            return await response.json();
        }
        throw new Error(`Failed to load quiz file ${fileId}`);
    } catch (error) {
        console.error(`Error loading quiz file ${fileId}:`, error);
        return null;
    }
};

export const parseQuizData = (data, fileId) => {
    // Support both new structure (with metadata) and legacy structure (array)
    const metadata = data.metadata || { 
        id: fileId, 
        name: fileId.charAt(0).toUpperCase() + fileId.slice(1), 
        category: 'Other' 
    };
    const questions = data.questions || data;
    return { metadata, questions };
};

export const validateQuizFile = (data) => {
    const questions = data.questions || (Array.isArray(data) ? data : null);
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        throw new Error("Invalid Quiz File: Not a valid array of questions.");
    }

    // Check signature on first question
    const firstQ = questions[0];
    if (!firstQ || (!firstQ.hasOwnProperty('question') || !firstQ.hasOwnProperty('type') || !firstQ.hasOwnProperty('answer'))) {
        throw new Error("Invalid Quiz File: Missing required question properties.");
    }

    return questions;
};
