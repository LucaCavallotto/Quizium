# Project Overview

**Quizium** is a high-performance, dynamic quiz application built with vanilla JavaScript. It offers a premium, interactive experience for testing knowledge across various subjects without the overhead of heavy frameworks. The app features real-time feedback, multiple timing modes (Stopwatch/Timer), and a specialized **Quiz Workshop** for seamless content creation and validation.

---

# Technical Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | Web Browser | Client-side execution (ES6+) |
| **Logic** | Vanilla JavaScript | Modular class-based state management |
| **Structure** | HTML5 | Semantic markup with multi-screen containerization |
| **Styling** | Modular CSS | Variable-driven Design System with Dark Mode support |
| **Typography** | Google Fonts | Inter (wght 400-800) |
| **Data** | JSON | Data-driven architecture via manifest discovery |

---

# Workflow & Rules

### Commands & Development
- **Local Dev**: Run via any local HTTP server (e.g., `live-server`, `python -m http.server`, or VS Code Live Server extension).
- **Deployment**: Static hosting (GitHub Pages). No build step required.
- **Data Updates**: Add JSON quiz files to `/data/` and update `data/quizzes.json` manifest.

### Coding standards
- **Patterns**:
    - **Class-Based Architecture**: Use the `QuizApp` (and `WorkshopManager`) classes to encapsulate logic. Avoid global variables outside the main instances.
    - **Configuration Object**: Maintain `CONFIG` at the top of the file for screen IDs, paths, and element selectors.
    - **Global Mapping**: Explicitly bind class methods to the `window` object via `bindGlobalEvents()` for access from the HTML.
- **Naming**: Use `camelCase` for JavaScript variables/functions and `kebab-case` for CSS classes.
- **State Management**: Access all session-specific data via `this.state` within the class instance.
- **Performance**: Use `async/await` for all IO operations (fetching JSON, file system access).

### Documentation & Commits
- **Commits**: Concise, imperative, and descriptive (e.g., `feat: add open-ended question type`).
- **Comments**: Focus on the *why*, not the *how*. Preserve existing JSDoc-style documentation.

---

# Design System & UI

### Styling System
The project uses **pure CSS variables** defined in `variables.css` for theme consistency. 
- **Palette**: Primary `#6366f1` (Indigo), Success `#10b981`, Error `#ef4444`.
- **Dark Mode**: Automatic support via `prefers-color-scheme` media query.
- **Layout**: Flexible CSS Grid and Flexbox for responsiveness across mobile and desktop.

### User Interface
- **Micro-animations**: Subtle transitions on button hovers and screen switches.
- **Icons**: Mix of native emojis and optimized SVG paths for UI actions.
- **Components**: Custom-built toggles, range sliders, and modal overlays.

---

# Architecture

```text
/
├── index.html              # Main application shell (multi-screen container)
├── README.md               # User-facing documentation
├── GEMINI.md               # AI collaborator context guide [THIS FILE]
├── data/
│   ├── quizzes.json        # Discovery manifest
│   └── [id].json           # Self-describing quiz data (metadata + questions)
└── assets/
    ├── app.js              # State engine: Handles quiz flow, scoring, and UI sync
    ├── workshop.js         # IDE-like content management tool
    └── css/
        ├── variables.css   # Single source of truth for design tokens
        ├── layout.css      # Core grid and container definitions
        ├── components.css  # Atomic UI elements (btn, toggle, slider)
        ├── screens.css     # Navigation-level styling
        └── workshop.css    # Specialized tool styling
```

---

# Lessons Learned

- **Navigation Protection**: The `beforeunload` listener prevents data loss during active quizzes or unsaved workshop sessions.
- **Dynamic Discovery**: Quizzes are self-describing; the app reads `metadata` directly from quiz JSONs, allowing for zero-code subject additions.
- **State Separation**: Isolating `allQuestions` (pool) from `questions` (current session) ensures sampling and shuffling don't mutate source data.
- **Grill Navigation**: The "Quiz Grill" uses a sidebar layout on desktop for better visibility, with a custom resizer for user preference.
- **Correction Logic**: Separating `Instant` vs `Final` correction modes requires strict tracking of locked vs. mutable answers in `this.state`.
