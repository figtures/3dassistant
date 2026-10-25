import type { BufferGeometry } from "three";

/** STL dosyaları genelde mm birimindedir; cm³ ve cm için dönüşüm uygulanır. */
export const STL_UNIT_MM = true;

export interface BoundingBoxCm {
  widthCm: number;
  heightCm: number;
  depthCm: number;
}

export interface MeshMetrics {
  volumeCm3: number;
  boundingBox: BoundingBoxCm;
  triangleCount: number;
  surfaceAreaCm2: number;
}

export const MATERIAL_DENSITY_PRESETS: { id: string; label: string; densityGcm3: number }[] = [
  { id: "pla", label: "PLA", densityGcm3: 1.24 },
  { id: "petg", label: "PETG", densityGcm3: 1.27 },
  { id: "abs", label: "ABS", densityGcm3: 1.04 },
  { id: "asa", label: "ASA", densityGcm3: 1.07 },
  { id: "tpu", label: "TPU", densityGcm3: 1.21 },
  { id: "nylon", label: "Naylon", densityGcm3: 1.14 },
  { id: "resin", label: "Reçine", densityGcm3: 1.15 },
];

export function estimateWeightGrams(volumeCm3: number, densityGcm3: number): number {
  return volumeCm3 * densityGcm3;
}

/** İsteğe bağlı kaba baskı süresi (dk): ~0.8 dk / cm³ referans hız */
export function estimatePrintMinutes(volumeCm3: number, minutesPerCm3 = 0.8): number {
  return Math.max(1, Math.round(volumeCm3 * minutesPerCm3));
}

function cross(
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
): [number, number, number] {
  return [by * cz - bz * cy, bz * cx - bx * cz, bx * cy - by * cx];
}

function dot(ax: number, ay: number, az: number, cx: number, cy: number, cz: number): number {
  return ax * cx + ay * cy + az * cz;
}

/** Signed tetrahedron yöntemi; kapalı mesh hacmi (origin'e göre). */
export function computeSignedVolumeMm3(positions: ArrayLike<number>): number {
  let volume = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i];
    const ay = positions[i + 1];
    const az = positions[i + 2];
    const bx = positions[i + 3];
    const by = positions[i + 4];
    const bz = positions[i + 5];
    const cx = positions[i + 6];
    const cy = positions[i + 7];
    const cz = positions[i + 8];
    const [ux, uy, uz] = cross(bx, by, bz, cx, cy, cz);
    volume += dot(ax, ay, az, ux, uy, uz) / 6;
  }
  return Math.abs(volume);
}

export function mm3ToCm3(mm3: number): number {
  return mm3 / 1000;
}

export function mmToCm(mm: number): number {
  return mm / 10;
}

export function computeBoundingBoxMm(positions: ArrayLike<number>): {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function triangleAreaMm2(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const [ux, uy, uz] = cross(abx, aby, abz, acx, acy, acz);
  return Math.sqrt(ux * ux + uy * uy + uz * uz) / 2;
}

export function computeSurfaceAreaMm2(positions: ArrayLike<number>): number {
  let area = 0;
  for (let i = 0; i < positions.length; i += 9) {
    area += triangleAreaMm2(
      positions[i],
      positions[i + 1],
      positions[i + 2],
      positions[i + 3],
      positions[i + 4],
      positions[i + 5],
      positions[i + 6],
      positions[i + 7],
      positions[i + 8]
    );
  }
  return area;
}

export function computeMeshMetricsFromPositions(positions: ArrayLike<number>): MeshMetrics {
  const volumeMm3 = computeSignedVolumeMm3(positions);
  const box = computeBoundingBoxMm(positions);
  const triangleCount = positions.length / 9;
  const surfaceMm2 = computeSurfaceAreaMm2(positions);
  return {
    volumeCm3: mm3ToCm3(volumeMm3),
    boundingBox: {
      widthCm: mmToCm(box.maxX - box.minX),
      heightCm: mmToCm(box.maxY - box.minY),
      depthCm: mmToCm(box.maxZ - box.minZ),
    },
    triangleCount,
    surfaceAreaCm2: surfaceMm2 / 100,
  };
}

export function computeMeshMetricsFromBufferGeometry(geometry: BufferGeometry): MeshMetrics {
  const working = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const attr = working.getAttribute("position");
  if (!attr) {
    return {
      volumeCm3: 0,
      boundingBox: { widthCm: 0, heightCm: 0, depthCm: 0 },
      triangleCount: 0,
      surfaceAreaCm2: 0,
    };
  }
  return computeMeshMetricsFromPositions(attr.array as ArrayLike<number>);
}

/** Test için: kenarı `sizeMm` olan eksen hizalı küp (12 üçgen). */
export function cubeMeshPositionsMm(sizeMm: number): Float32Array {
  const h = sizeMm / 2;
  const verts: [number, number, number][] = [
    [-h, -h, h],
    [h, -h, h],
    [h, h, h],
    [-h, h, h],
    [-h, -h, -h],
    [h, -h, -h],
    [h, h, -h],
    [-h, h, -h],
  ];
  const faces = [
    [0, 1, 2],
    [0, 2, 3],
    [1, 5, 6],
    [1, 6, 2],
    [5, 4, 7],
    [5, 7, 6],
    [4, 0, 3],
    [4, 3, 7],
    [3, 2, 6],
    [3, 6, 7],
    [4, 5, 1],
    [4, 1, 0],
  ];
  const out = new Float32Array(faces.length * 9);
  let o = 0;
  for (const [a, b, c] of faces) {
    const va = verts[a];
    const vb = verts[b];
    const vc = verts[c];
    out[o++] = va[0];
    out[o++] = va[1];
    out[o++] = va[2];
    out[o++] = vb[0];
    out[o++] = vb[1];
    out[o++] = vb[2];
    out[o++] = vc[0];
    out[o++] = vc[1];
    out[o++] = vc[2];
  }
  return out;
}
