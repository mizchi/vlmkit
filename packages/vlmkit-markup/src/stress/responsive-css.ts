/**
 * The page's own CSS, read and edited through the DevTools protocol for `check responsive`.
 *
 * The CSSOM cannot do this job. A stylesheet linked from a `file:` page is cross-origin in
 * Chromium, and so is one on a CDN: `sheet.cssRules` throws on both. Measured on the demo
 * sites (2026-09-26): every one links its CSS, so a CSSOM-only cause search tested nothing
 * there and said "no declaration to test", and the breakpoint move could not be tried. The
 * protocol reads every sheet the page has and gives, per element, the rules that apply now
 * in cascade order with their enclosing media and container queries — the cascade the
 * browser computed, rather than one re-derived from selector specificity by hand.
 *
 * Three uses, each with a pure half in `@mizchi/vlmkit-judge/responsive.ts`:
 *
 *   - `mediaConditions`   every media query text on the page, for the regime partition;
 *   - `causeCandidates`   the winning author declaration per property on tagged elements,
 *                         with the value that neutralises it (`neutralOverride`);
 *   - `moveConditions`    rewrite a media query's text in place (`CSS.setMediaText`), and
 *                         `restoreConditions` to put it back, so a suggested breakpoint is
 *                         tried on the real stylesheet.
 *
 * Chromium only. `openCssInspector` returns null elsewhere, and the runner says what it
 * could not do instead of pretending.
 */
import type { CDPSession, Page } from "playwright";
import { neutralOverride, type CauseCandidate } from "@mizchi/vlmkit-judge/responsive.ts";

interface CssProperty {
  name: string;
  value: string;
  important?: boolean;
  disabled?: boolean;
  parsedOk?: boolean;
  /** Present on authored declarations; the expanded longhands carry none. */
  range?: unknown;
}

interface CssRuleMatch {
  rule: {
    origin: string;
    styleSheetId?: string;
    selectorList: { text: string };
    style: { cssProperties: CssProperty[] };
    media?: { text: string; source: string }[];
    containerQueries?: { text: string }[];
  };
}

interface CssMedia {
  text: string;
  source: string;
  styleSheetId?: string;
  range?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
}

export interface TaggedNode {
  index: number;
  element: string;
  role: CauseCandidate["role"];
}

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, "");

export class CssInspector {
  private readonly sheets = new Map<string, { url: string; inline: boolean }>();
  private moved: { styleSheetId: string; range: CssMedia["range"]; text: string; to: string }[] = [];

  private constructor(private readonly session: CDPSession, private readonly documentUrl: string) {
    session.on("CSS.styleSheetAdded", (event: { header: { styleSheetId: string; sourceURL: string; isInline?: boolean } }) => {
      this.sheets.set(event.header.styleSheetId, { url: event.header.sourceURL, inline: event.header.isInline === true });
    });
  }

  static async open(page: Page): Promise<CssInspector | null> {
    let session: CDPSession;
    try {
      session = await page.context().newCDPSession(page);
    } catch {
      return null;
    }
    const inspector = new CssInspector(session, page.url());
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    return inspector;
  }

