// Real bug: a company name came back from a discovery actor as literal
// "Piaker &amp; Lyons" -- the source page had "&amp;" in its raw HTML and
// the actor never decoded it before returning JSON, so it was stored and
// rendered verbatim. Applied to any text field coming out of a discovery
// actor (apify.ts, braveleads.ts) before it's stored or shown to the agent.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const codePoint = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}
