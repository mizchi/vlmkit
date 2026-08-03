export const messages = Object.freeze({
  ja: Object.freeze({
    "page.title": "vlmkit — 見るのではなく、測る",
    "meta.description":
      "vlmkit は、フロントエンドの見た目と振る舞いを実ブラウザで決定論的に検証するツールキットです。",
    "skip.main": "本文へスキップ",
    "dogfood.kicker": "DOGFOOD / VERIFIED LIVE",
    "dogfood.message": "このサイトは vlmkit 自身で生成、デバッグされています。",
    "brand.home": "vlmkit ホーム",
    "nav.label": "メインナビゲーション",
    "nav.workflow": "仕組み",
    "nav.commands": "コマンド",
    "nav.start": "はじめる",
    "controls.label": "表示設定",
    "controls.localeToEnglish": "English に切り替える",
    "controls.localeToJapanese": "日本語に切り替える",
    "controls.themeToDark": "ダークテーマに切り替える",
    "controls.themeToLight": "ライトテーマに切り替える",
    "controls.themeLight": "LIGHT",
    "controls.themeDark": "DARK",
    "github.label": "GitHub で vlmkit を見る",
    "hero.line1": "「見た」ではなく、",
    "hero.line2": "「測った」を。",
    "hero.lead":
      "vlmkit は、ページの崩れ・コピー・振る舞い・ピクセル差分を実ブラウザで測る検証ツールキット。人にも、コードを書くエージェントにも。",
    "hero.start": "2分ではじめる",
    "hero.workflow": "仕組みを見る",
    "hero.status": "ほとんどのゲートは API キー不要",
    "hero.viewportLabel": "3つのビューポートで検証済み",
    "hero.measurementLabel": "vlmkit の測定レイヤー",
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
    "principle.line1": "AIを信じない。",
    "principle.line2": "結果を測る。",
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
    "start.line1": "まず、いまのページを",
    "start.line2": "測ってみる。",
    "start.note": "Node.js 24+。Chromium の準備は最初の一度だけ。",
    "start.copyLabel": "インストールコマンドをコピー",
    "start.copied": "コピーしました",
    "start.docs": "GitHub でドキュメントを読む",
    "footer.tagline": "ページを測る。事実を直す。証拠とともに出荷する。",
  }),
  en: Object.freeze({
    "page.title": "vlmkit — Don't just look. Measure.",
    "meta.description":
      "vlmkit deterministically verifies frontend visuals and behavior in a real browser.",
    "skip.main": "Skip to main content",
    "dogfood.kicker": "DOGFOOD / VERIFIED LIVE",
    "dogfood.message": "This site is generated and debugged with vlmkit itself.",
    "brand.home": "vlmkit home",
    "nav.label": "Main navigation",
    "nav.workflow": "How it works",
    "nav.commands": "Commands",
    "nav.start": "Get started",
    "controls.label": "Display preferences",
    "controls.localeToEnglish": "Switch to English",
    "controls.localeToJapanese": "Switch to Japanese",
    "controls.themeToDark": "Switch to dark theme",
    "controls.themeToLight": "Switch to light theme",
    "controls.themeLight": "LIGHT",
    "controls.themeDark": "DARK",
    "github.label": "View vlmkit on GitHub",
    "hero.line1": "Don't just look.",
    "hero.line2": "Measure it.",
    "hero.lead":
      "vlmkit measures broken layouts, copy, behavior, and pixel diffs in a real browser—for people and coding agents alike.",
    "hero.start": "Start in 2 minutes",
    "hero.workflow": "See how it works",
    "hero.status": "most gates need no API key",
    "hero.viewportLabel": "Verified across three viewports",
    "hero.measurementLabel": "vlmkit measurement layers",
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
    "principle.line1": "Don't trust AI.",
    "principle.line2": "Measure the result.",
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
  const catalog = messages[locale] ?? messages.ja;
  return catalog[key] ?? messages.ja[key] ?? key;
}
