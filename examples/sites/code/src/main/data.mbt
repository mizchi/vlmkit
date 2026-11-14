// Everything the page shows is fixed data written here. Times are text.

///|
struct Commit {
  author : String
  msg : String
  pr : Int
  sha : String
  age : String
}

///|
struct Entry {
  path : String
  is_dir : Bool
  msg : String
  pr : Int
  age : String
}

///|
struct Branch {
  name : String
  is_tag : Bool
  head : Commit
}

///|
struct Label {
  name : String
  color : String
}

///|
struct Issue {
  num : Int
  title : String
  open_ : Bool
  labels : Array[String]
  author : String
  ago : String
  comments : Int
  milestone : String
  assignee : String
  project : String
  body : String
}

///|
let owner : String = "tidewater"

///|
let repo_name : String = "lantern"

///|
let clone_https : String = "https://forgeyard.example/tidewater/lantern.git"

///|
let clone_cli : String = "fy repo clone tidewater/lantern"

///|
let main_head : Commit = {
  author: "mira-okafor",
  msg: "render: stream pages to disk as they finish",
  pr: 418,
  sha: "8c41d2e",
  age: "2 hours ago",
}

///|
let branches : Array[Branch] = [
  { name: "main", is_tag: false, head: main_head },
  {
    name: "next",
    is_tag: false,
    head: {
      author: "jun-arata",
      msg: "graph: incremental rebuild of changed pages only",
      pr: 421,
      sha: "f02b9a7",
      age: "40 minutes ago",
    },
  },
  {
    name: "release/3.x",
    is_tag: false,
    head: {
      author: "mira-okafor",
      msg: "Release 3.4.0",
      pr: 0,
      sha: "1d7e330",
      age: "2 weeks ago",
    },
  },
  {
    name: "feat/incremental-graph",
    is_tag: false,
    head: {
      author: "jun-arata",
      msg: "graph: hash front matter separately from the body",
      pr: 0,
      sha: "a93c0f1",
      age: "yesterday",
    },
  },
  {
    name: "fix/feed-dates",
    is_tag: false,
    head: {
      author: "sol-varga",
      msg: "feed: write dates in RFC 3339 with the site's zone",
      pr: 0,
      sha: "5be4417",
      age: "3 days ago",
    },
  },
  {
    name: "docs/plugin-guide",
    is_tag: false,
    head: {
      author: "ines-duarte",
      msg: "docs: a worked plugin from hook to test",
      pr: 0,
      sha: "c6610d8",
      age: "4 days ago",
    },
  },
  {
    name: "chore/deps-2026-11",
    is_tag: false,
    head: {
      author: "tidebot",
      msg: "chore(deps): bump the dev group with 4 updates",
      pr: 0,
      sha: "07f9e2c",
      age: "5 days ago",
    },
  },
  {
    name: "perf/parallel-render",
    is_tag: false,
    head: {
      author: "theo-brandt",
      msg: "render: a worker pool sized to the machine",
      pr: 0,
      sha: "e4a1b56",
      age: "last week",
    },
  },
  {
    name: "v3.4.0",
    is_tag: true,
    head: {
      author: "mira-okafor",
      msg: "Release 3.4.0",
      pr: 0,
      sha: "1d7e330",
      age: "2 weeks ago",
    },
  },
  {
    name: "v3.3.2",
    is_tag: true,
    head: {
      author: "sol-varga",
      msg: "Release 3.3.2",
      pr: 0,
      sha: "9a2f61b",
      age: "last month",
    },
  },
  {
    name: "v3.3.1",
    is_tag: true,
    head: {
      author: "sol-varga",
      msg: "Release 3.3.1",
      pr: 0,
      sha: "34cc0e8",
      age: "2 months ago",
    },
  },
  {
    name: "v3.3.0",
    is_tag: true,
    head: {
      author: "mira-okafor",
      msg: "Release 3.3.0",
      pr: 0,
      sha: "b8e7d12",
      age: "3 months ago",
    },
  },
  {
    name: "v3.2.0",
    is_tag: true,
    head: {
      author: "jun-arata",
      msg: "Release 3.2.0",
      pr: 0,
      sha: "60fa4c9",
      age: "5 months ago",
    },
  },
]

