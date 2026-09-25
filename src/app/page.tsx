import { RunForm } from "@/components/RunForm";
import { HologramAvatar } from "@/components/HologramAvatar";

export default function Home() {
  return (
    <div className="p-6">
      <div className="rounded-3xl border border-panel-border bg-linear-to-b from-emerald-900/50 via-teal-950 to-panel px-8 pb-20 pt-12 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/80">
          Lead research agent
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">
          Give it a qualification objective
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-300">
          It refines your objective into ICP criteria, discovers candidate companies, scrapes
          their public sites, qualifies each one, and drafts outreach for the ones that qualify.
          Nothing is ever sent -- every draft waits for your review.
        </p>

        <div className="mt-4">
          <HologramAvatar />
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-14 max-w-2xl px-4 text-left">
        <RunForm />
      </div>

      <div className="h-8" />
    </div>
  );
}
