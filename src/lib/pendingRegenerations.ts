// Real bug: OutreachEmailCard/LinkedInMessageCard kept "is a regeneration
// running" and "here's the result" as local component state. The Leads tab
// is conditionally rendered ({tab === "Leads" && ...}), which truly unmounts
// its whole subtree on a tab switch -- so navigating away mid-regeneration
// (a real thing to do during a multi-second wait) discarded the eventual
// result into a component that no longer existed, with nothing shown when
// the user came back. This module-level store is the actual source of truth
// for "where is this regeneration" instead, so it survives an unmount/
// remount within the same page load (a full reload is an acceptable
// boundary -- there's nothing meaningful to resume across one anyway).
export type PendingRegenState =
  | { status: "pending" }
  | { status: "done"; result: Record<string, string> }
  | { status: "error"; message: string };

const store = new Map<string, PendingRegenState>();

export function regenKey(leadId: string, field: "email_1" | "email_2" | "email_3" | "linkedin"): string {
  return `${leadId}:${field}`;
}

export function getPendingRegen(key: string): PendingRegenState | undefined {
  return store.get(key);
}

export function setPendingRegen(key: string, state: PendingRegenState): void {
  store.set(key, state);
}

export function clearPendingRegen(key: string): void {
  store.delete(key);
}
