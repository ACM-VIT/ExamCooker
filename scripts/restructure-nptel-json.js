/*
 * transform_course_json.js
 * 
 * Usage: node transform_course_json.js <inputPath> <outputPath>
 * Example: node transform_course_json.js oldJSON.json newJSON.json
 */

const fs = require('fs');
const path = require('path');

// Get command-line arguments
const [,, inputPath, outputPath] = process.argv;

if (!inputPath) {
  console.error('Usage: node transform_course_json.js <inputPath> <outputPath>');
  process.exit(1);
}

// Determine output path or default to "output.json"
const outPath = outputPath || path.join(path.dirname(inputPath), 'output.json');

// Read and parse the old JSON
let raw;
try {
  raw = fs.readFileSync(inputPath, 'utf-8');
} catch (err) {
  console.error(`Error reading file at ${inputPath}:`, err.message);
  process.exit(1);
}

let oldData;
try {
  oldData = JSON.parse(raw);
} catch (err) {
  console.error('Invalid JSON:', err.message);
  process.exit(1);
}

// Transform the data
const newData = {
  title: oldData.course_name,
  code: oldData.course_code,
  weeks: []
};

// Group questions by week_number
const weeksMap = new Map();

if (Array.isArray(oldData.assignments)) {
  oldData.assignments.forEach(assignment => {
    const weekKey = assignment.week_number;

    if (!weeksMap.has(weekKey)) {
      weeksMap.set(weekKey, { name: weekKey, questions: [] });
    }
    const weekObj = weeksMap.get(weekKey);

    if (Array.isArray(assignment.questions)) {
      assignment.questions.forEach(q => {
        // Extract options' text
        const optionTexts = Array.isArray(q.options)
          ? q.options.map(o => o.option_text)
          : [];

        // Find the correct answer text
        let answerText = null;
        if (Array.isArray(q.options)) {
          const correct = q.options.find(o => o.option_number === q.correct_option);
          answerText = correct ? correct.option_text : null;
        }

        weekObj.questions.push({
          question: q.question_text,
          options: optionTexts,
          answer: answerText
        });
      });
    }
  });
}

newData.weeks = Array.from(weeksMap.values());

// Write the transformed JSON to file
try {
  fs.writeFileSync(outPath, JSON.stringify(newData, null, 2), 'utf-8');
  console.log(`Transformed JSON written to ${outPath}`);
} catch (err) {
  console.error(`Error writing file to ${outPath}:`, err.message);
  process.exit(1);
}
