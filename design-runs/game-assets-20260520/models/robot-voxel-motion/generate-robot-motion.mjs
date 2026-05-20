#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outBase = join(here, "robot-voxel-motion");
const unit = 0.12;
const cubeSize = unit * 0.92;

const materials = {
  frame: { name: "robot_graphite_frame", color: [0.08, 0.09, 0.11, 1], roughness: 0.82 },
  shadow: { name: "robot_black_shadow", color: [0.02, 0.02, 0.03, 1], roughness: 0.9 },
  panel: { name: "robot_blue_panel", color: [0.06, 0.15, 0.32, 1], roughness: 0.75 },
  face: { name: "robot_cyan_face", color: [0.08, 0.82, 0.92, 1], roughness: 0.45 },
  eye: { name: "robot_amber_eye", color: [1.0, 0.66, 0.08, 1], roughness: 0.35 },
  accent: { name: "robot_red_accent", color: [0.9, 0.05, 0.09, 1], roughness: 0.62 },
  joint: { name: "robot_violet_joint", color: [0.32, 0.18, 0.62, 1], roughness: 0.72 },
  trim: { name: "robot_light_trim", color: [0.67, 0.72, 0.78, 1], roughness: 0.65 },
};

class VoxelPart {
  constructor(name) {
    this.name = name;
    this.primitives = new Map();
    this.cubes = [];
  }

  cube(material, x, y, z, sx = 1, sy = 1, sz = 1, label = "") {
    const center = [x * unit, y * unit, z * unit];
    const size = [sx * cubeSize, sy * cubeSize, sz * cubeSize];
    this.addBox(material, center, size);
    this.cubes.push({ material, x, y, z, sx, sy, sz, label });
  }

