export function summarizeVlmRegionDiff(doc) {
  if (!doc || typeof doc !== "object") {
    return { available: false, summary: null, changeCount: 0, changes: [] };
  }
  const changes = Array.isArray(doc.changes)
    ? doc.changes.map((change) => ({
      selector: change.selector ?? change.selectorHint ?? "unknown",
      selectorHint: change.selectorHint ?? null,
      property: change.property ?? "unknown",
      from: change.from ?? null,
      to: change.to ?? null,
      confidence: change.confidence ?? "unknown",
      region: change.region ?? "unknown",
      description: change.description ?? "",
    }))
    : [];
  return {
    available: true,
    summary: typeof doc.summary === "string" ? doc.summary : null,
    model: typeof doc.model === "string" ? doc.model : null,
    cost: typeof doc.usage?.cost === "number" ? doc.usage.cost : null,
    changeCount: changes.length,
    changes,
  };
}
