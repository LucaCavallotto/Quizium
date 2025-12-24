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

## Review Features

After completing a quiz, you can review your performance:

-   **Results Screen**: Displays your score percentage, total time, and a breakdown of correct/incorrect answers.
-   **Review Answers**: Click the "Review Answers" button on the results screen to navigate through the questions again.
    -   See exactly what you answered vs. the correct answer.
    -   Read detailed explanations for each question.


To add a new subject to Quizium, you need to follow these steps:

### 1. Create the Data File

Create a new JSON file in the `data/` folder. The filename should be the unique ID of your subject (e.g., `history.json`).

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
  }
]
```

*   **id**: Unique integer identifier for the question.
*   **type**: `"multiple"` for multiple choice, or `"boolean"` for True/False.
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

Once this is done, refresh the page to see your new subject!
