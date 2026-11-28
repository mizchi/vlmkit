/**
 * `check reset`: a page under every initial state a browser and a reset stylesheet give it.
 *
 * A branch is one (UA × reset) pair: the page in Chromium, Firefox or WebKit, with one reset stylesheet
 * (veriss's `veriss-resets/1` manifest: none, modern-normalize, normalize, sanitize, josh-comeau,
 * tailwind-preflight, destyle) put before the page's own sheets. The browser half renders each branch
 * and runs `check integrity`'s layout judges on it; this file decides what the results mean, with no
 * browser:
 *
 * - a finding in every measured branch, and a finding only in some, named by the smallest UA × reset
 *   product that covers where it is (`describeBranchSet`, the same summary veriss's `analyzeResetMatrix`
 *   gives, so one defect reads the same from both);
 * - branches that could not be measured, never counted as absent;
 * - veriss's static claims on the same branches held against what the browser drew
 *   (`compareVerissClaims`): a branch where veriss decided and the browser disagrees is veriss's error.
 */

export const RESET_MATRIX_UAS = ["chromium", "firefox", "webkit"] as const;
export type ResetMatrixUa = (typeof RESET_MATRIX_UAS)[number];

export interface BranchSpace {
  uas: readonly string[];
  resets: readonly string[];
}

export interface Branch {
  /** `ua:reset`, veriss's branch id. */
  id: string;
  ua: string;
  reset: string;
}

export const branchId = (ua: string, reset: string): string => `${ua}:${reset}`;

/** Every (ua, reset) pair, UA-major, in the order given (veriss's `enumerateBranches`). */
export function enumerateBranches(space: BranchSpace): Branch[] {
  return space.uas.flatMap((ua) => space.resets.map((reset) => ({ id: branchId(ua, reset), ua, reset })));
}

export type BranchSetPart = { uas: readonly string[] | "any"; resets: readonly string[] | "any" };

/**
 * The smallest description of a set of branch ids over the space: one product (UAs × resets, either side
 * `any` when it is the whole axis), or else a union of products grouped by the UAs each reset holds for.
 * A port of veriss's `describeBranchSet` (veriss is an optional peer, so it cannot be imported here); a test
 * holds the two to the same output when veriss is installed.
 */
export function describeBranchSet(
  ids: readonly string[],
  space: BranchSpace,
): { where: BranchSetPart | BranchSetPart[]; summary: string } {
  const pairs = ids.map((id) => {
    const i = id.indexOf(":");
    return [id.slice(0, i), id.slice(i + 1)] as const;
  });
  const U = space.uas.filter((u) => pairs.some((p) => p[0] === u));
  const R = space.resets.filter((r) => pairs.some((p) => p[1] === r));
  const side = (list: readonly string[], all: readonly string[]): readonly string[] | "any" =>
    list.length === all.length ? "any" : list;
  const text = ({ uas: u, resets: r }: BranchSetPart) =>
    u === "any" && r === "any"
      ? "every branch"
      : u === "any"
        ? `${(r as readonly string[]).join(", ")} (any UA)`
        : r === "any"
          ? `${u.join(", ")} (any reset)`
          : `${u.join(", ")} × ${r.join(", ")}`;
  if (new Set(ids).size === U.length * R.length) {
    const where: BranchSetPart = { uas: side(U, space.uas), resets: side(R, space.resets) };
    return { where, summary: text(where) };
  }
  const groups: { uas: string[]; resets: string[] }[] = [];
  for (const r of R) {
    const us = U.filter((u) => pairs.some((p) => p[0] === u && p[1] === r));
    const g = groups.find((x) => x.uas.join() === us.join());
    if (g) g.resets.push(r);
    else groups.push({ uas: us, resets: [r] });
  }
  const where: BranchSetPart[] = groups.map((g) => ({
    uas: side(g.uas, space.uas),
    resets: side(g.resets, space.resets),
  }));
  return { where, summary: where.map(text).join("; ") };
}

/** One layout finding of one branch: a `check integrity` finding, merged over the widths it was seen at. */
export interface BranchFinding {
  kind: string;
  severity: "fail" | "warn";
  selector?: string;
  message: string;
  widths: number[];
}