///|
let tree : Array[Entry] = [
  { path: ".github", is_dir: true, msg: "ci: test on Node 22 and 24", pr: 402, age: "3 weeks ago" },
  { path: ".github/workflows", is_dir: true, msg: "ci: test on Node 22 and 24", pr: 402, age: "3 weeks ago" },
  { path: ".github/workflows/ci.yml", is_dir: false, msg: "ci: test on Node 22 and 24", pr: 402, age: "3 weeks ago" },
  { path: ".github/ISSUE_TEMPLATE.md", is_dir: false, msg: "Ask for the config file in bug reports", pr: 0, age: "8 months ago" },
  { path: "docs", is_dir: true, msg: "docs: a worked plugin from hook to test", pr: 415, age: "4 days ago" },
  { path: "docs/getting-started.md", is_dir: false, msg: "docs: shorter first run", pr: 390, age: "last month" },
  { path: "docs/configuration.md", is_dir: false, msg: "config: document every key with its default", pr: 377, age: "2 months ago" },
  { path: "docs/plugins.md", is_dir: false, msg: "docs: a worked plugin from hook to test", pr: 415, age: "4 days ago" },
  { path: "examples", is_dir: true, msg: "examples: a blog with tags and a feed", pr: 366, age: "3 months ago" },
  { path: "examples/blog", is_dir: true, msg: "examples: a blog with tags and a feed", pr: 366, age: "3 months ago" },
  { path: "examples/blog/lantern.config.ts", is_dir: false, msg: "examples: a blog with tags and a feed", pr: 366, age: "3 months ago" },
  { path: "examples/blog/content", is_dir: true, msg: "examples: a blog with tags and a feed", pr: 366, age: "3 months ago" },
  { path: "examples/blog/content/hello-world.md", is_dir: false, msg: "examples: a blog with tags and a feed", pr: 366, age: "3 months ago" },
  { path: "src", is_dir: true, msg: "render: stream pages to disk as they finish", pr: 418, age: "2 hours ago" },
  { path: "src/cli.ts", is_dir: false, msg: "cli: --watch rebuilds only what changed", pr: 409, age: "2 weeks ago" },
  { path: "src/config.ts", is_dir: false, msg: "config: reject unknown keys with a suggestion", pr: 384, age: "last month" },
  { path: "src/core", is_dir: true, msg: "graph: drop pages whose source was deleted", pr: 411, age: "6 days ago" },
  { path: "src/core/build.ts", is_dir: false, msg: "render: stream pages to disk as they finish", pr: 418, age: "2 hours ago" },
  { path: "src/core/graph.ts", is_dir: false, msg: "graph: drop pages whose source was deleted", pr: 411, age: "6 days ago" },
  { path: "src/render", is_dir: true, msg: "render: stream pages to disk as they finish", pr: 418, age: "2 hours ago" },
  { path: "src/render/markdown.ts", is_dir: false, msg: "markdown: footnotes and heading anchors", pr: 399, age: "3 weeks ago" },
  { path: "src/render/templates.ts", is_dir: false, msg: "render: stream pages to disk as they finish", pr: 418, age: "2 hours ago" },
  { path: "src/plugins", is_dir: true, msg: "feed: write dates in RFC 3339", pr: 406, age: "2 weeks ago" },
  { path: "src/plugins/feed.ts", is_dir: false, msg: "feed: write dates in RFC 3339", pr: 406, age: "2 weeks ago" },
  { path: "src/plugins/sitemap.ts", is_dir: false, msg: "sitemap: skip drafts and noindex pages", pr: 352, age: "4 months ago" },
  { path: "src/plugins/syntax-highlight-with-line-numbers-and-theme-switching.ts", is_dir: false, msg: "highlight: themes switch with the page's colour scheme", pr: 395, age: "3 weeks ago" },
  { path: "test", is_dir: true, msg: "test: cover the streaming writer", pr: 418, age: "2 hours ago" },
  { path: "test/build.test.ts", is_dir: false, msg: "test: cover the streaming writer", pr: 418, age: "2 hours ago" },
  { path: ".editorconfig", is_dir: false, msg: "Initial commit", pr: 0, age: "4 years ago" },
  { path: ".gitignore", is_dir: false, msg: "Ignore the .lantern cache", pr: 0, age: "2 years ago" },
  { path: "CHANGELOG.md", is_dir: false, msg: "Release 3.4.0", pr: 0, age: "2 weeks ago" },
  { path: "LICENSE", is_dir: false, msg: "Initial commit", pr: 0, age: "4 years ago" },
  { path: "README.md", is_dir: false, msg: "readme: the five-minute tour", pr: 413, age: "5 days ago" },
  { path: "package.json", is_dir: false, msg: "Release 3.4.0", pr: 0, age: "2 weeks ago" },
  { path: "tsconfig.json", is_dir: false, msg: "build: target ES2023", pr: 361, age: "3 months ago" },
]

