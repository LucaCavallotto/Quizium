/**
 * UI rendering and DOM manipulation
 */
import { CONFIG } from './config.js';

export const showScreen = (screenId) => {
    Object.values(CONFIG.SCREENS).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
};

export const renderSubjectCard = (container, subject, count, onClick) => {
    const icon = subject.icon || '📝';
    const color = subject.color || '#6b7280';
    const bg = subject.bg || '#f3f4f6';

    const card = document.createElement('div');
    card.className = 'subject-card';
    card.style.setProperty('--card-color', color);
    card.style.setProperty('--card-bg-light', bg);

    card.onclick = onClick;

    card.innerHTML = `
        <div class="card-icon">${icon}</div>
        <div class="card-content">
            <h3 class="card-title">${subject.name}</h3>
            <div class="card-stats"><span>${count} Questions</span></div>
        </div>
        <div class="card-action">→</div>
    `;
    container.appendChild(card);
};

export const updateProgressBar = (answeredCount, total) => {
    const progress = total > 0 ? (answeredCount / total) * 100 : 0;
    const bar = document.getElementById(CONFIG.SELECTORS.PROGRESS_BAR);
    if (bar) bar.style.width = `${progress}%`;
};

export const showStatus = (element, msg, type) => {
    if (!element) return;
    element.innerHTML = msg;
    element.className = `workshop-status ${type}`;
    if (type === 'success') {
        setTimeout(() => {
            element.classList.add('hidden');
        }, 3000);
    }
};

export const hideStatus = (elements) => {
    elements.forEach(el => {
        if (el) el.classList.add('hidden');
    });
};

export const toggleActionButtons = (buttons, enabled) => {
    buttons.forEach(btn => {
        if (btn) btn.disabled = !enabled;
    });
};