  rect(material, x0, x1, y0, y1, z0, z1, label = "") {
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          this.cube(material, x, y, z, 1, 1, 1, label);
        }
      }
    }
  }

  addBox(material, center, size) {
    const primitive = this.getPrimitive(material);
    const hx = size[0] / 2;
    const hy = size[1] / 2;
    const hz = size[2] / 2;
    const corners = [
      [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
      [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
    ].map((point) => add(center, point));
    const faces = [
      [0, 1, 2, 3, [0, 0, -1]],
      [4, 7, 6, 5, [0, 0, 1]],
      [0, 4, 5, 1, [0, -1, 0]],
      [3, 2, 6, 7, [0, 1, 0]],
      [1, 5, 6, 2, [1, 0, 0]],
      [0, 3, 7, 4, [-1, 0, 0]],
    ];
    for (const face of faces) {
      const offset = primitive.positions.length / 3;
      for (let i = 0; i < 4; i++) {
        primitive.positions.push(...corners[face[i]]);
        primitive.normals.push(...face[4]);
      }
      primitive.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }
  }

  getPrimitive(material) {
    let primitive = this.primitives.get(material);
    if (!primitive) {
      primitive = { material, positions: [], normals: [], indices: [] };
      this.primitives.set(material, primitive);
    }
    return primitive;
  }

  primitiveList() {
    return [...this.primitives.values()];
  }
}

const parts = new Map();

function definePart(name, build) {
  const part = new VoxelPart(name);
  build(part);
  parts.set(name, part);
}

definePart("pelvis", (p) => {
  p.rect("frame", -2, 2, -1, 1, -1, 1, "pelvis_core");
  p.rect("panel", -1, 1, 0, 1, 2, 2, "front_pelvis_panel");
  p.rect("accent", -2, 2, 1, 1, 2, 2, "belt_accent");
  p.rect("joint", -3, -3, 0, 0, -1, 1, "left_hip_socket");
  p.rect("joint", 3, 3, 0, 0, -1, 1, "right_hip_socket");
});

definePart("torso", (p) => {
  p.rect("frame", -3, 3, -2, 3, -1, 1, "torso_core");
  p.rect("panel", -2, 2, -1, 2, 2, 2, "front_chest_panel");
  p.rect("trim", -3, 3, 3, 3, 2, 2, "shoulder_trim");
  p.rect("accent", -2, 2, 0, 0, 3, 3, "center_red_stripe");
  p.rect("joint", -4, -4, 2, 2, -1, 1, "left_shoulder_socket");
  p.rect("joint", 4, 4, 2, 2, -1, 1, "right_shoulder_socket");
});

definePart("head", (p) => {
  p.rect("frame", -3, 3, 0, 5, -2, 2, "head_cube");
  p.rect("shadow", -3, 3, 5, 5, -2, 2, "head_top_shadow");
  p.rect("face", -2, 2, 2, 4, 3, 3, "cyan_face_plate");
  p.cube("eye", -1, 3, 4, 1, 1, 1, "left_eye");
  p.cube("eye", 1, 3, 4, 1, 1, 1, "right_eye");
  p.rect("trim", -1, 1, 6, 6, 0, 0, "antenna_base");
  p.cube("accent", 0, 7, 0, 1, 1, 1, "antenna_tip");
});

definePart("upper_arm", (p) => {
  p.rect("joint", -1, 1, -1, -1, -1, 1, "shoulder_cap");
  p.rect("frame", -1, 1, -4, -2, -1, 1, "upper_arm");
  p.rect("accent", 0, 0, -3, -3, 2, 2, "upper_arm_front_stripe");
});

definePart("forearm", (p) => {
  p.rect("frame", -1, 1, -4, -1, -1, 1, "forearm");
  p.rect("panel", -1, 1, -3, -2, 2, 2, "forearm_panel");
  p.rect("joint", -1, 1, -1, -1, -1, 1, "elbow_socket");
});

definePart("hand", (p) => {
  p.rect("trim", -1, 1, -1, 0, -1, 1, "block_hand");
  p.cube("accent", 0, -2, 1, 1, 1, 1, "front_knuckle");
});

definePart("upper_leg", (p) => {
  p.rect("joint", -1, 1, -1, -1, -1, 1, "hip_cap");
  p.rect("frame", -1, 1, -4, -2, -1, 1, "upper_leg");
  p.rect("panel", 0, 0, -3, -2, 2, 2, "thigh_panel");
});

definePart("lower_leg", (p) => {
  p.rect("frame", -1, 1, -4, -1, -1, 1, "lower_leg");
  p.rect("joint", -1, 1, -1, -1, -1, 1, "knee_socket");
  p.rect("accent", 0, 0, -3, -2, 2, 2, "shin_red_stripe");
});

definePart("foot", (p) => {
  p.rect("trim", -2, 2, -1, 0, -1, 2, "wide_foot");
  p.rect("shadow", -2, 2, -1, -1, 3, 3, "toe_shadow");
});

const nodeSpecs = [
  { name: "robot_root", translation: [0, 0, 0], children: ["pelvis"], extras: { role: "root", pivotLabel: "world-origin" } },
  { name: "pelvis", mesh: "pelvis", translation: [0, 1.25, 0], children: ["torso", "left_upper_leg", "right_upper_leg"], extras: { role: "hips", pivotLabel: "hips-center" } },
  { name: "torso", mesh: "torso", translation: [0, 0.34, 0], children: ["head", "left_upper_arm", "right_upper_arm"], extras: { role: "spine", pivotLabel: "waist" } },
  { name: "head", mesh: "head", translation: [0, 0.52, 0], children: [], extras: { role: "head", pivotLabel: "neck" } },
  { name: "left_upper_arm", mesh: "upper_arm", translation: [-0.56, 0.34, 0], children: ["left_forearm"], extras: { role: "left-shoulder", pivotLabel: "shoulder" } },
  { name: "left_forearm", mesh: "forearm", translation: [0, -0.44, 0], children: ["left_hand"], extras: { role: "left-elbow", pivotLabel: "elbow" } },
  { name: "left_hand", mesh: "hand", translation: [0, -0.43, 0.02], children: [], extras: { role: "left-hand", pivotLabel: "wrist" } },
  { name: "right_upper_arm", mesh: "upper_arm", translation: [0.56, 0.34, 0], children: ["right_forearm"], extras: { role: "right-shoulder", pivotLabel: "shoulder" } },
  { name: "right_forearm", mesh: "forearm", translation: [0, -0.44, 0], children: ["right_hand"], extras: { role: "right-elbow", pivotLabel: "elbow" } },
  { name: "right_hand", mesh: "hand", translation: [0, -0.43, 0.02], children: [], extras: { role: "right-hand", pivotLabel: "wrist" } },
  { name: "left_upper_leg", mesh: "upper_leg", translation: [-0.24, -0.14, 0], children: ["left_lower_leg"], extras: { role: "left-hip", pivotLabel: "hip" } },
  { name: "left_lower_leg", mesh: "lower_leg", translation: [0, -0.46, 0], children: ["left_foot"], extras: { role: "left-knee", pivotLabel: "knee" } },
  { name: "left_foot", mesh: "foot", translation: [0, -0.42, 0.10], children: [], extras: { role: "left-foot", pivotLabel: "ankle" } },
  { name: "right_upper_leg", mesh: "upper_leg", translation: [0.24, -0.14, 0], children: ["right_lower_leg"], extras: { role: "right-hip", pivotLabel: "hip" } },
  { name: "right_lower_leg", mesh: "lower_leg", translation: [0, -0.46, 0], children: ["right_foot"], extras: { role: "right-knee", pivotLabel: "knee" } },
  { name: "right_foot", mesh: "foot", translation: [0, -0.42, 0.10], children: [], extras: { role: "right-foot", pivotLabel: "ankle" } },
];

await mkdir(here, { recursive: true });
await writeFile(`${outBase}.glb`, toGlb());
await writeFile(`${outBase}.obj`, toObj());
await writeFile(`${outBase}.mtl`, toMtl());
await writeFile(`${outBase}.metadata.json`, `${JSON.stringify({
  subject: "voxel-motion-robot",
  format: ["glb", "obj", "mtl"],
  style: "motion-ready voxel humanoid robot",
  sourceMethod: "manual procedural voxel model with named transform nodes and glTF animation clips",
  sourceReference: "https://note.com/npaka/n/nde5589d13536",
  unit,
  cubeSize,
  cubeCount: [...parts.values()].reduce((sum, part) => sum + part.cubes.length, 0),
  materialCount: Object.keys(materials).length,
  nodeCount: nodeSpecs.length,
  animationClips: [
    { id: "idle_bob", durationSeconds: 2.0, purpose: "subtle loop for pivot stability and head readability" },
    { id: "walk_cycle", durationSeconds: 1.0, purpose: "in-place humanoid gait smoke test" },
    { id: "wave", durationSeconds: 1.5, purpose: "upper-body articulation smoke test" },
  ],
  motionContract: {
    requiredNodes: nodeSpecs.map((node) => node.name),
    requiredChecks: [
      "named humanoid transform nodes are present",
      "feet remain near the ground plane in sampled walk frames",
      "arm and leg swings preserve blocky silhouette",
      "animation clips loop without first/last pose drift",
      "fixed-camera snapshots are nonblank for front, side, and iso views",
    ],
  },
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);

console.log(`Wrote ${outBase}.glb`);
console.log(`Wrote ${outBase}.obj`);
console.log(`Wrote ${outBase}.mtl`);
console.log(`Cubes: ${[...parts.values()].reduce((sum, part) => sum + part.cubes.length, 0)}`);

function toGlb() {
  const gltf = {
    asset: { version: "2.0", generator: "vlmkit robot voxel motion generator" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [],
    meshes: [],
    materials: Object.values(materials).map((material) => ({
      name: material.name,
      pbrMetallicRoughness: {
        baseColorFactor: material.color,
        metallicFactor: 0,
        roughnessFactor: material.roughness,
      },
    })),
    animations: [],
    buffers: [{ byteLength: 0 }],
    bufferViews: [],
    accessors: [],
  };
  const chunks = [];
  const materialKeys = Object.keys(materials);
  const meshByPart = new Map();
  for (const [name, part] of parts) {
    meshByPart.set(name, addMesh(gltf, chunks, part, materialKeys));
  }

  const nodeIndexByName = new Map();
  for (const spec of nodeSpecs) {
    const node = {
      name: spec.name,
      translation: spec.translation,
      extras: spec.extras,
    };
    if (spec.mesh) node.mesh = meshByPart.get(spec.mesh);
    nodeIndexByName.set(spec.name, gltf.nodes.length);
    gltf.nodes.push(node);
  }
  for (const spec of nodeSpecs) {
    const node = gltf.nodes[nodeIndexByName.get(spec.name)];
    if (spec.children.length > 0) {
      node.children = spec.children.map((name) => nodeIndexByName.get(name));
    }
  }

  addAnimations(gltf, chunks, nodeIndexByName);
  return encodeGlb(gltf, chunks);
}

function addMesh(gltf, chunks, part, materialKeys) {
  const mesh = { name: part.name, primitives: [] };
  for (const primitive of part.primitiveList()) {
    const posAccessor = addAccessor(gltf, chunks, new Float32Array(primitive.positions), 5126, "VEC3", 34962, minMaxVec3(primitive.positions));
    const normalAccessor = addAccessor(gltf, chunks, new Float32Array(primitive.normals), 5126, "VEC3", 34962);
    const indexAccessor = addAccessor(gltf, chunks, new Uint32Array(primitive.indices), 5125, "SCALAR", 34963);
    mesh.primitives.push({
      attributes: { POSITION: posAccessor, NORMAL: normalAccessor },
      indices: indexAccessor,
      material: materialKeys.indexOf(primitive.material),
      extras: { material: primitive.material },
    });
  }
  const index = gltf.meshes.length;
  gltf.meshes.push(mesh);
  return index;
}

function addAnimations(gltf, chunks, nodeIndexByName) {
  const walkTimes = [0, 0.25, 0.5, 0.75, 1.0];
  addAnimation(gltf, chunks, nodeIndexByName, "walk_cycle", walkTimes, [
    rotationTrack("left_upper_leg", "x", [-0.48, 0, 0.48, 0, -0.48]),
    rotationTrack("right_upper_leg", "x", [0.48, 0, -0.48, 0, 0.48]),
    rotationTrack("left_lower_leg", "x", [0.24, 0.48, 0.10, 0.24, 0.24]),
    rotationTrack("right_lower_leg", "x", [0.10, 0.24, 0.24, 0.48, 0.10]),
    rotationTrack("left_foot", "x", [0.16, -0.12, -0.16, 0.05, 0.16]),
    rotationTrack("right_foot", "x", [-0.16, 0.05, 0.16, -0.12, -0.16]),
    rotationTrack("left_upper_arm", "x", [0.40, 0, -0.40, 0, 0.40]),
    rotationTrack("right_upper_arm", "x", [-0.40, 0, 0.40, 0, -0.40]),
    rotationTrack("left_forearm", "x", [-0.16, -0.22, -0.10, -0.18, -0.16]),
    rotationTrack("right_forearm", "x", [-0.10, -0.18, -0.16, -0.22, -0.10]),
    translationTrack("pelvis", walkTimes.map((_, index) => [0, 1.25 + [0, 0.035, 0, 0.035, 0][index], 0])),
    rotationTrack("torso", "z", [0.04, -0.02, -0.04, 0.02, 0.04]),
    rotationTrack("head", "z", [-0.025, 0, 0.025, 0, -0.025]),
  ]);

  const idleTimes = [0, 0.5, 1.0, 1.5, 2.0];
  addAnimation(gltf, chunks, nodeIndexByName, "idle_bob", idleTimes, [
    translationTrack("pelvis", idleTimes.map((_, index) => [0, 1.25 + [0, 0.018, 0.03, 0.018, 0][index], 0])),
    rotationTrack("head", "z", [-0.03, 0.025, 0.03, -0.025, -0.03]),
    rotationTrack("left_upper_arm", "z", [0.05, 0.02, -0.02, 0.02, 0.05]),
    rotationTrack("right_upper_arm", "z", [-0.05, -0.02, 0.02, -0.02, -0.05]),
  ]);

  const waveTimes = [0, 0.3, 0.6, 0.9, 1.2, 1.5];
  addAnimation(gltf, chunks, nodeIndexByName, "wave", waveTimes, [
    rotationEulerTrack("right_upper_arm", [
      [-0.15, 0, -0.2],
      [-0.3, 0, -1.0],
      [-0.25, 0, -1.15],
      [-0.3, 0, -1.0],
      [-0.25, 0, -1.15],
      [-0.15, 0, -0.2],
    ]),
    rotationTrack("right_forearm", "z", [0.0, -0.55, -0.25, -0.6, -0.25, 0.0]),
    rotationTrack("head", "z", [0, -0.08, -0.08, -0.08, -0.08, 0]),
  ]);
}

function addAnimation(gltf, chunks, nodeIndexByName, name, times, tracks) {
  const animation = { name, samplers: [], channels: [] };
  const inputAccessor = addAccessor(
    gltf,
    chunks,
    new Float32Array(times),
    5126,
    "SCALAR",
    undefined,
    { min: [Math.min(...times)], max: [Math.max(...times)] },
  );
  for (const track of tracks) {
    const node = nodeIndexByName.get(track.nodeName);
    if (node === undefined) throw new Error(`Animation target not found: ${track.nodeName}`);
    const outputAccessor = addAccessor(
      gltf,
      chunks,
      new Float32Array(track.values.flat()),
      5126,
      track.path === "rotation" ? "VEC4" : "VEC3",
    );
    const sampler = animation.samplers.length;
    animation.samplers.push({ input: inputAccessor, output: outputAccessor, interpolation: "LINEAR" });
    animation.channels.push({ sampler, target: { node, path: track.path } });
  }
  gltf.animations.push(animation);
}

function rotationTrack(nodeName, axis, angles) {
  return {
    nodeName,
    path: "rotation",
    values: angles.map((angle) => {
      if (axis === "x") return quatFromEuler(angle, 0, 0);
      if (axis === "y") return quatFromEuler(0, angle, 0);
      return quatFromEuler(0, 0, angle);
    }),
  };
}

function rotationEulerTrack(nodeName, angles) {
  return {
    nodeName,
    path: "rotation",
    values: angles.map(([x, y, z]) => quatFromEuler(x, y, z)),
  };
}

function translationTrack(nodeName, values) {
  return { nodeName, path: "translation", values };
}

function toObj() {
  const lines = [
    "# Static bind-pose OBJ for robot-voxel-motion.glb.",
    "# Animation and hierarchy are only present in the GLB.",
    "mtllib robot-voxel-motion.mtl",
  ];
  let vertexOffset = 1;
  let normalOffset = 1;
  const worldTransforms = computeWorldTranslations();
  for (const spec of nodeSpecs) {
    if (!spec.mesh) continue;
    const part = parts.get(spec.mesh);
    const translation = worldTransforms.get(spec.name);
    for (const primitive of part.primitiveList()) {
      lines.push("", `o ${spec.name}_${primitive.material}`, `usemtl ${materials[primitive.material].name}`);
      for (let i = 0; i < primitive.positions.length; i += 3) {
        lines.push(
          `v ${fmt(primitive.positions[i] + translation[0])} ${fmt(primitive.positions[i + 1] + translation[1])} ${fmt(primitive.positions[i + 2] + translation[2])}`,
        );
      }
      for (let i = 0; i < primitive.normals.length; i += 3) {
        lines.push(`vn ${fmt(primitive.normals[i])} ${fmt(primitive.normals[i + 1])} ${fmt(primitive.normals[i + 2])}`);
      }
      for (let i = 0; i < primitive.indices.length; i += 3) {
        const a = primitive.indices[i] + vertexOffset;
        const b = primitive.indices[i + 1] + vertexOffset;
        const c = primitive.indices[i + 2] + vertexOffset;
        const na = primitive.indices[i] + normalOffset;
        const nb = primitive.indices[i + 1] + normalOffset;
        const nc = primitive.indices[i + 2] + normalOffset;
        lines.push(`f ${a}//${na} ${b}//${nb} ${c}//${nc}`);
      }
      vertexOffset += primitive.positions.length / 3;
      normalOffset += primitive.normals.length / 3;
    }
  }
  return `${lines.join("\n")}\n`;
}