///|
let readme_src : String =
  #|# Lantern
  #|
  #|[![build: passing](badges/build.svg)](#) [![license: MIT](badges/license.svg)](#) [![version: 3.4.0](badges/version.svg)](#) [![coverage: 94%](badges/coverage.svg)](#)
  #|
  #|Lantern turns a folder of Markdown into a fast static site. It builds a graph of your pages, rebuilds only what changed, and streams each page to disk as soon as it is ready.
  #|
  #|## Install
  #|
  #|Lantern needs Node 22 or later.
  #|
  #|```sh
  #|npm install --save-dev @tidewater/lantern
  #|npx lantern init my-site
  #|npx lantern dev
  #|```
  #|
  #|## Configuration
  #|
  #|Put a `lantern.config.ts` next to your content. Every key is optional.
  #|
  #|| Key | Default | What it does |
  #||---|---|---|
  #|| `content` | `"content"` | Folder the pages are read from |
  #|| `out` | `"dist"` | Folder the site is written to |
  #|| `baseUrl` | `"/"` | Prefix for every link, for a site under a sub-path |
  #|| `drafts` | `false` | Build pages marked `draft: true` |
  #|
  #|## Roadmap
  #|
  #|- [x] Incremental rebuilds from the page graph
  #|- [x] Streaming writer
  #|- [ ] Image pipeline with responsive sizes
  #|- [ ] Search index plugin
  #|
  #|## Contributing
  #|
  #|Read **docs/plugins.md** before writing a plugin. Found a bug? Open a [New issue](#/issues/new) with your config and the command you ran.
  #|
  #|## License
  #|
  #|MIT. See `LICENSE`.

