interface AutoNumberResult {
  newValue: string;
  cursorPosition: number;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Handles Enter key behavior for numbered lists in textareas.
 * - Continues numbering on the next line
 * - Renumbers subsequent lines in the same contiguous block
 * - Removes prefix and exits list mode on empty numbered lines
 *
 * Returns null if the current line is not a numbered list item.
 */
export function handleAutoNumber(
  value: string,
  selectionStart: number,
  selectionEnd: number
): AutoNumberResult | null {
  // Find the current line
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const lineEnd = value.indexOf('\n', selectionStart);
  const effectiveLineEnd = lineEnd === -1 ? value.length : lineEnd;
  const currentLine = value.substring(lineStart, effectiveLineEnd);

  // Check if line matches numbered list pattern
  const match = currentLine.match(/^(\s*)(\d+)\.\s/);
  if (!match) return null;

  const indent = match[1];
  const currentNumber = parseInt(match[2], 10);
  const prefix = match[0];

  // Empty line exit: if content after prefix is empty, remove prefix and exit list
  const contentAfterPrefix = currentLine.substring(prefix.length);
  if (contentAfterPrefix.trim() === '' && selectionStart >= lineStart + prefix.length) {
    const newValue =
      value.substring(0, lineStart) +
      indent +
      value.substring(effectiveLineEnd);
    return {
      newValue,
      cursorPosition: lineStart + indent.length,
    };
  }

  // Normal continuation: insert new numbered line
  const newPrefix = `${indent}${currentNumber + 1}. `;

  const newValue =
    value.substring(0, selectionStart) +
    '\n' +
    newPrefix +
    value.substring(selectionEnd, effectiveLineEnd) +
    (lineEnd === -1 ? '' : value.substring(lineEnd));

  const cursorPos = selectionStart + 1 + newPrefix.length;

  // Renumber subsequent lines
  const lines = newValue.split('\n');
  const newLineIndex = value.substring(0, selectionStart).split('\n').length; // 0-based index of newly inserted line
  const renumberFrom = newLineIndex + 1;
  let expectedNum = currentNumber + 2;
  const indentPattern = new RegExp(`^${escapeRegex(indent)}(\\d+)\\.\\s`);

  for (let i = renumberFrom; i < lines.length; i++) {
    const lineMatch = lines[i].match(indentPattern);
    if (!lineMatch) break;
    lines[i] = `${indent}${expectedNum}. ` + lines[i].substring(lineMatch[0].length);
    expectedNum++;
  }

  return {
    newValue: lines.join('\n'),
    cursorPosition: cursorPos,
  };
}
