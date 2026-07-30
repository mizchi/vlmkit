/** Empirically calibrated reporting thresholds for `vrt interact --heal-all`.
 *
 * See docs/reports/data/2026-07-30-selector-heal-calibration.json.
 * The strong cutoff intentionally favours precision: the corpus has no false
 * positives at >= 0.40, while 0.30 admitted an incorrect sibling suggestion.
 */
export const STRONG_HEAL_THRESHOLD = 0.4;
export const WEAK_HEAL_THRESHOLD = 0.15;

export type HealTier = "strong" | "weak" | "none";

export function classifyHealTier(confidence: number): HealTier {
  if (confidence >= STRONG_HEAL_THRESHOLD) return "strong";
  if (confidence >= WEAK_HEAL_THRESHOLD) return "weak";
  return "none";
}
