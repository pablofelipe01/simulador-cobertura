// Compresor ZIP mínimo (deflate) sin dependencias: igual en Windows, macOS y Linux.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const TABLA = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function fechaDos(d) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora, dia };
}

function listar(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listar(p, base) : [p];
  });
}

/** Comprime la carpeta `carpeta` (incluida como raíz del ZIP) en `destino`. */
export function comprimirCarpeta(carpeta, destino) {
  const raiz = path.dirname(carpeta);
  const partes = [];
  const central = [];
  let desplazamiento = 0;
  for (const archivo of listar(carpeta).sort()) {
    const nombre = Buffer.from(path.relative(raiz, archivo).split(path.sep).join("/"), "utf8");
    const datos = readFileSync(archivo);
    const comprimidos = zlib.deflateRawSync(datos, { level: 9 });
    const usarDeflate = comprimidos.length < datos.length;
    const cuerpo = usarDeflate ? comprimidos : datos;
    const crc = crc32(datos);
    const { hora, dia } = fechaDos(statSync(archivo).mtime);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(usarDeflate ? 8 : 0, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(cuerpo.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    partes.push(local, nombre, cuerpo);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(usarDeflate ? 8 : 0, 10);
    c.writeUInt16LE(hora, 12);
    c.writeUInt16LE(dia, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(cuerpo.length, 20);
    c.writeUInt32LE(datos.length, 24);
    c.writeUInt16LE(nombre.length, 28);
    c.writeUInt32LE(desplazamiento, 42);
    central.push(c, nombre);
    desplazamiento += 30 + nombre.length + cuerpo.length;
  }
  const tam = central.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(central.length / 2, 8);
  fin.writeUInt16LE(central.length / 2, 10);
  fin.writeUInt32LE(tam, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  writeFileSync(destino, Buffer.concat([...partes, ...central, fin]));
}
