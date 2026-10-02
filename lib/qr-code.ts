/**
 * Zero-dependency pure TypeScript QR Code Generator (ISO/IEC 18004 compliant).
 * Supports Byte Mode (UTF-8) across Versions 1 through 5 with Error Correction Level L.
 * Ideal for instant mobile device pairing, team join links, and live hackathon judging.
 */

// Galois Field GF(256) exponent and logarithm lookup tables (primitive polynomial 0x11D)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

let gfVal = 1;
for (let i = 0; i < 255; i++) {
  GF_EXP[i] = gfVal;
  GF_EXP[i + 255] = gfVal;
  GF_LOG[gfVal] = i;
  gfVal = (gfVal << 1) ^ (gfVal & 0x80 ? 0x11d : 0);
}

function gfMul(x: number, y: number): number {
  return x === 0 || y === 0 ? 0 : GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

/** Computes generator polynomial of degree `ecCount` */
function rsGenPoly(ecCount: number): number[] {
  let poly = [1];
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly.reverse();
}

/** Computes Reed-Solomon error correction codewords */
function rsComputeRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGenPoly(ecCount);
  const res = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    for (let j = 0; j < ecCount - 1; j++) {
      res[j] = res[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    res[ecCount - 1] = gfMul(gen[ecCount], factor);
  }
  return res;
}

interface VersionSpec {
  version: number;
  total: number;
  ec: number;
  data: number;
  align: number[];
}

const VERSION_SPECS: (VersionSpec | null)[] = [
  null,
  { version: 1, total: 26, ec: 7, data: 19, align: [] },
  { version: 2, total: 44, ec: 10, data: 34, align: [6, 18] },
  { version: 3, total: 70, ec: 15, data: 55, align: [6, 22] },
  { version: 4, total: 100, ec: 20, data: 80, align: [6, 26] },
  { version: 5, total: 134, ec: 26, data: 108, align: [6, 30] },
];

/**
 * Generates a 2D boolean matrix representing the QR code (true = black module, false = white module).
 * If the input exceeds Version 5 capacity (~106 bytes), the payload is safely trimmed.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder();
  let bytes = encoder.encode(text);

  // Pick smallest fitting version
  let spec = VERSION_SPECS.find((s) => s && bytes.length + 2 <= s.data);
  if (!spec) {
    spec = VERSION_SPECS[5]!;
    if (bytes.length > spec.data - 2) {
      bytes = bytes.slice(0, spec.data - 2);
    }
  }

  // Bit buffer
  const bits: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  // 1. Byte mode indicator: 0100
  pushBits(0b0100, 4);

  // 2. Character count indicator (8 bits for V1-9)
  pushBits(bytes.length, 8);
  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8);
  }

  // 3. Terminator (up to 4 zeroes)
  const capacityBits = spec.data * 8;
  const termLen = Math.min(4, capacityBits - bits.length);
  pushBits(0, termLen);

  // 4. Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // 5. Convert bits to data codewords
  const dataCodewords = new Uint8Array(spec.data);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bits[i * 8 + b];
    }
    dataCodewords[i] = byte;
  }

  // 6. Pad bytes 0xEC, 0x11
  let padByte = 0xec;
  for (let i = bits.length / 8; i < spec.data; i++) {
    dataCodewords[i] = padByte;
    padByte = padByte === 0xec ? 0x11 : 0xec;
  }

  // 7. RS Error Correction codewords
  const ecCodewords = rsComputeRemainder(dataCodewords, spec.ec);

  // 8. Interleaved/concatenated codewords (single block for V1-5 Level L)
  const allCodewords = new Uint8Array(spec.total);
  allCodewords.set(dataCodewords, 0);
  allCodewords.set(ecCodewords, spec.data);

  // 9. Matrix construction
  const size = 17 + 4 * spec.version;
  const matrix: (number | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null)
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );

  function setModule(r: number, c: number, val: number, func = true) {
    matrix[r][c] = val;
    if (func) isFunction[r][c] = true;
  }

  // Finder patterns (7x7)
  function addFinder(top: number, left: number) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBlack =
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setModule(top + r, left + c, isBlack ? 1 : 0);
      }
    }
  }
  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // Separators around finders
  for (let i = 0; i < 8; i++) {
    setModule(7, i, 0);
    setModule(i, 7, 0);
    setModule(7, size - 8 + i, 0);
    setModule(i, size - 8, 0);
    setModule(size - 8, i, 0);
    setModule(size - 8 + i, 7, 0);
  }

  // Alignment patterns
  if (spec.align.length >= 2) {
    const coords = spec.align;
    for (const r of coords) {
      for (const c of coords) {
        if (
          (r <= 8 && c <= 8) ||
          (r <= 8 && c >= size - 8) ||
          (r >= size - 8 && c <= 8)
        ) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            setModule(r + dr, c + dc, isBlack ? 1 : 0);
          }
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0 ? 1 : 0;
    if (!isFunction[6][i]) setModule(6, i, val);
    if (!isFunction[i][6]) setModule(i, 6, val);
  }

  // Dark module
  setModule(4 * spec.version + 9, 8, 1);

  // Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 8 + i] = true;
    isFunction[size - 8 + i][8] = true;
  }

  // Data module placement (zig-zag right to left)
  const allBits: number[] = [];
  for (let i = 0; i < allCodewords.length; i++) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((allCodewords[i] >> b) & 1);
    }
  }

  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // Skip timing column 6
    const rows: number[] = [];
    if (upward) {
      for (let r = size - 1; r >= 0; r--) rows.push(r);
    } else {
      for (let r = 0; r < size; r++) rows.push(r);
    }
    for (const r of rows) {
      for (let c = col; c >= col - 1; c--) {
        if (!isFunction[r][c]) {
          const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
          // Standard mask pattern 0: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = bit ^ (mask ? 1 : 0) ? 1 : 0;
        }
      }
    }
    upward = !upward;
  }

  // Format information (EC Level L = 01, Mask 0 = 000 -> 0x77c4)
  const formatBits = 0x77c4;
  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >> (14 - i)) & 1;
    // Top-left
    if (i <= 5) setModule(8, i, bit);
    else if (i === 6) setModule(8, 7, bit);
    else if (i === 7) setModule(8, 8, bit);
    else if (i === 8) setModule(7, 8, bit);
    else setModule(14 - i, 8, bit);

    // Split around other two finders (7 bits bottom, 8 bits right)
    if (i < 7) setModule(size - 1 - i, 8, bit);
    else setModule(8, size - 15 + i, bit);
  }

  return matrix.map((row) => row.map((cell) => cell === 1));
}
