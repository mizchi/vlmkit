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
  range?: { startLine: number; startColumn: number; endLine?: number; endColumn?: number };
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

/** A node of `DOM.getDocument`, as far as the sheet order needs it. */
interface DomNode {
  backendNodeId: number;
  /** Name, value, name, value… */
  attributes?: string[];
  children?: DomNode[];
  contentDocument?: DomNode;
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
  private readonly sheets = new Map<
    string,
    { url: string; inline: boolean; startLine: number; origin: string; ownerNode?: number; disabled: boolean }
  >();
  private moved: { styleSheetId: string; range: CssMedia["range"]; text: string; to: string }[] = [];

  private constructor(
    private readonly session: CDPSession,
    private readonly documentUrl: string,
  ) {
    session.on(
      "CSS.styleSheetAdded",
      (event: {
        header: {
          styleSheetId: string;
          sourceURL: string;
          isInline?: boolean;
          startLine?: number;
          origin?: string;
          ownerNode?: number;
          disabled?: boolean;
        };
      }) => {
        this.sheets.set(event.header.styleSheetId, {
          url: event.header.sourceURL,
          inline: event.header.isInline === true,
          startLine: event.header.startLine ?? 0,
          origin: event.header.origin ?? "regular",
          ...(event.header.ownerNode !== undefined ? { ownerNode: event.header.ownerNode } : {}),
          disabled: event.header.disabled === true,
        });
      },
    );
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
    const { medias } = (await this.session.send("CSS.getMediaQueries")) as { medias: CssMedia[] };
    return [...new Set(medias.map((m) => m.text.trim()).filter((t) => t && t !== "all" && t !== "screen"))];
  }

  /** How many stylesheets the protocol has reported (linked, `<style>`, imported). */
  get sheetCount(): number {
    return this.sheets.size;
  }

  /** A 1-based line in the file the sheet lives in (an inline `<style>` is offset by where it starts). */
  private fileLine(styleSheetId: string | undefined, line: number | undefined): number | undefined {
    if (line === undefined) return undefined;
    return (styleSheetId ? (this.sheets.get(styleSheetId)?.startLine ?? 0) : 0) + line + 1;
  }

