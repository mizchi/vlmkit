#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outBase = join(here, "goblin-voxel");
const unit = 0.12;
const cubeSize = unit * 0.94;

const materials = {
  skin: { name: "voxel_skin_olive", color: [0.46, 0.56, 0.20, 1], roughness: 0.9 },
  skinDark: { name: "voxel_skin_shadow", color: [0.34, 0.43, 0.14, 1], roughness: 0.95 },
  earInner: { name: "voxel_ear_inner", color: [0.67, 0.40, 0.20, 1], roughness: 0.95 },
  leather: { name: "voxel_dark_leather", color: [0.20, 0.13, 0.08, 1], roughness: 0.96 },
  pants: { name: "voxel_ragged_brown", color: [0.45, 0.24, 0.10, 1], roughness: 0.96 },
  wrap: { name: "voxel_tan_wrap", color: [0.67, 0.50, 0.28, 1], roughness: 0.96 },
  wood: { name: "voxel_wood", color: [0.42, 0.25, 0.10, 1], roughness: 0.98 },
  woodDark: { name: "voxel_wood_shadow", color: [0.28, 0.16, 0.07, 1], roughness: 0.98 },
  eye: { name: "voxel_gold_eye", color: [0.95, 0.72, 0.06, 1], roughness: 0.6 },
  brow: { name: "voxel_black_brow", color: [0.09, 0.07, 0.05, 1], roughness: 0.9 },
  tooth: { name: "voxel_tooth", color: [0.88, 0.82, 0.62, 1], roughness: 0.85 },
};

