// Word-overlap (Jaccard) similarity -- deliberately simple (no LLM call, no
// embeddings) since this only gates a pre-run confirmation modal and needs
// to be fast/cheap on every "New run" submission, not semantically perfect.
function normalizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function objectiveSimilarity(a: string, b: string): number {
  return jaccardSimilarity(normalizeWords(a), normalizeWords(b));
}