  /**
   * Every authored declaration the browser did not parse (`parsedOk: false`) in an author rule
   * matching one of the first `limit` elements (or their pseudo-elements), once per declaration
   * however many elements its rule matches. Rules under a media query that does not match now
   * are not seen: the protocol lists the rules that apply.
   */
  async unparsedDeclarations(limit: number): Promise<{
    elements: number;
    declarations: {
      selector: string;
      property: string;
      value: string;
      sheet: string;
      line?: number;
      elements: number;
    }[];
  }> {
    const { root } = (await this.session.send("DOM.getDocument", { depth: 0 })) as { root: { nodeId: number } };
    const { nodeIds } = (await this.session.send("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector: "*",
    })) as { nodeIds: number[] };
    const found = new Map<
      string,
      { selector: string; property: string; value: string; sheet: string; line?: number; elements: number }
    >();
    const inspected = nodeIds.slice(0, limit);
    for (const nodeId of inspected) {
      const matched = (await this.session.send("CSS.getMatchedStylesForNode", { nodeId }).catch(() => ({}))) as {
        matchedCSSRules?: CssRuleMatch[];
        pseudoElements?: { matches: CssRuleMatch[] }[];
      };
      const counted = new Set<string>();
      for (const match of [
        ...(matched.matchedCSSRules ?? []),
        ...(matched.pseudoElements ?? []).flatMap((p) => p.matches),
      ]) {
        if (match.rule.origin !== "regular") continue;
        for (const p of match.rule.style.cssProperties) {
          if (p.parsedOk !== false || p.range === undefined || p.disabled) continue;
          const key = `${match.rule.styleSheetId}\u0000${p.range.startLine}:${p.range.startColumn}`;
          const prev = found.get(key);
          if (prev) {
            if (!counted.has(key)) prev.elements++;
          } else {
            const line = this.fileLine(match.rule.styleSheetId, p.range.startLine);
            found.set(key, {
              selector: match.rule.selectorList.text,
              property: p.name,
              value: p.value.trim(),
              sheet: this.sheetName(match.rule.styleSheetId),
              ...(line !== undefined ? { line } : {}),
              elements: 1,
            });
          }
          counted.add(key);
        }
      }
    }
    return { elements: inspected.length, declarations: [...found.values()] };
  }

  /**
   * Every authored, parsed declaration of an author rule matching one of the first `limit`
   * elements (pseudo-elements left out), with the elements it matches as protocol node ids.
   * `accept` filters by property name before anything is kept.
   */
  async matchedDeclarations(
    limit: number,
    accept: (property: string) => boolean,
  ): Promise<{
    elements: number;
    declarations: {
      selector: string;
      property: string;
      value: string;
      key: string;
      sheet: string;
      line?: number;
      styleSheetId: string;
      range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
      nodes: number[];
    }[];
  }> {
    const { root } = (await this.session.send("DOM.getDocument", { depth: 0 })) as { root: { nodeId: number } };
    const { nodeIds } = (await this.session.send("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector: "*",
    })) as { nodeIds: number[] };
    const found = new Map<string, Awaited<ReturnType<CssInspector["matchedDeclarations"]>>["declarations"][number]>();
    const inspected = nodeIds.slice(0, limit);
    for (const nodeId of inspected) {
      const matched = (await this.session.send("CSS.getMatchedStylesForNode", { nodeId }).catch(() => ({}))) as {
        matchedCSSRules?: CssRuleMatch[];
      };
      for (const match of matched.matchedCSSRules ?? []) {
        if (match.rule.origin !== "regular" || !match.rule.styleSheetId) continue;
        for (const p of match.rule.style.cssProperties) {
          const r = p.range;
          if (!r || r.endLine === undefined || r.endColumn === undefined || p.disabled || p.parsedOk === false)
            continue;
          if (!accept(p.name.toLowerCase())) continue;
          const key = `${match.rule.styleSheetId}\u0000${r.startLine}:${r.startColumn}`;
          const prev = found.get(key);
          if (prev) {
            if (!prev.nodes.includes(nodeId)) prev.nodes.push(nodeId);
            continue;
          }
          const line = this.fileLine(match.rule.styleSheetId, r.startLine);
          found.set(key, {
            selector: match.rule.selectorList.text,
            property: p.name.toLowerCase(),
            value: p.value.trim() + (p.important ? " !important" : ""),
            key,
            sheet: this.sheetName(match.rule.styleSheetId),
            ...(line !== undefined ? { line } : {}),
            styleSheetId: match.rule.styleSheetId,
            range: { startLine: r.startLine, startColumn: r.startColumn, endLine: r.endLine, endColumn: r.endColumn },
            nodes: [nodeId],
          });
        }
      }
    }
    return { elements: inspected.length, declarations: [...found.values()] };
  }

  /** Run a function body on the element a protocol node id names (`this` is the element), and return its JSON value. */
  async onNode<T>(nodeId: number, body: string): Promise<T | null> {
    try {
      const { object } = (await this.session.send("DOM.resolveNode", { nodeId })) as { object: { objectId?: string } };
      if (!object.objectId) return null;
      const { result } = (await this.session.send("Runtime.callFunctionOn", {
        objectId: object.objectId,
        functionDeclaration: `function () {${body}\n}`,
        returnByValue: true,
      })) as { result: { value?: T } };
      return result.value ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Blank the given ranges of their sheets (each character turned into a space, line breaks
   * kept, so every other range stays where it was), run `fn`, then put every sheet's text back.
   */
  async withoutRanges<T>(
    edits: readonly {
      styleSheetId: string;
      range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
    }[],
    fn: () => Promise<T>,
  ): Promise<T> {
    const original = new Map<string, string>();
    for (const e of edits)
      if (!original.has(e.styleSheetId)) {
        const { text } = (await this.session.send("CSS.getStyleSheetText", { styleSheetId: e.styleSheetId })) as {
          text: string;
        };
        original.set(e.styleSheetId, text);
      }
    try {
      for (const [id, text] of original) {
        const lines = text.split("\n");
        for (const e of edits.filter((x) => x.styleSheetId === id))
          for (let l = e.range.startLine; l <= e.range.endLine; l++) {
            const line = lines[l] ?? "";
            const from = l === e.range.startLine ? e.range.startColumn : 0;
            const to = l === e.range.endLine ? e.range.endColumn : line.length;
            lines[l] = line.slice(0, from) + " ".repeat(Math.max(0, to - from)) + line.slice(to);
          }
        await this.session.send("CSS.setStyleSheetText", { styleSheetId: id, text: lines.join("\n") });
      }
      return await fn();
    } finally {
      for (const [id, text] of original)
        await this.session.send("CSS.setStyleSheetText", { styleSheetId: id, text }).catch(() => {});
    }
  }

  /**
   * The text of every author stylesheet the protocol has reported, in the order it reported them,
   * with the 1-based file line its first line sits at (an inline `<style>` is offset).
   */
  /**
   * The text of every author sheet, in document order (the order the cascade reads them; the protocol
   * reports them as they load). `unordered` counts the sheets with no owner element (an @import, a
   * constructed sheet), whose place in that order is not known here.
   */
  async sheetTexts(): Promise<{
    texts: { sheet: string; text: string; firstFileLine: number; media?: string }[];
    unordered: number;
  }> {
    // Each owner element's place in the document (preorder over the whole tree).
    const { root } = (await this.session.send("DOM.getDocument", { depth: -1 })) as { root: DomNode };
    const order = new Map<number, number>();
    // The media condition a sheet's owner gives it (<link media>, <style media>): its rules apply only there.
    const ownerMedia = new Map<number, string>();
    const walk = (n: DomNode) => {
      order.set(n.backendNodeId, order.size);
      const attrs = n.attributes ?? [];
      for (let i = 0; i + 1 < attrs.length; i += 2)
        if (attrs[i]!.toLowerCase() === "media" && attrs[i + 1]!.trim())
          ownerMedia.set(n.backendNodeId, attrs[i + 1]!.trim());
      for (const c of [...(n.children ?? []), ...(n.contentDocument ? [n.contentDocument] : [])]) walk(c);
    };
    walk(root);
    const regular = [...this.sheets].filter(([, h]) => h.origin === "regular" && !h.disabled);
    const unordered = regular.filter(([, h]) => h.ownerNode === undefined || !order.has(h.ownerNode)).length;
    regular.sort(
      ([, a], [, b]) => (order.get(a.ownerNode ?? -1) ?? Infinity) - (order.get(b.ownerNode ?? -1) ?? Infinity),
    );
    const out: { sheet: string; text: string; firstFileLine: number; media?: string }[] = [];
    for (const [id, header] of regular) {
      const got = (await this.session.send("CSS.getStyleSheetText", { styleSheetId: id }).catch(() => null)) as {
        text: string;
      } | null;
      const media = header.ownerNode !== undefined ? ownerMedia.get(header.ownerNode) : undefined;
      if (got)
        out.push({
          sheet: this.sheetName(id),
          text: got.text,
          firstFileLine: header.startLine + 1,
          ...(media && media.toLowerCase() !== "all" ? { media } : {}),
        });
    }
    return { texts: out, unordered };
  }

  /** Every `@media` rule's condition in the page's stylesheets, with where it is written. */
  async mediaRules(): Promise<{ condition: string; sheet: string; line?: number }[]> {
    const { medias } = (await this.session.send("CSS.getMediaQueries")) as { medias: CssMedia[] };
    const out: { condition: string; sheet: string; line?: number }[] = [];
    const seen = new Set<string>();
    for (const m of medias) {
      if (m.source !== "mediaRule") continue;
      const key = `${m.styleSheetId}\u0000${m.range?.startLine}:${m.range?.startColumn}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const line = this.fileLine(m.styleSheetId, m.range?.startLine);
      out.push({
        condition: m.text.trim(),
        sheet: this.sheetName(m.styleSheetId),
        ...(line !== undefined ? { line } : {}),
      });
    }
    return out;
  }

  /**
   * The winning author declaration for each layout property on each tagged node. The
   * protocol lists matching rules in cascade order, lowest first, so for one importance
   * the last declaration wins; an `!important` one beats any that is not; the style
   * attribute comes last. Declarations only — the longhands a shorthand expands into are
   * skipped, so `flex: 0 0 auto` is one candidate, not four.
   */
  async causeCandidates(tagged: readonly TaggedNode[]): Promise<(CauseCandidate & { node: number })[]> {
    const { root } = (await this.session.send("DOM.getDocument", { depth: 0 })) as { root: { nodeId: number } };
    const { nodeIds } = (await this.session.send("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector: "[data-vlmkit-pbt]",
    })) as { nodeIds: number[] };
    const byIndex = new Map(tagged.map((t) => [t.index, t]));
    const out: (CauseCandidate & { node: number })[] = [];
    for (const nodeId of nodeIds) {
      const { attributes } = (await this.session.send("DOM.getAttributes", { nodeId })) as { attributes: string[] };
      const at = attributes.indexOf("data-vlmkit-pbt");
      const node = byIndex.get(Number(attributes[at + 1]));
      if (!node) continue;
      const matched = (await this.session.send("CSS.getMatchedStylesForNode", { nodeId })) as {
        matchedCSSRules?: CssRuleMatch[];
        inlineStyle?: { cssProperties: CssProperty[] };
      };
      const winners = new Map<
        string,
        { important: boolean; order: number; value: string; rule: string; media: string[]; sheet: string }
      >();
      const consider = (p: CssProperty, order: number, rule: string, media: string[], sheet: string) => {
        if (p.range === undefined || p.disabled || p.parsedOk === false) return;
        const important = p.important === true;
        const prev = winners.get(p.name);
        if (prev && prev.important && !important) return;
        if (prev && prev.important === important && prev.order > order) return;
        winners.set(p.name, { important, order, value: p.value, rule, media, sheet });
      };
      (matched.matchedCSSRules ?? []).forEach((match, order) => {
        if (match.rule.origin !== "regular") return;
        const media = [
          ...(match.rule.media ?? [])
            .filter((m) => m.source === "mediaRule" || m.source === "importRule")
            .map((m) => m.text),
          ...(match.rule.containerQueries ?? []).map((q) => `@container ${q.text}`),
        ];
        for (const p of match.rule.style.cssProperties) {
          consider(p, order, match.rule.selectorList.text, media, this.sheetName(match.rule.styleSheetId));
        }
      });
      for (const p of matched.inlineStyle?.cssProperties ?? [])
        consider(p, Number.MAX_SAFE_INTEGER, "style attribute", [], "inline");
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
        const { medias } = (await this.session.send("CSS.getMediaQueries")) as { medias: CssMedia[] };
        const target = medias.find(
          (m) => m.source === "mediaRule" && m.styleSheetId && m.range && normalise(m.text) === normalise(move.from),
        );
        if (!target) break;
        const { media } = (await this.session.send("CSS.setMediaText", {
          styleSheetId: target.styleSheetId!,
          range: target.range!,
          text: move.to,
        })) as { media: CssMedia };
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
      const { medias } = (await this.session.send("CSS.getMediaQueries")) as { medias: CssMedia[] };
      const distance = (r: CssMedia["range"]) =>
        r && m.range
          ? Math.abs(r.startLine - m.range.startLine) * 1e6 + Math.abs(r.startColumn - m.range.startColumn)
          : 0;
      const found = medias
        .filter((x) => x.styleSheetId === m.styleSheetId && x.range && normalise(x.text) === normalise(m.to))
        .sort((a, b) => distance(a.range) - distance(b.range))[0];
      if (!found) continue;
      await this.session
        .send("CSS.setMediaText", { styleSheetId: m.styleSheetId, range: found.range!, text: m.text })
        .catch(() => {});
    }
    this.moved = [];
  }

  async close(): Promise<void> {
    await this.session.detach().catch(() => {});
  }
}
