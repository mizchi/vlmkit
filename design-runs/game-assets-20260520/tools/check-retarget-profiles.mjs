#!/usr/bin/env node
import {
  describeRetargetProfiles,
  evaluateRetargetWarnings,
  retargetProfileNames,
  validateRetargetProfiles,
} from "./retarget-profiles.mjs";

const failures = [];

check("profile validation passes", () => {
  const result = validateRetargetProfiles();
  return result.ok ? "ok" : result.errors.join("\n");
}, "ok");

check(
  "profile names include aliases",
  () => retargetProfileNames().join("|"),
  "strict|robot-voxel|simple-rig",
);

check("profile descriptions are schema-shaped", () => {
  const robotVoxel = describeRetargetProfiles().find((profile) => {
    return profile.name === "robot-voxel";
  });
  if (!robotVoxel) return "missing";
  return [
    robotVoxel.kind,
    robotVoxel.aliases.join(","),
    robotVoxel.thresholds.warnScore,
    robotVoxel.thresholds.failScore,
    robotVoxel.thresholds.failPenalty,
    robotVoxel.rules
      .map((rule) => `${rule.id}:${rule.classification}:${rule.region}:${rule.hardFail}`)
      .join("|"),
    robotVoxel.fallbackRule.id,
  ].join("\n");
}, [
  "weighted",
  "simple-rig",
  "0.95",
  "0.5",
  "2",
  [
    "finger:ignored:finger:false",
    "toe:ignored:toe-foot:false",
    "upper-body-fallback:fallback:body:false",
    "required-core:required:core:true",
  ].join("|"),
  "unexpected",
].join("\n"));

check("robot-voxel tolerates fingers and upper-body fallbacks", () => {
  const result = evaluateRetargetWarnings(motionWithWarnings([
    "retarget preset robot-voxel has no target for leftThumbProximal",
    "retarget preset robot-voxel has no target for chest",
  ]), { profileName: "robot-voxel" });
  return `${result.verdict}:${result.score}:${result.weightedPenalty}:${result.toleratedSkipped}:${result.nonToleratedSkipped}`;
}, "pass:1:0:2:0");

check("robot-voxel fails when soft penalties exceed failScore", () => {
  const result = evaluateRetargetWarnings(motionWithWarnings([
    "retarget preset robot-voxel has no target for antenna",
    "retarget preset robot-voxel has no target for tail",
    "retarget preset robot-voxel has no target for cape",
  ]), { profileName: "robot-voxel" });
  return `${result.verdict}:${result.score}:${result.weightedPenalty}:${result.nonToleratedSkipped}`;
}, "fail:0.25:1.5:3");

check("robot-voxel fails skipped core channels", () => {
  const result = evaluateRetargetWarnings(motionWithWarnings([
    "retarget preset robot-voxel has no target for hips",
  ]), { profileName: "robot-voxel" });
  return `${result.verdict}:${result.hardFailureSkipped}:${result.nonTolerated[0]?.ruleId}`;
}, "fail:1:required-core");

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("retarget profile checks passed");
}

function check(label, actualFn, expected) {
  const actual = actualFn();
  if (actual !== expected) {
    failures.push(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function motionWithWarnings(reasons) {
  return {
    source: {
      skippedChannelCount: reasons.length,
      warnings: reasons.map((reason, index) => ({
        clipId: "Test",
        animationIndex: 0,
        channelIndex: index,
        node: reason.match(/for ([^\s]+)/)?.[1] ?? null,
        path: "rotation",
        reason,
      })),
    },
    clips: [
      {
        id: "Test",
        tracks: [{ target: "hips" }, { target: "head" }],
      },
    ],
  };
}
