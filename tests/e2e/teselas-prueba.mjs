// Teselas sintéticas para las pruebas: no dependen de internet ni de datos reales.
// Mapa base: verde con textura. Relieve (Terrarium): llanura a 250 m con un cerro y ondulaciones.
import zlib from "node:zlib";

const TABLA = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function bloque(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo), datos]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([largo, td, c]);
}
function png(rgb) {
  const crudo = Buffer.alloc(256 * (1 + 256 * 3));
  for (let j = 0; j < 256; j++) {
    crudo[j * 769] = 0;
    rgb.copy(crudo, j * 769 + 1, j * 768, (j + 1) * 768);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(256, 0);
  ihdr.writeUInt32BE(256, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloque("IHDR", ihdr), bloque("IDAT", zlib.deflateSync(crudo)), bloque("IEND", Buffer.alloc(0))]);
}

function latLon(z, x, y, i, j) {
  const n = 256 * 2 ** z;
  const lon = ((x * 256 + i + 0.5) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y * 256 + j + 0.5)) / n))) * 180) / Math.PI;
  return [lat, lon];
}

export function elevacion(lat, lon) {
  const cerro = 650 * Math.exp(-((lat - 4.33) ** 2 + (lon + 73.56) ** 2) / 0.004);
  return 250 + cerro + 25 * Math.sin(lat * 95) * Math.cos(lon * 80);
}

export function teselaRelieve(z, x, y) {
  const rgb = Buffer.alloc(256 * 256 * 3);
  for (let j = 0; j < 256; j++)
    for (let i = 0; i < 256; i++) {
      const h = elevacion(...latLon(z, x, y, i, j)) + 32768;
      const r = Math.floor(h / 256);
      const g = Math.floor(h - r * 256);
      const b = Math.round((h - r * 256 - g) * 256) & 255;
      rgb.set([r, g, b], (j * 256 + i) * 3);
    }
  return png(rgb);
}

export function teselaMapa(z, x, y) {
  const rgb = Buffer.alloc(256 * 256 * 3);
  for (let j = 0; j < 256; j++)
    for (let i = 0; i < 256; i++) {
      const [lat, lon] = latLon(z, x, y, i, j);
      const t = Math.min(1, Math.max(0, (elevacion(lat, lon) - 250) / 600));
      const ruido = ((i * 7919 + j * 104729 + x * 31 + y * 17) % 23) - 11;
      rgb.set([98 - 30 * t + ruido, 124 - 30 * t + ruido, 72 - 15 * t + ruido], (j * 256 + i) * 3);
    }
  return png(rgb);
}

/** Desvía las teselas externas (mapa base y relieve) a las sintéticas. */
export async function desviarTeselas(context) {
  const cache = new Map();
  await context.route(/arcgisonline\.com|openstreetmap\.org|opentopomap\.org|elevation-tiles-prod/, async (route) => {
    const u = route.request().url();
    let m = u.match(/terrarium\/(\d+)\/(\d+)\/(\d+)/);
    let clave;
    let crear;
    if (m) {
      clave = `d${m[1]}/${m[2]}/${m[3]}`;
      crear = () => teselaRelieve(+m[1], +m[2], +m[3]);
    } else if ((m = u.match(/MapServer\/tile\/(\d+)\/(\d+)\/(\d+)/))) {
      if (u.includes("Reference")) return route.fulfill({ status: 404, body: "" });
      clave = `m${m[1]}/${m[3]}/${m[2]}`;
      crear = () => teselaMapa(+m[1], +m[3], +m[2]);
    } else if ((m = u.match(/(?:openstreetmap|opentopomap)\.org\/(\d+)\/(\d+)\/(\d+)/))) {
      clave = `m${m[1]}/${m[2]}/${m[3]}`;
      crear = () => teselaMapa(+m[1], +m[2], +m[3]);
    } else return route.fulfill({ status: 404, body: "" });
    if (!cache.has(clave)) cache.set(clave, crear());
    return route.fulfill({ status: 200, headers: { "content-type": "image/png", "access-control-allow-origin": "*" }, body: cache.get(clave) });
  });
}