class VoxelModel {
  constructor() {
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

const model = new VoxelModel();

// Head block: wider than the torso, with stepped top and lower jaw.
model.rect("skin", -3, 3, 17, 20, -2, 2, "head");
model.rect("skin", -2, 2, 21, 22, -2, 2, "head_top");
model.rect("skinDark", -3, -3, 17, 19, -2, 2, "head_side_shadow");
model.rect("skinDark", 3, 3, 17, 19, -2, 2, "head_side_shadow");
model.rect("skin", -2, 2, 16, 16, -1, 2, "jaw");

// Ears are stepped triangular voxel shapes.
model.rect("skin", -7, -4, 19, 20, -1, 1, "left_ear");
model.rect("skin", -6, -4, 18, 18, -1, 1, "left_ear");
model.cube("skin", -8, 20, 0, 1, 1, 1, "left_ear_tip");
model.rect("earInner", -6, -5, 18, 19, 1, 1, "left_ear_inner");
model.rect("skin", 4, 7, 19, 20, -1, 1, "right_ear");
model.rect("skin", 4, 6, 18, 18, -1, 1, "right_ear");
model.cube("skin", 8, 20, 0, 1, 1, 1, "right_ear_tip");
model.rect("earInner", 5, 6, 18, 19, 1, 1, "right_ear_inner");

// Face details are deliberately simple, matching voxel reference constraints.
model.rect("brow", -3, -1, 19, 19, 3, 3, "left_brow");
model.rect("brow", 1, 3, 19, 19, 3, 3, "right_brow");
model.cube("eye", -2, 18, 3, 1, 1, 1, "left_eye");
model.cube("eye", 2, 18, 3, 1, 1, 1, "right_eye");
model.rect("earInner", -1, 1, 17, 17, 3, 3, "nose");
model.cube("earInner", 0, 16, 4, 1, 1, 1, "nose_tip");
model.cube("tooth", -2, 15, 3, 1, 1, 1, "left_tusk");
model.cube("tooth", 2, 15, 3, 1, 1, 1, "right_tusk");

// Neck, torso, vest, belt, and ragged shorts.
model.rect("skinDark", -1, 1, 14, 15, -1, 1, "neck");
model.rect("skin", -2, 2, 9, 14, -1, 1, "torso");
model.rect("leather", -3, -2, 10, 14, 2, 2, "left_vest");
model.rect("leather", 2, 3, 10, 14, 2, 2, "right_vest");
model.rect("leather", -2, 2, 14, 14, 2, 2, "shoulder_vest");
model.rect("wrap", -3, 3, 8, 8, -1, 2, "belt");
model.rect("pants", -3, 3, 5, 7, -1, 1, "shorts");
for (let x = -3; x <= 3; x += 2) {
  model.cube("pants", x, 4, 0, 1, 1, 1, "ragged_short_tip");
}

// Arms and hands. Viewer-left arm holds the club.
model.rect("skin", -5, -4, 11, 14, 0, 1, "club_upper_arm");
model.rect("skin", -6, -5, 8, 11, 0, 1, "club_forearm");
model.rect("skin", -7, -6, 7, 8, 1, 2, "club_hand");
model.rect("wrap", -6, -5, 8, 8, 0, 2, "club_wrist_wrap");
model.rect("skin", 4, 5, 11, 14, 0, 1, "free_upper_arm");
model.rect("skin", 5, 6, 8, 11, 0, 1, "free_forearm");
model.rect("skin", 6, 7, 7, 8, 1, 2, "free_hand");
model.rect("wrap", 5, 6, 8, 8, 0, 2, "free_wrist_wrap");

// Legs, ankle wraps, and blocky feet.
model.rect("skin", -3, -2, 1, 5, 0, 1, "left_leg");
model.rect("skin", 2, 3, 1, 5, 0, 1, "right_leg");
model.rect("wrap", -3, -2, 2, 3, 0, 1, "left_ankle_wrap");
model.rect("wrap", 2, 3, 2, 3, 0, 1, "right_ankle_wrap");
model.rect("skin", -4, -1, 0, 0, 1, 3, "left_foot");
model.rect("skin", 1, 4, 0, 0, 1, 3, "right_foot");
model.cube("skinDark", -4, 0, 3, 1, 1, 1, "left_toe_shadow");
model.cube("skinDark", 4, 0, 3, 1, 1, 1, "right_toe_shadow");

// Chunky wooden club, separated into handle and blocky head.
model.rect("wood", -10, -9, 7, 14, 2, 2, "club_handle");
model.rect("wood", -12, -9, 13, 20, 1, 3, "club_head");
model.rect("woodDark", -12, -12, 14, 19, 1, 3, "club_shadow");
model.cube("woodDark", -13, 16, 2, 1, 1, 1, "club_knot");
model.cube("woodDark", -9, 18, 3, 1, 1, 1, "club_knot");
model.cube("wood", -11, 21, 2, 1, 1, 1, "club_top_chip");

await mkdir(here, { recursive: true });
await writeFile(`${outBase}.obj`, toObj(model));
await writeFile(`${outBase}.mtl`, toMtl());
await writeFile(`${outBase}.glb`, toGlb(model));
await writeFile(`${outBase}.metadata.json`, `${JSON.stringify({
  subject: "voxel-club-goblin",
  sourceReference: "../../references/goblin-voxel-turnaround.png",
  format: ["obj", "mtl", "glb"],
  style: "voxel block model",
  sourceMethod: "manual voxel reconstruction based on generated voxel turnaround",
  unit,
  cubeSize,
  cubeCount: model.cubes.length,
  materialCount: Object.keys(materials).length,
  generatedAt: new Date().toISOString(),
}, null, 2)}\n`);

console.log(`Wrote ${outBase}.obj`);
console.log(`Wrote ${outBase}.mtl`);
console.log(`Wrote ${outBase}.glb`);
console.log(`Cubes: ${model.cubes.length}`);

function toObj(model) {
  const lines = [
    "# Voxel goblin generated from GPT Image voxel turnaround reference.",
    "mtllib goblin-voxel.mtl",
  ];
  let vertexOffset = 1;
  let normalOffset = 1;
  for (const primitive of model.primitiveList()) {
    lines.push("", `o ${primitive.material}`, `usemtl ${materials[primitive.material].name}`);
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
  const lines = ["# Materials for goblin-voxel.obj"];
  for (const material of Object.values(materials)) {
    const [r, g, b] = material.color;
    lines.push(
      "",
      `newmtl ${material.name}`,
      `Kd ${fmt(r)} ${fmt(g)} ${fmt(b)}`,
      `Ka ${fmt(r * 0.2)} ${fmt(g * 0.2)} ${fmt(b * 0.2)}`,
      "Ks 0.030 0.030 0.030",
      `Ns ${fmt(12 * (1 - material.roughness) + 2)}`,
      "d 1.0",
    );
  }
  return `${lines.join("\n")}\n`;
}

function toGlb(model) {
  const materialKeys = Object.keys(materials);
  const gltf = {
    asset: { version: "2.0", generator: "vlmkit voxel goblin generator" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "goblin-voxel" }],
    meshes: [{ name: "goblin-voxel", primitives: [] }],
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
  for (const primitive of model.primitiveList()) {
    const posAccessor = addAccessor(gltf, chunks, new Float32Array(primitive.positions), 5126, "VEC3", 34962, minMaxVec3(primitive.positions));
    const normalAccessor = addAccessor(gltf, chunks, new Float32Array(primitive.normals), 5126, "VEC3", 34962);
    const indexAccessor = addAccessor(gltf, chunks, new Uint32Array(primitive.indices), 5125, "SCALAR", 34963);
    gltf.meshes[0].primitives.push({
      attributes: { POSITION: posAccessor, NORMAL: normalAccessor },
      indices: indexAccessor,
      material: materialKeys.indexOf(primitive.material),
      extras: { material: primitive.material },
    });
  }
  const bin = Buffer.concat(chunks);
  gltf.buffers[0].byteLength = bin.length;
  const jsonText = JSON.stringify(gltf);
  const json = Buffer.from(`${jsonText}${" ".repeat((4 - (jsonText.length % 4)) % 4)}`);
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
  chunks.push(pad4(raw));
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

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function pad4(buffer) {
  const pad = (4 - (buffer.length % 4)) % 4;
  return pad === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(pad)]);
}

function fmt(value) {
  return Number(value).toFixed(4);
}
