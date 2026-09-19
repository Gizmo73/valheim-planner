export function stableHash(s) {
  let a = 5381, b = 5381;
  for (let i = 0; i < s.length; i += 2) {
    a = (((a << 5) + a) ^ s.charCodeAt(i)) | 0;
    if (i + 1 < s.length) b = (((b << 5) + b) ^ s.charCodeAt(i + 1)) | 0;
  }
  return (a + Math.imul(b, 1566083941)) | 0;
}

const HASH_CREATOR = stableHash('creator');
const HASH_TEXT = stableHash('text');
const HASH_TERRAIN_COMPILER = stableHash('_TerrainCompiler');
const HASH_TCDATA = stableHash('TCData');

const FLAG_SMALLPOS = 8192;
const FLAG_ROT = 4096;
const FLAG_PERSISTENT = 256;

class BinaryReader {
  constructor(buffer) {
    this.buf = buffer;
    this.view = new DataView(buffer);
    this.pos = 0;
  }

  u8() { const v = this.view.getUint8(this.pos); this.pos += 1; return v; }
  i16() { const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
  u16() { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  i32() { const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  u32() { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  i64() { const v = this.view.getBigInt64(this.pos, true); this.pos += 8; return v; }
  f32() { const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }

  vec3() {
    const x = this.f32(), y = this.f32(), z = this.f32();
    return { x, y, z };
  }

  quat() {
    const x = this.f32(), y = this.f32(), z = this.f32(), w = this.f32();
    return { x, y, z, w };
  }

  vec2s() {
    const x = this.i16(), z = this.i16();
    return { x, y: 0, z };
  }

  numitems() {
    let n = this.u8();
    if (n & 0x80) {
      n = ((n & 0x7F) << 8) | this.u8();
    }
    return n;
  }

  str7() {
    let len = 0, shift = 0, b;
    do {
      b = this.u8();
      len |= (b & 0x7F) << shift;
      shift += 7;
    } while (b & 0x80);
    const bytes = new Uint8Array(this.buf, this.pos, len);
    this.pos += len;
    return new TextDecoder().decode(bytes);
  }

  bytearr() {
    const len = this.i32();
    const bytes = new Uint8Array(this.buf, this.pos, len);
    this.pos += len;
    return bytes;
  }
}

function parseSmallRotation(r) {
  let n = r.u16();
  if (n & 0x8000) {
    return { x: 0, y: (n & 0x7FFF) * 0.5, z: 0 };
  }
  n = ((n << 16) | r.u16()) >>> 0;
  const rx = (n & 1023) * 0.5;
  const ry = ((n >>> 10) & 1023) * 0.5;
  const rz = ((n >>> 20) & 1023) * 0.5;
  return { x: rx, y: ry, z: rz };
}

function snapYaw(yaw) {
  const step = 22.5;
  const nearest = Math.round(yaw / step) * step;
  if (Math.abs(yaw - nearest) <= 0.5) return nearest;
  return yaw;
}

function parseZDO(r) {
  const flags = r.u16();

  let pos;
  if (flags & FLAG_SMALLPOS) {
    pos = r.vec2s();
  } else {
    pos = r.vec3();
  }

  const prefabHash = r.i32();

  let rot = { x: 0, y: 0, z: 0 };
  if (flags & FLAG_ROT) {
    rot = parseSmallRotation(r);
  }

  const zdo = {
    flags,
    pos,
    prefabHash,
    rot,
    yawSnapped: snapYaw(rot.y),
    floats: null,
    vec3s: null,
    quats: null,
    ints: null,
    longs: null,
    strs: null,
    bytes: null,
    conn: null,
  };

  const typeMask = flags & 0xFF;

  if (typeMask & 1) {
    zdo.conn = { type: r.u8(), hash: r.i32() };
  }
  if (typeMask & 2) {
    const n = r.numitems();
    zdo.floats = new Map();
    for (let i = 0; i < n; i++) {
      const key = r.i32();
      const val = r.f32();
      zdo.floats.set(key, val);
    }
  }
  if (typeMask & 4) {
    const n = r.numitems();
    zdo.vec3s = new Map();
    for (let i = 0; i < n; i++) {
      const key = r.i32();
      const val = r.vec3();
      zdo.vec3s.set(key, val);
    }
  }
  if (typeMask & 8) {
    const n = r.numitems();
    zdo.quats = new Map();
    for (let i = 0; i < n; i++) {
      const key = r.i32();
      const val = r.quat();
      zdo.quats.set(key, val);
    }
  }
  if (typeMask & 16) {
    const n = r.numitems();
    zdo.ints = new Map();
    for (let i = 0; i < n; i++) {
      const key = r.i32();
      const val = r.i32();
      zdo.ints.set(key, val);
    }
  }
  if (typeMask & 32) {
    const n = r.numitems();
    zdo.longs = new Map();
    for (let i = 0; i < n; i++) {
      const key = r.i32();
      const val = r.i64();
      zdo.longs.set(key, val);
    }
  }
  if (typeMask & 64) {
    const n = r.numitems();
    zdo.strs = new Map();
    for (let i = 0; i < n; i++) {
      const key = r.i32();
      const val = r.str7();
      zdo.strs.set(key, val);
    }
  }
  if (typeMask & 128) {
    const n = r.numitems();
    zdo.bytes = new Map();
    for (let i = 0; i < n; i++) {
      const key = r.i32();
      const val = r.bytearr();
      zdo.bytes.set(key, val);
    }
  }

  return zdo;
}

function parseChunkFile(buffer) {
  const r = new BinaryReader(buffer);
  const worldVersion = r.i16();
  const zdoCount = r.i32();
  const zdos = [];
  for (let i = 0; i < zdoCount; i++) {
    zdos.push(parseZDO(r));
  }
  if (r.pos !== buffer.byteLength) {
    console.warn(`Chunk trailing bytes: read ${r.pos} of ${buffer.byteLength}`);
  }
  return { worldVersion, zdos };
}

function parseChunksIndex(buffer) {
  const r = new BinaryReader(buffer);
  const version = r.u16();
  const totalZdoCount = r.i32();
  const entryCount = r.i32();
  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    const chunkId = r.u16();
    const size = r.u8();
    const chunkVersion = r.u32();
    const zdoCount = r.i32();
    entries.push({ chunkId, size, version: chunkVersion, zdoCount });
  }
  return { version, totalZdoCount, entryCount, entries };
}

function isPlayerBuilt(zdo) {
  return zdo.longs !== null && zdo.longs.has(HASH_CREATOR);
}

function getSignText(zdo) {
  if (!zdo.strs) return null;
  return zdo.strs.get(HASH_TEXT) || null;
}

export function findBestGeneration(files) {
  const gens = new Map();
  for (const f of files) {
    const name = f.name || f.webkitRelativePath?.split('/').pop() || '';
    const m = name.match(/^_main\.(\d+)\.(fwl2|db2|chunks|ok)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!gens.has(n)) gens.set(n, new Set());
      gens.get(n).add(m[2]);
    }
  }

  let best = -1;
  for (const [n, exts] of gens) {
    if (exts.has('ok') && exts.has('chunks') && n > best) best = n;
  }
  return best;
}

export async function readWorldFolder(files, onProgress) {
  const report = (msg) => onProgress && onProgress(msg);

  report('Finding generation...');
  const gen = findBestGeneration(files);
  if (gen < 0) throw new Error('No valid generation found (missing .ok or .chunks)');

  const fileMap = new Map();
  for (const f of files) {
    const name = f.name || f.webkitRelativePath?.split('/').pop() || '';
    fileMap.set(name, f);
  }

  report(`Using generation ${gen}`);
  const chunksFile = fileMap.get(`_main.${gen}.chunks`);
  if (!chunksFile) throw new Error(`Missing _main.${gen}.chunks`);
  const chunksBuffer = await chunksFile.arrayBuffer();
  const chunksIndex = parseChunksIndex(chunksBuffer);

  const chunkFiles = [];
  for (const [name, file] of fileMap) {
    if (name.endsWith('.chunk')) chunkFiles.push({ name, file });
  }

  report(`Parsing ${chunkFiles.length} chunk files...`);
  const allZdos = [];
  for (const { name, file } of chunkFiles) {
    const buf = await file.arrayBuffer();
    const parsed = parseChunkFile(buf);
    allZdos.push(...parsed.zdos);
  }

  report(`Parsed ${allZdos.length} ZDOs`);

  const playerBuilt = allZdos.filter(isPlayerBuilt);
  report(`Found ${playerBuilt.length} player-built pieces`);

  const signs = playerBuilt.filter(z => {
    const text = getSignText(z);
    return text && text.trim().toUpperCase() === 'BLUEPRINT';
  });

  let rotationLog = [];
  for (const zdo of playerBuilt) {
    if (Math.abs(zdo.yawSnapped - zdo.rot.y) > 0.01) {
      rotationLog.push({ hash: zdo.prefabHash, stored: zdo.rot.y, snapped: zdo.yawSnapped });
    }
    if (Math.abs(zdo.rot.x) > 0.01 || Math.abs(zdo.rot.z) > 0.01) {
      rotationLog.push({ hash: zdo.prefabHash, pitch: zdo.rot.x, roll: zdo.rot.z });
    }
  }

  const terrainCompilers = allZdos.filter(z => z.prefabHash === HASH_TERRAIN_COMPILER);

  return {
    generation: gen,
    totalZdos: allZdos.length,
    chunksIndex,
    chunkFileCount: chunkFiles.length,
    allZdos,
    playerBuilt,
    signs,
    terrainCompilers,
    rotationLog,
  };
}

export function filterNearSign(pieces, sign, radius) {
  const sx = sign.pos.x, sz = sign.pos.z;
  return pieces.filter(p => {
    const dx = p.pos.x - sx, dz = p.pos.z - sz;
    return Math.sqrt(dx * dx + dz * dz) <= radius;
  });
}

export async function decompressTCData(bytesData) {
  const ds = new DecompressionStream('gzip');
  const blob = new Blob([bytesData]);
  const decompressed = blob.stream().pipeThrough(ds);
  const reader = decompressed.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { result.set(c, offset); offset += c.length; }
  return result.buffer;
}

export function parseTCData(buffer) {
  const r = new BinaryReader(buffer);
  const version = r.i32();
  const operationCount = r.i32();
  const lastOpPosition = r.vec3();
  const lastOpRadius = r.f32();

  const n1 = r.i32();
  const heightGrid = [];
  for (let i = 0; i < n1; i++) {
    const modified = r.u8();
    if (modified) {
      const level = r.f32();
      const smooth = r.f32();
      heightGrid.push({ modified: true, level, smooth });
    } else {
      heightGrid.push({ modified: false, level: 0, smooth: 0 });
    }
  }

  const n2 = r.i32();
  const paintGrid = [];
  for (let i = 0; i < n2; i++) {
    const modified = r.u8();
    if (modified) {
      const cr = r.f32(), cg = r.f32(), cb = r.f32(), ca = r.f32();
      paintGrid.push({ modified: true, r: cr, g: cg, b: cb, a: ca });
    } else {
      paintGrid.push({ modified: false, r: 0, g: 0, b: 0, a: 0 });
    }
  }

  return { version, operationCount, lastOpPosition, lastOpRadius, heightGrid, paintGrid };
}

export { HASH_CREATOR, HASH_TEXT, HASH_TERRAIN_COMPILER, HASH_TCDATA };
