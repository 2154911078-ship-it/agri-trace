import {
  CanvasTexture,
  SRGBColorSpace,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  ClampToEdgeWrapping
} from 'three';

export const W = 1024;
export const H = 1024;
export const TILE = 2048;
export const TAU = Math.PI * 2;

/* -------------------------------------------------------------------------- */
/*  Deterministic helpers                                                     */
/* -------------------------------------------------------------------------- */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed = 1) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function canvasTexture(canvas, { wrapS = ClampToEdgeWrapping, wrapT = ClampToEdgeWrapping } = {}) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = wrapS;
  texture.wrapT = wrapT;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  return texture;
}

/* -------------------------------------------------------------------------- */
/*  Shared curves — these are periodic over TILE, so the map can loop         */
/* -------------------------------------------------------------------------- */

export function roadCenter(y) {
  const u = y / TILE;
  return 206
    + Math.sin(TAU * u * 2 + 2.16) * 31
    + Math.sin(TAU * u * 5 + 0.66) * 10.5
    + Math.sin(TAU * u * 9 + 1.18) * 3.0;
}

export function roadHalf(y) {
  const u = y / TILE;
  return 45.5
    + Math.sin(TAU * u * 3 + 0.72) * 3.1
    + Math.sin(TAU * u * 7 + 2.04) * 1.4;
}

export function riverCenter(y) {
  const u = y / TILE;
  return 611
    + Math.sin(TAU * u * 2 + 0.55) * 78
    + Math.sin(TAU * u * 5 + 2.17) * 24
    + Math.sin(TAU * u * 8 + 0.34) * 4.2;
}

export function riverHalf(y) {
  const u = y / TILE;
  return 55
    + Math.sin(TAU * u * 3 + 1.28) * 5.6
    + Math.sin(TAU * u * 7 + 0.2) * 2.0;
}

export function bankNoise(y, side = 0, amp = 1) {
  const u = y / TILE;
  return amp * (
    Math.sin(TAU * u * 13 + (side > 0 ? 1.7 : 4.9)) * 0.54 +
    Math.sin(TAU * u * 31 + (side > 0 ? 0.4 : 2.8)) * 0.31 +
    Math.sin(TAU * u * 57 + (side > 0 ? 3.3 : 5.7)) * 0.15
  );
}

function riverLeft(y) {
  return riverCenter(y) - riverHalf(y) + bankNoise(y, -1, 2.1);
}

function riverRight(y) {
  return riverCenter(y) + riverHalf(y) + bankNoise(y, 1, 2.1);
}

function roadLeft(y) {
  return roadCenter(y) - roadHalf(y) + bankNoise(y, -1, 1.45);
}

function roadRight(y) {
  return roadCenter(y) + roadHalf(y) + bankNoise(y, 1, 1.45);
}

