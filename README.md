# Quizium

Quizium is a dynamic and interactive quiz application that allows users to test their knowledge on various subjects. The app is built with HTML, CSS, and vanilla JavaScript.

## How the App Works

The application loads subject data dynamically from JSON files located in the `data/` folder.
1.  **Discovery**: The app reads a manifest file `data/quizzes.json` to discover available quiz IDs.
2.  **Dynamic Metadata**: For each quiz, the app fetches the JSON file and extracts metadata (name, category, icon, color) directly from the file's content.
3.  **Home Screen**: Quizzes are automatically grouped by the `category` field defined in their metadata.
4.  **Configuration & Mode**: Users can select question count, time modes, and correction modes before starting.

## Time Modes

Select your preferred pacing style before starting the quiz:

-   **None**: Take your time! No time tracking or limits.
-   **Stopwatch**: Tracks your elapsed time. Good for measuring how fast you can complete the quiz.
-   **Timer**: Sets a countdown limit (e.g., 10 minutes).
    -   *Auto-Select*: Interacting with the timer slider automatically enables Timer mode.
    -   *Timeout*: The quiz automatically ends if the time runs out.
    -   *Results*: Shows the actual time taken if you finish early (e.g., if you set 10m but finish in 2m, results show 2m).

## Correction Modes

Choose when to receive feedback on your answers (located in the Setup screen):

-   **Instant Correction** (Default):
    -   Get immediate feedback after selecting an answer.
    -   Correct answers turn Green, wrong answers turn Red.
    -   Once selected, the answer is locked and cannot be changed.
    -   Explanations are shown immediately.
-   **Final Correction**:
    -   No feedback is shown during the quiz.
    -   You can change your selected answer by clicking another option.
    -   Selected answers are marked with a neutral blue outline.
    -   Scores and incorrect answers are revealed only at the end.

## Keyboard Shortcuts

Improve your workflow with these keyboard shortcuts (Desktop):

| Key | Action |
| :--- | :--- |
| **Right Arrow** | Go to the Next Question |
| **Left Arrow** | Go to the Previous Question |
| **Numbers 1-9** | Select Answer Option (1 for 1st, 2 for 2nd, etc.) |
| **Enter** | Confirm/Finish Quiz (when Modal is open) |
| **Backspace** | Cancel/Close Modal (when Modal is open) |
| **Escape** | Exit Quiz or Cancel/Close Modal |
| **f** | Flag/Unflag Question (Final Correction Mode only) |
| **s** | Toggle Quiz Grill visibility |

*Note: Number keys are disabled if the corresponding option is not available or if navigation modifiers (Ctrl/Alt) are held. Navigation/Selection keys are blocked when the confirmation modal is open.*

## Quiz Grill (Desktop Only)

The **Quiz Grill** is a powerful navigation sidebar that provides a "bird's-eye view" of your quiz progress:
-   **Question Map**: Each dot represent a question. Blue for current, Green for correct, Red for wrong, and Grey for answered (in Final Correction mode).
-   **Quick Jump**: Click any dot in the grill to navigate directly to that specific question.
-   **Live Progress**: Tracks the number of completed questions in real-time.
-   **Toggle Visibility**: Use the grid icon in the bottom-right corner of the screen to show or hide the grill sidebar.


## Navigation Protection

To prevent accidental data loss, the application includes a protection mechanism:
-   **Active Quiz**: If you try to reload the page, close the tab, or navigate away while a quiz is in progress, the browser will display a confirmation dialog.
-   **Safe States**: Navigation is free (no warning) when on the Home screen, Setup screens, Results screen, or while Reviewing answers.

## Review Features

After completing a quiz, you can review your performance:

-   **Results Screen**: Displays your score percentage, total time, and a breakdown of correct/incorrect answers.
-   **Review Answers**: Click the "Review Answers" button on the results screen to navigate through the questions again.
    -   See exactly what you answered vs. the correct answer.
    -   Read detailed explanations for each question.
-   **Review Wrong Answers**: A specific mode to review only the questions you missed.
    -   Focus your study time on weak points.
    -   Visible only if you have incorrectly answered questions.

## Accessibility

The application is built with accessibility in mind:
-   **Semantic HTML**: Uses proper semantic tags for structure.
-   **ARIA Labels**: Interactive elements include labels for screen readers.
-   **Keyboard Navigation**: Full support for navigating and interacting via keyboard.
-   **Visual Feedback**: Distinct colors and icons (now minimal and centered) for correct/wrong states.

## How to add a new subject

To add a new subject to Quizium, you need to follow these steps:

### 1. Create the Data File

Create a new JSON file in the `data/` folder. The filename should be the unique ID of your subject (e.g., `history.json`).

> **Tip**: You can use the **Quiz Workshop** (found on the Home Screen) to easily generate the JSON structure or edit existing quizzes.

Quiz files are stored as objects containing both `metadata` and a `questions` array.

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
      "options": ["Option A", "Option B", "Option C", "Option D"],
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
      "question": "Open-ended question?",
      "explanation": "Self-assessment explanation."
    }
  ]
}
```

- **Metadata Fields**:
  - `id`: Unique identifier (should match filename).
  - `name`: Display name.
  - `icon`: Emoji representing the subject.
  - `color`: Primary accent color for UI elements.
  - `bg`: Soft background color for the card.
  - `language`: `'EN'` or `'IT'` for UI labels.
  - `category`: Used to group quizzes on the home screen.

*   **id**: Unique integer identifier for the question.
*   **type**: `"multiple"` for multiple choice, `"boolean"` for True/False, or `"open"` for open-ended questions.
*   **options**: Array of strings (Required only for `"multiple"` type).
*   **answer**: 
    *   For `multiple`: Integer index (0-based) of the correct option.
    *   For `boolean`: Integer `0` (False) or `1` (True).


Adding a and subject is now entirely data-driven:

### 1. Create the Data File
Create a new JSON file in the `data/` folder (e.g., `history.json`) following the structure above. 

> [!TIP]
> Use the **Quiz Workshop** to easily generate and save these files. It automatically handles the metadata wrapping for you.

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

The app will automatically detect the new file, read its metadata, and place it in the correct category section on the home screen. No code changes in `app.js` are required!

## Developer Tools

### Question Builder & Utility

The **Quiz Workshop** is an integrated suite of tools for content creation and management, accessible directly from the Home Screen.

-   **Access**: Click the **Quiz Workshop** 🛠️ button on the Home Screen.
-   **Edit Mode**: You can also enter the workshop with an existing quiz loaded by clicking **Edit Questions** ✏️ in the setup screen.

**Features:**
1.  **Question Builder Tab**:
    -   Converts raw text questions into valid JSON.
    -   Smart detection of Multiple Choice vs Boolean.
    -   Validates structure and indices.
    -   Smart JSON output (array vs list) based on Starting ID.

**Builder Input Format:**
To use the generator, paste your questions using the following structure (separate blocks with an empty line):

*Multiple Choice:*
```text
Question Text
Option 1
Option 2
Option 3
0 (Correct Index: 0 for first, 1 for second, etc.)
Expanation (Optional)
```

*Boolean:*
```text
Question Text
b (identifies the block as boolean)
1 (1 for True, 0 for False)
Explanation (Optional)
```

*Open-ended:*
```text
Question Text
o (identifies the block as open-ended)
Self-assessment Explanation
```

2.  **Reorder IDs Tab**:
    -   Accepts an existing JSON array of questions.
    -   Sorts them by their current `id`.
    -   Renumbers `id` sequentially starting from 1.
    -   Outputs normalized JSON ready for use.