  private sheetName(styleSheetId: string | undefined): string {
    const sheet = styleSheetId ? this.sheets.get(styleSheetId) : undefined;
    if (!sheet) return "stylesheet";
    const file = (url: string) => url.split(/[?#]/)[0]!.split("/").pop() || url;
    return sheet.inline || sheet.url === this.documentUrl ? `<style> in ${file(this.documentUrl)}` : file(sheet.url);
  }

  async mediaConditions(): Promise<string[]> {
    const { medias } = await this.session.send("CSS.getMediaQueries") as { medias: CssMedia[] };
    return [...new Set(medias.map((m) => m.text.trim()).filter((t) => t && t !== "all" && t !== "screen"))];
  }

  /**
   * The winning author declaration for each layout property on each tagged node. The
   * protocol lists matching rules in cascade order, lowest first, so for one importance
   * the last declaration wins; an `!important` one beats any that is not; the style
   * attribute comes last. Declarations only — the longhands a shorthand expands into are
   * skipped, so `flex: 0 0 auto` is one candidate, not four.
   */
  async causeCandidates(tagged: readonly TaggedNode[]): Promise<(CauseCandidate & { node: number })[]> {
    const { root } = await this.session.send("DOM.getDocument", { depth: 0 }) as { root: { nodeId: number } };
    const { nodeIds } = await this.session.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "[data-vlmkit-pbt]" }) as { nodeIds: number[] };
    const byIndex = new Map(tagged.map((t) => [t.index, t]));
    const out: (CauseCandidate & { node: number })[] = [];
    for (const nodeId of nodeIds) {
      const { attributes } = await this.session.send("DOM.getAttributes", { nodeId }) as { attributes: string[] };
      const at = attributes.indexOf("data-vlmkit-pbt");
      const node = byIndex.get(Number(attributes[at + 1]));
      if (!node) continue;
      const matched = await this.session.send("CSS.getMatchedStylesForNode", { nodeId }) as {
        matchedCSSRules?: CssRuleMatch[];
        inlineStyle?: { cssProperties: CssProperty[] };
      };
      const winners = new Map<string, { important: boolean; order: number; value: string; rule: string; media: string[]; sheet: string }>();
      const consider = (p: CssProperty, order: number, rule: string, media: string[], sheet: string) => {
        if (p.range === undefined || p.disabled || p.parsedOk === false) return;
        const important = p.important === true;
        const prev = winners.get(p.name);
        if (prev && (prev.important && !important)) return;
        if (prev && prev.important === important && prev.order > order) return;
        winners.set(p.name, { important, order, value: p.value, rule, media, sheet });
      };
      (matched.matchedCSSRules ?? []).forEach((match, order) => {
        if (match.rule.origin !== "regular") return;
        const media = [
          ...(match.rule.media ?? []).filter((m) => m.source === "mediaRule" || m.source === "importRule").map((m) => m.text),
          ...(match.rule.containerQueries ?? []).map((q) => `@container ${q.text}`),
        ];
        for (const p of match.rule.style.cssProperties) {
          consider(p, order, match.rule.selectorList.text, media, this.sheetName(match.rule.styleSheetId));
        }
      });
      for (const p of matched.inlineStyle?.cssProperties ?? []) consider(p, Number.MAX_SAFE_INTEGER, "style attribute", [], "inline");
      for (const [property, w] of winners) {
        const override = neutralOverride(property, w.value);
        if (override === null) continue;
        out.push({
          node: node.index,
          element: node.element,
          role: node.role,
          property,
          value: w.value.trim(),
          override,
          rule: w.rule,
          media: w.media,
          sheet: w.sheet,
        });
      }
    }
    return out;
  }

  /**
   * Rewrite every `@media` whose text is `from` to `to`, in the page's stylesheets.
   * Re-queried after each edit, because an edit shifts the ranges after it on the same
   * line (a minified sheet is one line); undone in reverse order by `restoreConditions`.
   */
  async moveConditions(moves: readonly { from: string; to: string }[]): Promise<number> {
    let rewritten = 0;
    for (const move of moves) {
      for (let guard = 0; guard < 32; guard++) {
        const { medias } = await this.session.send("CSS.getMediaQueries") as { medias: CssMedia[] };
        const target = medias.find((m) => m.source === "mediaRule" && m.styleSheetId && m.range
          && normalise(m.text) === normalise(move.from));
        if (!target) break;
        const { media } = await this.session.send("CSS.setMediaText", {
          styleSheetId: target.styleSheetId!,
          range: target.range!,
          text: move.to,
        }) as { media: CssMedia };
        this.moved.push({ styleSheetId: target.styleSheetId!, range: media.range, text: target.text, to: move.to });
        rewritten++;
      }
    }
    return rewritten;
  }

  /**
   * Undo `moveConditions`, last edit first. Each edit is found again by its new text in its
   * sheet, nearest to where it was written: a later edit earlier on the same line has
   * shifted the range the protocol returned for it.
   */
  async restoreConditions(): Promise<void> {
    for (const m of this.moved.reverse()) {
      const { medias } = await this.session.send("CSS.getMediaQueries") as { medias: CssMedia[] };
      const distance = (r: CssMedia["range"]) =>
        r && m.range ? Math.abs(r.startLine - m.range.startLine) * 1e6 + Math.abs(r.startColumn - m.range.startColumn) : 0;
      const found = medias
        .filter((x) => x.styleSheetId === m.styleSheetId && x.range && normalise(x.text) === normalise(m.to))
        .sort((a, b) => distance(a.range) - distance(b.range))[0];
      if (!found) continue;
      await this.session.send("CSS.setMediaText", { styleSheetId: m.styleSheetId, range: found.range!, text: m.text }).catch(() => {});
    }
    this.moved = [];
  }

  async close(): Promise<void> {
    await this.session.detach().catch(() => {});
  }
}
