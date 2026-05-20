export function computeWorldMatrices(gltf) {
  const matrices = new Map();
  const sceneRoots = gltf.scenes?.[gltf.scene ?? 0]?.nodes;
  const roots = Array.isArray(sceneRoots) && sceneRoots.length > 0
    ? sceneRoots
    : rootNodeIndexes(gltf.nodes ?? []);
  for (const root of roots) visitWorldMatrix(gltf, root, identityMatrix(), matrices);
  return matrices;
}

export function nodeWorldPosition(name, nodeIndexByName, worldMatrices) {
  const index = nodeIndexByName.get(name);
  return index === undefined ? null : nodeIndexWorldPosition(index, worldMatrices);
}

export function nodeIndexWorldPosition(nodeIndex, worldMatrices) {
  const matrix = worldMatrices.get(nodeIndex);
  return matrix ? transformPoint(matrix, [0, 0, 0]) : null;
}

export function vec3(value, context) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(item))) {
    throw new Error(`${context} must be a finite vec3`);
  }
  return value;
}

export function vec4(value, context) {
  if (!Array.isArray(value) || value.length !== 4 || value.some((item) => !Number.isFinite(item))) {
    throw new Error(`${context} must be a finite vec4`);
  }
  return value;
}

export function vec3Range(values) {
  if (values.length === 0) return null;
  return {
    min: [
      round(Math.min(...values.map((value) => value[0]))),
      round(Math.min(...values.map((value) => value[1]))),
      round(Math.min(...values.map((value) => value[2]))),
    ],
    max: [
      round(Math.max(...values.map((value) => value[0]))),
      round(Math.max(...values.map((value) => value[1]))),
      round(Math.max(...values.map((value) => value[2]))),
    ],
  };
}

export function axisRange(range, axis) {
  return range ? range.max[axis] - range.min[axis] : null;
}

function rootNodeIndexes(nodes) {
  const childIndexes = new Set(nodes.flatMap((node) => node.children ?? []));
  return nodes.map((_, index) => index).filter((index) => !childIndexes.has(index));
}

function visitWorldMatrix(gltf, nodeIndex, parentMatrix, output) {
  const node = gltf.nodes?.[nodeIndex];
  if (!node) return;
  const worldMatrix = multiplyMatrices(parentMatrix, nodeLocalMatrix(node));
  output.set(nodeIndex, worldMatrix);
  for (const child of node.children ?? []) visitWorldMatrix(gltf, child, worldMatrix, output);
}

function nodeLocalMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16 && node.matrix.every(Number.isFinite)) return node.matrix;
  return composeMatrix(
    vec3(node.translation ?? [0, 0, 0], `translation for node ${node.name ?? ""}`),
    vec4(node.rotation ?? [0, 0, 0, 1], `rotation for node ${node.name ?? ""}`),
    vec3(node.scale ?? [1, 1, 1], `scale for node ${node.name ?? ""}`),
  );
}

function identityMatrix() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function composeMatrix(translation, rotation, scale) {
  const [x, y, z, w] = rotation;
  const [sx, sy, sz] = scale;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    translation[0], translation[1], translation[2], 1,
  ];
}

function multiplyMatrices(a, b) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      result[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3];
    }
  }
  return result;
}

function transformPoint(matrix, point) {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function round(value) {
  return Math.round(value * 100000) / 100000;
}
