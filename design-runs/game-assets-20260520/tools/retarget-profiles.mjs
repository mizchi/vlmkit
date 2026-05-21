import { motionCorePolicy } from "./motion-core-runtime.mjs";

const STRICT_PROFILE = {
  name: "strict",
  aliases: [],
  kind: "strict",
};

const ROBOT_VOXEL_PROFILE = {
  name: "robot-voxel",
  aliases: ["simple-rig"],
  kind: "weighted",
  warnScore: 0.95,
  failScore: 0.5,
  failPenalty: 2,
  rules: [
    {
      id: "finger",
      classification: "ignored",
      region: "finger",
      penalty: 0,
      match: /(thumb|index|middle|ring|little|finger)/,
    },
    {
      id: "toe",
      classification: "ignored",
      region: "toe-foot",
      penalty: 0,
      match: /toe/,
    },
    {
      id: "upper-body-fallback",
      classification: "fallback",
      region: "body",
      penalty: 0,
      match: /(chest|neck|shoulder)/,
    },
    {
      id: "required-core",
      classification: "required",
      region: "core",
      penalty: 2,
      hardFail: true,
      match: /(hips|spine|head|upperarm|lowerarm|hand|upperleg|lowerleg|foot)/,
    },
  ],
  fallbackRule: {
    id: "unexpected",
    classification: "unexpected",
    region: "other",
    penalty: 0.5,
  },
};

const profiles = [STRICT_PROFILE, ROBOT_VOXEL_PROFILE];

export function retargetProfileNames() {
  return profiles.flatMap((profile) => [profile.name, ...profile.aliases]);
}

export function describeRetargetProfiles() {
  return profiles.map((profile) => describeRetargetProfile(profile));
}

