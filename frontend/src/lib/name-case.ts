/** "allu naveen" → "Allu Naveen" while typing; inner letters stay as typed (the server re-cases on save). */
export function capitalizeWords(value: string) {
  return value.replace(/(^|[\s.\-(])(\p{L})/gu, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

/**
 * Capitalises the input in place, keeping the caret where it was, and returns the new value.
 * Writing the DOM first means React sees no change on re-render, so the caret does not jump.
 */
export function capitalizeInput(input: HTMLInputElement) {
  const next = capitalizeWords(input.value);
  if (next !== input.value) {
    const { selectionStart, selectionEnd } = input;
    input.value = next;
    if (selectionStart !== null && selectionEnd !== null) input.setSelectionRange(selectionStart, selectionEnd);
  }
  return next;
}
