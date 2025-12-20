# Quizium

Quizium is a dynamic and interactive quiz application that allows users to test their knowledge on various subjects. The app is built with HTML, CSS, and vanilla JavaScript.

## How the App Works

The application loads subject data dynamically from JSON files located in the `data/` folder.
1.  **Home Screen**: Displays available subjects. The app reads the available subjects from the configuration in `assets/app.js` and fetches the corresponding JSON files to count the questions.
2.  **Configuration**: Users can select the number of questions they want to answer (Short, Normal, Max, or a custom value using the slider).
3.  **Quiz Mode**: Questions are presented one by one. The app tracks correct and wrong answers. Immediate feedback is provided with explanations.
4.  **Results**: At the end of the quiz, a score is calculated and displayed along with a performance summary.

## How to Add a New Subject

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

Open `assets/app.js` and find the `quizApp.subjects` array. Add a single line for your new subject containing its ID, name, icon, and colors.

```javascript
/* ... inside quizApp object ... */
subjects: [
    // ... existing subjects
    { 
        id: 'history', 
        name: 'World History', 
        icon: '📜', 
        color: '#d97706', 
        bg: '#fffbeb',
        booleanLabels: ['True', 'False']
    }
],
```

*   **id**: Must match your JSON filename (without `.json`).
*   **name**: The display name of the subject.
*   **icon**: Emoji or text icon.
*   **color**: Main accent color.
*   **bg**: Light background color.
*   **lang**: Language code for boolean labels (e.g., `'IT'` for Vero/Falso, `'EN'` for True/False).

Once this is done, refresh the page to see your new subject!