///|
let build_ts : String =
  #|// Build every page in the graph and stream it to disk.
  #|import { mkdir, writeFile } from "node:fs/promises";
  #|import { dirname, join } from "node:path";
  #|import { loadGraph, type Page } from "./graph";
  #|import { renderPage } from "../render/templates";
  #|import type { Config } from "../config";
  #|
  #|export interface BuildResult {
  #|  written: number;
  #|  skipped: number;
  #|  ms: number;
  #|}
  #|
  #|/* A page is rebuilt when its own hash or the hash of a page it
  #|   includes has changed since the last build. */
  #|export function isStale(page: Page, previous: Map<string, string>): boolean {
  #|  const before = previous.get(page.id);
  #|  if (before === undefined) return true;
  #|  return before !== page.hash || page.includes.some((dep) => previous.get(dep) !== dep);
  #|}
  #|
  #|async function writePage(out: string, page: Page, html: string): Promise<void> {
  #|  const file = join(out, page.route, "index.html");
  #|  await mkdir(dirname(file), { recursive: true });
  #|  await writeFile(file, html, "utf8");
  #|}
  #|
  #|export async function build(config: Config, previous = new Map<string, string>()): Promise<BuildResult> {
  #|  const started = performance.now();
  #|  const graph = await loadGraph(config.content);
  #|  let written = 0;
  #|  let skipped = 0;
  #|  for (const page of graph.pages) {
  #|    if (!config.drafts && page.draft) continue;
  #|    if (!isStale(page, previous)) {
  #|      skipped += 1;
  #|      continue;
  #|    }
  #|    const html = await renderPage(page, config);
  #|    await writePage(config.out, page, html); // stream: write as soon as it is ready
  #|    written += 1;
  #|  }
  #|  return { written, skipped, ms: Math.round(performance.now() - started) };
  #|}
  #|
  #|export function summary(result: BuildResult): string {
  #|  return `${result.written} written, ${result.skipped} unchanged in ${result.ms}ms`;
  #|}

///|
let markdown_ts : String =
  #|// A small Markdown renderer: headings with anchors, lists, code and footnotes.
  #|import { escapeHtml } from "./templates";
  #|
  #|const HEADING = /^(#{1,6})\s+(.*)$/;
  #|
  #|export function slug(text: string): string {
  #|  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  #|}
  #|
  #|export function renderHeading(line: string): string | null {
  #|  const match = HEADING.exec(line);
  #|  if (!match) return null;
  #|  const level = match[1].length;
  #|  const text = match[2];
  #|  return `<h${level} id="${slug(text)}">${escapeHtml(text)}</h${level}>`;
  #|}
  #|
  #|export function renderInline(text: string): string {
  #|  return escapeHtml(text)
  #|    .replace(/`([^`]+)`/g, "<code>$1</code>")
  #|    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  #|    .replace(/\[\^(\d+)\]/g, '<sup><a href="#fn-$1">$1</a></sup>');
  #|}
  #|
  #|export function renderMarkdown(source: string): string {
  #|  const out: string[] = [];
  #|  for (const line of source.split("\n")) {
  #|    const heading = renderHeading(line);
  #|    if (heading) {
  #|      out.push(heading);
  #|    } else if (line.startsWith("- ")) {
  #|      out.push(`<li>${renderInline(line.slice(2))}</li>`);
  #|    } else if (line.trim() !== "") {
  #|      out.push(`<p>${renderInline(line)}</p>`);
  #|    }
  #|  }
  #|  return out.join("\n");
  #|}

///|
let cli_ts : String =
  #|#!/usr/bin/env node
  #|// lantern <init|dev|build> [--watch] [--out dir]
  #|import { build, summary } from "./core/build";
  #|import { loadConfig } from "./config";
  #|
  #|const HELP = "usage: lantern <init|dev|build> [--watch] [--out dir]";
  #|
  #|function flag(args: string[], name: string): boolean {
  #|  return args.includes(`--${name}`);
  #|}
  #|
  #|function option(args: string[], name: string): string | undefined {
  #|  const at = args.indexOf(`--${name}`);
  #|  return at === -1 ? undefined : args[at + 1];
  #|}
  #|
  #|export async function main(args: string[]): Promise<number> {
  #|  const [command] = args;
  #|  if (!command || flag(args, "help")) {
  #|    console.log(HELP);
  #|    return command ? 0 : 2;
  #|  }
  #|  const config = await loadConfig(process.cwd(), { out: option(args, "out") });
  #|  if (command === "build") {
  #|    console.log(summary(await build(config)));
  #|    return 0;
  #|  }
  #|  if (command === "dev" || flag(args, "watch")) {
  #|    const { watch } = await import("./core/graph");
  #|    await watch(config, (result) => console.log(summary(result)));
  #|    return 0;
  #|  }
  #|  console.error(`unknown command: ${command}`);
  #|  return 2;
  #|}
  #|
  #|main(process.argv.slice(2)).then((code) => process.exit(code));