export interface BranchRun extends Branch {
  /** measured; skipped (the engine is not installed); failed (the page did not load or the judges threw). */
  status: "measured" | "skipped" | "failed";
  error?: string;
  findings: BranchFinding[];
}

/**
 * The same finding in two branches. By rule and selector; a finding with no selector by its message with the
 * numbers, quoted text and nth paths taken out (a page overflow of 2px in one engine and 6px in another is one
 * finding, as veriss keys a finding by code and box, not by its numbers).
 */
export function findingKey(f: { kind: string; selector?: string; message: string }): string {
  if (f.selector) return `${f.kind} ${f.selector}`;
  return `${f.kind} ${f.message
    .replace(/"[^"]*"/g, "")
    .replace(/\([^)]*nth-(?:of-type|child)[^)]*\)/g, "")
    .replace(/-?\d+(?:\.\d+)?/g, "#")
    .trim()}`;
}

/** Findings merged per branch: one per key, with every width it was seen at. */
export function mergeWidths(found: readonly (Omit<BranchFinding, "widths"> & { viewport: number })[]): BranchFinding[] {
  const by = new Map<string, BranchFinding>();
  for (const f of found) {
    const key = findingKey(f);
    const seen = by.get(key);
    if (seen) {
      if (!seen.widths.includes(f.viewport)) seen.widths.push(f.viewport);
      if (f.severity === "fail") seen.severity = "fail";
      continue;
    }
    by.set(key, {
      kind: f.kind,
      severity: f.severity,
      ...(f.selector ? { selector: f.selector } : {}),
      message: f.message,
      widths: [f.viewport],
    });
  }
  for (const f of by.values()) f.widths.sort((a, b) => b - a);
  return [...by.values()];
}

export interface MatrixFinding {
  key: string;
  kind: string;
  /** The worst severity any branch gave it. */
  severity: "fail" | "warn";
  selector?: string;
  /** Branch ids it is found in, and its message and widths in each. */
  in: string[];
  messages: Record<string, string>;
  widths: Record<string, number[]>;
  /** Measured branches it is not found in. */
  absent: string[];
  /** Branches not measured (skipped or failed): its absence there is not shown. */
  unmeasured: string[];
  where: BranchSetPart | BranchSetPart[];
  summary: string;
  /** Found in a `none` branch: the page as it ships breaks in that browser, whatever reset a host adds. */
  withoutReset: boolean;
}

export interface ResetMatrixSummary {
  holdsEverywhere: MatrixFinding[];
  onlyIn: MatrixFinding[];
  unmeasured: { id: string; status: "skipped" | "failed"; error: string }[];
  /** Measured branches with the same findings (by key), largest group first. */
  equivalent: string[][];
  space: BranchSpace & { total: number; measured: number };
}

export function summarizeResetMatrix(runs: readonly BranchRun[], space: BranchSpace): ResetMatrixSummary {
  const measured = runs.filter((r) => r.status === "measured");
  const unmeasured = runs.filter((r) => r.status !== "measured");
  const byKey = new Map<string, Omit<MatrixFinding, "absent" | "unmeasured" | "where" | "summary" | "withoutReset">>();
  for (const run of measured)
    for (const f of run.findings) {
      const key = findingKey(f);
      let e = byKey.get(key);
      if (!e) {
        e = {
          key,
          kind: f.kind,
          severity: f.severity,
          ...(f.selector ? { selector: f.selector } : {}),
          in: [],
          messages: {},
          widths: {},
        };
        byKey.set(key, e);
      }
      if (f.severity === "fail") e.severity = "fail";
      if (!e.in.includes(run.id)) {
        e.in.push(run.id);
        e.messages[run.id] = f.message;
        e.widths[run.id] = f.widths;
      }
    }
  // The summary is said over the branches measured: a product over a space with holes would name branches
  // nobody looked at.
  const analysed = {
    uas: space.uas.filter((u) => measured.some((r) => r.ua === u)),
    resets: space.resets.filter((x) => measured.some((r) => r.reset === x)),
  };
  const holdsEverywhere: MatrixFinding[] = [];
  const onlyIn: MatrixFinding[] = [];
  for (const e of byKey.values()) {
    const out: MatrixFinding = {
      ...e,
      absent: measured.filter((r) => !e.in.includes(r.id)).map((r) => r.id),
      unmeasured: unmeasured.map((r) => r.id),
      ...describeBranchSet(e.in, analysed),
      withoutReset: e.in.some((id) => id.endsWith(":none")),
    };
    (e.in.length === measured.length ? holdsEverywhere : onlyIn).push(out);
  }
  const groups = new Map<string, string[]>();
  for (const run of measured) {
    const k = run.findings
      .map((f) => findingKey(f))
      .sort()
      .join("\n");
    groups.set(k, [...(groups.get(k) ?? []), run.id]);
  }
  return {
    holdsEverywhere,
    onlyIn,
    unmeasured: unmeasured.map((r) => ({
      id: r.id,
      status: r.status as "skipped" | "failed",
      error: r.error ?? "not measured",
    })),
    equivalent: [...groups.values()].sort((a, b) => b.length - a.length),
    space: { uas: space.uas, resets: space.resets, total: runs.length, measured: measured.length },
  };
}

