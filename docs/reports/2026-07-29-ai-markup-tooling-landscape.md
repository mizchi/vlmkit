# AI + マークアップ支援ツールの動向調査(直近1年)と vlmkit の立ち位置

日付: 2026-07-29 / 調査: Web(2025 後半〜2026 前半の総括記事・比較記事)

## 結論(先出し)

- **生成(スクショ/Figma → コード)は完全にコモディティ化**。v0 / Lovable /
  Bolt / Builder Visual Copilot 2.0 / Anima / Locofy が横並びで、業界の
  総括は一様に「100% 本番コードを出す経路は無い / 20-40% は手直し」。
  → vlmkit は生成器では戦わない。価値は**検証器**側。
- **検証はピクセル VRT・セレクタ自己修復・静的 a11y スキャンに収束**。
  この 3 つの隙間 —「決定論的な done-condition」と
  「a11y イベント→状態遷移の契約」— が vlmkit の占有ニッチで、
  市場にまだ薄いことが調査で裏取りできた。
- **MCP が統合面のデファクト**。Playwright もエージェント各種も MCP に
  収束。vlmkit のゲートを MCP tool 化すれば他人のループに刺さる。

## 軸別マッピング

### 1. スクショ→コード生成
主要: v0, Lovable, Bolt.new, Builder.io Visual Copilot 2.0, Anima,
Locofy。総括記事はどれも「叩き台であって仕上げは人手」「20-40% 手直しが
プロトタイプと製品の差」で一致。**共通欠落 = done かどうかの判定器**。
vlmkit の verify-markup / composition がそこを埋める(生成でなく収束判定)。

### 2. VRT / Playwright
2026 の Playwright は `toHaveScreenshot()` 一級 VRT に加え **MCP・内蔵
エージェント・accessibility-tree-first 実行**を搭載。「self-healing」は
**壊れたセレクタの張り替え専用**で、タイミング flaky・環境ドリフト・
本物の製品リグレッションは直さない、と各記事が明言。
→ vlmkit の composition は VRT の代替でなく直交(リグレッション・ゲート
でなく done-condition)。統合面は MCP に寄せるべき。

### 3. a11y 検証 ← 最大の未占有ニッチ
市場は axe-core(静的 WCAG スキャン)に集約。新カテゴリの「AI a11y
エージェント」(EvinceAI 等)も alt-text 妥当性・ARIA 整合の**推論**止まり
= 静的スナップショットのルール評価か半自動ガイドテスト。
**キーボードイベントを発火して状態遷移(focus trap / roving /
activedescendant / announce)を決定論的に検証する軸は自動化が依然薄い。**
vlmkit の `check interactions` がまさにここで、APG 公式実装 dogfood
(tabs / menu-button)で外部妥当性も確認済み(追記12)。

### 4. エージェント修復 / ブラウザ自動化
browser-use(78k★)、Stagehand v3(2026-02、**action caching** で成功
アクション再利用 → LLM 呼び出し削減)、Skyvern(CV+LLM で視覚要素同定)。
**いずれもタスク自動化(ナビ・フォーム入力)であって、マークアップの
構築/修復ではない。** 共通弱点は「毎ステップ LLM 呼び出しでコスト高」。
最も思想が近いのは **Expect(git diff からコーディングエージェント内で
テスト生成)** = ループ内検証。
→ vlmkit の決定論ツールは per-step LLM を避ける設計で優位。この領域への
進出要件は別紙 `docs/design/mcp-and-agent-expansion.md`。

## vlmkit への戦略的含意

1. 生成では戦わない、検証で戦う(done-condition は稀少資産)。
2. **MCP 露出**が次の明白な一手(統合面のデファクト)。
3. **a11y イベント軸**が最大の未占有ニッチ — 深掘りの価値あり。

## 出典
- Banani "AI Design-to-Code Tools 2026"; Dupple "Screenshot to Code 2026";
  Superdesign "Figma to Code 2026"
- TestDino "Playwright AI Ecosystem 2026"; Crosscheck "Self-Healing Tests
  2026"; Bug0 "Playwright Visual Regression 2026"
- QASkills "AI Accessibility Testing Tools 2026"; WebAbility "Web
  Accessibility Testing Tools 2026"
- noqta / DEV(stevengonsalvez)/ Bug0 "browser-use vs Stagehand vs
  Skyvern / Expect 2026"