///|
let config_ts : String =
  #|// Load lantern.config.ts and fill in the defaults.
  #|export interface Config {
  #|  content: string;
  #|  out: string;
  #|  baseUrl: string;
  #|  drafts: boolean;
  #|}
  #|
  #|export const DEFAULTS: Config = {
  #|  content: "content",
  #|  out: "dist",
  #|  baseUrl: "/",
  #|  drafts: false,
  #|};
  #|
  #|const KEYS = Object.keys(DEFAULTS);
  #|
  #|function nearest(key: string): string | undefined {
  #|  return KEYS.find((known) => known.startsWith(key.slice(0, 3)));
  #|}
  #|
  #|export function validate(user: Record<string, unknown>): void {
  #|  for (const key of Object.keys(user)) {
  #|    if (KEYS.includes(key)) continue;
  #|    const hint = nearest(key);
  #|    throw new Error(hint ? `unknown key "${key}": did you mean "${hint}"?` : `unknown key "${key}"`);
  #|  }
  #|}
  #|
  #|export async function loadConfig(root: string, overrides: Partial<Config> = {}): Promise<Config> {
  #|  const mod = await import(`${root}/lantern.config.ts`).catch(() => ({ default: {} }));
  #|  validate(mod.default);
  #|  return { ...DEFAULTS, ...mod.default, ...overrides };
  #|}

///|
let package_json : String =
  #|{
  #|  "name": "@tidewater/lantern",
  #|  "version": "3.4.0",
  #|  "description": "A static site generator that rebuilds only what changed",
  #|  "license": "MIT",
  #|  "type": "module",
  #|  "bin": { "lantern": "dist/cli.js" },
  #|  "engines": { "node": ">=22" },
  #|  "scripts": {
  #|    "build": "tsc -p .",
  #|    "test": "node --test test/",
  #|    "lint": "eslint src test"
  #|  },
  #|  "devDependencies": {
  #|    "typescript": "^5.9.0",
  #|    "eslint": "^9.30.0"
  #|  }
  #|}

///|
let ci_yml : String =
  #|# Test every push and pull request on the supported Node versions.
  #|name: ci
  #|on:
  #|  push:
  #|    branches: [main]
  #|  pull_request:
  #|jobs:
  #|  test:
  #|    runs-on: ubuntu-latest
  #|    strategy:
  #|      matrix:
  #|        node: [22, 24]
  #|    steps:
  #|      - uses: actions/checkout@v4
  #|      - uses: actions/setup-node@v4
  #|        with:
  #|          node-version: ${{ matrix.node }}
  #|          cache: npm
  #|      - run: npm ci
  #|      - run: npm test
  #|      - run: npm run lint

///|
fn file_text(path : String) -> String {
  match path {
    "README.md" => readme_src
    "src/core/build.ts" => build_ts
    "src/render/markdown.ts" => markdown_ts
    "src/cli.ts" => cli_ts
    "src/config.ts" => config_ts
    "package.json" => package_json
    ".github/workflows/ci.yml" => ci_yml
    "LICENSE" =>
      #|MIT License
      #|
      #|Copyright (c) 2022 Tidewater contributors
      #|
      #|Permission is hereby granted, free of charge, to any person obtaining a copy
      #|of this software, to deal in the software without restriction.
    ".editorconfig" =>
      #|root = true
      #|
      #|[*]
      #|indent_style = space
      #|indent_size = 2
      #|end_of_line = lf
    ".gitignore" =>
      #|node_modules/
      #|dist/
      #|.lantern/
    "tsconfig.json" =>
      #|{
      #|  "compilerOptions": { "target": "ES2023", "module": "NodeNext", "strict": true, "outDir": "dist" },
      #|  "include": ["src"]
      #|}
    "CHANGELOG.md" =>
      #|# Changelog
      #|
      #|## 3.4.0
      #|
      #|- Pages are written to disk as soon as they render.
      #|- `--watch` rebuilds only the pages whose sources changed.
    _ => {
      let name = basename(path)
      if path.has_suffix(".md") {
        "# " + name + "\n\nThis page is part of the Lantern \{dirname(path)} folder.\n"
      } else {
        "// " + name + "\n// Part of Lantern's \{dirname(path)} folder.\nexport const name = \"" +
        name +
        "\";\n\nexport function describe(): string {\n  return `${name} is loaded`;\n}\n"
      }
    }
  }
}

