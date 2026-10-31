/** Note title: the first non-empty line, trimmed. */
export function deriveTitle(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/** The whole note as plain text: the title, a blank line, then the body. */
export function noteAsText(heading: string, body: string): string {
  const title = heading.trim();
  const text = body.trim();
  if (!title) return text;
  return text ? `${title}\n\n${text}` : title;
}

/** The whole note as Markdown: the title becomes a `#` heading. */
export function noteAsMarkdown(heading: string, body: string): string {
  const title = heading.trim();
  const text = body.trim();
  if (!title) return text;
  return text ? `# ${title}\n\n${text}` : `# ${title}`;
}
