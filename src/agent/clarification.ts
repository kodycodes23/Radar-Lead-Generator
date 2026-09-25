// In-process registry that lets the ask_clarifying_question tool block until
// a human answer arrives via POST /api/runs/[id]/clarify, without changing
// runAgent's single-string-prompt query() call into a streaming one. Same
// process-lifetime limitation as the rest of this app's fire-and-forget state
// (RunContext counters, the watchdog timer): if the dev/host process restarts
// while a question is pending, the in-memory entry is gone and the saved
// clarification_answer in the DB can no longer resume that run automatically.

interface PendingClarification {
  resolve: (answer: string) => void;
  reject: (err: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingClarification>();

// Bounded, like every other wait in this system. If nobody answers in this
// window, the run fails loudly with a clear reason instead of hanging forever.
export const CLARIFICATION_TIMEOUT_MS = 30 * 60 * 1000;

export function waitForClarificationAnswer(runId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(runId);
      reject(new Error(`No answer received within ${Math.round(CLARIFICATION_TIMEOUT_MS / 60000)} minutes.`));
    }, CLARIFICATION_TIMEOUT_MS);
    pending.set(runId, { resolve, reject, timeout });
  });
}

// Called from the clarify API route. Returns false if there's no live wait
// for this run in this process (already answered, timed out, or the process
// restarted since the question was asked) so the route can report that
// clearly instead of silently no-op'ing.
export function resolveClarification(runId: string, answer: string): boolean {
  const entry = pending.get(runId);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  pending.delete(runId);
  entry.resolve(answer);
  return true;
}

export function isClarificationPending(runId: string): boolean {
  return pending.has(runId);
}