function toMtl() {
  const lines = ["# Materials for robot-voxel-motion.obj"];
  for (const material of Object.values(materials)) {
    const [r, g, b] = material.color;
    lines.push(
      "",
      `newmtl ${material.name}`,
      `Kd ${fmt(r)} ${fmt(g)} ${fmt(b)}`,
      `Ka ${fmt(r * 0.2)} ${fmt(g * 0.2)} ${fmt(b * 0.2)}`,
      "Ks 0.020 0.020 0.020",
      `Ns ${fmt(16 * (1 - material.roughness) + 2)}`,
      "d 1.0",
    );
  }
  return `${lines.join("\n")}\n`;
}

function computeWorldTranslations() {
  const byName = new Map(nodeSpecs.map((spec) => [spec.name, spec]));
  const output = new Map();
  function visit(name, parent) {
    const spec = byName.get(name);
    const world = add(parent, spec.translation);
    output.set(name, world);
    for (const child of spec.children) visit(child, world);
  }
  visit("robot_root", [0, 0, 0]);
  return output;
}

function addAccessor(gltf, chunks, typedArray, componentType, type, target, bounds) {
  const byteOffset = alignChunks(chunks, 4);
  const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  const bufferView = gltf.bufferViews.length;
  const view = { buffer: 0, byteOffset, byteLength: bytes.byteLength };
  if (target) view.target = target;
  gltf.bufferViews.push(view);
  chunks.push(bytes);
  const accessor = {
    bufferView,
    byteOffset: 0,
    componentType,
    count: typedArray.length / componentsPerType(type),
    type,
  };
  if (bounds?.min) accessor.min = bounds.min;
  if (bounds?.max) accessor.max = bounds.max;
  const index = gltf.accessors.length;
  gltf.accessors.push(accessor);
  return index;
}