export function isGrass(x, y, margin = 0) {
  if (x < 14 || x > W - 14) return false;
  if (Math.abs(x - roadCenter(y)) < roadHalf(y) + margin) return false;
  if (Math.abs(x - riverCenter(y)) < riverHalf(y) + margin) return false;
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Terrain                                                                   */
/* -------------------------------------------------------------------------- */

const GRASS_STROKES = ['#79a947', '#8fbc55', '#a4cd68', '#b3d675', '#6f9e40', '#9fc55f'];
const FLOWER_COLORS = ['#fff8e2', '#f6dc81', '#f1a09a', '#e9e6ff', '#f7c9d2'];

function traceBand(g, leftFn, rightFn, step = 6) {
  g.beginPath();
  const y0 = -18;
  const y1 = TILE + 18;
  for (let y = y0; y <= y1; y += step) {
    const x = leftFn(y);
    if (y === y0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  for (let y = y1; y >= y0; y -= step) {
    g.lineTo(rightFn(y), y);
  }
  g.closePath();
}

function drawWrappedY(y, radius, draw) {
  draw(y);
  if (y - radius < 0) draw(y + TILE);
  if (y + radius > TILE) draw(y - TILE);
}

function drawRadialBlob(g, x, y, rx, ry, color, alpha) {
  g.save();
  g.translate(x, y);
  g.scale(rx, ry);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, color);
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = alpha;
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, 1, 0, TAU);
  g.fill();
  g.restore();
}

function drawSoftShadow(g, x, y, rx, ry, alpha = 0.22) {
  g.save();
  g.translate(x, y);
  g.scale(rx, ry);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, `rgba(35,55,30,${alpha})`);
  grad.addColorStop(0.55, `rgba(35,55,30,${alpha * 0.66})`);
  grad.addColorStop(1, 'rgba(35,55,30,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, 1, 0, TAU);
  g.fill();
  g.restore();
}

function paintRiver(g) {
  g.save();
  traceBand(g, riverLeft, riverRight, 5);
  g.clip();

  g.fillStyle = '#51b2d1';
  g.fillRect(0, 0, W, TILE);

  // Cooler water near both banks, brighter heart in the middle.
  const edgeShade = g.createLinearGradient(370, 0, 780, 0);
  edgeShade.addColorStop(0, 'rgba(24,108,145,0.28)');
  edgeShade.addColorStop(0.27, 'rgba(44,139,174,0.10)');
  edgeShade.addColorStop(0.52, 'rgba(154,225,235,0.10)');
  edgeShade.addColorStop(0.78, 'rgba(44,139,174,0.10)');
  edgeShade.addColorStop(1, 'rgba(24,108,145,0.26)');
  g.fillStyle = edgeShade;
  g.fillRect(0, 0, W, TILE);

  // Long, translucent flow ribbons.
  const riverRng = mulberry32(1147);
  for (let i = 0; i < 110; i++) {
    const y = riverRng() * TILE;
    const x = riverCenter(y) + (riverRng() - 0.5) * riverHalf(y) * 1.55;
    const len = 12 + riverRng() * 64;
    const bend = (riverRng() - 0.5) * 8;
    const alpha = 0.035 + riverRng() * 0.075;
    const col = riverRng() > 0.72 ? '207,246,247' : riverRng() > 0.45 ? '105,198,218' : '34,132,167';
    drawWrappedY(y, len + 10, (yy) => {
      g.strokeStyle = `rgba(${col},${alpha})`;
      g.lineWidth = 0.8 + riverRng() * 2.8;
      g.beginPath();
      g.moveTo(x - riverHalf(yy) * 0.1, yy);
      g.quadraticCurveTo(x + bend, yy + len * 0.45, x + bend * 0.2, yy + len);
      g.stroke();
    });
  }

  // Fine ripples / painterly dashes.
  for (let i = 0; i < 360; i++) {
    const y = riverRng() * TILE;
    const x = riverCenter(y) + (riverRng() - 0.5) * riverHalf(y) * 1.5;
    const w = 2 + riverRng() * 11;
    const alpha = 0.09 + riverRng() * 0.22;
    drawWrappedY(y, 6, (yy) => {
      g.strokeStyle = riverRng() > 0.48 ? `rgba(208,246,246,${alpha})` : `rgba(26,124,159,${alpha * 0.7})`;
      g.lineWidth = 0.7 + riverRng() * 1.2;
      g.beginPath();
      g.moveTo(x - w * 0.5, yy);
      g.quadraticCurveTo(x, yy - 1.2, x + w * 0.5, yy + 0.2);
      g.stroke();
    });
  }

  // Dark inner bank line, then a thin light splash.
  g.lineCap = 'round';
  for (const side of [-1, 1]) {
    g.beginPath();
    for (let y = -10; y <= TILE + 10; y += 5) {
      const x = (side < 0 ? riverLeft(y) : riverRight(y)) + side * 1.6;
      if (y === -10) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(27,105,132,0.30)';
    g.lineWidth = 4.4;
    g.stroke();
    g.strokeStyle = 'rgba(195,240,238,0.24)';
    g.lineWidth = 1.2;
    g.stroke();
  }

  // Little pale stones at the water's edge.
  for (let i = 0; i < 24; i++) {
    const y = riverRng() * TILE;
    const side = riverRng() > 0.5 ? 1 : -1;
    const x = (side > 0 ? riverRight(y) : riverLeft(y)) + (riverRng() - 0.5) * 9;
    drawWrappedY(y, 9, (yy) => {
      g.save();
      g.translate(x, yy);
      g.rotate(riverRng() * TAU);
      g.fillStyle = `rgba(168,178,153,${0.28 + riverRng() * 0.3})`;
      g.beginPath();
      g.ellipse(0, 0, 2 + riverRng() * 4.5, 1.2 + riverRng() * 2.3, 0, 0, TAU);
      g.fill();
      g.restore();
    });
  }

  g.restore();

  // A whisper of damp bank just outside the water.
  g.save();
  g.strokeStyle = 'rgba(54,96,73,0.18)';
  g.lineWidth = 9;
  g.lineCap = 'round';
  for (const side of [-1, 1]) {
    g.beginPath();
    for (let y = -12; y <= TILE + 12; y += 6) {
      const x = (side < 0 ? riverLeft(y) : riverRight(y)) + side * 5;
      if (y === -12) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

function paintRoad(g) {
  g.save();
  traceBand(g, roadLeft, roadRight, 5);
  g.clip();

  g.fillStyle = '#d9c9a2';
  g.fillRect(0, 0, W, TILE);

  // Warm and cool worn patches.
  const roadRng = mulberry32(9901);
  for (let i = 0; i < 95; i++) {
    const y = roadRng() * TILE;
    const x = roadCenter(y) + (roadRng() - 0.5) * roadHalf(y) * 1.7;
    const r = 4 + roadRng() * 24;
    drawWrappedY(y, r + 8, (yy) => {
      drawRadialBlob(g, x, yy, r, r * (0.5 + roadRng() * 0.5),
        roadRng() > 0.5 ? '#e6d8b7' : '#c5b38b', 0.08 + roadRng() * 0.12);
    });
  }

  // Sandy flecks and shallow hand-painted scratches.
  for (let i = 0; i < 250; i++) {
    const y = roadRng() * TILE;
    const x = roadCenter(y) + (roadRng() - 0.5) * roadHalf(y) * 1.7;
    const len = 1.5 + roadRng() * 6;
    drawWrappedY(y, 5, (yy) => {
      g.strokeStyle = roadRng() > 0.45 ? `rgba(109,94,65,${0.10 + roadRng() * 0.16})` : `rgba(248,236,204,${0.15 + roadRng() * 0.2})`;
      g.lineWidth = 0.6 + roadRng() * 1.2;
      g.beginPath();
      g.moveTo(x, yy);
      g.lineTo(x + (roadRng() - 0.5) * 5, yy + len);
      g.stroke();
    });
  }

  // Two pale wheel tracks with a springy edge.
  for (const offset of [-18, 18]) {
    g.beginPath();
    for (let y = -12; y <= TILE + 12; y += 5) {
      const x = roadCenter(y) + offset + Math.sin(TAU * y / TILE * 4 + offset) * 1.6;
      if (y === -12) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(148,128,87,0.20)';
    g.lineWidth = 4.6;
    g.stroke();
    g.strokeStyle = 'rgba(245,232,199,0.22)';
    g.lineWidth = 1.4;
    g.stroke();
  }

  // Loose central dust / leaf litter.
  for (let i = 0; i < 60; i++) {
    const y = roadRng() * TILE;
    const x = roadCenter(y) + (roadRng() - 0.5) * roadHalf(y) * 1.35;
    drawWrappedY(y, 4, (yy) => {
      g.fillStyle = roadRng() > 0.5 ? 'rgba(103,92,61,0.15)' : 'rgba(246,236,212,0.2)';
      g.beginPath();
      g.ellipse(x, yy, 0.8 + roadRng() * 2.1, 0.5 + roadRng() * 1.1, roadRng() * 3, 0, TAU);
      g.fill();
    });
  }
  g.restore();

  // Edges: a darker, slightly crumbled outline.
  g.save();
  g.lineCap = 'round';
  for (const side of [-1, 1]) {
    g.beginPath();
    for (let y = -12; y <= TILE + 12; y += 5) {
      const x = (side < 0 ? roadLeft(y) : roadRight(y)) + side * 1.2;
      if (y === -12) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = 'rgba(132,112,75,0.33)';
    g.lineWidth = 5.2;
    g.stroke();
    g.strokeStyle = 'rgba(239,225,188,0.35)';
    g.lineWidth = 1.3;
    g.stroke();
  }
  g.restore();
}

function drawTree(g, x, y, r, seed) {
  const rng = mulberry32(seed);
  const shadowR = r * 1.05;
  drawSoftShadow(g, x + r * 0.42, y + r * 0.58, shadowR, shadowR * 0.74, 0.26);

  // Trunk peeks through the canopy.
  g.fillStyle = 'rgba(91,67,43,0.85)';
  g.beginPath();
  g.ellipse(x, y + 2, r * 0.12, r * 0.19, 0, 0, TAU);
  g.fill();

  const lobes = [];
  const count = 9 + Math.floor(rng() * 6);
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const dd = rng() * r * 0.54;
    lobes.push({
      x: x + Math.cos(a) * dd,
      y: y + Math.sin(a) * dd * 0.82,
      r: r * (0.26 + rng() * 0.32),
      shade: rng()
    });
  }
  lobes.sort((a, b) => a.shade - b.shade);

  for (const lobe of lobes) {
    const dark = lobe.shade > 0.7 ? '#2f6138' : lobe.shade > 0.35 ? '#3f7942' : '#4d8b49';
    g.fillStyle = dark;
    g.beginPath();
    g.arc(lobe.x + r * 0.05, lobe.y + r * 0.08, lobe.r, 0, TAU);
    g.fill();
  }
  for (const lobe of lobes) {
    const t = lobe.shade;
    g.fillStyle = t > 0.64 ? '#6fa354' : t > 0.3 ? '#5b964d' : '#4b8343';
    g.beginPath();
    g.arc(lobe.x - r * 0.025, lobe.y - r * 0.035, lobe.r * 0.79, 0, TAU);
    g.fill();
  }
  // Sunlit crown, upper-left.
  for (let i = 0; i < 13; i++) {
    const a = -2.5 + rng() * 1.8;
    const dd = rng() * r * 0.62;
    const lx = x + Math.cos(a) * dd;
    const ly = y + Math.sin(a) * dd * 0.75;
    g.fillStyle = `rgba(151,190,105,${0.18 + rng() * 0.3})`;
    g.beginPath();
    g.arc(lx, ly, r * (0.055 + rng() * 0.10), 0, TAU);
    g.fill();
  }
  // Hand-painted leaf notches.
  g.strokeStyle = 'rgba(42,81,45,0.22)';
  g.lineWidth = 0.8;
  for (let i = 0; i < 10; i++) {
    const a = rng() * TAU;
    const rr = r * (0.38 + rng() * 0.4);
    g.beginPath();
    g.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1.4 + rng() * 2.5, a, a + 1.1);
    g.stroke();
  }
}

function drawShrub(g, x, y, r, seed) {
  const rng = mulberry32(seed);
  drawSoftShadow(g, x + r * 0.36, y + r * 0.48, r * 1.1, r * 0.72, 0.19);
  for (let i = 0; i < 9; i++) {
    const a = rng() * TAU;
    const dd = rng() * r * 0.6;
    const rr = r * (0.24 + rng() * 0.28);
    g.fillStyle = i % 3 === 0 ? '#5a964b' : i % 3 === 1 ? '#6ba356' : '#447d40';
    g.beginPath();
    g.arc(x + Math.cos(a) * dd, y + Math.sin(a) * dd * 0.7, rr, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 4; i++) {
    g.fillStyle = 'rgba(173,206,120,0.35)';
    g.beginPath();
    g.arc(x - r * 0.2 + (rng() - 0.5) * r * 0.7, y - r * 0.22 + (rng() - 0.5) * r * 0.5, r * (0.08 + rng() * 0.1), 0, TAU);
    g.fill();
  }
}

function drawRock(g, x, y, r, seed) {
  const rng = mulberry32(seed);
  drawSoftShadow(g, x + r * 0.35, y + r * 0.5, r * 1.2, r * 0.7, 0.2);
  const pts = [];
  const n = 7 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (0.72 + rng() * 0.36);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.72]);
  }
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = '#909889';
  g.fill();
  g.strokeStyle = 'rgba(73,83,72,0.38)';
  g.lineWidth = 1.2;
  g.stroke();
  g.beginPath();
  g.moveTo(x - r * 0.36, y - r * 0.1);
  g.quadraticCurveTo(x, y - r * 0.46, x + r * 0.34, y - r * 0.16);
  g.strokeStyle = 'rgba(215,220,197,0.44)';
  g.lineWidth = 1.6;
  g.stroke();
}

function drawFlowerCluster(g, x, y, seed) {
  const rng = mulberry32(seed);
  const n = 3 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    const fx = x + (rng() - 0.5) * 18;
    const fy = y + (rng() - 0.5) * 14;
    const r = 1.15 + rng() * 1.15;
    const col = FLOWER_COLORS[Math.floor(rng() * FLOWER_COLORS.length)];
    g.fillStyle = col;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * TAU;
      g.beginPath();
      g.ellipse(fx + Math.cos(a) * r, fy + Math.sin(a) * r * 0.8, r * 0.9, r * 0.58, a, 0, TAU);
      g.fill();
    }
    g.fillStyle = rng() > 0.5 ? '#e2b84e' : '#f6e6a2';
    g.beginPath();
    g.arc(fx, fy, r * 0.52, 0, TAU);
    g.fill();
  }
}

function paintMeadow(g) {
  g.fillStyle = '#88b957';
  g.fillRect(0, 0, W, TILE);

  // Broad, soft patches of pasture colour.
  const patchRng = mulberry32(20260412);
  for (let i = 0; i < 105; i++) {
    const x = patchRng() * W;
    const y = patchRng() * TILE;
    const rx = 30 + patchRng() * 155;
    const ry = 24 + patchRng() * 150;
    const col = patchRng() > 0.5 ? '#a2cd68' : '#77a949';
    const alpha = 0.035 + patchRng() * 0.075;
    drawWrappedY(y, rx + 10, (yy) => drawRadialBlob(g, x, yy, rx, ry, col, alpha));
  }

  // Short, hand-made grass marks. Three wrapped passes keep the seam alive.
  const grassRng = mulberry32(77701);
  g.lineCap = 'round';
  for (let i = 0; i < 9800; i++) {
    const x = grassRng() * W;
    const y = grassRng() * TILE;
    const len = 2.2 + grassRng() * 7;
    const lean = (grassRng() - 0.5) * 4.2;
    const col = GRASS_STROKES[Math.floor(grassRng() * GRASS_STROKES.length)];
    const alpha = 0.10 + grassRng() * 0.20;
    const width = 0.55 + grassRng() * 1.25;
    drawWrappedY(y, len + 3, (yy) => {
      g.strokeStyle = col;
      g.globalAlpha = alpha;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(x, yy);
      g.quadraticCurveTo(x + lean * 0.4, yy + len * 0.55, x + lean, yy + len);
      g.stroke();
    });
  }
  g.globalAlpha = 1;

  // Slightly larger tufts catch the eye.
  const tuftRng = mulberry32(8341);
  for (let i = 0; i < 720; i++) {
    const x = tuftRng() * W;
    const y = tuftRng() * TILE;
    if (!isGrass(x, y, 8)) continue;
    const h = 5 + tuftRng() * 11;
    drawWrappedY(y, h + 3, (yy) => {
      g.strokeStyle = tuftRng() > 0.45 ? '#9fc75f' : '#6f9e42';
      g.globalAlpha = 0.2 + tuftRng() * 0.3;
      g.lineWidth = 0.7 + tuftRng() * 0.9;
      for (let b = 0; b < 4; b++) {
        const spread = (b - 1.5) * 2.7;
        g.beginPath();
        g.moveTo(x + spread * 0.3, yy);
        g.quadraticCurveTo(x + spread * 0.8, yy - h * 0.55, x + spread, yy - h);
        g.stroke();
      }
    });
  }
  g.globalAlpha = 1;
}

function addSmallDetails(g) {
  const detailRng = mulberry32(33011);

  // Shrubs, almost always outside the two travel lines.
  for (let i = 0; i < 28; i++) {
    const x = 36 + detailRng() * (W - 72);
    const y = detailRng() * TILE;
    if (!isGrass(x, y, 28)) continue;
    drawWrappedY(y, 50, (yy) => drawShrub(g, x, yy, 12 + detailRng() * 11, Math.floor(detailRng() * 1e9)));
  }

  // Stones: mostly meadow, a handful near the water.
  const rockSpots = [
    [728, 330, 8], [692, 1080, 7], [446, 510, 6], [477, 1580, 8],
    [382, 260, 6], [314, 960, 9], [914, 760, 7], [158, 1330, 8],
    [500, 1830, 6], [760, 1740, 7], [84, 330, 6], [862, 430, 5]
  ];
  for (let i = 0; i < rockSpots.length; i++) {
    const [x, y, r] = rockSpots[i];
    drawWrappedY(y, 30, (yy) => drawRock(g, x, yy, r, 800 + i));
  }

  // Flower clusters, seeded and gently clustered around little meadows.
  const flowerCentres = [
    [320, 560], [375, 940], [420, 1420], [310, 1880],
    [842, 320], [888, 1020], [816, 1450], [944, 1900],
    [92, 520], [124, 1060], [74, 1660]
  ];
  for (let c = 0; c < flowerCentres.length; c++) {
    const [cx, cy] = flowerCentres[c];
    for (let i = 0; i < 8; i++) {
      const x = cx + (detailRng() - 0.5) * 96;
      const y = cy + (detailRng() - 0.5) * 110;
      if (!isGrass(x, y, 7)) continue;
      drawWrappedY(y, 20, (yy) => drawFlowerCluster(g, x, yy, Math.floor(detailRng() * 1e9)));
    }
  }

  // Butterflies? No — the scene should remain quiet.
}

function drawTrees(g) {
  const trees = [
    [54, 176, 50, 21], [128, 722, 46, 22], [344, 286, 56, 23],
    [396, 638, 43, 24], [360, 1212, 51, 25], [418, 1752, 56, 26],
    [938, 256, 55, 27], [846, 556, 44, 28], [930, 1098, 54, 29],
    [806, 1528, 48, 30], [968, 1848, 58, 31], [62, 1486, 45, 32]
  ];
  for (const [x, y, r, seed] of trees) {
    drawWrappedY(y, r * 2.1, (yy) => drawTree(g, x, yy, r, seed));
  }
}

export function buildTerrainTexture() {
  const canvas = makeCanvas(W, TILE);
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = true;

  paintMeadow(g);
  paintRiver(g);
  paintRoad(g);
  addSmallDetails(g);
  drawTrees(g);

  // A very light top-left wash unifies the hand-painted colours.
  const wash = g.createLinearGradient(0, 0, W, TILE);
  wash.addColorStop(0, 'rgba(255,255,232,0.075)');
  wash.addColorStop(0.5, 'rgba(255,255,255,0)');
  wash.addColorStop(1, 'rgba(64,92,54,0.035)');
  g.fillStyle = wash;
  g.fillRect(0, 0, W, TILE);

  const texture = canvasTexture(canvas, { wrapS: ClampToEdgeWrapping, wrapT: RepeatWrapping });
  texture.anisotropy = 8;
  return texture;
}

/* -------------------------------------------------------------------------- */
/*  Animals                                                                   */
/* -------------------------------------------------------------------------- */

const FRAME_COUNT = 8;
const ANIMAL_FRAME = 160;

function cowPatchLayout(type, rng) {
  const patches = [];
  const count = type === 'brown' ? 7 : 6;
  for (let i = 0; i < count; i++) {
    patches.push({
      x: 80 + (rng() - 0.5) * 35,
      y: 65 + (rng() - 0.5) * 52,
      rx: 6 + rng() * 15,
      ry: 7 + rng() * 19,
      rot: rng() * TAU
    });
  }
  return patches;
}

function drawCowFrame(g, type, frame, seed) {
  const phase = (frame / FRAME_COUNT) * TAU;
  const step = Math.sin(phase);
  const step2 = Math.sin(phase + Math.PI);
  const bob = Math.sin(phase * 2) * 0.9;
  const rng = mulberry32(seed);
  const cream = '#f1e5c9';
  const brown = '#9a6743';
  const black = '#30322d';
  const base = type === 'brown' ? cream : '#ece3cf';
  const patch = type === 'brown' ? brown : black;

  g.save();
  g.translate(80, 80 + bob);

  // Four small legs, peeking out from under the barrel of the body.
  const legColor = type === 'brown' ? '#e2d1ae' : '#3b3c36';
  for (const [lx, ly, s] of [[-22, -18, step], [22, -15, step2], [-21, 19, step2], [20, 22, step]]) {
    g.save();
    g.translate(lx, ly + s * 2.5);
    g.rotate(s * 0.12);
    g.fillStyle = legColor;
    g.strokeStyle = 'rgba(59,47,34,0.34)';
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(-3.6, -10, 7.2, 18, 3.4);
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(73,53,36,0.64)';
    g.beginPath();
    g.ellipse(0, 7.2, 3.2, 2.4, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  // Tail: a thin, slow-swishing line.
  const tail = Math.sin(phase * 0.75 + 0.7) * 6;
  g.strokeStyle = type === 'brown' ? '#7d5639' : '#252822';
  g.lineWidth = 3.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 33);
  g.quadraticCurveTo(tail * 0.5, 43, tail, 50);
  g.stroke();
  g.fillStyle = type === 'brown' ? '#5e422d' : '#1d201c';
  g.beginPath();
  g.arc(tail, 51, 3.6, 0, TAU);
  g.fill();

  // Body silhouette.
  g.beginPath();
  g.ellipse(0, 0, 26, 40, 0, 0, TAU);
  g.fillStyle = base;
  g.fill();
  g.save();
  g.clip();

  // Irregular hand-painted patches.
  const patches = cowPatchLayout(type, mulberry32(seed + 19));
  for (const p of patches) {
    g.save();
    g.translate(p.x - 80, p.y - 80);
    g.rotate(p.rot);
    g.fillStyle = patch;
    g.beginPath();
    g.ellipse(0, 0, p.rx, p.ry, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  // Inner volume: left edge cool, sunlit side warm.
  const bodyShade = g.createLinearGradient(-30, -38, 32, 40);
  bodyShade.addColorStop(0, 'rgba(255,255,230,0.24)');
  bodyShade.addColorStop(0.48, 'rgba(255,255,255,0)');
  bodyShade.addColorStop(1, 'rgba(56,48,34,0.18)');
  g.fillStyle = bodyShade;
  g.fillRect(-32, -44, 64, 88);
  g.restore();

  g.strokeStyle = 'rgba(68,52,34,0.27)';
  g.lineWidth = 1.3;
  g.beginPath();
  g.ellipse(0, 0, 26, 40, 0, 0, TAU);
  g.stroke();

  // Head, ears, horns and muzzle — seen from above.
  const headSway = Math.sin(phase) * 1.4;
  g.save();
  g.translate(headSway, -42 + Math.abs(bob) * 0.2);
  const headW = 16;
  const headH = 19;
  g.fillStyle = type === 'brown' ? '#e6d4b0' : '#e7dec8';
  g.beginPath();
  g.ellipse(0, 0, headW, headH, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(68,52,34,0.28)';
  g.lineWidth = 1.2;
  g.stroke();

  // Ears.
  g.fillStyle = type === 'brown' ? '#c99b72' : '#b9ad98';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(side * 17, 1, 7.5, 4.2, side * 0.45, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(69,53,36,0.24)';
    g.lineWidth = 1;
    g.stroke();
  }

  // Tiny horns.
  g.strokeStyle = '#d9c99e';
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(side * 10, -11);
    g.quadraticCurveTo(side * 13, -17, side * 10, -20);
    g.stroke();
  }

  // Muzzle and nostril flecks.
  g.fillStyle = '#d8a99c';
  g.beginPath();
  g.ellipse(0, -13, 9.5, 7, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(89,59,50,0.55)';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(side * 3.2, -14, 1.25, 1.7, 0, 0, TAU);
    g.fill();
  }
  // A dark forehead poll.
  g.fillStyle = type === 'brown' ? 'rgba(110,73,48,0.5)' : 'rgba(44,45,39,0.5)';
  g.beginPath();
  g.ellipse(0, 3, 8.5, 8, 0, 0, TAU);
  g.fill();
  g.restore();

  g.restore();
}

function drawSheepFrame(g, frame, seed) {
  const phase = (frame / FRAME_COUNT) * TAU;
  const step = Math.sin(phase);
  const step2 = Math.sin(phase + Math.PI);
  const bob = Math.sin(phase * 2 + 0.4) * 1.3;
  const rng = mulberry32(seed);

  g.save();
  g.translate(80, 82 + bob);

  // Legs.
  for (const [lx, ly, s] of [[-14, 18, step], [14, 18, step2], [-12, 33, step2], [13, 33, step]]) {
    g.save();
    g.translate(lx, ly + s * 2);
    g.strokeStyle = '#6e6552';
    g.lineWidth = 4.2;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, -5);
    g.lineTo(s * 1.5, 7);
    g.stroke();
    g.fillStyle = '#4e4638';
    g.beginPath();
    g.ellipse(s * 1.5, 7, 2.4, 3.2, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  // Tail puff.
  g.fillStyle = '#e7ddc4';
  g.beginPath();
  g.arc(Math.sin(phase * 0.6) * 2, 39, 7.5, 0, TAU);
  g.fill();

  // Fluffy body made of overlapping wool lobes.
  const lobes = [];
  for (let i = 0; i < 18; i++) {
    const a = rng() * TAU;
    const dd = rng() * 18;
    lobes.push({
      x: Math.cos(a) * dd * 0.9,
      y: Math.sin(a) * dd * 1.25 - 2,
      r: 9 + rng() * 9
    });
  }
  lobes.sort((a, b) => a.y - b.y);
  for (const lobe of lobes) {
    g.fillStyle = '#e3d8bf';
    g.beginPath();
    g.arc(lobe.x + 1.5, lobe.y + 2, lobe.r, 0, TAU);
    g.fill();
  }
  for (const lobe of lobes) {
    g.fillStyle = iShade(lobe.r);
    g.beginPath();
    g.arc(lobe.x - 0.8, lobe.y - 1.2, lobe.r * 0.88, 0, TAU);
    g.fill();
  }

  // Wool curls.
  g.strokeStyle = 'rgba(180,166,137,0.28)';
  g.lineWidth = 0.9;
  for (let i = 0; i < 16; i++) {
    const a = rng() * TAU;
    const rr = 5 + rng() * 22;
    g.beginPath();
    g.arc(Math.cos(a) * rr, Math.sin(a) * rr * 1.3, 1.5 + rng() * 2, a, a + 1.7);
    g.stroke();
  }

  // Head.
  const headSway = Math.sin(phase + 0.8) * 1.5;
  g.save();
  g.translate(headSway, -39);
  g.fillStyle = '#e9dfc8';
  g.beginPath();
  g.ellipse(0, 0, 13, 17, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(113,97,72,0.28)';
  g.lineWidth = 1.1;
  g.stroke();
  // Ears.
  g.fillStyle = '#cdbfa5';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(side * 13, 1, 6, 3.4, side * 0.35, 0, TAU);
    g.fill();
  }
  // Muzzle.
  g.fillStyle = '#baa68e';
  g.beginPath();
  g.ellipse(0, -11, 7.4, 5.2, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(95,76,60,0.5)';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.arc(side * 2.7, -12, 0.9, 0, TAU);
    g.fill();
  }
  // Pale poll.
  g.fillStyle = 'rgba(244,237,220,0.65)';
  g.beginPath();
  g.ellipse(0, 3, 7, 6.2, 0, 0, TAU);
  g.fill();
  g.restore();

  g.restore();
}

function iShade(r) {
  if (r > 13) return '#eee5cf';
  if (r > 10.5) return '#e9dfc8';
  return '#e0d4b9';
}

export function createAnimalSheet(type, seed) {
  const canvas = makeCanvas(ANIMAL_FRAME * FRAME_COUNT, ANIMAL_FRAME);
  const g = canvas.getContext('2d');
  for (let f = 0; f < FRAME_COUNT; f++) {
    g.save();
    g.translate(f * ANIMAL_FRAME, 0);
    if (type === 'sheep') drawSheepFrame(g, f, seed);
    else drawCowFrame(g, type, f, seed);
    g.restore();
  }
  const texture = canvasTexture(canvas);
  texture.wrapS = ClampToEdgeWrapping;
  texture.repeat.set(1 / FRAME_COUNT, 1);
  texture.userData = { frames: FRAME_COUNT };
  return texture;
}

/* -------------------------------------------------------------------------- */
/*  Bicycle + rider                                                           */
/* -------------------------------------------------------------------------- */

export function createBikeSheet() {
  const size = 160;
  const canvas = makeCanvas(size * FRAME_COUNT, size);
  const g = canvas.getContext('2d');

  for (let f = 0; f < FRAME_COUNT; f++) {
    const phase = (f / FRAME_COUNT) * TAU;
    const pedal = Math.sin(phase);
    const pedal2 = Math.sin(phase + Math.PI);

    g.save();
    g.translate(f * size + 80, 82);

    // Contact shadow is a separate layer; this is only the vehicle.
    // Wheels.
    for (const wheelY of [-37, 43]) {
      g.save();
      g.translate(0, wheelY);
      g.strokeStyle = '#242925';
      g.lineWidth = 5.2;
      g.beginPath();
      g.ellipse(0, 0, 6.3, 18.5, 0, 0, TAU);
      g.stroke();
      g.strokeStyle = 'rgba(116,82,44,0.78)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.ellipse(0, 0, 4.2, 15.3, 0, 0, TAU);
      g.stroke();
      g.strokeStyle = 'rgba(221,204,175,0.48)';
      g.lineWidth = 0.7;
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * 1.5, Math.sin(a) * 2.2);
        g.lineTo(Math.cos(a) * 4.0, Math.sin(a) * 14.8);
        g.stroke();
      }
      g.restore();
    }

    // Orange frame, clear even at small scale.
    g.strokeStyle = '#e97832';
    g.lineWidth = 3.4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(0, -37);
    g.lineTo(0, 43);
    g.moveTo(0, -26);
    g.lineTo(-10, 8);
    g.lineTo(0, 24);
    g.lineTo(10, 8);
    g.lineTo(0, -26);
    g.stroke();
    g.strokeStyle = '#f39a53';
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(0, -22);
    g.lineTo(0, 22);
    g.stroke();

    // Rear rack / saddle hint.
    g.fillStyle = '#57402d';
    g.beginPath();
    g.ellipse(0, 26, 7, 3.4, 0, 0, TAU);
    g.fill();

    // Legs — one drives down while the other comes up.
    for (const [side, p] of [[-1, pedal], [1, pedal2]]) {
      g.strokeStyle = '#d6a07f';
      g.lineWidth = 4.5;
      g.beginPath();
      g.moveTo(side * 5, 12);
      g.quadraticCurveTo(side * (9 + p * 3), 19 + p * 4, side * 8, 25 + p * 4);
      g.stroke();
      g.fillStyle = '#343b39';
      g.beginPath();
      g.ellipse(side * 8, 26 + p * 4, 3.4, 2.6, 0, 0, TAU);
      g.fill();
      g.fillStyle = '#8b9692';
      g.beginPath();
      g.ellipse(side * 8, 27 + p * 4, 4.2, 1.2, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(244,246,241,0.78)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(side * 8, 27 + p * 4, 3.2, 0.2, 2.4);
      g.stroke();
    }

    // Torso in blue, seen from above and folded toward the bars.
    g.fillStyle = '#2e72b0';
    g.beginPath();
    g.ellipse(0, -2, 13, 20, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(20,54,85,0.5)';
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = '#4b95ce';
    g.beginPath();
    g.ellipse(-2, -6, 8, 12, -0.15, 0, TAU);
    g.fill();

    // Arms reaching to the bars.
    g.strokeStyle = '#d8a383';
    g.lineWidth = 3.3;
    g.lineCap = 'round';
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * 8, -10);
      g.quadraticCurveTo(side * 13, -22, side * 14, -29);
      g.stroke();
      g.strokeStyle = '#2e72b0';
      g.lineWidth = 4.4;
      g.beginPath();
      g.moveTo(side * 8, -10);
      g.lineTo(side * 10, -18);
      g.stroke();
      g.strokeStyle = '#d8a383';
      g.lineWidth = 3.1;
    }

    // Narrow handlebars.
    g.strokeStyle = '#5c625b';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-13, -31);
    g.quadraticCurveTo(0, -34, 13, -31);
    g.stroke();
    g.strokeStyle = '#c8b18e';
    g.lineWidth = 2;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * 13, -31);
      g.lineTo(side * 15, -29);
      g.stroke();
    }

    // Head and pale helmet.
    g.fillStyle = '#d9aa8b';
    g.beginPath();
    g.arc(0, -21, 7, 0, TAU);
    g.fill();
    g.fillStyle = '#e8e2cf';
    g.beginPath();
    g.ellipse(0, -25, 7.8, 8.2, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(117,114,98,0.36)';
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.72)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.arc(-1.6, -27, 4.2, 3.6, 5.6);
    g.stroke();

    // A tiny hint of a rider's neck.
    g.fillStyle = '#d1a085';
    g.beginPath();
    g.ellipse(0, -15, 3.8, 3.2, 0, 0, TAU);
    g.fill();

    g.restore();
  }

  const texture = canvasTexture(canvas);
  texture.repeat.set(1 / FRAME_COUNT, 1);
  texture.userData = { frames: FRAME_COUNT };
  return texture;
}

