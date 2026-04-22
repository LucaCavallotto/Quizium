# Quizium

Quizium is a dynamic and interactive quiz application that allows users to test their knowledge on various subjects. The app is built with HTML, CSS, and vanilla JavaScript.

## How the App Works

The application loads subject data dynamically from JSON files located in the `data/` folder.
1.  **Home Screen**: Displays available subjects. The app reads the available subjects from the configuration in `assets/app.js` and fetches the corresponding JSON files to count the questions.
2.  **Configuration**: Users can select the number of questions they want to answer (Short, Normal, Max, or a custom value using the slider).
3.  **Quiz Mode**: Questions are presented one by one. The app tracks correct and wrong answers. Immediate feedback is provided with explanations.
4.  **Results**: At the end of the quiz, a score is calculated and displayed along with a performance summary.

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

**JSON Format:**
The file must contain an array of question objects. Each object should have the following structure:

```json
[
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
    "question": "True or False question statement?",
    "answer": 0,
    "explanation": "Explanation here."
  },
  {
    "id": 3,
    "type": "open",
    "question": "Open-ended question statement?",
    "explanation": "Self-assessment explanation here."
  }
]
```

*   **id**: Unique integer identifier for the question.
*   **type**: `"multiple"` for multiple choice, `"boolean"` for True/False, or `"open"` for open-ended questions.
*   **options**: Array of strings (Required only for `"multiple"` type).
*   **answer**: 
    *   For `multiple`: Integer index (0-based) of the correct option.
    *   For `boolean`: Integer `0` (False) or `1` (True).


### 2. Register the Subject in the App

Open `assets/app.js` and find the `subjects` array inside the `QuizApp` constructor state. Add a single line for your new subject:

```javascript
/* Inside QuizApp constructor -> this.state */
subjects: [
    // ... existing subjects
    { 
        id: 'history', 
        name: 'World History', 
        icon: '📜', 
        color: '#d97706', 
        bg: '#fffbeb',
        lang: 'EN' 
    }
],
```

*   **id**: Must match your JSON filename (without `.json`).
*   **name**: The display name of the subject.
*   **icon**: Emoji or text icon.
*   **color**: Main accent color (CSS hex or var).
*   **bg**: Light background color.
*   **lang**: Language code (`'EN'` or `'IT'`) for formatting boolean question labels (e.g., True/False vs Vero/Falso).
*   **file**: (Optional) If your JSON file name differs from the ID, specify it here (e.g., `file: 'my-history.json'`).

Once this is done, refresh the page to see your new subject!

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


