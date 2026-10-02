import { test } from "node:test";
import assert from "node:assert/strict";
import { generateQrMatrix } from "@/lib/qr-code";

test("generateQrMatrix produces valid square 2D matrix for short string (Version 1)", () => {
  const matrix = generateQrMatrix("SFSU");
  assert.equal(matrix.length, 21);
  assert.equal(matrix[0].length, 21);

  // Top-left finder center (row 3, col 3) is black
  assert.equal(matrix[3][3], true);
  // Top-left finder inner white ring (row 1, col 1) is white
  assert.equal(matrix[1][1], false);
  // Top-left finder corner (0,0) is black
  assert.equal(matrix[0][0], true);

  // Top-right finder center (row 3, col 21-4 = 17) is black
  assert.equal(matrix[3][17], true);

  // Bottom-left finder center (row 17, col 3) is black
  assert.equal(matrix[17][3], true);

  // Separator at row 7, col 0 is white
  assert.equal(matrix[7][0], false);
});

test("generateQrMatrix automatically scales version for longer URLs", () => {
  const url = "https://gatorxecute.sfsu.edu/meet";
  const matrix = generateQrMatrix(url);
  // URL length 33 + 2 = 35 bytes -> needs Version 3 (29x29) or Version 2
  assert.ok(matrix.length >= 25);
  assert.equal(matrix.length, matrix[0].length);

  // Dark module is present at (4*v + 9, 8)
  const v = (matrix.length - 17) / 4;
  assert.equal(matrix[4 * v + 9][8], true);
});
