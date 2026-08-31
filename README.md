# Active Recall Hub

A dynamic and interactive multi-quiz web application for active recall learning. It hosts multiple quizzes across diverse topics and categories within a single platform, featuring customizable question sets, stopwatch and timer modes, instant vs. final correction feedback, a desktop quiz grill navigation sidebar, keyboard shortcuts, and detailed post-quiz answer reviews.

## How the App Works

The application loads subject data dynamically from JSON files located in the `data/` folder.
1. **Discovery**: The app reads a manifest file `data/quizzes.json` to discover available quiz IDs.
2. **Dynamic Metadata**: For each quiz, the app fetches the JSON file and extracts metadata (name, category, icon, color) directly from the file's content.
3. **Home Screen**: Quizzes are automatically grouped by the `category` field defined in their metadata.
4. **Configuration & Mode**: Users can select question count (which defaults automatically to the total maximum available), time modes, and correction modes before starting.

## Time Modes

Select your preferred pacing style before starting the quiz:

- **None**: Take your time! No time tracking or limits.
- **Stopwatch**: Tracks your elapsed time. Good for measuring how fast you can complete the quiz.
- **Timer**: Sets a countdown limit (e.g., 10 minutes).
    - *Auto-Select*: Interacting with the timer slider automatically enables Timer mode.
    - *Timeout*: The quiz automatically ends if the time runs out.
    - *Results*: Shows the actual time taken if you finish early (e.g., if you set 10m but finish in 2m, results show 2m).

## Correction Modes

Choose when to receive feedback on your answers (located in the Setup screen):

- **Instant Correction** (Default):
    - Get immediate feedback after selecting an answer.
    - Correct answers turn Green, wrong answers turn Red.
    - Once selected, the answer is locked and cannot be changed.
    - Question instruction text displays explicit directives (`Select ONE answer:`, `Select ONE or MORE answers:`).
    - Explanations and self-assessment prompts (for open-ended questions) are shown immediately upon confirmation.
- **Final Correction**:
    - No feedback is shown during quiz taking.
    - You can change your selected answer anytime by clicking another option.
    - Selected answers are marked with a neutral blue outline.
    - Scores and incorrect answers are revealed only at the end on the Results screen.
    - Open-ended questions defer self-assessment to **Review Mode**, allowing you to grade your answers after submitting to determine your final score.

## Keyboard Shortcuts

Improve your workflow with these keyboard shortcuts (Desktop):

| Key | Action |
| :--- | :--- |
| **Right Arrow** | Go to the Next Question |
| **Left Arrow** | Go to the Previous Question |
| **Up Arrow** | Jump -10 Questions Backward |
| **Down Arrow** | Jump +10 Questions Forward |
| **Numbers 1-9** | Select Answer Option (1 for 1st, 2 for 2nd, etc.) |
| **Enter** | Confirm/Finish Quiz (when Modal is open) |
| **Backspace** | Cancel/Close Modal (when Modal is open) |
| **Escape** | Exit Quiz or Cancel/Close Modal |
| **f** | Flag/Unflag Question (Final Correction Mode only) |
| **s** | Toggle Quiz Grill visibility |

*Note: Number keys are disabled if the corresponding option is not available or if navigation modifiers (Ctrl/Alt) are held. Navigation/Selection keys are blocked when the confirmation modal is open.*

## Desktop Quiz Grill

The **Quiz Grill** is a powerful navigation sidebar for desktop devices (≥ 1100px) that provides a "bird's-eye view" of your quiz progress:
- **Question Map**: Each dot represents a question (Blue for current, Green for correct, Red for wrong, Yellow for partial/open, and Grey for answered in Final Correction mode).
- **Resizable Sidebar**: Drag the right edge of the Quiz Grill sidebar to adjust its width according to your preference.
- **Zero-Width Collapse**: Press **s** or click the toggle button to smoothly collapse the grill to zero width without pushing layout content.
- **Quick Jump**: Click any dot in the grill to navigate directly to that specific question.
- **Review Progress**: Automatically updates to display active review progress (`x / N`) during answer review mode.