///|
let labels : Array[Label] = [
  { name: "bug", color: "#d73a4a" },
  { name: "enhancement", color: "#a2eeef" },
  { name: "documentation", color: "#0075ca" },
  { name: "good first issue", color: "#7057ff" },
  { name: "help wanted", color: "#008672" },
  { name: "performance", color: "#fbca04" },
  { name: "plugins", color: "#f9d0c4" },
  { name: "windows", color: "#5319e7" },
  { name: "question", color: "#d876e3" },
  { name: "needs repro", color: "#e4e669" },
]

///|
fn label_color(name : String) -> String {
  for l in labels {
    if l.name == name {
      return l.color
    }
  }
  "#888888"
}

///|
let open_titles : Array[(String, Array[String], String, String, Int)] = [
  ("Watch mode misses files renamed by an editor's atomic save", ["bug", "needs repro"], "pia-lund", "2 hours ago", 4),
  ("Feed plugin: let a page opt out with feed: false", ["plugins", "enhancement"], "sol-varga", "5 hours ago", 1),
  ("Build fails on Windows when the content path has a space", ["bug", "windows"], "arjun-mehta", "yesterday", 7),
  ("Document how baseUrl interacts with absolute links in Markdown", ["documentation", "good first issue"], "ines-duarte", "yesterday", 2),
  ("Parallel render: cap the worker pool on machines with little memory", ["performance"], "theo-brandt", "2 days ago", 5),
  ("Sitemap lists pages that a redirect replaced", ["bug", "plugins"], "kofi-mensah", "2 days ago", 0),
  ("Support footnotes that span more than one paragraph", ["enhancement"], "lena-hoff", "3 days ago", 3),
  ("Heading anchors collide when two headings have the same text", ["bug", "good first issue"], "maya-chen", "3 days ago", 6),
  ("Expose the page graph to plugins as a read-only API", ["plugins", "enhancement", "help wanted"], "jun-arata", "4 days ago", 9),
  ("Dev server does not reload CSS that a template imports", ["bug"], "rafael-souza", "5 days ago", 2),
  ("How do I put drafts behind a preview URL?", ["question"], "noor-haddad", "6 days ago", 1),
  ("Image pipeline: responsive sizes from a single source image", ["enhancement", "help wanted"], "mira-okafor", "last week", 12),
  ("Front matter dates are read in the build machine's time zone", ["bug"], "sol-varga", "last week", 4),
  ("Search index plugin", ["plugins", "enhancement"], "ines-duarte", "last week", 15),
  ("Error message for a missing layout should name the page", ["enhancement", "good first issue"], "pia-lund", "2 weeks ago", 0),
  ("Builds are slower with more than 5,000 pages in one folder", ["performance", "needs repro"], "arjun-mehta", "2 weeks ago", 8),
  ("Add a --dry-run flag that prints what would be written", ["enhancement"], "kofi-mensah", "2 weeks ago", 3),
  ("Templates cannot read the site's config from a partial", ["bug"], "lena-hoff", "3 weeks ago", 2),
  ("Translate the getting-started guide", ["documentation", "help wanted"], "maya-chen", "3 weeks ago", 5),
  ("Syntax highlighting has no colour for TOML keys", ["plugins", "good first issue"], "rafael-souza", "last month", 1),
  ("Long code blocks overflow the page on phones in the default theme", ["bug"], "noor-haddad", "last month", 6),
  ("Allow a content folder outside the project root", ["enhancement", "question"], "theo-brandt", "last month", 2),
  ("Plugin hooks run twice after a config reload in dev", ["bug", "plugins"], "jun-arata", "2 months ago", 11),
]

