/** Note title: the first non-empty line, trimmed. */
export function deriveTitle(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
}
