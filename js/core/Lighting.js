import { load, save } from './storage.js';
import { DEG } from './geometry.js';

const DEFAULTS = { roofs: true, azimuth: 300, elevation: 40, strength: 0.4 };
const ROOF_SLOPE = 30; // nominal: one roof asset stands in for its 26°, 45° and 67° variants
const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

// One directional light, fixed to the world like the sun. It shades roof faces by the way they
// slope and lights the terrain hillshade.
export class Lighting {
  constructor(bus) {
    this.bus = bus;
    this.settings = { ...DEFAULTS, ...load('lighting', {}) };
  }

  set(key, value) {
    this.settings[key] = value;
    save('lighting', this.settings);
    this.bus.emit('lighting:changed', key);
    this.bus.emit('render');
  }

  get compass() {
    return POINTS[Math.round(this.settings.azimuth / 22.5) % 16];
  }

  // Unit vector towards the light: x east, y north, z up. Azimuth is the bearing the light comes from.
  get vector() {
    const a = this.settings.azimuth * DEG, e = this.settings.elevation * DEG;
    return { x: Math.sin(a) * Math.cos(e), y: Math.cos(a) * Math.cos(e), z: Math.sin(e) };
  }

  // How much brighter (+) or darker (-) a roof face is than flat ground, for a face sloping
  // down towards (dx, dy) in plan coordinates (y south).
  faceShade(dx, dy) {
    const L = this.vector, s = ROOF_SLOPE * DEG;
    const n = { x: dx * Math.sin(s), y: -dy * Math.sin(s), z: Math.cos(s) };
    return n.x * L.x + n.y * L.y + n.z * L.z - L.z;
  }
}
