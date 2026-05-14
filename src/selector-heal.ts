/**
 * Self-healing selectors.
 *
 * When a Playwright action fails because its CSS selector doesn't
 * match (or matches a hidden element), inspect the page for the
 * closest plausible replacement and surface candidates. Inspired by
 * the browser-use/browser-harness self-healing pattern: rather than
 * fail with a generic "selector miss," tell the agent what to fix.
 *
 * The healer looks at three signals:
 *   - tag similarity (button → button)
 *   - class-name token overlap (`.nav-toggle` → `.navigation-toggle`)
 *   - text content similarity (`.cancel` → element containing "Cancel")
 *
 * Returns ranked candidates with a confidence score so the caller
 * can decide whether to suggest, auto-apply, or just report.
 */
import type { Page } from "playwright";

export interface HealCandidate {
  selector: string;
  tag: string;
  text: string;
  /** Confidence ∈ [0, 1]. Higher = more likely the intended target. */
  confidence: number;
  /** Diagnostics: which signals contributed. */
  reasons: string[];
}

/**
 * Given a selector that failed to match (or matched a hidden element)
 * and the page, return ranked candidate selectors that *might* be
 * the intended target.
 */
export async function healSelector(
  page: Page,
  brokenSelector: string,
  options: { maxCandidates?: number } = {},
): Promise<HealCandidate[]> {
  const maxCandidates = options.maxCandidates ?? 5;
  const parsed = parseSelector(brokenSelector);
  return await page.evaluate(
    ({ parsed, maxCandidates }) => {
      function tokenize(s: string): string[] {
        return s.toLowerCase().split(/[^a-z0-9]+/i).filter((t) => t.length > 1);
      }
      function jaccard(a: string[], b: string[]): number {
        if (a.length === 0 && b.length === 0) return 0;
        const sa = new Set(a), sb = new Set(b);
        let inter = 0;
        for (const t of sa) if (sb.has(t)) inter++;
        const union = sa.size + sb.size - inter;
        return union === 0 ? 0 : inter / union;
      }
      function shortSelector(el: Element): string {
        if (el.id) return "#" + CSS.escape(el.id);
        if (el.className && typeof el.className === "string") {
          const classes = el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2);
          if (classes.length > 0) {
            return el.tagName.toLowerCase() + "." + classes.map((c) => CSS.escape(c)).join(".");
          }
        }
        return el.tagName.toLowerCase();
      }

      const targetTokens = tokenize(parsed.classNames.join(" ") + " " + (parsed.text ?? "") + " " + (parsed.id ?? ""));
      const targetTag = parsed.tag;
      const targetTextLc = (parsed.text ?? "").toLowerCase();

      // Candidate population: only visible elements that are
      // interactive-ish OR that match the target tag.
      const interactiveSelectors = "button, a[href], input, select, textarea, summary, [role='button'], [role='link'], [tabindex]";
      const seen = new Set<Element>();
      const candidates: HealCandidate[] = [];
      const elements = new Set<Element>();
      for (const el of document.querySelectorAll(interactiveSelectors)) elements.add(el);
      if (targetTag) {
        for (const el of document.querySelectorAll(targetTag)) elements.add(el);
      }

      for (const el of elements) {
        if (seen.has(el)) continue;
        seen.add(el);
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.1) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        const tag = el.tagName.toLowerCase();
        const classNames = (el.className && typeof el.className === "string"
          ? el.className.trim().split(/\s+/)
          : []) as string[];
        const text = (el.textContent || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().slice(0, 60);
        const reasons: string[] = [];
        let score = 0;

        if (targetTag && tag === targetTag) {
          score += 0.2;
          reasons.push("same tag");
        }
        const candidateTokens = tokenize(classNames.join(" ") + " " + text + " " + (el.id || ""));
        const j = jaccard(targetTokens, candidateTokens);
        if (j > 0) {
          score += j * 0.5;
          reasons.push(`token similarity ${j.toFixed(2)}`);
        }
        if (targetTextLc && text.toLowerCase().includes(targetTextLc)) {
          score += 0.3;
          reasons.push("text contains target");
        }
        // Class-substring fallback (e.g. .nav-toggle vs .navigation-toggle)
        if (parsed.classNames.length > 0) {
          for (const tc of parsed.classNames) {
            for (const cc of classNames) {
              if (cc.toLowerCase().includes(tc.toLowerCase()) || tc.toLowerCase().includes(cc.toLowerCase())) {
                score += 0.15;
                reasons.push(`class substring (\`${tc}\` ↔ \`${cc}\`)`);
                break;
              }
            }
          }
        }

        if (score <= 0.05) continue;
        candidates.push({
          selector: shortSelector(el),
          tag, text,
          confidence: Math.min(1, score),
          reasons,
        });
      }

      candidates.sort((a, b) => b.confidence - a.confidence);
      return candidates.slice(0, maxCandidates);
    },
    { parsed, maxCandidates },
  );
}

interface ParsedSelector {
  tag: string;
  id?: string;
  classNames: string[];
  text?: string;
}

/**
 * Very loose CSS selector parser — extracts tag, classes, id, and
 * any quoted text fragments (`:has-text("…")` is Playwright-specific).
 * Good enough for healing heuristics; the broken selector is by
 * definition not parseable by the page anyway.
 */
function parseSelector(selector: string): ParsedSelector {
  const out: ParsedSelector = { tag: "", classNames: [] };
  // tag — leading word
  const tagMatch = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
  if (tagMatch) out.tag = tagMatch[1]!.toLowerCase();
  // id
  const idMatch = selector.match(/#([a-zA-Z][\w-]*)/);
  if (idMatch) out.id = idMatch[1]!;
  // classes
  const classMatches = selector.matchAll(/\.([a-zA-Z][\w-]*)/g);
  for (const m of classMatches) out.classNames.push(m[1]!);
  // quoted text inside :has-text("...") or text=...
  const textMatch = selector.match(/(?::has-text|text\s*=)\(?["']([^"']+)["']\)?/);
  if (textMatch) out.text = textMatch[1];
  return out;
}