///|
let closed_titles : Array[String] = [
  "Stream pages to disk as they finish", "Incremental rebuild skips pages whose includes changed",
  "README example uses an old config key", "Feed dates are not RFC 3339", "CLI prints a stack trace for an unknown command",
  "Sitemap should skip noindex pages", "Drafts are built by default", "Watch mode leaks file handles",
  "Templates escape HTML twice in titles", "Add Node 24 to CI", "Docs: explain the page graph",
  "Heading anchors drop non-ASCII letters", "Config typo gives no suggestion", "Dev server port is not configurable",
  "Windows paths in the sitemap use backslashes", "Markdown tables lose alignment", "Build summary counts skipped pages as written",
  "Plugin errors do not name the plugin", "Example blog has a broken tag page", "Remove the deprecated --legacy flag",
  "Code blocks lose their language class", "Support .mdx files", "Release notes for 3.3.0",
  "Cache folder is created in the wrong place", "Footnote links point to the wrong page", "Upgrade to TypeScript 5.9",
  "Trailing slashes in baseUrl are doubled", "Dark theme code colours are unreadable", "Speed up the graph hash",
  "Feed plugin ignores the site title", "Lint the test folder too", "Getting-started guide skips npm init",
  "Empty content folder crashes the build", "Dev server serves stale 404 pages", "Add a CONTRIBUTING section",
  "Front matter with tabs fails to parse", "Images with spaces in names 404", "Watch mode on network drives",
  "Sort pages by date in the example blog", "Parallel render ignores --out", "Unify the log format",
]

///|
let people : Array[String] = [
  "mira-okafor", "jun-arata", "sol-varga", "ines-duarte", "theo-brandt", "pia-lund",
  "arjun-mehta", "kofi-mensah", "lena-hoff", "maya-chen", "rafael-souza", "noor-haddad",
]

///|
let milestones : Array[String] = ["3.5.0", "4.0.0"]

///|
let projects : Array[String] = ["Roadmap 2027", "Docs refresh"]

///|
let closed_ages : Array[String] = [
  "2 weeks ago", "3 weeks ago", "last month", "2 months ago", "3 months ago", "4 months ago",
  "5 months ago", "6 months ago", "8 months ago", "last year",
]

///|
fn seed_issues() -> Array[Issue] {
  let out : Array[Issue] = []
  // Numbers 123 down: open and closed interleaved deterministically.
  let mut num = 123
  let mut oi = 0
  let mut ci = 0
  let mut rng = 20261114
  while oi < open_titles.length() || ci < closed_titles.length() {
    rng = (rng * 1103515245 + 12345) % 2147483647
    if rng < 0 {
      rng = -rng
    }
    let pick_open = if oi >= open_titles.length() {
      false
    } else if ci >= closed_titles.length() {
      true
    } else {
      oi * 64 <= (oi + ci) * 23
    }
    if pick_open {
      let (title, ls, author, ago, comments) = open_titles[oi]
      out.push({
        num,
        title,
        open_: true,
        labels: ls,
        author,
        ago,
        comments,
        milestone: if oi % 3 == 0 { milestones[0] } else if oi % 5 == 1 { milestones[1] } else { "" },
        assignee: if oi % 4 == 0 { people[(oi + 2) % people.length()] } else { "" },
        project: if oi % 2 == 0 { projects[oi / 2 % 2] } else { "" },
        body: "Seen on Lantern 3.4.0 with Node 22.\n\nSteps to reproduce are in the first comment.",
      })
      oi += 1
    } else {
      let title = closed_titles[ci]
      let lbl = labels[rng % labels.length()].name
      out.push({
        num,
        title,
        open_: false,
        labels: [lbl],
        author: people[(ci * 5 + 3) % people.length()],
        ago: closed_ages[ci * closed_ages.length() / closed_titles.length()],
        comments: rng % 9,
        milestone: if ci % 4 == 0 { "3.4.0" } else { "" },
        assignee: if ci % 3 == 0 { people[ci % people.length()] } else { "" },
        project: if ci % 5 == 0 { projects[0] } else { "" },
        body: "Fixed on main.",
      })
      ci += 1
    }
    num -= 1
  }
  out
}