export function validateRetargetProfiles() {
  const errors = [];
  const seenNames = new Map();
  for (const profile of profiles) {
    validateProfileShape(profile, errors);
    for (const name of [profile.name, ...(profile.aliases ?? [])]) {
      if (seenNames.has(name)) {
        errors.push(
          `profile name/alias collision: ${name} (${seenNames.get(name)} and ${profile.name})`,
        );
      } else {
        seenNames.set(name, profile.name);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function resolveRetargetProfile(name) {
  const profile = profiles.find((item) => {
    return item.name === name || item.aliases.includes(name);
  });
  if (!profile) throw new Error(`unknown retarget profile: ${name}`);
  return profile;
}

export function evaluateRetargetWarnings(motion, options = {}) {
  const profile = resolveRetargetProfile(options.profileName ?? "strict");
  const warnings = motion?.source?.warnings ?? [];
  const trackCount = (motion?.clips ?? []).reduce((sum, clip) => {
    return sum + (clip.tracks?.length ?? 0);
  }, 0);
  const skipped = motion?.source?.skippedChannelCount ?? warnings.length;
  const total = trackCount + skipped;
  const retainedRatio = total > 0 ? trackCount / total : 0;
  const skippedByRegion = skippedChannelRegions(warnings);

  if (profile.kind === "strict") {
    const threshold = options.minRetainedRatioWarn ?? 0.4;
    return {
      profile: profile.name,
      requestedProfile: options.profileName ?? profile.name,
      mode: "retained-ratio",
      verdict: motionCorePolicy.retarget.strictVerdict({
        trackCount,
        skipped,
        minRetainedRatioWarn: threshold,
      }),
      retainedRatio: round(retainedRatio),
      trackCount,
      skipped,
      skippedByRegion,
      threshold,
    };
  }

  const classified = warnings.map((warning) => classifyWarning(warning, profile));
  const penalty = classified.reduce((sum, item) => sum + item.penalty, 0);
  const score = weightedProfileScore(profile, penalty);
  const hardFailures = classified.filter((item) => item.hardFail);
  const nonTolerated = classified.filter((item) => item.penalty > 0 || item.hardFail);
  const verdict = weightedProfileVerdict(profile, {
    score,
    weightedPenalty: penalty,
    hardFailureCount: hardFailures.length,
  });

  return {
    profile: profile.name,
    requestedProfile: options.profileName ?? profile.name,
    mode: "weighted-profile",
    verdict,
    score,
    warnScore: profile.warnScore,
    failScore: profile.failScore,
    weightedPenalty: round(penalty),
    retainedRatio: round(retainedRatio),
    trackCount,
    skipped,
    toleratedSkipped: skipped - nonTolerated.length,
    nonToleratedSkipped: nonTolerated.length,
    hardFailureSkipped: hardFailures.length,
    skippedByRegion,
    skippedByPolicy: summarizeByPolicy(classified),
    nonTolerated: nonTolerated.slice(0, 8).map(formatClassifiedWarning),
  };
}

export function skippedChannelRegions(warnings) {
  const regions = {};
  for (const warning of warnings) {
    const region = skeletonRegion(warning.reason ?? warning.node ?? "");
    regions[region] = (regions[region] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(regions).sort((a, b) => b[1] - a[1]));
}

export function skeletonRegion(text) {
  const value = String(text).toLowerCase();
  if (/(thumb|index|middle|ring|little|finger)/.test(value)) return "finger";
  if (/(toe|foot)/.test(value)) return "toe-foot";
  if (/(shoulder|upperarm|lowerarm|hand|arm)/.test(value)) return "arm";
  if (/(upperleg|lowerleg|leg)/.test(value)) return "leg";
  if (/(chest|spine|neck|head|hips)/.test(value)) return "body";
  return "other";
}

function classifyWarning(warning, profile) {
  const value = `${warning.node ?? ""} ${warning.reason ?? ""}`.toLowerCase();
  const rule = resolveProfileRule(profile, value);
  return {
    warning,
    ruleId: rule.id,
    classification: rule.classification,
    region: rule.region,
    penalty: rule.penalty,
    hardFail: Boolean(rule.hardFail),
  };
}

function resolveProfileRule(profile, value) {
  if (profile.name === ROBOT_VOXEL_PROFILE.name) {
    const ruleId = motionCorePolicy.retarget.robotVoxelRuleId(value);
    return profile.rules.find((item) => item.id === ruleId) ?? profile.fallbackRule;
  }
  return profile.rules.find((item) => item.match.test(value)) ?? profile.fallbackRule;
}

function weightedProfileScore(profile, penalty) {
  if (profile.name === ROBOT_VOXEL_PROFILE.name) {
    return motionCorePolicy.retarget.robotVoxelScore(penalty);
  }
  return round(Math.max(0, 1 - Math.min(1, penalty / profile.failPenalty)));
}

function weightedProfileVerdict(profile, { score, weightedPenalty, hardFailureCount }) {
  if (profile.name === ROBOT_VOXEL_PROFILE.name) {
    return motionCorePolicy.retarget.robotVoxelVerdict({
      weightedPenalty,
      hardFailureCount,
    });
  }
  return hardFailureCount > 0 || score < profile.failScore
    ? "fail"
    : score < profile.warnScore
      ? "warn"
      : "pass";
}

function describeRetargetProfile(profile) {
  const description = {
    name: profile.name,
    aliases: [...(profile.aliases ?? [])],
    kind: profile.kind,
  };
  if (profile.kind === "weighted") {
    description.thresholds = {
      warnScore: profile.warnScore,
      failScore: profile.failScore,
      failPenalty: profile.failPenalty,
    };
    description.rules = profile.rules.map(describeRule);
    description.fallbackRule = describeRule(profile.fallbackRule);
  }
  return description;
}

function describeRule(rule) {
  return {
    id: rule.id,
    classification: rule.classification,
    region: rule.region,
    penalty: rule.penalty,
    hardFail: Boolean(rule.hardFail),
    match: rule.match?.source ?? null,
  };
}

function validateProfileShape(profile, errors) {
  if (!profile.name) errors.push("profile missing name");
  if (!Array.isArray(profile.aliases)) {
    errors.push(`profile ${profile.name} aliases must be an array`);
  }
  if (!["strict", "weighted"].includes(profile.kind)) {
    errors.push(`profile ${profile.name} has unsupported kind: ${profile.kind}`);
  }
  if (profile.kind !== "weighted") return;
  if (!isUnitScore(profile.warnScore)) {
    errors.push(`profile ${profile.name} warnScore must be between 0 and 1`);
  }
  if (!isUnitScore(profile.failScore)) {
    errors.push(`profile ${profile.name} failScore must be between 0 and 1`);
  }
  if (
    isUnitScore(profile.warnScore) &&
    isUnitScore(profile.failScore) &&
    profile.failScore > profile.warnScore
  ) {
    errors.push(`profile ${profile.name} failScore must be <= warnScore`);
  }
  if (!Number.isFinite(profile.failPenalty) || profile.failPenalty <= 0) {
    errors.push(`profile ${profile.name} failPenalty must be positive`);
  }
  if (!Array.isArray(profile.rules) || profile.rules.length === 0) {
    errors.push(`profile ${profile.name} must define rules`);
  }
  for (const rule of profile.rules ?? []) validateRule(profile.name, rule, errors);
  validateRule(profile.name, profile.fallbackRule, errors, { fallback: true });
}

function validateRule(profileName, rule, errors, options = {}) {
  if (!rule) {
    errors.push(`profile ${profileName} missing ${options.fallback ? "fallbackRule" : "rule"}`);
    return;
  }
  if (!rule.id) errors.push(`profile ${profileName} has a rule without id`);
  if (!rule.classification) errors.push(`profile ${profileName} rule ${rule.id} missing classification`);
  if (!rule.region) errors.push(`profile ${profileName} rule ${rule.id} missing region`);
  if (!Number.isFinite(rule.penalty) || rule.penalty < 0) {
    errors.push(`profile ${profileName} rule ${rule.id} penalty must be non-negative`);
  }
  if (!options.fallback && !(rule.match instanceof RegExp)) {
    errors.push(`profile ${profileName} rule ${rule.id} match must be a RegExp`);
  }
}

function isUnitScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function summarizeByPolicy(classified) {
  const summary = {};
  for (const item of classified) {
    const key = item.ruleId;
    const entry = summary[key] ?? {
      classification: item.classification,
      region: item.region,
      count: 0,
      penalty: 0,
    };
    entry.count++;
    entry.penalty = round(entry.penalty + item.penalty);
    summary[key] = entry;
  }
  return Object.fromEntries(Object.entries(summary).sort((a, b) => b[1].count - a[1].count));
}

function formatClassifiedWarning(item) {
  return {
    node: item.warning.node ?? null,
    path: item.warning.path ?? null,
    reason: item.warning.reason ?? null,
    ruleId: item.ruleId,
    classification: item.classification,
    penalty: item.penalty,
    hardFail: item.hardFail,
  };
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
