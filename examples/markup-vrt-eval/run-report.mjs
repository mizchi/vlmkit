export function buildReport({
  provider,
  scenario,
  steps,
  generatedSource,
  plan,
  locators,
  visualContext,
  repairContext,
  stabilityRuns,
  visualRegressionDetected,
  expectedChange,
  vlmRegionDiffStatus,
  vlmRegionSummary,
  artifacts,
}) {
  const planHasSingleScenario = (plan.match(/^### /gm) ?? []).length === 1;
  const generatedScreenshotAssertions = (generatedSource.match(/toHaveScreenshot/g) ?? []).length;
  const generatedDirectPageGoto = /page\.goto\(/.test(generatedSource);
  const generatedCommentLines = generatedSource.split(/\r?\n/).filter((line) => line.trim().startsWith("//")).length;
  const generatedUsesReleaseRowTestId = /getByTestId\(["']release-row-invoice-export["']\)/.test(generatedSource);
  const expectedChangeApproval = evaluateExpectedChange(repairContext, expectedChange, visualRegressionDetected);
  const qualityFailures = buildQualityFailures({
    planHasSingleScenario,
    generatedScreenshotAssertions,
    generatedDirectPageGoto,
    generatedCommentLines,
    generatedUsesReleaseRowTestId,
    visualRegressionDetected,
    repairContext,
    visualContext,
    stabilityRuns,
    expectedChangeApproval,
  });

  return {
    generatedAt: new Date().toISOString(),
    provider,
    scenario,
    steps,
    qualityFailures,
    metrics: {
      planHasSingleScenario,
      locatorRoleCount: locators.roles?.length ?? 0,
      locatorTestIdCount: locators.testIds?.length ?? 0,
      generatedLineCount: generatedSource.trimEnd().split(/\r?\n/).length,
      generatedScreenshotAssertions,
      generatedDirectPageGoto,
      generatedCommentLines,
      generatedUsesReleaseRowTestId,
      runtimeGateRuns: 2,
      stabilityCheckRuns: stabilityRuns.length,
      stabilityChecksPassed: stabilityRuns.every((run) => run.exitCode === 0),
      visualRegressionDetected,
      repairContextAvailable: (repairContext.imageDiff?.changedPixels ?? 0) > 0,
      repairHintCount: repairContext.repairHints.length,
      repairSelectorMatchCount: repairContext.imageDiff?.selectorMatches?.length ?? 0,
      cssAttributionCount: repairContext.styleAttribution.changedProperties.length,
      driftKind: repairContext.drift.kind,
      driftPrimaryCause: repairContext.drift.primaryCause,
      viewportContextCount: visualContext.viewports?.length ?? 0,
      expectedChangeApproved: expectedChangeApproval.approved,
      vlmRegionDiffStatus,
      vlmRegionChangeCount: vlmRegionSummary.changeCount,
    },
    expectedChangeApproval,
    vlmRegionSummary,
    repair: {
      failureKind: repairContext.failure.kind,
      screenshotName: repairContext.failure.screenshotName,
      diffRatio: repairContext.imageDiff?.diffRatio ?? null,
      bbox: repairContext.imageDiff?.bbox ?? null,
      selectorMatches: repairContext.imageDiff?.selectorMatches?.map((match) => ({
        selector: match.selector,
        confidence: match.confidence,
        score: match.evidence?.score ?? null,
      })) ?? [],
      edgeCandidates: repairContext.imageDiff?.edgeCandidates?.map((candidate) => ({
        selector: candidate.selector,
        reason: candidate.reason,
        score: candidate.score,
      })) ?? [],
      cssAttribution: repairContext.styleAttribution.changedProperties.slice(0, 8),
      drift: repairContext.drift,
      semanticChanged: repairContext.semanticDiff.changed,
      artifacts: {
        expectedPng: repairContext.artifacts?.expectedPng ?? null,
        actualPng: repairContext.artifacts?.actualPng ?? null,
        diffPng: repairContext.artifacts?.diffPng ?? null,
      },
      hints: repairContext.repairHints.slice(0, 12),
    },
    artifacts,
  };
}

export function buildQualityFailures({
  planHasSingleScenario,
  generatedScreenshotAssertions,
  generatedDirectPageGoto,
  generatedCommentLines,
  generatedUsesReleaseRowTestId,
  visualRegressionDetected,
  repairContext,
  visualContext,
  stabilityRuns,
  expectedChangeApproval,
}) {
  return [
    !planHasSingleScenario && "plan should contain exactly one scenario",
    generatedScreenshotAssertions < 2 && "generated test should contain at least two screenshot assertions",
    generatedDirectPageGoto && "generated test should use gotoApp(page), not page.goto(...)",
    generatedCommentLines > 0 && "generated test should not contain comments",
    !generatedUsesReleaseRowTestId && "generated test should use the release row test id for Invoice Export",
    !visualRegressionDetected && "regression variant should fail via VRT",
    !(repairContext.imageDiff?.changedPixels > 0) && "repair context should include measured image diff pixels",
    repairContext.repairHints.length === 0 && "repair context should include actionable repair hints",
    repairContext.styleAttribution.changedProperties.length === 0 && "repair context should include computed-style attribution",
    repairContext.drift.kind !== "visual-only" && "intentional regression should classify as visual-only",
    (visualContext.viewports?.length ?? 0) < 3 && "visual context should include desktop, mobile, and wide snapshots",
    stabilityRuns.some((run) => run.exitCode !== 0) && "stable generated VRT should pass twice after baseline update",
    !expectedChangeApproval.approved && `expected-change approval failed: ${expectedChangeApproval.reasons.join("; ")}`,
  ].filter(Boolean);
}

function evaluateExpectedChange(repairContext, expectedChange, visualRegressionDetected) {
  const reasons = [];
  if (!visualRegressionDetected) reasons.push("visual regression was not detected");
  if (repairContext.failure.kind !== expectedChange.expectedFailureKind) {
    reasons.push(`failure kind ${repairContext.failure.kind} != ${expectedChange.expectedFailureKind}`);
  }
  if (repairContext.drift.kind !== expectedChange.expectedDriftKind) {
    reasons.push(`drift kind ${repairContext.drift.kind} != ${expectedChange.expectedDriftKind}`);
  }
  if (!expectedChange.allowedPrimaryCauses.includes(repairContext.drift.primaryCause)) {
    reasons.push(`primary cause ${repairContext.drift.primaryCause} is not allowed`);
  }
  const selectors = [
    ...repairContext.styleAttribution.changedProperties.map((row) => row.selector),
    ...(repairContext.imageDiff?.selectorMatches ?? []).map((match) => match.selector),
    ...(repairContext.imageDiff?.edgeCandidates ?? []).map((candidate) => candidate.selector),
  ];
  const allowedSelectorFound = selectors.some((selector) =>
    expectedChange.allowedSelectors.some((allowed) => selector === allowed || selector.startsWith(`${allowed}:`))
  );
  if (!allowedSelectorFound) reasons.push("no changed selector matched expected-change allowlist");
  return {
    approved: reasons.length === 0,
    reasons,
    expectedChange,
  };
}

export function renderReportArtifacts({ report, guardrailSources }) {
  return {
    markdown: renderMarkdown(report),
    githubStepSummary: renderGithubStepSummary(report),
    guardrailContext: renderGuardrailContext({ report, guardrailSources }),
    html: renderHtmlReport(report),
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Markup VRT Eval Report",
    "",
    `- Provider: ${report.provider}`,
    `- Scenario: ${report.scenario}`,
    `- Visual regression detected: ${report.metrics.visualRegressionDetected ? "yes" : "no"}`,
    "",
    "## Metrics",
    "",
    `- Single-scenario plan: ${report.metrics.planHasSingleScenario ? "yes" : "no"}`,
    `- Locator inventory: ${report.metrics.locatorRoleCount} roles, ${report.metrics.locatorTestIdCount} test ids`,
    `- Generated test: ${report.metrics.generatedLineCount} lines`,
    `- Screenshot assertions: ${report.metrics.generatedScreenshotAssertions}`,
    `- Direct page.goto: ${report.metrics.generatedDirectPageGoto ? "yes" : "no"}`,
    `- Comment lines: ${report.metrics.generatedCommentLines}`,
    `- Uses release row test id: ${report.metrics.generatedUsesReleaseRowTestId ? "yes" : "no"}`,
    `- Runtime gate runs: ${report.metrics.runtimeGateRuns}`,
    `- Stability checks: ${report.metrics.stabilityChecksPassed ? "pass" : "fail"} (${report.metrics.stabilityCheckRuns})`,
    `- Repair context available: ${report.metrics.repairContextAvailable ? "yes" : "no"}`,
    `- Repair hints: ${report.metrics.repairHintCount}`,
    `- Repair selector matches: ${report.metrics.repairSelectorMatchCount}`,
    `- CSS attribution rows: ${report.metrics.cssAttributionCount}`,
    `- Drift: ${report.metrics.driftKind} / ${report.metrics.driftPrimaryCause}`,
    `- Viewport contexts: ${report.metrics.viewportContextCount}`,
    `- Expected change approved: ${report.metrics.expectedChangeApproved ? "yes" : "no"}`,
    `- Optional VLM region diff: ${report.metrics.vlmRegionDiffStatus}`,
    `- VLM region changes: ${report.metrics.vlmRegionChangeCount}`,
    `- Quality gate failures: ${report.qualityFailures.length}`,
    "",
    "## Repair Context",
    "",
    `- Failure kind: ${report.repair.failureKind}`,
    `- Screenshot: ${report.repair.screenshotName ?? "unknown"}`,
    `- Diff ratio: ${report.repair.diffRatio == null ? "n/a" : `${(report.repair.diffRatio * 100).toFixed(2)}%`}`,
    `- BBox: ${report.repair.bbox ? `left ${report.repair.bbox.left}, top ${report.repair.bbox.top}, width ${report.repair.bbox.width}, height ${report.repair.bbox.height}` : "n/a"}`,
    `- Selector matches: ${report.repair.selectorMatches.map((match) => `${match.selector} (${match.confidence})`).join(", ") || "none"}`,
    `- Top-edge candidates: ${report.repair.edgeCandidates.slice(0, 4).map((candidate) => `${candidate.selector} (${candidate.reason})`).join(", ") || "none"}`,
    `- Semantic changed: ${report.repair.semanticChanged ? "yes" : "no"}`,
    "",
    "### CSS Attribution",
    "",
    ...report.repair.cssAttribution.map((row) => `- ${row.selector}: ${row.property} \`${row.before}\` -> \`${row.after}\` (${row.category}, score ${row.score})`),
    ...(report.vlmRegionSummary.available ? [
      "",
      "### VLM Region Diff",
      "",
      `- Model: ${report.vlmRegionSummary.model ?? "unknown"}`,
      `- Cost: ${report.vlmRegionSummary.cost == null ? "unknown" : `$${report.vlmRegionSummary.cost}`}`,
      `- Summary: ${report.vlmRegionSummary.summary ?? "n/a"}`,
      ...report.vlmRegionSummary.changes.slice(0, 6).map((row) =>
        `- ${row.selector}: ${row.property} \`${row.from ?? "?"}\` -> \`${row.to ?? "?"}\` (${row.confidence})`
      ),
    ] : []),
    "",
    "### Hints",
    "",
    ...report.repair.hints.map((hint) => `- ${hint}`),
    "",
    "## Steps",
    "",
    "| Step | Exit | Duration |",
    "| --- | ---: | ---: |",
    ...report.steps.map((step) => `| ${step.name} | ${step.exitCode} | ${step.durationMs}ms |`),
    "",
    "## Artifacts",
    "",
    ...Object.entries(report.artifacts)
      .filter(([, value]) => value)
      .map(([key, value]) => `- ${key}: \`${value}\``),
    "",
  ];
  return lines.join("\n");
}

function renderHtmlReport(report) {
  const imageArtifacts = report.repair.artifacts ?? {};
  const image = (label, path) => path
    ? `<figure><figcaption>${escapeHtml(label)}</figcaption><img src="${escapeHtml(toHtmlArtifactPath(path))}" alt="${escapeHtml(label)}"></figure>`
    : "";
  const cssRows = report.repair.cssAttribution.map((row) =>
    `<tr><td>${escapeHtml(row.selector)}</td><td>${escapeHtml(row.property)}</td><td><code>${escapeHtml(row.before)}</code></td><td><code>${escapeHtml(row.after)}</code></td><td>${escapeHtml(row.category)}</td><td>${row.score}</td></tr>`
  ).join("");
  const vlmRows = report.vlmRegionSummary.changes.map((row) =>
    `<tr><td>${escapeHtml(row.selector)}</td><td>${escapeHtml(row.property)}</td><td><code>${escapeHtml(row.from ?? "")}</code></td><td><code>${escapeHtml(row.to ?? "")}</code></td><td>${escapeHtml(row.confidence)}</td><td>${escapeHtml(row.region)}</td></tr>`
  ).join("");
  const hints = report.repair.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Markup VRT Eval Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #17202a; background: #f6f8fa; }
    main { max-width: 1180px; margin: 0 auto; display: grid; gap: 18px; }
    section { background: white; border: 1px solid #d8dee5; border-radius: 8px; padding: 16px; }
    h1, h2 { margin: 0 0 12px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
    .metric { border: 1px solid #d8dee5; border-radius: 6px; padding: 10px; background: #fbfcfd; }
    .metric strong { display: block; font-size: 22px; }
    .screens { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
    figure { margin: 0; }
    figcaption { font-size: 13px; font-weight: 700; margin-bottom: 6px; }
    img { width: 100%; border: 1px solid #d8dee5; border-radius: 6px; background: white; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid #e7eaee; padding: 8px; text-align: left; vertical-align: top; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  </style>
</head>
<body>
<main>
  <h1>Markup VRT Eval Report</h1>
  <section>
    <h2>Summary</h2>
    <p><strong>Scenario:</strong> ${escapeHtml(report.scenario)}</p>
    <div class="metrics">
      <div class="metric"><span>Visual regression</span><strong>${report.metrics.visualRegressionDetected ? "detected" : "missing"}</strong></div>
      <div class="metric"><span>Drift</span><strong>${escapeHtml(report.metrics.driftKind)} / ${escapeHtml(report.metrics.driftPrimaryCause)}</strong></div>
      <div class="metric"><span>Expected change</span><strong>${report.metrics.expectedChangeApproved ? "approved" : "rejected"}</strong></div>
      <div class="metric"><span>Quality failures</span><strong>${report.qualityFailures.length}</strong></div>
    </div>
  </section>
  <section>
    <h2>Screenshots</h2>
    <div class="screens">
      ${image("Expected", imageArtifacts.expectedPng)}
      ${image("Actual", imageArtifacts.actualPng)}
      ${image("Diff", imageArtifacts.diffPng)}
    </div>
  </section>
  <section>
    <h2>CSS Attribution</h2>
    <table><thead><tr><th>Selector</th><th>Property</th><th>Before</th><th>After</th><th>Category</th><th>Score</th></tr></thead><tbody>${cssRows}</tbody></table>
  </section>
  <section>
    <h2>VLM Region Diff</h2>
    <p>${escapeHtml(report.vlmRegionSummary.summary ?? "Not run")}</p>
    <table><thead><tr><th>Selector</th><th>Property</th><th>From</th><th>To</th><th>Confidence</th><th>Region</th></tr></thead><tbody>${vlmRows}</tbody></table>
  </section>
  <section>
    <h2>Hints</h2>
    <ul>${hints}</ul>
  </section>
</main>
</body>
</html>`;
}

function renderGithubStepSummary(report) {
  const rows = [
    ["Provider", report.provider],
    ["Scenario", report.scenario],
    ["Quality gate failures", String(report.qualityFailures.length)],
    ["Visual regression", report.metrics.visualRegressionDetected ? "detected" : "missing"],
    ["Expected change", report.metrics.expectedChangeApproved ? "approved" : "rejected"],
    ["Drift", `${report.metrics.driftKind} / ${report.metrics.driftPrimaryCause}`],
    ["Diff ratio", formatPercent(report.repair.diffRatio)],
    ["Stability checks", `${report.metrics.stabilityChecksPassed ? "pass" : "fail"} (${report.metrics.stabilityCheckRuns})`],
    ["CSS attribution rows", String(report.metrics.cssAttributionCount)],
    ["VLM region diff", `${report.metrics.vlmRegionDiffStatus} (${report.metrics.vlmRegionChangeCount} changes)`],
  ];
  return [
    "# Markup VRT Dogfood",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    ...rows.map(([key, value]) => `| ${escapeTableCell(key)} | ${escapeTableCell(value)} |`),
    "",
    "## Top Repair Hints",
    "",
    ...(report.repair.hints.length
      ? report.repair.hints.slice(0, 5).map((hint) => `- ${hint}`)
      : ["- none"]),
    "",
    "## Top CSS Attribution",
    "",
    ...(report.repair.cssAttribution.length
      ? report.repair.cssAttribution.slice(0, 5).map((row) =>
        `- ${row.selector}: ${row.property} \`${row.before}\` -> \`${row.after}\` (${row.category}, score ${row.score})`
      )
      : ["- none"]),
    "",
    "## Artifacts",
    "",
    ...Object.entries(report.artifacts)
      .filter(([, value]) => value)
      .map(([key, value]) => `- ${key}: \`${value}\``),
    "",
  ].join("\n");
}

function renderGuardrailContext({ report, guardrailSources }) {
  const {
    requestMarkdown,
    planMarkdown,
    locatorInventory,
    generationRulesMarkdown,
  } = guardrailSources;
  return [
    "# Markup VRT Heal Guardrail Context",
    "",
    "Use this as `guardrailContext` for `@mizchi/vlmkit-heal` when repairing the generated Release Queue test.",
    "",
    "## Non-Negotiable Repair Guardrails",
    "",
    "- Do not weaken the scenario, remove the Blocked filter interaction, or remove the Invoice Export detail assertion.",
    "- Do not replace the workflow with broad presence checks just to make the test pass.",
    "- Do not introduce locators outside the observed locator inventory unless the UI has intentionally changed.",
    "- Prefer repairing tests and VRT baselines. Do not edit application code unless the operator explicitly asks for it.",
    "",
    "## Scenario Summary",
    "",
    `- Provider: ${report.provider}`,
    `- Scenario: ${report.scenario}`,
    `- Failure kind: ${report.repair.failureKind}`,
    `- Screenshot: ${report.repair.screenshotName ?? "unknown"}`,
    `- Diff ratio: ${formatPercent(report.repair.diffRatio)}`,
    `- Drift: ${report.metrics.driftKind} / ${report.metrics.driftPrimaryCause}`,
    `- Expected change approved: ${report.metrics.expectedChangeApproved ? "yes" : "no"}`,
    "",
    "## Original Request",
    "",
    fenced("markdown", requestMarkdown),
    "",
    "## Plan",
    "",
    fenced("markdown", planMarkdown),
    "",
    "## Observed Locator Inventory",
    "",
    fenced("json", JSON.stringify(locatorInventory ?? {}, null, 2)),
    "",
    "## Generation Rules",
    "",
    fenced("markdown", generationRulesMarkdown),
    "",
    "## Repair Signals",
    "",
    "### CSS Attribution",
    "",
    ...(report.repair.cssAttribution.length
      ? report.repair.cssAttribution.map((row) =>
        `- ${row.selector}: ${row.property} \`${row.before}\` -> \`${row.after}\` (${row.category}, score ${row.score})`
      )
      : ["- none"]),
    "",
    "### Selector Matches",
    "",
    ...(report.repair.selectorMatches.length
      ? report.repair.selectorMatches.map((match) => `- ${match.selector} (${match.confidence}, score ${match.score ?? "n/a"})`)
      : ["- none"]),
    "",
    "### Top-Edge Candidates",
    "",
    ...(report.repair.edgeCandidates.length
      ? report.repair.edgeCandidates.map((candidate) => `- ${candidate.selector}: ${candidate.reason} (score ${candidate.score})`)
      : ["- none"]),
    "",
    "### VLM Region Diff",
    "",
    ...(report.vlmRegionSummary.available
      ? [
        `- Model: ${report.vlmRegionSummary.model ?? "unknown"}`,
        `- Cost: ${report.vlmRegionSummary.cost == null ? "unknown" : `$${report.vlmRegionSummary.cost}`}`,
        `- Summary: ${report.vlmRegionSummary.summary ?? "n/a"}`,
        ...report.vlmRegionSummary.changes.map((row) =>
          `- ${row.selector}: ${row.property} \`${row.from ?? "?"}\` -> \`${row.to ?? "?"}\` (${row.confidence})`
        ),
      ]
      : [`- ${report.metrics.vlmRegionDiffStatus}`]),
    "",
    "### Repair Hints",
    "",
    ...(report.repair.hints.length ? report.repair.hints.map((hint) => `- ${hint}`) : ["- none"]),
    "",
  ].join("\n");
}

function toHtmlArtifactPath(path) {
  return path.startsWith(".vrt/markup-vrt-eval/")
    ? path.slice(".vrt/markup-vrt-eval/".length)
    : path;
}

function formatPercent(value) {
  return value == null ? "n/a" : `${(value * 100).toFixed(2)}%`;
}

function escapeTableCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function fenced(language, value) {
  return `\`\`\`${language}\n${String(value ?? "").replaceAll("```", "`\u200b``")}\n\`\`\``;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
