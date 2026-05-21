export function evaluateVrmVrmaPlaybackContract({
  vrmGltf,
  vrmaGltf,
  motion,
  renderVerify = null,
  requiredBones = [],
  requiredClips = [],
  allowNonVrmTarget = false,
}) {
  const vrmBones = humanoidBoneNames(vrmGltf, "VRMC_vrm");
  const vrmaBones = humanoidBoneNames(vrmaGltf, "VRMC_vrm_animation");
  const motionClips = motion?.clips ?? [];
  const motionTracks = motionClips.flatMap((clip) => clip.tracks ?? []);
  const checks = [];

  pushCheck(checks, "vrm.humanoid", vrmBones.length > 0, {
    status: allowNonVrmTarget ? "warn" : "fail",
    reason: "target model has no VRMC_vrm humanoid mapping",
    value: { humanoidBoneCount: vrmBones.length, allowNonVrmTarget },
  });
  pushCheck(checks, "vrma.humanoid", vrmaBones.length > 0, {
    reason: "VRMA has no VRMC_vrm_animation humanoid mapping",
    value: { humanoidBoneCount: vrmaBones.length },
  });
  pushCheck(checks, "humanoid.required-bones", requiredBones.every((bone) => vrmaBones.includes(bone) && (allowNonVrmTarget || vrmBones.includes(bone))), {
    reason: "required humanoid bone missing from VRM or VRMA",
    value: {
      requiredBones,
      missingFromVrm: allowNonVrmTarget ? [] : requiredBones.filter((bone) => !vrmBones.includes(bone)),
      missingFromVrma: requiredBones.filter((bone) => !vrmaBones.includes(bone)),
    },
  });
  pushCheck(checks, "motion.target-space", motion?.source?.targetSpace === "humanoid", {
    reason: "extracted Motion IR is not in humanoid target space",
    value: { targetSpace: motion?.source?.targetSpace ?? null },
  });
  pushCheck(checks, "motion.vrma-extension", Boolean(motion?.source?.vrmcVrmAnimation), {
    reason: "extracted Motion IR lacks VRMC_vrm_animation source metadata",
    value: motion?.source?.vrmcVrmAnimation ?? null,
  });
  pushCheck(checks, "motion.bone-count", motion?.source?.vrmcVrmAnimation?.humanoidBoneCount === vrmaBones.length, {
    reason: "Motion IR humanoid bone count differs from VRMA",
    value: {
      motion: motion?.source?.vrmcVrmAnimation?.humanoidBoneCount ?? null,
      vrma: vrmaBones.length,
    },
  });
  pushCheck(checks, "clips.required", requiredClips.every((clip) => motionClips.some((item) => item.id === clip)), {
    reason: "required clip missing from Motion IR",
    value: {
      requiredClips,
      motionClips: motionClips.map((clip) => clip.id).filter(Boolean),
    },
  });
  pushCheck(checks, "tracks.required-bones", requiredBones.every((bone) => motionTracks.some((track) => track.target === bone)), {
    reason: "Motion IR lacks tracks for required humanoid bones",
    value: {
      requiredBones,
      trackTargets: [...new Set(motionTracks.map((track) => track.target).filter(Boolean))].sort(),
    },
  });
  if (renderVerify) {
    pushCheck(checks, "render.verify", renderVerify.ok === true, {
      reason: "render verification did not pass",
      value: { ok: renderVerify.ok ?? null },
    });
  }

  const failed = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  return {
    ok: failed === 0,
    summary: {
      checkCount: checks.length,
      failed,
      warnings,
      vrmHumanoidBoneCount: vrmBones.length,
      vrmaHumanoidBoneCount: vrmaBones.length,
      motionClipCount: motionClips.length,
      motionTrackCount: motionTracks.length,
    },
    checks,
  };
}

export function humanoidBoneNames(gltf, extensionName) {
  const humanBones = gltf?.extensions?.[extensionName]?.humanoid?.humanBones;
  if (humanBones && !Array.isArray(humanBones)) {
    return Object.keys(humanBones).sort((a, b) => a.localeCompare(b));
  }
  if (extensionName === "VRMC_vrm") {
    const vrm0Bones = gltf?.extensions?.VRM?.humanoid?.humanBones;
    if (Array.isArray(vrm0Bones)) {
      return vrm0Bones
        .map((bone) => bone?.bone)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
  }
  return [];
}

function pushCheck(checks, id, ok, options) {
  const status = ok ? "pass" : options.status ?? "fail";
  checks.push({
    id,
    status,
    ok: status !== "fail",
    reason: status === "pass" ? null : options.reason,
    value: options.value ?? null,
  });
}