## Finish Confirmation Modal

To prevent accidental submissions, clicking **Finish Quiz** triggers a smart confirmation modal:
- **Unanswered Warning**: Dynamically counts and displays an alert badge (e.g. *"3 unanswered questions remaining"*) if questions are left incomplete.
- **Clean Submission**: If all questions are answered, the warning automatically hides.
- **Theme Support**: Seamlessly styled for both Light and Dark modes.

## Navigation Protection

To prevent accidental data loss, the application includes a browser navigation protection mechanism:
- **Active Quiz**: If you try to reload the page, close the tab, or navigate away while a quiz is in progress, the browser will display a confirmation warning.
- **Safe States**: Navigation protection is disabled when on the Home screen, Setup screens, Results screen, or while Reviewing answers.

## Review Features & Score Syncing

After completing a quiz, you can review your performance:

- **Results Screen**: Displays your score percentage, animated score ring, total time, and exact counts of Correct, Wrong, Skipped, and Total questions.
- **Open-Ended Self-Evaluation Note**: Prompts you to self-evaluate any unconfirmed open-ended answers during review.
- **Review Answers**: Navigate through questions again to inspect your answers, correct answers, and detailed explanations. Clock display is hidden to keep navigation focused.
- **Review Wrong Answers**: Filter to review only missed or skipped questions to focus on weak points.
- **Open-Ended Grading**: Self-evaluate open answers with **Incorrect (`✗`)** on the left and **Correct (`✓`)** on the right.
- **Dynamic Score Recalculation**: Exiting review mode automatically recalculates and syncs your final score, percentage, ring chart, and stats.

## Accessibility & Dark Mode

The application is built with accessibility and visual excellence in mind:
- **Semantic HTML**: Uses HTML5 structure and descriptive unique IDs.
- **ARIA Labels**: Interactive buttons and inputs include labels for screen readers.
- **Keyboard Navigation**: Full support for navigating, selecting, and confirming via keyboard.
- **Dark Mode**: Native CSS variable-driven light and dark mode with automatic system theme adaptation.

## How to add a new subject

To add a new subject to Active Recall Hub, follow these steps:

### 1. Create the Data File

Create a new JSON file in the `data/` folder. The filename should match the subject's unique ID (e.g., `history.json`).

> [!TIP]
> You can use the **Quiz Workshop** (found on the Home Screen) to easily generate the JSON structure or edit existing quizzes.

Quiz files contain `metadata` and a `questions` array.

**JSON Format:**
```json
{
  "metadata": {
    "id": "history",
    "name": "World History",
    "icon": "📜",
    "color": "#d97706",
    "bg": "#fffbeb",
    "language": "EN",
    "category": "History"
  },
  "questions": [
    {
      "id": 1,
      "type": "multiple",
      "question": "Your question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
      "answer": 2,
      "explanation": "Brief explanation of why this answer is correct."
    },
    {
      "id": 2,
      "type": "boolean",
      "question": "True or False?",
      "answer": 1,
      "explanation": "Explanation here."
    },
    {
      "id": 3,
      "type": "open",
      "question": "Open-ended question with code:\n```rust\nlet x = 5;\n```",
      "explanation": "Self-assessment explanation."
    },
    {
      "id": 4,
      "type": "multiselect",
      "question": "Select all that apply:",
      "options": ["Valid", "Invalid", "Also Valid", "Maybe Valid", "Definitely Invalid"],
      "answer": [0, 2, 3],
      "explanation": "0, 2, and 3 are correct."
    },
    {
      "id": 5,
      "type": "match",
      "question": "Match the items to their category:",
      "options": [
        {"value": "cat_a", "text": "Category A"},
        {"value": "cat_b", "text": "Category B"}
      ],
      "pairs": [
        {"left": "First Item", "answer": "cat_a"},
        {"left": "Second Item", "answer": "cat_b"}
      ]
    }
  ]
}
```