// ---------------------------------------------------------------------------
// veriss against the browser

/**
 * What veriss said about one branch at one width (`analyzeResetMatrix` with min = max = that width):
 * the boxes it reports as not fitting their parent on the inline axis (`E_LAYOUT_ITEM_SIZE`), by path, and
 * whether it decided the whole branch (no Unknown anywhere), which is what lets its silence about a box mean
 * "fits".
 */
export interface VerissBranchClaim {
  id: string;
  width: number;
  status: string;
  /** No Unknown diagnostic: a box veriss does not report fits, by veriss. */
  decided: boolean;
  overflows: { path: string; label: string; message: string }[];
}

/**
 * What the browser drew for the same branch and width: every in-flow box whose border box sticks out past its
 * parent's content box on the inline axis, by veriss's path, and the paths whose element veriss's label does
 * not name (left out of the comparison: the trees disagree, not the layouts).
 */
export interface BrowserBranchBoxes {
  id: string;
  width: number;
  overflows: { path: string; label: string; amount: number }[];
  unmapped: string[];
}

export interface VerissDisagreement {
  id: string;
  width: number;
  path: string;
  label: string;
  /** What veriss said and what the browser drew. */
  veriss: "overflows" | "fits";
  browser: "overflows" | "fits";
  detail: string;
}

export interface VerissComparison {
  /** Branch × width pairs veriss analysed. */
  pairs: number;
  /** Pairs where veriss decided the whole branch (no Unknown). */
  decided: number;
  /** Decided pairs where veriss and the browser agree on every box (including "nothing overflows"). */
  agreedPairs: number;
  /** Boxes compared, and those where veriss and the browser said the same. */
  compared: number;
  agreed: number;
  disagreements: VerissDisagreement[];
  /** Per branch: pairs decided, boxes compared and agreed. */
  perBranch: Record<string, { pairs: number; decided: number; agreedPairs: number; compared: number; agreed: number }>;
}

/**
 * veriss's `E_LAYOUT_ITEM_SIZE` (inline axis) held to the browser, as veriss's own e2e spec holds it: a box veriss
 * reports as not fitting sticks out past its parent's content box in the browser, and in a branch veriss decided,
 * a box it does not report does not. A claim veriss makes is decided wherever it is made; its silence only where it
 * decided the branch.
 */