/* -------------------------------------------------------------------------- */
/*  Aircraft                                                                  */
/* -------------------------------------------------------------------------- */

function drawPlane(g, size) {
  const s = size / 256;
  g.save();
  g.scale(s, s);

  // Wings.
  g.fillStyle = '#f3ecd8';
  g.strokeStyle = 'rgba(72,79,59,0.55)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(128, 113);
  g.lineTo(32, 143);
  g.quadraticCurveTo(20, 148, 23, 158);
  g.quadraticCurveTo(26, 166, 42, 162);
  g.lineTo(128, 150);
  g.lineTo(214, 162);
  g.quadraticCurveTo(230, 166, 233, 158);
  g.quadraticCurveTo(236, 148, 224, 143);
  g.closePath();
  g.fill();
  g.stroke();

  // Wing shading.
  g.fillStyle = 'rgba(184,181,158,0.30)';
  g.beginPath();
  g.moveTo(128, 140);
  g.lineTo(29, 153);
  g.quadraticCurveTo(24, 159, 39, 161);
  g.lineTo(128, 148);
  g.lineTo(217, 161);
  g.quadraticCurveTo(232, 159, 227, 153);
  g.closePath();
  g.fill();

  // Orange wingtips.
  g.fillStyle = '#df7a37';
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(128 + side * 96, 144);
    g.lineTo(128 + side * 104, 150);
    g.lineTo(128 + side * 101, 160);
    g.lineTo(128 + side * 88, 155);
    g.closePath();
    g.fill();
  }

  // Tailplane.
  g.fillStyle = '#eee5cf';
  g.strokeStyle = 'rgba(72,79,59,0.48)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(128, 195);
  g.lineTo(94, 207);
  g.quadraticCurveTo(89, 214, 100, 216);
  g.lineTo(128, 211);
  g.lineTo(156, 216);
  g.quadraticCurveTo(167, 214, 162, 207);
  g.closePath();
  g.fill();
  g.stroke();

  // Fuselage.
  const fuse = g.createLinearGradient(105, 0, 151, 0);
  fuse.addColorStop(0, '#fbf6e7');
  fuse.addColorStop(0.42, '#f1e7ca');
  fuse.addColorStop(1, '#c9bf9f');
  g.fillStyle = fuse;
  g.strokeStyle = 'rgba(65,75,57,0.55)';
  g.lineWidth = 1.7;
  g.beginPath();
  g.moveTo(128, 19);
  g.bezierCurveTo(145, 31, 154, 65, 151, 120);
  g.bezierCurveTo(149, 167, 141, 198, 128, 218);
  g.bezierCurveTo(115, 198, 107, 167, 105, 120);
  g.bezierCurveTo(102, 65, 111, 31, 128, 19);
  g.closePath();
  g.fill();
  g.stroke();

  // Cream stripe and warm panel line.
  g.strokeStyle = 'rgba(208,112,54,0.72)';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(110, 95);
  g.quadraticCurveTo(128, 101, 146, 95);
  g.stroke();
  g.strokeStyle = 'rgba(255,250,232,0.8)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(112, 98);
  g.quadraticCurveTo(128, 103, 144, 98);
  g.stroke();

  // Cockpit.
  g.fillStyle = '#5b8fa5';
  g.beginPath();
  g.ellipse(128, 104, 14, 23, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(43,58,54,0.55)';
  g.lineWidth = 1.4;
  g.stroke();
  g.fillStyle = 'rgba(231,246,237,0.58)';
  g.beginPath();
  g.ellipse(123, 98, 5.4, 9, -0.2, 0, TAU);
  g.fill();

  // Nose and propeller blur.
  g.fillStyle = '#d8ccb0';
  g.beginPath();
  g.ellipse(128, 25, 10, 8, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(79,84,63,0.5)';
  g.lineWidth = 1.2;
  g.stroke();
  g.save();
  g.translate(128, 17);
  g.strokeStyle = 'rgba(106,112,93,0.34)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 21, Math.PI * 1.08, Math.PI * 1.92);
  g.stroke();
  g.strokeStyle = 'rgba(106,112,93,0.19)';
  g.lineWidth = 1.1;
  g.beginPath();
  g.arc(0, 0, 28, Math.PI * 1.14, Math.PI * 1.86);
  g.stroke();
  g.restore();

  // Small windows / panel stitches.
  g.fillStyle = 'rgba(94,82,57,0.4)';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(114 + i * 14, 184, 1.3, 0, TAU);
    g.fill();
  }

  g.restore();
}