///|
struct Pull {
  num : Int
  title : String
  author : String
  ago : String
  labels : Array[String]
  comments : Int
}

///|
let pulls : Array[Pull] = [
  { num: 421, title: "graph: incremental rebuild of changed pages only", author: "jun-arata", ago: "40 minutes ago", labels: ["performance"], comments: 3 },
  { num: 420, title: "docs: a worked plugin from hook to test", author: "ines-duarte", ago: "4 days ago", labels: ["documentation"], comments: 5 },
  { num: 419, title: "feed: write dates in RFC 3339 with the site's zone", author: "sol-varga", ago: "3 days ago", labels: ["bug", "plugins"], comments: 2 },
  { num: 417, title: "chore(deps): bump the dev group with 4 updates", author: "tidebot", ago: "5 days ago", labels: [], comments: 0 },
]

///|
let contributors : Array[String] = [
  "mira-okafor", "jun-arata", "sol-varga", "ines-duarte", "theo-brandt", "pia-lund",
  "arjun-mehta", "kofi-mensah", "lena-hoff", "maya-chen", "rafael-souza", "noor-haddad",
  "tidebot", "eve-larsen",
]

///|
let languages : Array[(String, Double, String)] = [
  ("TypeScript", 71.4, "#3178c6"),
  ("CSS", 12.8, "#663399"),
  ("HTML", 8.3, "#e34c26"),
  ("JavaScript", 5.1, "#f1e05a"),
  ("Shell", 2.4, "#89e051"),
]

///|
let topics : Array[String] = [
  "static-site-generator", "markdown", "typescript", "incremental-build", "jamstack", "blog",
]

// Blame: seeded chunks, each a run of lines from one commit.

///|
let blame_commits : Array[Commit] = [
  main_head,
  { author: "jun-arata", msg: "graph: drop pages whose source was deleted", pr: 411, sha: "3e9b0a4", age: "6 days ago" },
  { author: "sol-varga", msg: "build: report unchanged pages separately", pr: 388, sha: "77c2d91", age: "last month" },
  { author: "theo-brandt", msg: "render: write pages with a recursive mkdir", pr: 342, sha: "b1f05ee", age: "5 months ago" },
  { author: "mira-okafor", msg: "Initial commit", pr: 0, sha: "0a1c3f2", age: "4 years ago" },
  { author: "ines-duarte", msg: "Explain staleness in a comment", pr: 297, sha: "c44e8a0", age: "last year" },
]

///|
fn blame_chunks(path : String, lines : Int) -> Array[(Int, Int, Commit)] {
  // (first line, line count, commit), from a generator seeded by the path.
  let mut seed = 7
  for c in path {
    seed = (seed * 31 + c.to_int()) % 10007
  }
  let out = []
  let mut at = 1
  while at <= lines {
    seed = (seed * 7919 + 17) % 10007
    let len = 2 + seed % 7
    let n = if at + len - 1 > lines { lines - at + 1 } else { len }
    out.push((at, n, blame_commits[seed / 7 % blame_commits.length()]))
    at += n
  }
  out
}

///|
fn basename(path : String) -> String {
  match path.rev_find("/") {
    Some(i) => path.substring(start=i + 1)
    None => path
  }
}

///|
fn dirname(path : String) -> String {
  match path.rev_find("/") {
    Some(i) => path.substring(end=i)
    None => ""
  }
}
