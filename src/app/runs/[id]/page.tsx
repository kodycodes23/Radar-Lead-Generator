import { notFound } from "next/navigation";
import { getLeadsForRun, getRun, getToolCallsForRun, getRunFamily, getOutreachEditsForRun } from "@/lib/db";
import { RunLiveView } from "@/components/RunLiveView";

// Always reflects live run state -- never statically prerendered.
export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  const [leads, toolCalls, family, outreachEdits] = await Promise.all([
    getLeadsForRun(id),
    getToolCallsForRun(id),
    getRunFamily(id),
    getOutreachEditsForRun(id),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <RunLiveView
        runId={id}
        initialRun={run}
        initialLeads={leads}
        initialToolCalls={toolCalls}
        initialFamily={family}
        initialOutreachEdits={outreachEdits}
      />
    </div>
  );
}
