#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { PNG } from "pngjs";
import {
  evaluateRetargetWarnings,
  retargetProfileNames,
  skippedChannelRegions,
} from "./retarget-profiles.mjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const defaultBackground = [0xe8, 0xe8, 0xe4];

function parseArgs(argv) {
  const args = {
    rendersDir: "",
    renderVerify: "",
    motion: "",
    out: "",
    background: defaultBackground,
    minForegroundRatio: 0.03,
    minCoverageRatio: 0.015,
    maxCoverageRatio: 0.75,
    maxCenterJumpRatio: 0.18,
    maxAreaJumpRatio: 0.45,
    minRetainedRatioWarn: 0.4,
    retargetProfile: "strict",
    minGroundYWarn: -0.35,
    minGroundYFail: -2.5,
    minFootDeltaYWarn: -0.25,
    maxAlwaysFloatingFootDeltaYWarn: 0.65,
    maxTrackedNodeDisplacementWarn: 1.35,
    maxPelvisDisplacementWarn: 0.45,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--renders-dir" || arg === "--dir") args.rendersDir = resolve(required(argv, ++i, arg));
    else if (arg === "--render-verify") args.renderVerify = resolve(required(argv, ++i, arg));
    else if (arg === "--motion") args.motion = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--background") args.background = parseHexColor(required(argv, ++i, arg));
    else if (arg === "--min-foreground-ratio") args.minForegroundRatio = Number(required(argv, ++i, arg));
    else if (arg === "--min-coverage-ratio") args.minCoverageRatio = Number(required(argv, ++i, arg));
    else if (arg === "--max-coverage-ratio") args.maxCoverageRatio = Number(required(argv, ++i, arg));
    else if (arg === "--max-center-jump-ratio") args.maxCenterJumpRatio = Number(required(argv, ++i, arg));
    else if (arg === "--max-area-jump-ratio") args.maxAreaJumpRatio = Number(required(argv, ++i, arg));
    else if (arg === "--min-retained-ratio-warn") args.minRetainedRatioWarn = Number(required(argv, ++i, arg));
    else if (arg === "--retarget-profile") args.retargetProfile = required(argv, ++i, arg);
    else if (arg === "--min-ground-y-warn") args.minGroundYWarn = Number(required(argv, ++i, arg));
    else if (arg === "--min-ground-y-fail") args.minGroundYFail = Number(required(argv, ++i, arg));
    else if (arg === "--min-foot-delta-y-warn") args.minFootDeltaYWarn = Number(required(argv, ++i, arg));
    else if (arg === "--max-always-floating-foot-delta-y-warn") args.maxAlwaysFloatingFootDeltaYWarn = Number(required(argv, ++i, arg));
    else if (arg === "--max-tracked-node-displacement-warn") args.maxTrackedNodeDisplacementWarn = Number(required(argv, ++i, arg));
    else if (arg === "--max-pelvis-displacement-warn") args.maxPelvisDisplacementWarn = Number(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/verify-motion-quality.mjs --renders-dir <dir> [options]

Options:
  --renders-dir <path>              Render directory
  --render-verify <path>            Existing verify-renders JSON
  --motion <path>                   Motion IR JSON
  --out <path>                      Quality report JSON
  --background <hex>                Background color (default: #e8e8e4)
  --min-foreground-ratio <n>        Failure threshold for foreground pixels
  --min-coverage-ratio <n>          Warning threshold for screen coverage
  --max-coverage-ratio <n>          Warning threshold for overfilled frames
  --max-center-jump-ratio <n>       Warning threshold for bbox center jumps
  --max-area-jump-ratio <n>         Warning threshold for bbox area jumps
  --min-retained-ratio-warn <n>     Warning threshold for retained motion channels
  --retarget-profile <profile>      ${retargetProfileNames().join("|")} (default: strict)
  --min-ground-y-warn <n>           Warning threshold for groundDeltaY when available, otherwise minGroundY
  --min-ground-y-fail <n>           Failure threshold for groundDeltaY when available, otherwise minGroundY
  --min-foot-delta-y-warn <n>       Warning threshold for foot pivot sinking below bind pose
  --max-always-floating-foot-delta-y-warn <n>
                                    Warning threshold when all sampled frames have both feet above bind pose
  --max-tracked-node-displacement-warn <n>
                                    Warning threshold for tracked hand/foot displacement from bind pose
  --max-pelvis-displacement-warn <n>
                                    Warning threshold for pelvis displacement from bind pose
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.rendersDir) throw new Error("--renders-dir is required");
  if (!retargetProfileNames().includes(args.retargetProfile)) {
    throw new Error(`--retarget-profile must be one of: ${retargetProfileNames().join(", ")}`);
  }
  if (!args.out) args.out = join(dirname(args.rendersDir), `${basenameNoExt(args.rendersDir)}.motion-quality.json`);
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const frames = await readFrames(args);
  const motion = args.motion ? JSON.parse(await readFile(args.motion, "utf8")) : null;
  const renderVerify = args.renderVerify ? JSON.parse(await readFile(args.renderVerify, "utf8")) : null;
  const checks = [];

  checkRenderVerify(renderVerify, checks);
  checkFrameBasics(frames, args, checks);
  checkFrameStability(frames, args, checks);
  checkGround(frames, args, checks);
  checkFootContact(frames, args, checks);
  checkLimbExtent(frames, args, checks);
  checkRetainedChannels(motion, args, checks);
  checkLoopMetadata(motion, checks);

  const verdict = summarizeVerdict(checks);
  const result = {
    ok: verdict !== "fail",
    verdict,
    inputs: {
      rendersDir: relative(repoRoot, args.rendersDir),
      renderVerify: args.renderVerify ? relative(repoRoot, args.renderVerify) : null,
      motion: args.motion ? relative(repoRoot, args.motion) : null,
      retargetProfile: args.retargetProfile,
    },
    metrics: summarizeMetrics(frames, motion),
    checks,
    frames: frames.map((frame) => ({
      file: frame.file,
      view: frame.view,
      sampleTime: frame.sampleTime,
      foregroundRatio: frame.foregroundRatio,
      screenCoverageRatio: frame.screenCoverageRatio,
      bboxCenter: frame.bboxCenter,
      minGroundY: frame.minGroundY,
      groundDeltaY: frame.groundDeltaY,
      footContact: frame.footContact,
      trackedNodeDisplacement: frame.trackedNodeDisplacement,
    })),
  };
  await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${verdict.toUpperCase()} ${relative(repoRoot, args.out)}`);
  if (verdict === "fail") process.exit(1);
}

async function readFrames(args) {
  const files = (await readdir(args.rendersDir))
    .filter((file) => file.endsWith(".png"))
    .sort();
  const frames = [];
  for (const file of files) {
    const pngPath = join(args.rendersDir, file);
    const metadataPath = pngPath.replace(/\.png$/, ".metadata.json");
    const image = PNG.sync.read(await readFile(pngPath));
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    const bbox = foregroundBbox(image, args.background);
    const screenCoverageRatio = bbox ? (bbox.width * bbox.height) / (image.width * image.height) : 0;
    frames.push({
      file: relative(repoRoot, pngPath),
      metadata: relative(repoRoot, metadataPath),
      width: image.width,
      height: image.height,
      view: metadata.view ?? "unknown",
      sampleTime: Number(metadata.sampleTime ?? 0),
      foregroundRatio: round(foregroundRatio(image, args.background)),
      screenCoverageRatio: round(screenCoverageRatio),
      bbox,
      bboxCenter: bbox ? [round((bbox.minX + bbox.maxX) / 2 / image.width), round((bbox.minY + bbox.maxY) / 2 / image.height)] : null,
      minGroundY: metadata.state?.minGroundY ?? null,
      groundDeltaY: metadata.state?.groundDeltaY ?? null,
      animatedBounds: metadata.state?.animatedBounds ?? null,
      bindBounds: metadata.state?.bindBounds ?? null,
      normalizedBindBounds: metadata.state?.normalizedBindBounds ?? null,
      bindTrackedNodes: metadata.state?.bindTrackedNodes ?? null,
      animatedTrackedNodes: metadata.state?.animatedTrackedNodes ?? null,
      footContact: footContactFromState(metadata.state),
      trackedNodeDisplacement: trackedNodeDisplacementFromState(metadata.state),
    });
  }
  return frames.sort((a, b) => `${a.view}:${a.sampleTime}`.localeCompare(`${b.view}:${b.sampleTime}`));
}

function checkLimbExtent(frames, args, checks) {
  const displacements = frames.map((frame) => frame.trackedNodeDisplacement).filter(Boolean);
  if (displacements.length === 0) {
    checks.push(warn("limb-extent", "no tracked node displacement metadata"));
    return;
  }
  const maxByNode = {};
  for (const displacement of displacements) {
    for (const [node, value] of Object.entries(displacement)) {
      maxByNode[node] = Math.max(maxByNode[node] ?? 0, value);
    }
  }
  const maxTrackedNode = Math.max(...Object.values(maxByNode));
  const pelvis = maxByNode.pelvis ?? 0;
  const value = {
    maxTrackedNode: round(maxTrackedNode),
    maxTrackedNodeDisplacementWarn: args.maxTrackedNodeDisplacementWarn,
    pelvis: round(pelvis),
    maxPelvisDisplacementWarn: args.maxPelvisDisplacementWarn,
    maxByNode: Object.fromEntries(Object.entries(maxByNode).map(([node, item]) => [node, round(item)])),
  };
  if (pelvis > args.maxPelvisDisplacementWarn) {
    checks.push(warn("limb-extent", "pelvis displacement exceeds bind-pose envelope", value));
  } else if (maxTrackedNode > args.maxTrackedNodeDisplacementWarn) {
    checks.push(warn("limb-extent", "tracked limb displacement exceeds bind-pose envelope", value));
  } else {
    checks.push(pass("limb-extent", "tracked limb displacement is within threshold", value));
  }
}

function checkFootContact(frames, args, checks) {
  const contacts = frames.map((frame) => frame.footContact).filter(Boolean);
  if (contacts.length === 0) {
    checks.push(warn("foot-contact", "no tracked foot metadata"));
    return;
  }
  const minFootDeltaY = Math.min(...contacts.map((contact) => contact.minDeltaY));
  const maxMinFootDeltaY = Math.max(...contacts.map((contact) => contact.minDeltaY));
  const alwaysFloating = contacts.every((contact) => contact.minDeltaY > args.maxAlwaysFloatingFootDeltaYWarn);
  const value = {
    frameCount: contacts.length,
    minFootDeltaY: round(minFootDeltaY),
    maxMinFootDeltaY: round(maxMinFootDeltaY),
    sinkWarnThreshold: args.minFootDeltaYWarn,
    alwaysFloatingWarnThreshold: args.maxAlwaysFloatingFootDeltaYWarn,
  };
  if (minFootDeltaY < args.minFootDeltaYWarn) {
    checks.push(warn("foot-contact", "foot pivots sink below bind-pose contact threshold", value));
  } else if (alwaysFloating) {
    checks.push(warn("foot-contact", "both feet float above bind-pose contact threshold in all sampled frames", value));
  } else {
    checks.push(pass("foot-contact", "foot contact envelope is within threshold", value));
  }
}

function checkRenderVerify(renderVerify, checks) {
  if (!renderVerify) {
    checks.push(warn("render-verify-missing", "render verify report was not provided"));
    return;
  }
  checks.push(renderVerify.ok ? pass("render-verify", "verify-renders passed") : fail("render-verify", "verify-renders failed", renderVerify.failures ?? []));
}

function checkFrameBasics(frames, args, checks) {
  if (frames.length === 0) {
    checks.push(fail("frame-count", "no frames found"));
    return;
  }
  checks.push(pass("frame-count", `${frames.length} frame(s) checked`, frames.length));
  const minForeground = Math.min(...frames.map((frame) => frame.foregroundRatio));
  checks.push(minForeground < args.minForegroundRatio
    ? fail("foreground-ratio", "foreground ratio below threshold", { minForeground, threshold: args.minForegroundRatio })
    : pass("foreground-ratio", "foreground ratio is above threshold", { minForeground, threshold: args.minForegroundRatio }));
  const minCoverage = Math.min(...frames.map((frame) => frame.screenCoverageRatio));
  const maxCoverage = Math.max(...frames.map((frame) => frame.screenCoverageRatio));
  if (minCoverage < args.minCoverageRatio) {
    checks.push(warn("screen-coverage-min", "rendered asset is small on screen", { minCoverage, threshold: args.minCoverageRatio }));
  } else {
    checks.push(pass("screen-coverage-min", "screen coverage minimum is acceptable", { minCoverage, threshold: args.minCoverageRatio }));
  }
  if (maxCoverage > args.maxCoverageRatio) {
    checks.push(warn("screen-coverage-max", "rendered asset is close to filling the screen", { maxCoverage, threshold: args.maxCoverageRatio }));
  } else {
    checks.push(pass("screen-coverage-max", "screen coverage maximum is acceptable", { maxCoverage, threshold: args.maxCoverageRatio }));
  }
}

function checkFrameStability(frames, args, checks) {
  const byView = groupBy(frames, (frame) => frame.view);
  let maxCenterJump = 0;
  let maxAreaJump = 0;
  for (const group of byView.values()) {
    const sorted = [...group].sort((a, b) => a.sampleTime - b.sampleTime);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.bboxCenter && curr.bboxCenter) {
        maxCenterJump = Math.max(maxCenterJump, distance(prev.bboxCenter, curr.bboxCenter));
      }
      const prevArea = prev.screenCoverageRatio;
      const currArea = curr.screenCoverageRatio;
      if (prevArea > 0 && currArea > 0) {
        maxAreaJump = Math.max(maxAreaJump, Math.abs(currArea - prevArea) / Math.max(prevArea, currArea));
      }
    }
  }
  checks.push(maxCenterJump > args.maxCenterJumpRatio
    ? warn("bbox-center-jump", "large frame-to-frame screen center movement", { maxCenterJump: round(maxCenterJump), threshold: args.maxCenterJumpRatio })
    : pass("bbox-center-jump", "frame-to-frame screen center movement is bounded", { maxCenterJump: round(maxCenterJump), threshold: args.maxCenterJumpRatio }));
  checks.push(maxAreaJump > args.maxAreaJumpRatio
    ? warn("bbox-area-jump", "large frame-to-frame screen area change", { maxAreaJump: round(maxAreaJump), threshold: args.maxAreaJumpRatio })
    : pass("bbox-area-jump", "frame-to-frame screen area change is bounded", { maxAreaJump: round(maxAreaJump), threshold: args.maxAreaJumpRatio }));
}

function checkGround(frames, args, checks) {
  const groundDeltaValues = frames.map((frame) => frame.groundDeltaY).filter(Number.isFinite);
  const metric = groundDeltaValues.length > 0 ? "groundDeltaY" : "minGroundY";
  const values = groundDeltaValues.length > 0
    ? groundDeltaValues
    : frames.map((frame) => frame.minGroundY).filter(Number.isFinite);
  if (values.length === 0) {
    checks.push(warn("ground-y", "no finite ground metadata"));
    return;
  }
  const minGround = Math.min(...values);
  const value = { metric, minGround: round(minGround), warnThreshold: args.minGroundYWarn, failThreshold: args.minGroundYFail };
  if (minGround < args.minGroundYFail) {
    checks.push(fail("ground-y", "motion sinks far below ground threshold", value));
  } else if (minGround < args.minGroundYWarn) {
    checks.push(warn("ground-y", "motion goes below ground warning threshold", value));
  } else {
    checks.push(pass("ground-y", "ground contact metadata is within threshold", value));
  }
}

function checkRetainedChannels(motion, args, checks) {
  if (!motion) {
    checks.push(warn("retained-channels", "motion IR was not provided"));
    return;
  }
  const result = evaluateRetargetWarnings(motion, {
    profileName: args.retargetProfile,
    minRetainedRatioWarn: args.minRetainedRatioWarn,
  });
  const reason = result.mode === "weighted-profile"
    ? {
      pass: "retarget skips are accepted by the weighted profile",
      warn: "retarget skipped channels outside the weighted profile tolerance",
      fail: "retarget skipped required channels for the target profile",
    }[result.verdict]
    : {
      pass: "retarget retained enough source channels",
      warn: "retarget kept a low ratio of source channels",
      fail: "retarget failed",
    }[result.verdict];
  checks.push(result.verdict === "fail"
    ? fail("retained-channels", reason, result)
    : result.verdict === "warn"
      ? warn("retained-channels", reason, result)
      : pass("retained-channels", reason, result));
}

function checkLoopMetadata(motion, checks) {
  if (!motion) return;
  const clips = motion.clips ?? [];
  const missing = clips.filter((clip) => typeof clip.loop !== "boolean");
  checks.push(missing.length > 0
    ? warn("loop-metadata", "some clips have no explicit loop metadata", missing.map((clip) => clip.id))
    : pass("loop-metadata", "all clips have explicit loop metadata", clips.map((clip) => ({ id: clip.id, loop: clip.loop }))));
}

function summarizeMetrics(frames, motion) {
  const foreground = frames.map((frame) => frame.foregroundRatio);
  const coverage = frames.map((frame) => frame.screenCoverageRatio);
  const trackCount = (motion?.clips ?? []).reduce((sum, clip) => sum + (clip.tracks?.length ?? 0), 0);
  const skipped = motion?.source?.skippedChannelCount ?? motion?.source?.warnings?.length ?? 0;
  return {
    frameCount: frames.length,
    foregroundRatio: range(foreground),
    screenCoverageRatio: range(coverage),
    minGroundY: range(frames.map((frame) => frame.minGroundY).filter(Number.isFinite)),
    groundDeltaY: range(frames.map((frame) => frame.groundDeltaY).filter(Number.isFinite)),
    footContact: summarizeFootContact(frames),
    trackedNodeDisplacement: summarizeTrackedNodeDisplacement(frames),
    motion: motion ? {
      clipCount: motion.clips?.length ?? 0,
      trackCount,
      skippedChannelCount: skipped,
      retainedChannelRatio: trackCount + skipped > 0 ? round(trackCount / (trackCount + skipped)) : null,
      skippedByRegion: skippedChannelRegions(motion.source?.warnings ?? []),
    } : null,
  };
}

function trackedNodeDisplacementFromState(state) {
  const bind = state?.bindTrackedNodes;
  const animated = state?.animatedTrackedNodes;
  if (!bind || !animated) return null;
  const displacement = {};
  for (const [name, bindPosition] of Object.entries(bind)) {
    const start = vec3OrNull(bindPosition);
    const end = vec3OrNull(animated[name]);
    if (!start || !end) continue;
    displacement[name] = round(distance3(start, end));
  }
  return Object.keys(displacement).length > 0 ? displacement : null;
}

function summarizeTrackedNodeDisplacement(frames) {
  const byNode = {};
  for (const frame of frames) {
    const displacement = frame.trackedNodeDisplacement;
    if (!displacement) continue;
    for (const [node, value] of Object.entries(displacement)) {
      const values = byNode[node] ?? [];
      values.push(value);
      byNode[node] = values;
    }
  }
  if (Object.keys(byNode).length === 0) return null;
  return Object.fromEntries(Object.entries(byNode).map(([node, values]) => [node, range(values)]));
}

function footContactFromState(state) {
  const bind = state?.bindTrackedNodes;
  const animated = state?.animatedTrackedNodes;
  const bindLeft = vec3OrNull(bind?.left_foot);
  const bindRight = vec3OrNull(bind?.right_foot);
  const animatedLeft = vec3OrNull(animated?.left_foot);
  const animatedRight = vec3OrNull(animated?.right_foot);
  if (!bindLeft || !bindRight || !animatedLeft || !animatedRight) return null;
  const leftDeltaY = round(animatedLeft[1] - bindLeft[1]);
  const rightDeltaY = round(animatedRight[1] - bindRight[1]);
  return {
    leftDeltaY,
    rightDeltaY,
    minDeltaY: round(Math.min(leftDeltaY, rightDeltaY)),
    maxDeltaY: round(Math.max(leftDeltaY, rightDeltaY)),
    leftY: animatedLeft[1],
    rightY: animatedRight[1],
  };
}

function summarizeFootContact(frames) {
  const contacts = frames.map((frame) => frame.footContact).filter(Boolean);
  if (contacts.length === 0) return null;
  return {
    minDeltaY: range(contacts.map((contact) => contact.minDeltaY)),
    maxDeltaY: range(contacts.map((contact) => contact.maxDeltaY)),
  };
}

function vec3OrNull(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite) ? value : null;
}

function foregroundRatio(image, background) {
  const bbox = foregroundBbox(image, background);
  return bbox ? bbox.foreground / (image.width * image.height) : 0;
}

function foregroundBbox(image, background) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  let foreground = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const idx = (y * image.width + x) * 4;
      const distanceToBackground =
        Math.abs(image.data[idx] - background[0]) +
        Math.abs(image.data[idx + 1] - background[1]) +
        Math.abs(image.data[idx + 2] - background[2]);
      if (distanceToBackground > 18 && image.data[idx + 3] > 0) {
        foreground++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (foreground === 0) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1, foreground };
}

function summarizeVerdict(checks) {
  if (checks.some((check) => check.verdict === "fail")) return "fail";
  if (checks.some((check) => check.verdict === "warn")) return "warn";
  return "pass";
}

function pass(id, reason, value) {
  return { id, verdict: "pass", reason, value: value ?? null };
}

function warn(id, reason, value) {
  return { id, verdict: "warn", reason, value: value ?? null };
}

function fail(id, reason, value) {
  return { id, verdict: "fail", reason, value: value ?? null };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function range(values) {
  if (values.length === 0) return null;
  return { min: round(Math.min(...values)), max: round(Math.max(...values)) };
}

function parseHexColor(value) {
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) throw new Error(`invalid hex color: ${value}`);
  const hex = match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function basenameNoExt(path) {
  const base = path.split(/[/\\]/).filter(Boolean).at(-1) ?? "renders";
  return base.replace(/\.[^.]+$/, "");
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
