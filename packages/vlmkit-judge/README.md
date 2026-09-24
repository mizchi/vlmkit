# @mizchi/vlmkit-judge

The pure layer of [vlmkit](https://github.com/mizchi/vlmkit): judges that take a
plain snapshot — boxes, colours, style signatures — and return findings. It has
no Playwright, no DOM, no Node built-ins, and no dependencies; `purity.test.ts`
enforces that.

```ts
import { judgeComposition } from "@mizchi/vlmkit-judge/composition.ts";

const report = judgeComposition({ boxes, viewport: { width: 1280, height: 720 } });
report.verdict; // "composed" | "unbalanced" | "not-judged"
```

| Module | Judge | Used by |
|---|---|---|
| `composition.ts` | `judgeComposition` — 近接 / 整列 / 対比 | `vlmkit check composition` |
| `color-roles.ts` | `judgeColorRoles` — palette by role, WCAG 1.4.11 / 1.4.1 | `vlmkit check color` |
| `design-policy.ts` | `judgeDesignPolicy` — style-signature reuse | `vlmkit check design` |
| `allow.ts` | `parseSelectorAllowRules`, `selectorAllowFilter` — the `--allow "<selector>;<reason>"` form | every style gate |
| `errors.ts` | `UsageError` | re-exported by `@mizchi/vlmkit-core/cli-error.ts` |

The browser half — the in-page collectors that produce these snapshots, and the
runners that drive Playwright — stays in `@mizchi/vlmkit-markup`, which
re-exports everything here from its original paths. A snapshot doesn't have to
come from a browser: `scene-graph.test.ts` judges a game menu written as a
scene graph.

Why the split exists and what moves next: `docs/design/package-decomposition.md`.
