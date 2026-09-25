import { getFailedRuns, getShortfallRuns, getErrorToolCalls } from "@/lib/db";
import { ErrorLogView } from "@/components/ErrorLogView";

// Always reflects the latest failures -- never statically prerendered.
export const dynamic = "force-dynamic";

export default async function ErrorsPage() {
  const [failedRuns, shortfallRuns, errorToolCalls] = await Promise.all([
    getFailedRuns(50),
    getShortfallRuns(50),
    getErrorToolCalls(100),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-50">Error log</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Every failed run and every tool-call error across all runs, newest first. Click any row for the full detail.
      </p>

      <ErrorLogView failedRuns={failedRuns} shortfallRuns={shortfallRuns} errorToolCalls={errorToolCalls} />
    </div>
  );
}
