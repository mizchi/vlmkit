import { defaultLocale } from "./preferences.js";

export const messages = Object.freeze({
  ja: Object.freeze({
    "page.title": "vlmkit — VLM支援によるUI検証",
    "meta.description":
      "vlmkit は AI の視覚と決定論的なブラウザ検証をつなぎ、証拠のある UI 実装を支援します。",
    "skip.main": "本文へスキップ",
    "dogfood.kicker": "DOGFOOD / VERIFIED LIVE",
    "dogfood.message": "このサイトは vlmkit 自身で生成、デバッグされています。",
    "brand.home": "vlmkit ホーム",
    "nav.label": "メインナビゲーション",
    "nav.proof": "実例",
    "nav.workflow": "仕組み",
    "nav.commands": "コマンド",
    "nav.skills": "スキル",
    "nav.start": "はじめる",
    "controls.label": "表示設定",
    "controls.localeToEnglish": "English に切り替える",
    "controls.localeToJapanese": "日本語に切り替える",
    "controls.themeToDark": "ダークテーマに切り替える",
    "controls.themeToLight": "ライトテーマに切り替える",
    "controls.themeLight": "LIGHT",
    "controls.themeDark": "DARK",
    "github.label": "GitHub で vlmkit を見る",
    "hero.line1": "VLMで実装し、",
    "hero.line2": "ブラウザで検証する。",
    "hero.lead":
      "vlmkit は、ページの崩れ・コピー・振る舞い・ピクセル差分を実ブラウザで測る検証ツールキット。人にも、コードを書くエージェントにも。",
    "hero.vlmLead":
      "vlmkit は AI エージェントの VLM 視覚と実ブラウザの測定を接続し、スクリーンショットから UI を実装し、崩れを見つけ、修正し、結果を証明できるようにします。",
    "hero.installLead": "スキルをひとつ入れるだけ。AI が最適な UI ワークフローを選んで実行します。",
    "hero.apmBootstrap": "APM が未導入なら",
    "hero.runAlt": "参照スクリーンショットから生成された UI",
    "hero.start": "実際の結果を見る",
    "hero.workflow": "仕組みを見る",
    "hero.status": "ほとんどのゲートは API キー不要",
    "hero.viewportLabel": "3つのビューポートで検証済み",
    "hero.measurementLabel": "vlmkit の測定レイヤー",
    "proof.line1": "実際の出力を、",
    "proof.line2": "数値で確認する。",
    "proof.lead":
      "VLM が見た目の意図を読み、vlmkit が結果をエージェントの修正につながる測定値へ変換。実装が収束するまで実ブラウザで再検証します。",
    "proof.targetLabel": "参照スクリーンショット",
    "proof.targetNote": "実装に渡した唯一の入力",
    "proof.targetAlt": "エージェントに渡した参照スクリーンショット",
    "proof.implementationLabel": "エージェントの実装",
    "proof.implementationNote": "生成された無編集の HTML/CSS",
    "proof.implementationAlt": "エージェントが生成した HTML と CSS",
    "proof.diffLabel": "測定された残差",
    "proof.diffNote": "ヒートマップが次の編集を示す",
    "proof.diffAlt": "参照と実装のピクセル差分ヒートマップ",
    "proof.metricsLabel": "実証ランで記録した測定値",
    "proof.metricStructure": "一致したコンポーネント",
    "proof.metricPosition": "最大位置ずれ",
    "proof.metricPixels": "4ラウンド後のピクセル差分",
    "proof.metricTime": "小型モデルの完走時間",
    "proof.caseBuildTitle": "小型モデルがピクセルだけからページを再構築。",
    "proof.caseBuildBody":
      "Haiku は自身の視覚と vlmkit の決定論的シグナルを使用。4ラウンドで全コピー、6領域、5色のパレット、0.97–0.99 のコンポーネント IoU を再現しました。",
    "proof.readRun": "実証ランをすべて読む",
    "proof.caseDefectTitle": "既存の VRT が見逃した実不具合を検出。",
    "proof.caseDefectBody":
      "375px で 13px のページ横溢れを検出。修正中にはボタンが親要素から 29px はみ出す新しい不具合を selector と差分量つきで検出。4状態すべてが DEFECTS から CLEAN になりました。",
    "proof.caseMigrationTitle": "視覚移行を差分ゼロまで収束。",
    "proof.caseMigrationBody":
      "エージェントが VRT のフィードバックだけで Tailwind を素の CSS へ移行し、3ラウンドで7ビューポートすべて 0.0% のピクセル差分に到達しました。",
    "proof.readMigration": "移行レポートを読む",
    "workflow.line1": "目視の感想を、",
    "workflow.line2": "修正できる事実へ。",
    "workflow.leadBefore": "壊れた場所と測定値を返す",
    "workflow.leadAfter": "が、次の一手を具体化します。直して、再実行して、緑になるまで。",
    "workflow.measure.title": "実ブラウザで測る",
    "workflow.measure.description":
      "DOM、描画ピクセル、computed style、アクセシビリティ状態を、同じ条件で採取。",
    "workflow.kick.title": "直す場所を返す",
    "workflow.kick.description":
      "「失敗」だけで終わらず、viewport、selector、差分量、修正方向を出力。",
    "workflow.prove.title": "もう一度、証明する",
    "workflow.prove.description":
      "人とエージェントが同じゲートを再実行。終了コードで「完了」を共有。",
    "commands.line1": "やりたいことから、",
    "commands.line2": "ひとつのコマンドへ。",
    "commands.lead":
      "参照画像がなくても、変化を追いたくても、出荷条件をまとめたくても。入口は短く、結果は機械可読です。",
    "commands.tablist": "検証シナリオ",
    "commands.inspect": "壊れ方を測る",
    "commands.snapshot": "変化を追う",
    "commands.ship": "完了を定義する",
    "principle.line1": "VLMが提案し、",
    "principle.line2": "計測が判断する。",
    "principle.lead":
      "エージェントが「できた」と言うことと、ページが正しいことは別です。vlmkit は、見た目の主張を再現可能な測定へ変えます。",
    "principle.quoteFooter": "測る → 直す → もう一度証明する",
    "principle.deterministic.title": "決定論的",
    "principle.deterministic.description":
      "同じ入力には同じ判定。VLM の感想ではなく、幾何とピクセルの測定。",
    "principle.actionable.title": "修正可能",
    "principle.actionable.description":
      "viewport と selector を含む kickback。失敗から次の編集へ直結。",
    "principle.shared.title": "人とエージェント共通",
    "principle.shared.description":
      "CLI、Playwright、MCP、CI。どの入口でも同じ終了コードの契約。",
    "skills.line1": "一度入れたら、",
    "skills.line2": "あとは自然に頼むだけ。",
    "skills.lead":
      "vlmkit をひとつ追加すれば、スキル名を覚える必要はありません。作りたい結果を伝えると、AI が依頼と素材を分類し、必要なワークフローを読み込んで、検証が通るまで実行します。",
    "skills.note": "1 インストール · 自動ルーティング · 11 ワークフロー",
    "skills.metaLabel": "メタエントリー",
    "skills.metaDescription":
      "フロントエンドの依頼で自動的に起動し、専門ワークフローを選択。利用者にスキル選択を求めず、CLI と Chromium も必要になった時だけ準備します。",
    "skills.exampleMock": "「このモックを実装して」",
    "skills.exampleResponsive": "「レスポンシブと操作を確認して」",
    "skills.exampleTest": "「この仕様を安定したテストにして」",
    "skills.classLabel": "AI が選べるワークフロー",
    "skills.verifyTitle": "日常の検証",
    "skills.verifyDescription":
      "参照デザインなしの HTML/CSS を、整合性・コピー・レスポンシブ・操作性のゲートで確認。",
    "skills.createTitle": "UI の作成",
    "skills.createDescription":
      "モック、参照画像、UI Contract、動作要件から静的・動的なページを再現。",
    "skills.testTitle": "テスト生成",
    "skills.testDescription":
      "自然言語の仕様から Playwright と再現可能な VRT を生成し、ドリフトを修復。",
    "skills.monitorTitle": "比較と監視",
    "skills.monitorDescription":
      "描画差分を説明し、継続的な回帰やフレームワーク移行の視覚的同等性を判定。",
    "skills.evaluateTitle": "評価と改善",
    "skills.evaluateDescription":
      "既知の CSS 回帰に対する修復性能と、エージェント向けツール自体の使いやすさを検証。",
    "skills.catalogLink": "11スキルの詳しい選択ガイドを見る",
    "skills.apmLabel": "APM でインストール",
    "skills.apmDescription":
      "公式 bootstrap で APM を導入または更新してから、自動ルーターをプロジェクトへひとつ追加します。",
    "skills.cliLabel": "skills CLI でインストール",
    "skills.cliDescription": "同じ自動ルーターを npx からひとつ追加します。",
    "start.line1": "まず、いまのページを",
    "start.line2": "測ってみる。",
    "start.note": "Node.js 24+。Chromium の準備は最初の一度だけ。",
    "start.copyLabel": "インストールコマンドをコピー",
    "start.copied": "コピーしました",
    "start.docs": "GitHub でドキュメントを読む",
    "footer.tagline": "ページを測る。事実を直す。証拠とともに出荷する。",
  }),
  en: Object.freeze({
    "page.title": "vlmkit — VLM-assisted UI verification",
    "meta.description":
      "vlmkit connects AI vision with deterministic browser verification to build UI with proof.",
    "skip.main": "Skip to main content",
    "dogfood.kicker": "DOGFOOD / VERIFIED LIVE",
    "dogfood.message": "This site is generated and debugged with vlmkit itself.",
    "brand.home": "vlmkit home",
    "nav.label": "Main navigation",
    "nav.proof": "Real results",
    "nav.workflow": "How it works",
    "nav.commands": "Commands",
    "nav.skills": "Skill",
    "nav.start": "Get started",
    "controls.label": "Display preferences",
    "controls.localeToEnglish": "Switch to English",
    "controls.localeToJapanese": "Switch to Japanese",
    "controls.themeToDark": "Switch to dark theme",
    "controls.themeToLight": "Switch to light theme",
    "controls.themeLight": "LIGHT",
    "controls.themeDark": "DARK",
    "github.label": "View vlmkit on GitHub",
    "hero.line1": "VLM-assisted UI.",
    "hero.line2": "Verified in the browser.",
    "hero.lead":
      "vlmkit measures broken layouts, copy, behavior, and pixel diffs in a real browser—for people and coding agents alike.",
    "hero.vlmLead":
      "vlmkit connects an AI agent's VLM vision to real-browser measurements, so it can implement UI from screenshots, find breakage, fix it, and prove the result.",
    "hero.installLead": "Install one skill. The AI picks and runs the right UI workflow.",
    "hero.apmBootstrap": "Need APM first?",
    "hero.runAlt": "UI generated from the reference screenshot",
    "hero.start": "See real results",
    "hero.workflow": "See how it works",
    "hero.status": "most gates need no API key",
    "hero.viewportLabel": "Verified across three viewports",
    "hero.measurementLabel": "vlmkit measurement layers",
    "proof.line1": "Actual output,",
    "proof.line2": "measured.",
    "proof.lead":
      "The VLM reads visual intent. vlmkit turns the result into measurements an agent can act on, then reruns the browser until the implementation converges.",
    "proof.targetLabel": "Reference screenshot",
    "proof.targetNote": "The only implementation input",
    "proof.targetAlt": "Reference screenshot supplied to the agent",
    "proof.implementationLabel": "Agent implementation",
    "proof.implementationNote": "Generated HTML/CSS, unedited",
    "proof.implementationAlt": "HTML and CSS generated by the agent",
    "proof.diffLabel": "Measured residual",
    "proof.diffNote": "Heatmap gives the next edit",
    "proof.diffAlt": "Measured pixel heatmap between reference and implementation",
    "proof.metricsLabel": "Recorded proof run metrics",
    "proof.metricStructure": "components matched",
    "proof.metricPosition": "maximum position drift",
    "proof.metricPixels": "pixel diff after 4 rounds",
    "proof.metricTime": "small-model completion",
    "proof.caseBuildTitle": "A small model rebuilt the page from pixels alone.",
    "proof.caseBuildBody":
      "Haiku used its vision with vlmkit's deterministic signals. Four rounds produced all copy, all six regions, the five-color palette, and 0.97–0.99 component IoU.",
    "proof.readRun": "Read the full run",
    "proof.caseDefectTitle": "It found defects the existing VRT suite missed.",
    "proof.caseDefectBody":
      "At 375px, integrity found 13px of page overflow. During the fix it caught a new button protruding 29px past its parent—with the selector and exact delta. Four captured states moved from DEFECTS to CLEAN.",
    "proof.caseMigrationTitle": "A visual migration reached zero drift.",
    "proof.caseMigrationBody":
      "An agent migrated Tailwind markup to vanilla CSS using only VRT feedback, reaching 0.0% pixel diff across 7 viewports in 3 rounds.",
    "proof.readMigration": "Read the migration report",
    "workflow.line1": "Turn visual opinions",
    "workflow.line2": "into fixable facts.",
    "workflow.leadBefore": "A",
    "workflow.leadAfter":
      "returns the broken location and measurements. Fix it, run again, and keep going until green.",
    "workflow.measure.title": "Measure in a real browser",
    "workflow.measure.description":
      "Capture DOM geometry, rendered pixels, computed styles, and accessibility states under identical conditions.",
    "workflow.kick.title": "Return the exact location",
    "workflow.kick.description":
      "Go beyond “failed” with the viewport, selector, diff size, and a concrete direction for the fix.",
    "workflow.prove.title": "Prove it again",
    "workflow.prove.description":
      "People and agents rerun the same gates and share a single exit-code contract for done.",
    "commands.line1": "Route the task",
    "commands.line2": "with one command.",
    "commands.lead":
      "No reference image? Tracking change? Defining release conditions? The entry point stays short and the result stays machine-readable.",
    "commands.tablist": "Verification scenarios",
    "commands.inspect": "Measure breakage",
    "commands.snapshot": "Track change",
    "commands.ship": "Define done",
    "principle.line1": "Vision proposes.",
    "principle.line2": "Measurements decide.",
    "principle.lead":
      "An agent saying “done” does not make the page correct. vlmkit turns visual claims into reproducible measurements.",
    "principle.quoteFooter": "Measure → fix → prove it again",
    "principle.deterministic.title": "Deterministic",
    "principle.deterministic.description":
      "The same input gets the same verdict—geometry and pixels, not a VLM's opinion.",
    "principle.actionable.title": "Actionable",
    "principle.actionable.description":
      "Kickback includes the viewport and selector, connecting each failure to the next edit.",
    "principle.shared.title": "Shared by people and agents",
    "principle.shared.description":
      "CLI, Playwright, MCP, or CI: every entry point follows the same exit-code contract.",
    "skills.line1": "Install once.",
    "skills.line2": "Ask naturally.",
    "skills.lead":
      "Add vlmkit once—there are no skill names to learn. Describe the outcome, and the AI classifies the request and artifacts, loads the right workflow, and runs it until the checks pass.",
    "skills.note": "1 install · automatic routing · 11 workflows",
    "skills.metaLabel": "Meta entry",
    "skills.metaDescription":
      "Activates automatically for frontend work and selects the matching workflow. It never asks you to pick a skill, and prepares the CLI and Chromium only when needed.",
    "skills.exampleMock": "“Implement this mock.”",
    "skills.exampleResponsive": "“Check responsiveness and interactions.”",
    "skills.exampleTest": "“Turn this spec into stable tests.”",
    "skills.classLabel": "What the AI can choose",
    "skills.verifyTitle": "Everyday verification",
    "skills.verifyDescription":
      "Check HTML/CSS with no reference design through integrity, copy, responsive, and interaction gates.",
    "skills.createTitle": "UI creation",
    "skills.createDescription":
      "Recreate static or dynamic pages from mocks, references, UI Contracts, and behavior briefs.",
    "skills.testTitle": "Test generation",
    "skills.testDescription":
      "Turn natural-language specs into Playwright tests, reproducible VRT, and drift healing.",
    "skills.monitorTitle": "Comparison and monitoring",
    "skills.monitorDescription":
      "Explain render deltas, watch recurring regressions, and judge visual equivalence after migrations.",
    "skills.evaluateTitle": "Evaluation and hardening",
    "skills.evaluateDescription":
      "Measure repair performance on known CSS regressions and improve agent-facing tool usability.",
    "skills.catalogLink": "Open the detailed guide to all 11 skills",
    "skills.apmLabel": "Install with APM",
    "skills.apmDescription":
      "Install or update APM with its official bootstrap, then add the single automatic router.",
    "skills.cliLabel": "Install with skills CLI",
    "skills.cliDescription": "Add the same automatic router directly through npx.",
    "start.line1": "Measure the page",
    "start.line2": "you have now.",
    "start.note": "Node.js 24+. Chromium setup is required only once.",
    "start.copyLabel": "Copy install command",
    "start.copied": "Copied",
    "start.docs": "Read the docs on GitHub",
    "footer.tagline": "Measure the page. Fix the fact. Ship with proof.",
  }),
});

export function translate(locale, key) {
  const fallbackCatalog = messages[defaultLocale];
  const catalog = messages[locale] ?? fallbackCatalog;
  return catalog[key] ?? fallbackCatalog[key] ?? key;
}
