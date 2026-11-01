// Finds the http(s) link under the caret, for Ctrl+click in the editor.

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
/** Punctuation that usually ends a sentence, not the link. */
const TRAILING = new Set([".", ",", ";", ":", "!", "?", ")", "]", "}"]);
const OPENERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

const count = (text: string, char: string) => text.split(char).length - 1;

/** Drops trailing punctuation, but keeps a closing bracket that has its opener in the link. */
function trimTrailing(url: string): string {
  let end = url.length;
  while (end > 0) {
    const last = url.charAt(end - 1);
    if (!TRAILING.has(last)) break;
    const opener = OPENERS[last];
    const head = url.slice(0, end);
    if (opener && count(head, opener) >= count(head, last)) break;
    end -= 1;
  }
  return url.slice(0, end);
}

/**
 * The link that contains `index` (a caret position), or `null`.
 * The caret right after the last character still counts as on the link.
 */
export function findLinkAt(text: string, index: number): string | null {
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = trimTrailing(match[0]);
    const start = match.index;
    // Only the scheme left (e.g. "https://."): not a link.
    if (!/^https?:\/\/./i.test(url)) continue;
    if (index >= start && index <= start + url.length) return url;
    if (start > index) break;
  }
  return null;
}