function encodeGlb(gltf, chunks) {
  const bin = Buffer.concat(chunks);
  const paddedBin = padBuffer(bin, 0x00);
  gltf.buffers[0].byteLength = paddedBin.length;
  const json = Buffer.from(JSON.stringify(gltf), "utf8");
  const paddedJson = padBuffer(json, 0x20);
  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(paddedJson.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, paddedJson, binHeader, paddedBin]);
}

function alignChunks(chunks, alignment) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const padding = (alignment - (length % alignment)) % alignment;
  if (padding > 0) chunks.push(Buffer.alloc(padding));
  return length + padding;
}

function padBuffer(buffer, padValue) {
  const padding = (4 - (buffer.length % 4)) % 4;
  if (padding === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(padding, padValue)]);
}

function minMaxVec3(values) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < values.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], values[i + axis]);
      max[axis] = Math.max(max[axis], values[i + axis]);
    }
  }
  return { min: min.map(round), max: max.map(round) };
}

function componentsPerType(type) {
  if (type === "SCALAR") return 1;
  if (type === "VEC3") return 3;
  if (type === "VEC4") return 4;
  throw new Error(`Unsupported accessor type: ${type}`);
}

function quatFromEuler(x, y, z) {
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ].map(round);
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function round(value) {
  return Math.round(value * 100000) / 100000;
}

function fmt(value) {
  return value.toFixed(5);
}
