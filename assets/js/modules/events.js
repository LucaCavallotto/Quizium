/**
 * Event listeners and user interaction setups
 */
import { CONFIG } from './config.js';

export const setupNavigationProtection = (shouldProtect) => {
    window.addEventListener('beforeunload', (e) => {
        if (shouldProtect()) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    });
};

export const initGrillResizer = (grill, resizer) => {
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

        const minWidth = 200;
        const maxWidth = window.innerWidth * 0.6;

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
};

export const setupKeyboardSupport = (handlers) => {
    document.addEventListener('keydown', (e) => {
        if (handlers.shouldIgnore(e)) return;

        if (handlers.handleModal(e)) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            handlers.onEscape();
            return;
        }

        if (e.key === 'f' || e.key === 'F') handlers.onToggleFlag();
        if (e.key === 's' || e.key === 'S') handlers.onToggleGrill();

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            handlers.onNext();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            handlers.onPrev();
        }

        if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key >= '1' && e.key <= '9') {
            handlers.onNumber(parseInt(e.key) - 1);
        }
    });
};
