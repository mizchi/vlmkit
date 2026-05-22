# Robot voxel motion — VLM review dogfood (2026-05-23)

Cross-VLM consistency check on the procedurally-generated voxel robot
fixture, using the new recommended Stage-1 combo
(`ui-tars-1.5-7b`) and the Stage-2 LLM (`gemini-2.5-flash`) as a
second VLM reviewer.

## Setup

- VLM A: `bytedance/ui-tars-1.5-7b` (OpenRouter)
- VLM B: `google/gemini-2.5-flash` (OpenRouter)
- Asset under test: `robot-voxel-motion.glb` + retargeted external
  VRMA clips (`Jump`, `LookAround`, `Goodbye`).
- Tool: `design-runs/game-assets-20260520/tools/review-motion-with-vlm.mjs`
  with `--models bytedance/ui-tars-1.5-7b,google/gemini-2.5-flash`.

## Motion review results

3 motions × 2 reviewers = 6 reviews.

| Motion | Reviewer | Verdict | Confidence | Defects | Cost | Latency |
|---|---|---:|---:|---|---:|---:|
| Jump | ui-tars | pass | 0.98 | `ground-penetration(low)` | $0.000392 | 2.7s |
| Jump | gemini-2.5-flash | pass | 1.00 | (none) | $0.002064 | 1.7s |
| LookAround | ui-tars | pass | 1.00 | (none) | $0.000380 | 1.3s |
| LookAround | gemini-2.5-flash | pass | 1.00 | (none) | $0.001312 | 24.1s ⚠ |
| Goodbye | ui-tars | pass | 0.90 | (none) | $0.000380 | 2.1s |
| Goodbye | gemini-2.5-flash | pass | 1.00 | (none) | $0.002080 | 2.1s |

All 6 reviews land on `pass`. ui-tars catches a low-severity
`ground-penetration` artifact on Jump that gemini misses — small
sub-surface sinking visible in iso renders. The deterministic motion
quality gate also reports pass for all three.

## Static bind-pose review

Free-form prompt asking each VLM to grade the iso render of
`robot-voxel-motion-glb-material-iso.png` (the bind-pose voxel robot)
on silhouette / proportions / separability:

| Reviewer | Verdict | Silhouette | Proportions | Separability | Cost |
|---|---|---|---|---|---:|
| ui-tars | pass | clean | humanoid-ok | limbs-distinct | $0.00017 |
| gemini-2.5-flash | pass | clean | humanoid-ok | limbs-distinct | $0.00064 |

Both agree the procedural voxel robot is well-formed.

## Cost comparison

| Reviewer | $/review (avg) | $/review (max) | Latency (avg) |
|---|---:|---:|---:|
| ui-tars-1.5-7b | ~$0.0004 | $0.0004 | ~2.0s |
| gemini-2.5-flash | ~$0.0016 | $0.0021 | ~9.3s (24s outlier) |

ui-tars is ~4× cheaper per review with comparable verdicts. gemini's
latency is variable — LookAround took 24s likely due to a cold model
state — and probably not suitable as the primary fast-path reviewer.

Total dogfood cost: **~$0.011** (3 motions × 2 reviewers + 1 static ×
2 reviewers).

## Observations

- **Both VLMs reliably distinguish coherent voxel humanoid from noise**
  — pass verdicts are unanimous on this well-formed fixture.
- **ui-tars sees finer defect detail** — ground-penetration catch on
  Jump is a real artifact the iso renders show.
- **gemini is "over-pass" on motion review** — 0 defects across all 3
  motions despite ui-tars catching one in Jump. May rubber-stamp.
- **ui-tars hallucinates jargon in free-form `summary` text** ("Test
  RGB derivatives by GLTFanimator without issues" in Jump). The
  structured `verdict` / `defects` fields stay grounded; the prose
  drift is local to the summary line.

## Recommendation for the G3 multi-VLM review gate

Default reviewer pair already documented in CLAUDE.md is
`ui-tars-1.5-7b + amazon/nova-lite-v1`. Based on this dogfood:

- Keep `ui-tars-1.5-7b` as the primary (cheapest, fastest, catches
  real defects).
- Adding `gemini-2.5-flash` as a second opinion is viable but its
  latency variability and zero-defect bias make it less attractive
  than `nova-lite-v1` for a consensus gate.
- For a **single-reviewer** workflow (no consensus), ui-tars at
  $0.0004 / 2s is the clear pick.

## Artifacts

- VLM review JSON:
  `/tmp/dogfood-eval/robot-motion-review/{Jump,LookAround,Goodbye}.vlm.json`
- Contact sheets:
  `/tmp/dogfood-eval/robot-motion-review/{Jump,LookAround,Goodbye}-contact.png`
- Static review request:
  `/tmp/dogfood-eval/robot-motion-review/static-request.json`