export function createPlaneTexture() {
  const canvas = makeCanvas(256, 256);
  const g = canvas.getContext('2d');
  drawPlane(g, 256);
  return canvasTexture(canvas);
}

export function createPlaneShadowTexture() {
  const source = makeCanvas(256, 256);
  drawPlane(source.getContext('2d'), 256);
  const canvas = makeCanvas(300, 300);
  const g = canvas.getContext('2d');
  g.filter = 'blur(7px)';
  g.drawImage(source, 22, 22);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#1e2b23';
  g.fillRect(0, 0, 300, 300);
  return canvasTexture(canvas);
}

/* -------------------------------------------------------------------------- */
/*  Clouds                                                                    */
/* -------------------------------------------------------------------------- */

function cloudField(nx, ny, lobes) {
  let d = 0;
  for (const lobe of lobes) {
    const dx = (nx - lobe.x) / lobe.rx;
    const dy = (ny - lobe.y) / lobe.ry;
    d += lobe.w * Math.exp(-(dx * dx + dy * dy) * 2.2);
  }
  return d;
}

function makeCloudLobes(rng, wide = 1) {
  const lobes = [
    { x: 0.50, y: 0.53, rx: 0.27 * wide, ry: 0.19, w: 1.05 },
    { x: 0.31, y: 0.58, rx: 0.18 * wide, ry: 0.15, w: 0.84 },
    { x: 0.69, y: 0.57, rx: 0.19 * wide, ry: 0.15, w: 0.86 },
    { x: 0.41, y: 0.45, rx: 0.17 * wide, ry: 0.14, w: 0.76 },
    { x: 0.60, y: 0.43, rx: 0.17 * wide, ry: 0.15, w: 0.80 },
    { x: 0.51, y: 0.36, rx: 0.15 * wide, ry: 0.13, w: 0.62 }
  ];
  const extra = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < extra; i++) {
    lobes.push({
      x: 0.28 + rng() * 0.44,
      y: 0.40 + rng() * 0.22,
      rx: (0.09 + rng() * 0.08) * wide,
      ry: 0.08 + rng() * 0.07,
      w: 0.40 + rng() * 0.32
    });
  }
  return lobes;
}

