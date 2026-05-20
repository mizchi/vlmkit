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

export function resolveRetargetProfile(name) {
  const profile = profiles.find((item) => item.name === name || item.aliases.includes(name));
  if (!profile) throw new Error(`unknown retarget profile: ${name}`);
  return profile;
}

export function evaluateRetargetWarnings(motion, options = {}) {
  const profile = resolveRetargetProfile(options.profileName ?? "strict");
  const warnings = motion?.source?.warnings ?? [];
  const trackCount = (motion?.clips ?? []).reduce((sum, clip) => sum + (clip.tracks?.length ?? 0), 0);
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
      verdict: retainedRatio < threshold ? "warn" : "pass",
      retainedRatio: round(retainedRatio),
      trackCount,
      skipped,
      skippedByRegion,
      threshold,
    };
  }

  const classified = warnings.map((warning) => classifyWarning(warning, profile));
  const penalty = classified.reduce((sum, item) => sum + item.penalty, 0);
  const score = round(Math.max(0, 1 - Math.min(1, penalty / profile.failPenalty)));
  const hardFailures = classified.filter((item) => item.hardFail);
  const nonTolerated = classified.filter((item) => item.penalty > 0 || item.hardFail);
  const verdict = hardFailures.length > 0
    ? "fail"
    : score < profile.warnScore
      ? "warn"
      : "pass";

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
  const rule = profile.rules.find((item) => item.match.test(value)) ?? profile.fallbackRule;
  return {
    warning,
    ruleId: rule.id,
    classification: rule.classification,
    region: rule.region,
    penalty: rule.penalty,
    hardFail: Boolean(rule.hardFail),
  };
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