- **Metadata Fields**:
  - `id`: Unique identifier (should match filename).
  - `name`: Display name.
  - `icon`: Emoji representing the subject.
  - `color`: Primary accent color for UI elements.
  - `bg`: Soft background color for the subject card.
  - `language`: `'EN'` or `'IT'` for UI labels.
  - `category`: Used to group quizzes on the home screen.

- **Question Fields**:
  - `id`: Unique integer identifier for the question.
  - `type`: `"multiple"` (single choice), `"multiselect"` (multiple checkboxes), `"boolean"` (True/False), `"match"` (dropdown pairs), or `"open"` (open-ended).
  - `question`: The text of the question. Markdown code blocks (e.g., ` ```rust\ncode\n``` `) are supported and styled.
  - `options`: Array of strings for `"multiple"` and `"multiselect"`. For `"match"`, an array of `{value, text}` objects.
  - `answer`: 
    - For `multiple`: Integer index (0-based) of correct option.
    - For `multiselect`: Array of integer indices (e.g., `[0, 2]`).
    - For `boolean`: Integer `0` (False) or `1` (True).
  - `pairs`: Array of `{left, answer}` objects (Required only for `"match"` type).

### 2. Update the Manifest

Open `data/quizzes.json` and add your new quiz ID to the array:

```json
[
  "f1",
  "cs",
  "cnts",
  "history"
]
```

The app will automatically discover the new file, extract its metadata, and present it on the home screen.

## Developer Tools & Quiz Workshop

The **Quiz Workshop** is an integrated suite of tools for content creation and management, accessible directly from the Home Screen or Setup screen.

- **Access**: Click **Quiz Workshop** 🛠️ on the Home Screen, or **Edit Questions** ✏️ on the Setup screen.

**Features:**
1. **Question Builder Tab**:
    - Converts raw text format into structured JSON.
    - Validates types, options, and answer indices.
    - Renders live preview of question layout.

**Builder Input Format (separated by blank lines):**

*Multiple Choice:*
```text
Question Text
Option 1
Option 2
... (Up to 5 options)
0 (Correct Index)
Explanation (Optional)
```

*Boolean:*
```text
Question Text
b (identifies block as boolean)
1 (1 for True, 0 for False)
Explanation (Optional)
```

*Open-ended:*
```text
Question Text
o (identifies block as open-ended)
Self-assessment Explanation
```

*Multiselect:*
```text
Question Text
m (identifies block as multiselect)
Option 1
Option 2
Option 3
0,2 (Comma-separated correct indices)
Explanation (Optional)
```

*Match:*
```text
Question Text
match (identifies block as match)
[val1] First Option Text
[val2] Second Option Text
-- (Separator)
Left Side 1 = val1
Left Side 2 = val2
Explanation (Optional)
```

### Complete Working Example (Copy & Paste into Question Builder)

Below is a complete 5-question text block featuring one working question for every supported type. You can copy and paste this block directly into the **Question Builder** tab to test or build a quiz instantly:

```text
What is the capital of France?
Paris
London
Berlin
Madrid
0
Paris is the capital and largest city of France.

The Earth orbits around the Sun.
b
1
Earth completes one full orbit around the Sun in approximately 365.25 days.

Explain the difference between let, const, and var in JavaScript.
o
let is block-scoped and reassignable, const is block-scoped and immutable, and var is function-scoped.

Which of the following are primary colors?
m
Red
Green
Blue
Yellow
0,2,3
Red, Yellow, and Blue are traditional primary colors.

Match each programming language to its primary paradigm:
match
[fp] Functional Programming
[oo] Object-Oriented Programming
--
Haskell = fp
Java = oo
Haskell is purely functional while Java is object-oriented.
```

2. **Reorder IDs Tab**:
    - Accepts an existing JSON array of questions.
    - Sorts them by their current `id`.
    - Renumbers `id` sequentially starting from 1.
    - Outputs normalized JSON ready for production.


