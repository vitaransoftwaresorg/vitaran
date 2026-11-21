/**
 * Shared answer-key table layout across admin, school, teacher, public, Excel, and PDF.
 * Column-major fill: Q1 down column 1, next batch in column 2, …
 * So each row reads: 1, 13, 25, 37, … (for 100 questions / 9 columns).
 */
export const ANSWER_KEY_TABLE_COLUMNS = 9;

export function answerKeyTableRows(questionCount: number) {
  return Math.max(1, Math.ceil(Math.max(0, questionCount) / ANSWER_KEY_TABLE_COLUMNS));
}

/** Question at (row, col) in the shared table, or null if past the end. */
export function answerKeyTableQuestion(
  questions: number[],
  row: number,
  col: number,
  columns = ANSWER_KEY_TABLE_COLUMNS,
) {
  const rows = answerKeyTableRows(questions.length);
  if (col < 0 || col >= columns || row < 0 || row >= rows) return null;
  const index = col * rows + row;
  if (index < 0 || index >= questions.length) return null;
  return questions[index] ?? null;
}