export function createCloudTexture(seed, width = 520, height = 340, wide = 1) {
  const rng = mulberry32(seed);
  const canvas = makeCanvas(width, height);
  const g = canvas.getContext('2d');
  const image = g.createImageData(width, height);
  const data = image.data;
  const lobes = makeCloudLobes(rng, wide);
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      let d = cloudField(nx, ny, lobes);

      // Small-scale, local-coordinate wrinkles. Never regenerated at runtime.
      const n1 = hash2(x >> 2, y >> 2, seed + 11) - 0.5;
      const n2 = hash2(x >> 4, y >> 3, seed + 29) - 0.5;
      d += n1 * 0.028 + n2 * 0.062;

      // Slight flat-topped volume, soft underbelly.
      const body = smoothstep(0.58, 0.87, d);
      let alpha = body;
      if (alpha <= 0.002) continue;

      const light = clamp(
        0.74 - (nx - 0.44) * 0.22 - (ny - 0.40) * 0.42 + body * 0.18,
        0.32,
        1
      );
      const shade = clamp(0.78 + (ny - 0.46) * 0.23 + body * 0.06, 0.65, 1);

      // White cloud with a breath of blue in the folds.
      const r = 205 + 50 * light;
      const gg = 213 + 42 * light;
      const b = 216 + 39 * light;
      const volume = smoothstep(0.25, 0.72, body);
      let cr = r * (0.93 + volume * 0.09);
      let cg = gg * (0.94 + volume * 0.07);
      let cb = b * (0.95 + volume * 0.06);
      cr = clamp(cr * (0.93 + shade * 0.08), 0, 255);
      cg = clamp(cg * (0.93 + shade * 0.08), 0, 255);
      cb = clamp(cb * (0.93 + shade * 0.08), 0, 255);

      // Grain noise, strongest in the soft edge band.
      const grain = hash2(x, y, seed + 101) - 0.5;
      const edge = alpha * (1 - alpha) * 3.4;
      alpha = clamp(alpha + grain * 0.13 * edge, 0, 1);

      // Ordered dithering keeps the edge powdery rather than banded.
      const dith = (bayer[y & 3][x & 3] / 16 - 0.5);
      if (alpha < 0.6) {
        alpha = clamp(alpha + dith * 0.13 * (1 - alpha), 0, 1);
      }

      // A few detached, airy particles around the rim.
      if (body > 0.30 && body < 0.62) {
        const particle = hash2(x, y, seed + 307);
        if (particle > 0.965) {
          alpha = Math.max(alpha, 0.16 + particle * 0.22);
          cr = Math.min(255, cr + 12);
          cg = Math.min(255, cg + 10);
        }
      }

      const idx = (y * width + x) * 4;
      data[idx] = cr;
      data[idx + 1] = cg;
      data[idx + 2] = cb;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  g.putImageData(image, 0, 0);

  // Cache a handful of extra soft particles; still local and seeded.
  for (let i = 0; i < 90; i++) {
    const x = width * (0.16 + rng() * 0.7);
    const y = height * (0.24 + rng() * 0.55);
    const nx = x / width;
    const ny = y / height;
    const d = cloudField(nx, ny, lobes);
    if (d < 0.42 || d > 0.75) continue;
    g.fillStyle = `rgba(255,255,250,${0.08 + rng() * 0.15})`;
    g.beginPath();
    g.arc(x, y, 0.7 + rng() * 1.6, 0, TAU);
    g.fill();
  }

  return { canvas, texture: canvasTexture(canvas) };
}

export function createCloudShadowTexture(cloudCanvas) {
  const pad = 36;
  const canvas = makeCanvas(cloudCanvas.width + pad * 2, cloudCanvas.height + pad * 2);
  const g = canvas.getContext('2d');
  g.filter = 'blur(18px)';
  g.drawImage(cloudCanvas, pad, pad);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#283a2d';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.globalCompositeOperation = 'source-over';
  return canvasTexture(canvas);
}

/* -------------------------------------------------------------------------- */
/*  Soft ground shadow                                                        */
/* -------------------------------------------------------------------------- */

export function createSoftShadowTexture() {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const g = canvas.getContext('2d');
  g.save();
  g.translate(size / 2, size / 2);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, size * 0.48);
  grad.addColorStop(0, 'rgba(25,39,27,0.62)');
  grad.addColorStop(0.46, 'rgba(25,39,27,0.36)');
  grad.addColorStop(0.78, 'rgba(25,39,27,0.12)');
  grad.addColorStop(1, 'rgba(25,39,27,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, size * 0.48, 0, TAU);
  g.fill();
  g.restore();
  return canvasTexture(canvas);
}