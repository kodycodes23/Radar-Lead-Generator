// Agent-authored error messages are often a full narrative paragraph -- fine
// as the permanent record, too long for a scannable list or a compact
// banner. A plain character cut works well in practice here: these messages
// consistently state the actual problem in the opening clause (e.g. "Blocked
// at the qualification-save stage: save_lead_qualification consistently
// errors with ..."), so the summary still contains the main error.
export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}
