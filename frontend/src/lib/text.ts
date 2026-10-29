/** Título de uma nota: a primeira linha não vazia, sem espaços nas pontas. */
export function deriveTitle(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return "";
}