export function compareVerissClaims(
  claims: readonly VerissBranchClaim[],
  boxes: readonly BrowserBranchBoxes[],
): VerissComparison {
  const out: VerissComparison = {
    pairs: 0,
    decided: 0,
    agreedPairs: 0,
    compared: 0,
    agreed: 0,
    disagreements: [],
    perBranch: {},
  };
  for (const c of claims) {
    const drawn = boxes.find((b) => b.id === c.id && b.width === c.width);
    if (!drawn) continue;
    const row = (out.perBranch[c.id] ??= { pairs: 0, decided: 0, agreedPairs: 0, compared: 0, agreed: 0 });
    const before = out.disagreements.length;
    out.pairs++;
    row.pairs++;
    if (c.decided) {
      out.decided++;
      row.decided++;
    }
    const unmapped = new Set(drawn.unmapped);
    const said = new Map(c.overflows.map((o) => [o.path, o]));
    const seen = new Map(drawn.overflows.map((o) => [o.path, o]));
    const paths = [...new Set([...said.keys(), ...(c.decided ? seen.keys() : [])])].filter((p) => !unmapped.has(p));
    for (const path of paths) {
      const v = said.get(path);
      const b = seen.get(path);
      out.compared++;
      row.compared++;
      if (!!v === !!b) {
        out.agreed++;
        row.agreed++;
        continue;
      }
      out.disagreements.push({
        id: c.id,
        width: c.width,
        path,
        label: v?.label ?? b!.label,
        veriss: v ? "overflows" : "fits",
        browser: b ? "overflows" : "fits",
        detail: v
          ? `veriss: "${v.message}"; the browser draws ${v.label} inside its parent's content box`
          : `the browser draws ${b!.label} ${b!.amount}px past its parent's content box; veriss decided the branch and reports no E_LAYOUT_ITEM_SIZE for it`,
      });
    }
    if (c.decided && out.disagreements.length === before) {
      out.agreedPairs++;
      row.agreedPairs++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Findings

export type ResetMatrixRule =
  | "redirected"
  | "every-branch"
  | "branch-defect"
  | "branch-unmeasured"
  | "veriss-disagrees";

export interface ResetMatrixFinding {
  rule: ResetMatrixRule;
  severity: "suspect" | "warn";
  message: string;
  selector?: string;
  evidence?: Record<string, unknown>;
}

const widthsText = (w: Record<string, number[]>) => {
  const all = [...new Set(Object.values(w).flat())].sort((a, b) => b - a);
  return all.map((x) => `${x}px`).join(", ");
};

/**
 * The findings. A defect in every branch keeps `check integrity`'s severity. A defect only in some keeps it when a
 * `none` branch has it (the page as shipped breaks in that browser) and is a warn when only resets the page does not
 * ship bring it (it breaks where a host page adds one: a component's concern). A branch that failed to load is a
 * suspect; one whose engine is not installed a warn. veriss's disagreement is a warn: veriss is wrong, not the page.
 */
export function judgeResetMatrix(input: {
  summary: ResetMatrixSummary;
  veriss?: VerissComparison | null;
  redirect?: string | null;
}): ResetMatrixFinding[] {
  const out: ResetMatrixFinding[] = [];
  if (input.redirect) out.push({ rule: "redirected", severity: "suspect", message: input.redirect });
  const { summary } = input;
  for (const f of summary.holdsEverywhere)
    out.push({
      rule: "every-branch",
      severity: f.severity === "fail" ? "suspect" : "warn",
      message: `[${f.kind}] in every branch measured (${summary.space.measured}) at ${widthsText(f.widths)}: ${f.messages[f.in[0]!]}`,
      ...(f.selector ? { selector: f.selector } : {}),
      evidence: { kind: f.kind, in: f.in, unmeasured: f.unmeasured },
    });
  for (const f of summary.onlyIn) {
    const first = f.in[0]!;
    out.push({
      rule: "branch-defect",
      severity: f.severity === "fail" && f.withoutReset ? "suspect" : "warn",
      message: `[${f.kind}] only in ${f.summary} (${f.in.length} of ${summary.space.measured} branches) at ${widthsText(f.widths)}: ${f.messages[first]}${f.withoutReset ? "" : " — not in any branch without a reset: it breaks where a host page adds one of these resets"}`,
      ...(f.selector ? { selector: f.selector } : {}),
      evidence: {
        kind: f.kind,
        where: f.where,
        summary: f.summary,
        in: f.in,
        absent: f.absent,
        unmeasured: f.unmeasured,
        widths: f.widths,
        withoutReset: f.withoutReset,
      },
    });
  }
  for (const u of summary.unmeasured)
    out.push({
      rule: "branch-unmeasured",
      severity: u.status === "failed" ? "suspect" : "warn",
      message: `${u.id} was not measured (${u.status}): ${u.error}`,
      evidence: { id: u.id, status: u.status },
    });
  for (const d of input.veriss?.disagreements ?? [])
    out.push({
      rule: "veriss-disagrees",
      severity: "warn",
      message: `${d.id} @${d.width}px: veriss says ${d.label} ${d.veriss === "overflows" ? "does not fit" : "fits"}, the browser ${d.browser === "overflows" ? "draws it outside" : "draws it inside"} its parent's content box — ${d.detail}`,
      evidence: { ...d },
    });
  return out;
}
