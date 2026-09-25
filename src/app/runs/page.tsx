import { listRuns } from "@/lib/db";
import { RunsTable } from "@/components/RunsTable";

// Always reflects live run state -- never statically prerendered.
export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runs = await listRuns();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-50">All runs</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Every run record, for inspecting status, limits, and progress.
      </p>
      <RunsTable initialRuns={runs} />
    </div>
  );
}
