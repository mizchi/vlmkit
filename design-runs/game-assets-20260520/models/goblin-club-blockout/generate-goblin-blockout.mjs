#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outBase = join(here, "goblin-club-blockout");

const materials = {
  skin: { name: "skin_olive_green", color: [0.43, 0.52, 0.18, 1], roughness: 0.82 },
  earInner: { name: "ear_inner_warm_brown", color: [0.66, 0.36, 0.22, 1], roughness: 0.88 },
  leather: { name: "dark_worn_leather", color: [0.24, 0.13, 0.07, 1], roughness: 0.92 },
  skirt: { name: "ragged_skirt_brown", color: [0.36, 0.17, 0.08, 1], roughness: 0.96 },
  wrap: { name: "tan_cloth_wrap", color: [0.58, 0.42, 0.25, 1], roughness: 0.96 },
  wood: { name: "club_rough_wood", color: [0.39, 0.22, 0.10, 1], roughness: 0.98 },
  eye: { name: "golden_eye", color: [0.95, 0.69, 0.18, 1], roughness: 0.45 },
  tooth: { name: "dull_tooth", color: [0.86, 0.78, 0.60, 1], roughness: 0.75 },
};

class Model {
  constructor() {
    this.primitives = [];
  }

  addPrimitive(name, material, positions, normals, indices) {
    this.primitives.push({ name, material, positions, normals, indices });
  }

