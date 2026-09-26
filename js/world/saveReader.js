// Valheim string hash — matches the prefab/key ints stored in .chunk ZDOs.
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
const HASH_TERRAIN_COMP = stableHash('_TerrainCompiler');
const HASH_TCDATA = stableHash('TCData');
const FLAG_SMALLPOS = 8192;
const FLAG_ROT = 4096;
const decoder = new TextDecoder();

class Reader {
  constructor(buffer) {
    this.buf = buffer;
    this.view = new DataView(buffer);
    this.pos = 0;
  }

  u8() { return this.view.getUint8(this.pos++); }
  i16() { const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }
  u16() { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  i32() { const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  f32() { const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  skip(n) { this.pos += n; }
  vec3() { return { x: this.f32(), y: this.f32(), z: this.f32() }; }

  count() {
    const n = this.u8();
    return n & 0x80 ? ((n & 0x7f) << 8) | this.u8() : n;
  }

  str() {
    let len = 0, shift = 0, b;
    do {
      b = this.u8();
      len |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    const s = decoder.decode(new Uint8Array(this.buf, this.pos, len));
    this.pos += len;
    return s;
  }

  bytes() {
    const len = this.i32();
    const out = new Uint8Array(this.buf, this.pos, len);
    this.pos += len;
    return out;
  }
}

// Yaw is stored in 0.5° steps; builds are placed on 22.5° steps, so snap near-misses.
function snapYaw(yaw) {
  const nearest = Math.round(yaw / 22.5) * 22.5;
  return Math.abs(yaw - nearest) <= 0.5 ? nearest : yaw;
}

function readYaw(r) {
  const n = r.u16();
  if (n & 0x8000) return (n & 0x7fff) * 0.5;
  const packed = ((n << 16) | r.u16()) >>> 0;
  return ((packed >>> 10) & 1023) * 0.5;
}

function readZDO(r) {
  const flags = r.u16();
  const pos = flags & FLAG_SMALLPOS ? { x: r.i16(), y: 0, z: r.i16() } : r.vec3();
  const zdo = { pos, prefab: r.i32(), yaw: flags & FLAG_ROT ? snapYaw(readYaw(r)) : 0, player: false, text: null, tcdata: null };
  const types = flags & 0xff;
  if (types & 1) r.skip(5); // connection
  if (types & 2) for (let n = r.count(); n > 0; n--) r.skip(8); // floats
  if (types & 4) for (let n = r.count(); n > 0; n--) r.skip(16); // vec3s
  if (types & 8) for (let n = r.count(); n > 0; n--) r.skip(20); // quats
  if (types & 16) for (let n = r.count(); n > 0; n--) r.skip(8); // ints
  if (types & 32) {
    for (let n = r.count(); n > 0; n--) {
      if (r.i32() === HASH_CREATOR) zdo.player = true;
      r.skip(8);
    }
  }
  if (types & 64) {
    for (let n = r.count(); n > 0; n--) {
      const key = r.i32(), val = r.str();
      if (key === HASH_TEXT) zdo.text = val;
    }
  }
  if (types & 128) {
    for (let n = r.count(); n > 0; n--) {
      const key = r.i32(), val = r.bytes();
      if (key === HASH_TCDATA) zdo.tcdata = val;
    }
  }
  return zdo;
}

function readChunk(buffer) {
  const r = new Reader(buffer);
  r.i16(); // world version
  const zdos = [];
  for (let n = r.i32(); n > 0; n--) zdos.push(readZDO(r));
  return zdos;
}

export function cleanSignText(text) {
  return (text || '').replace(/<[^>]*>/g, '').trim();
}

// files: File objects or {name, arrayBuffer()} entries from a zip.
export async function readSave(files, onProgress = () => {}) {
  const chunks = files.filter(f => f.name.endsWith('.chunk'));
  if (!chunks.length) throw new Error('No .chunk files found — pick every file in the world folder, or a zip of it.');
  const zdos = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i % 20 === 0) onProgress(`Reading chunk ${i + 1} of ${chunks.length}`);
    zdos.push(...readChunk(await chunks[i].arrayBuffer()));
  }
  const signs = zdos.filter(z => z.player && z.text && cleanSignText(z.text));
  const terrainComps = zdos.filter(z => z.prefab === HASH_TERRAIN_COMP && z.tcdata);
  return { zdos, signs, terrainComps, chunkCount: chunks.length };
}

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

// TerrainComp: per-vertex height deltas and paint over a 65 x 65 grid centred on the zone.
export async function readTerrainEdits(zdo) {
  const r = new Reader(await gunzip(zdo.tcdata));
  r.skip(4 + 4 + 12 + 4); // version, op count, last op point, last op radius
  const edits = new Map();
  const at = i => {
    if (!edits.has(i)) edits.set(i, { x: zdo.pos.x + (i % 65) - 32, z: zdo.pos.z + Math.floor(i / 65) - 32, level: 0, paint: null });
    return edits.get(i);
  };
  for (let i = 0, n = r.i32(); i < n; i++) {
    if (r.u8()) at(i).level = r.f32() + r.f32(); // level + smooth
  }
  for (let i = 0, n = r.i32(); i < n; i++) {
    if (r.u8()) {
      const p = [r.f32(), r.f32(), r.f32()];
      r.skip(4);
      at(i).paint = p;
    }
  }
  return [...edits.values()];
}