  addEllipsoid(name, material, center, radii, uSegments = 18, vSegments = 10) {
    const positions = [];
    const normals = [];
    const indices = [];
    for (let v = 0; v <= vSegments; v++) {
      const phi = Math.PI * (v / vSegments);
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      for (let u = 0; u <= uSegments; u++) {
        const theta = Math.PI * 2 * (u / uSegments);
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const x = cosTheta * sinPhi;
        const y = cosPhi;
        const z = sinTheta * sinPhi;
        positions.push(
          center[0] + x * radii[0],
          center[1] + y * radii[1],
          center[2] + z * radii[2],
        );
        normals.push(...normalize([x / radii[0], y / radii[1], z / radii[2]]));
      }
    }
    const row = uSegments + 1;
    for (let v = 0; v < vSegments; v++) {
      for (let u = 0; u < uSegments; u++) {
        const a = v * row + u;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    this.addPrimitive(name, material, positions, normals, indices);
  }

  addCylinder(name, material, start, end, radiusStart, radiusEnd = radiusStart, segments = 14) {
    const positions = [];
    const normals = [];
    const indices = [];
    const d = normalize(sub(end, start));
    const basis = orthonormalBasis(d);
    for (let ring = 0; ring < 2; ring++) {
      const center = ring === 0 ? start : end;
      const radius = ring === 0 ? radiusStart : radiusEnd;
      for (let i = 0; i < segments; i++) {
        const t = (Math.PI * 2 * i) / segments;
        const radial = add(scale(basis.u, Math.cos(t)), scale(basis.v, Math.sin(t)));
        positions.push(...add(center, scale(radial, radius)));
        normals.push(...radial);
      }
    }
    const baseCenter = positions.length / 3;
    positions.push(...start);
    normals.push(...scale(d, -1));
    const endCenter = positions.length / 3;
    positions.push(...end);
    normals.push(...d);
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const a = i;
      const b = next;
      const c = segments + i;
      const e = segments + next;
      indices.push(a, c, b, b, c, e);
      indices.push(baseCenter, b, a);
      indices.push(endCenter, c, e);
    }
    this.addPrimitive(name, material, positions, normals, indices);
  }

  addCone(name, material, base, tip, radius, segments = 14) {
    this.addCylinder(name, material, base, tip, radius, 0.015, segments);
  }

  addBox(name, material, center, size) {
    const hx = size[0] / 2;
    const hy = size[1] / 2;
    const hz = size[2] / 2;
    const corners = [
      [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
      [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
    ].map((p) => add(center, p));
    const faceDefs = [
      [0, 1, 2, 3, [0, 0, -1]],
      [4, 7, 6, 5, [0, 0, 1]],
      [0, 4, 5, 1, [0, -1, 0]],
      [3, 2, 6, 7, [0, 1, 0]],
      [1, 5, 6, 2, [1, 0, 0]],
      [0, 3, 7, 4, [-1, 0, 0]],
    ];
    const positions = [];
    const normals = [];
    const indices = [];
    for (const face of faceDefs) {
      const offset = positions.length / 3;
      for (let i = 0; i < 4; i++) {
        positions.push(...corners[face[i]]);
        normals.push(...face[4]);
      }
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }
    this.addPrimitive(name, material, positions, normals, indices);
  }

  addTrianglePanel(name, material, a, b, c, thickness = 0.02) {
    const n = normalize(cross(sub(b, a), sub(c, a)));
    const offset = scale(n, thickness);
    const positions = [
      ...add(a, offset), ...add(b, offset), ...add(c, offset),
      ...sub(a, offset), ...sub(c, offset), ...sub(b, offset),
    ];
    const normals = [...n, ...n, ...n, ...scale(n, -1), ...scale(n, -1), ...scale(n, -1)];
    const indices = [0, 1, 2, 3, 4, 5];
    this.addPrimitive(name, material, positions, normals, indices);
  }
}

const model = new Model();

// Core body proportions are based on the generated three-view sheet:
// large head, long ears, compact torso, short limbs, right hand holding a club.
model.addEllipsoid("head", "skin", [0, 2.62, 0.05], [0.46, 0.36, 0.38]);
model.addEllipsoid("brow", "skin", [0, 2.62, 0.38], [0.34, 0.10, 0.08], 14, 6);
model.addEllipsoid("torso", "skin", [0, 1.74, 0], [0.36, 0.54, 0.25]);
model.addEllipsoid("belly", "skin", [0, 1.55, 0.23], [0.23, 0.20, 0.08], 14, 6);
model.addCylinder("neck", "skin", [0, 2.18, 0.02], [0, 2.36, 0.03], 0.16, 0.20, 14);

model.addCone("left_ear_outer", "skin", [-0.34, 2.66, 0.02], [-0.98, 2.82, 0.08], 0.20, 16);
model.addCone("right_ear_outer", "skin", [0.34, 2.66, 0.02], [0.98, 2.82, 0.08], 0.20, 16);
model.addCone("left_ear_inner", "earInner", [-0.39, 2.65, 0.05], [-0.82, 2.77, 0.10], 0.12, 12);
model.addCone("right_ear_inner", "earInner", [0.39, 2.65, 0.05], [0.82, 2.77, 0.10], 0.12, 12);
model.addCone("hooked_nose", "skin", [0, 2.56, 0.34], [0, 2.48, 0.72], 0.13, 16);
model.addEllipsoid("left_eye", "eye", [-0.16, 2.63, 0.39], [0.07, 0.045, 0.03], 10, 5);
model.addEllipsoid("right_eye", "eye", [0.16, 2.63, 0.39], [0.07, 0.045, 0.03], 10, 5);
model.addCone("left_tusk", "tooth", [-0.10, 2.44, 0.35], [-0.16, 2.35, 0.45], 0.025, 8);
model.addCone("right_tusk", "tooth", [0.10, 2.44, 0.35], [0.16, 2.35, 0.45], 0.025, 8);

model.addBox("left_vest_panel", "leather", [-0.15, 1.84, 0.25], [0.20, 0.64, 0.055]);
model.addBox("right_vest_panel", "leather", [0.15, 1.84, 0.25], [0.20, 0.64, 0.055]);
model.addCylinder("waist_rope", "wrap", [-0.37, 1.38, 0.02], [0.37, 1.38, 0.02], 0.045, 0.045, 12);
for (let i = 0; i < 7; i++) {
  const x0 = -0.32 + i * 0.105;
  model.addTrianglePanel(`ragged_skirt_${i}`, "skirt", [x0, 1.35, 0.21], [x0 + 0.09, 1.35, 0.21], [x0 + 0.04, 0.96 - (i % 2) * 0.07, 0.26]);
}

const limbs = [
  { side: -1, shoulder: [-0.35, 1.98, 0.02], elbow: [-0.62, 1.54, 0.12], wrist: [-0.63, 1.17, 0.22], hand: [-0.64, 1.08, 0.27] },
  { side: 1, shoulder: [0.35, 1.98, 0.02], elbow: [0.62, 1.54, 0.02], wrist: [0.56, 1.16, 0.11], hand: [0.58, 1.07, 0.15] },
];
for (const limb of limbs) {
  const prefix = limb.side < 0 ? "left" : "right";
  model.addCylinder(`${prefix}_upper_arm`, "skin", limb.shoulder, limb.elbow, 0.10, 0.09, 12);
  model.addCylinder(`${prefix}_forearm`, "skin", limb.elbow, limb.wrist, 0.09, 0.075, 12);
  model.addEllipsoid(`${prefix}_hand`, "skin", limb.hand, [0.11, 0.08, 0.075], 10, 5);
  model.addCylinder(`${prefix}_wrist_wrap`, "wrap", add(limb.wrist, [-0.06 * limb.side, -0.02, -0.01]), add(limb.wrist, [0.06 * limb.side, 0.02, 0.01]), 0.045, 0.045, 10);
}

const legs = [
  { side: -1, hip: [-0.20, 1.08, 0.02], knee: [-0.28, 0.63, 0.06], ankle: [-0.24, 0.22, 0.04], foot: [-0.28, 0.12, 0.23] },
  { side: 1, hip: [0.20, 1.08, 0.02], knee: [0.28, 0.63, 0.06], ankle: [0.24, 0.22, 0.04], foot: [0.30, 0.12, 0.23] },
];
for (const leg of legs) {
  const prefix = leg.side < 0 ? "left" : "right";
  model.addCylinder(`${prefix}_thigh`, "skin", leg.hip, leg.knee, 0.12, 0.10, 12);
  model.addCylinder(`${prefix}_shin`, "skin", leg.knee, leg.ankle, 0.09, 0.075, 12);
  model.addEllipsoid(`${prefix}_foot`, "skin", leg.foot, [0.17, 0.07, 0.27], 12, 5);
  model.addCylinder(`${prefix}_ankle_wrap`, "wrap", add(leg.ankle, [-0.08 * leg.side, 0, -0.01]), add(leg.ankle, [0.08 * leg.side, 0, 0.01]), 0.048, 0.048, 10);
}

// Club held in the goblin's right hand (viewer left in the front view).
model.addCylinder("club_handle", "wood", [-0.72, 1.05, 0.28], [-0.86, 1.52, 0.34], 0.055, 0.065, 12);
model.addCylinder("club_head", "wood", [-0.88, 1.50, 0.35], [-1.02, 2.25, 0.42], 0.13, 0.20, 14);
for (let i = 0; i < 6; i++) {
  const y = 1.65 + i * 0.10;
  const z = 0.50 + (i % 2) * 0.04;
  model.addCone(`club_bark_spike_${i}`, "wood", [-0.98, y, 0.42], [-1.12, y + 0.03, z], 0.035, 8);
}

await mkdir(here, { recursive: true });
await writeFile(`${outBase}.obj`, toObj(model));
await writeFile(`${outBase}.mtl`, toMtl());
await writeFile(`${outBase}.glb`, toGlb(model));
await writeFile(`${outBase}.metadata.json`, `${JSON.stringify({
  subject: "club-goblin",
  sourceReference: "../../references/goblin-turnaround.png",
  format: ["obj", "mtl", "glb"],
  style: "low-poly blockout",
  sourceMethod: "manual procedural model based on generated three-view image",
  generatedAt: new Date().toISOString(),
  parts: model.primitives.map((primitive) => ({ name: primitive.name, material: primitive.material })),
}, null, 2)}\n`);

console.log(`Wrote ${outBase}.obj`);
console.log(`Wrote ${outBase}.mtl`);
console.log(`Wrote ${outBase}.glb`);

function toObj(model) {
  const lines = [
    "# Low-poly goblin blockout generated from the GPT Image turnaround reference.",
    "mtllib goblin-club-blockout.mtl",
  ];
  let vertexOffset = 1;
  let normalOffset = 1;
  for (const primitive of model.primitives) {
    lines.push("", `o ${primitive.name}`, `usemtl ${materials[primitive.material].name}`);
    for (let i = 0; i < primitive.positions.length; i += 3) {
      lines.push(`v ${fmt(primitive.positions[i])} ${fmt(primitive.positions[i + 1])} ${fmt(primitive.positions[i + 2])}`);
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
  return `${lines.join("\n")}\n`;
}

function toMtl() {
  const lines = ["# Materials for goblin-club-blockout.obj"];
  for (const material of Object.values(materials)) {
    const [r, g, b] = material.color;
    lines.push(
      "",
      `newmtl ${material.name}`,
      `Kd ${fmt(r)} ${fmt(g)} ${fmt(b)}`,
      `Ka ${fmt(r * 0.22)} ${fmt(g * 0.22)} ${fmt(b * 0.22)}`,
      "Ks 0.050 0.050 0.050",
      `Ns ${fmt(20 * (1 - material.roughness) + 4)}`,
      "d 1.0",
    );
  }
  return `${lines.join("\n")}\n`;
}

function toGlb(model) {
  const materialKeys = Object.keys(materials);
  const gltf = {
    asset: { version: "2.0", generator: "vlmkit game-assets goblin blockout" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "club-goblin-blockout" }],
    meshes: [{ name: "club-goblin-blockout", primitives: [] }],
    materials: materialKeys.map((key) => {
      const material = materials[key];
      return {
        name: material.name,
        pbrMetallicRoughness: {
          baseColorFactor: material.color,
          metallicFactor: 0,
          roughnessFactor: material.roughness,
        },
      };
    }),
    buffers: [{ byteLength: 0 }],
    bufferViews: [],
    accessors: [],
  };
  const chunks = [];

  for (const primitive of model.primitives) {
    const posAccessor = addAccessor(gltf, chunks, new Float32Array(primitive.positions), 5126, "VEC3", 34962, minMaxVec3(primitive.positions));
    const normalAccessor = addAccessor(gltf, chunks, new Float32Array(primitive.normals), 5126, "VEC3", 34962);
    const indexAccessor = addAccessor(gltf, chunks, new Uint16Array(primitive.indices), 5123, "SCALAR", 34963);
    gltf.meshes[0].primitives.push({
      attributes: { POSITION: posAccessor, NORMAL: normalAccessor },
      indices: indexAccessor,
      material: materialKeys.indexOf(primitive.material),
      extras: { name: primitive.name },
    });
  }

  const bin = Buffer.concat(chunks);
  gltf.buffers[0].byteLength = bin.length;
  const json = Buffer.from(`${JSON.stringify(gltf)}${" ".repeat((4 - (JSON.stringify(gltf).length % 4)) % 4)}`);
  const paddedBin = pad4(bin);
  const totalLength = 12 + 8 + json.length + 8 + paddedBin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, json, binHeader, paddedBin]);
}

function addAccessor(gltf, chunks, typed, componentType, type, target, minMax) {
  const raw = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const offset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const padded = pad4(raw);
  chunks.push(padded);
  const bufferViewIndex = gltf.bufferViews.length;
  gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: raw.length, target });
  const accessorIndex = gltf.accessors.length;
  const accessor = {
    bufferView: bufferViewIndex,
    byteOffset: 0,
    componentType,
    count: type === "SCALAR" ? typed.length : typed.length / 3,
    type,
  };
  if (minMax) {
    accessor.min = minMax.min;
    accessor.max = minMax.max;
  }
  gltf.accessors.push(accessor);
  return accessorIndex;
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
  return { min, max };
}

function pad4(buffer) {
  const pad = (4 - (buffer.length % 4)) % 4;
  return pad === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(pad)]);
}

function fmt(value) {
  return Number(value).toFixed(4);
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(a) {
  const length = Math.sqrt(dot(a, a)) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
}

function orthonormalBasis(d) {
  const helper = Math.abs(d[1]) < 0.88 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(d, helper));
  const v = normalize(cross(u, d));
  return { u, v };
}
