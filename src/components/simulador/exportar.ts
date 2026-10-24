// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Exportación del escenario (JSON), de los nodos (CSV) y de la simulación para Google Earth (KMZ):
// cobertura, nodos, enlaces, rango de alcance y mediciones de la regla.
import { CLASES, ENLACES } from "@/lib/radio/constantes";
import { aGMS, formatoArea, formatoDistancia, latAMercator } from "@/lib/radio/geo";
import { esDireccional, patronPorId } from "@/lib/radio/patron";
import { resumenRed } from "@/lib/radio/red";
import type { Antena, Escenario, ResultadoSimulacion } from "@/lib/radio/tipos";
import { textoNivel, type UnidadId } from "@/lib/radio/unidades";

import { geojsonAlcance } from "./capa-alcance";
import { ARCOIRIS, COLOR_BAJO_ESCALA, opcionesEscala, pintarCobertura } from "./capa-cobertura";
import { VISTA_DEFECTO, type Vista } from "./estado";
import { resumenMedicion } from "./regla";

export function descargar(nombre: string, datos: Blob) {
  const url = URL.createObjectURL(datos);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function nombreArchivo(base: string) {
  const limpio = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return limpio || "escenario";
}

export function exportarJson(e: Escenario) {
  descargar(`${nombreArchivo(e.nombre)}.json`, new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }));
}

export function exportarCsv(e: Escenario, r: ResultadoSimulacion | null) {
  const filas = [
    ["nombre", "tipo", "lat_wgs84", "lon_wgs84", "lat_gms", "lon_gms", "altura_m", "potencia_dbm", "ganancia_dbi", "perdida_cable_db", "antena", "azimut_grados", "elevacion_grados", "rol", "pasarela", "activa", "alcance_km", "area_servicio_km2", "saltos"],
  ];
  for (const a of e.antenas) {
    const s = r?.antenas.find((x) => x.id === a.id);
    const n = r?.nodos.find((x) => x.id === a.id);
    filas.push([
      a.nombre,
      (a.tipo ?? "antena") === "nodo" ? "nodo" : "nodo antena",
      a.lat.toFixed(6),
      a.lon.toFixed(6),
      aGMS(a.lat, "lat"),
      aGMS(a.lon, "lon"),
      String(a.alturaM),
      String(a.potenciaDbm),
      String(a.gananciaDbi),
      String(a.perdidaCableDb),
      patronPorId(a.patron).nombre,
      esDireccional(a) ? String(a.azimutDeg ?? 0) : "",
      esDireccional(a) ? String(a.elevacionDeg ?? 0) : "",
      a.rol,
      a.pasarela ? "sí" : "no",
      a.activa ? "sí" : "no",
      s ? s.alcanceKm.toFixed(2) : "",
      s ? s.areaServicioKm2.toFixed(2) : "",
      n?.saltos === null || n === undefined ? "" : String(n.saltos),
    ]);
  }
  // Separador «;» y BOM para que Excel en español lo abra con tildes y columnas correctas
  const csv = "﻿" + filas.map((f) => f.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n");
  descargar(`${nombreArchivo(e.nombre)}_nodos.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

/* ───────────── ZIP sin compresión (suficiente para KMZ) ───────────── */

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(d: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABLA_CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(archivos: { nombre: string; datos: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;
  for (const f of archivos) {
    const nombre = enc.encode(f.nombre);
    const crc = crc32(f.datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // sin compresión
    local.setUint32(14, crc, true);
    local.setUint32(18, f.datos.length, true);
    local.setUint32(22, f.datos.length, true);
    local.setUint16(26, nombre.length, true);
    partes.push(new Uint8Array(local.buffer), nombre, f.datos);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, f.datos.length, true);
    c.setUint32(24, f.datos.length, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(c.buffer), nombre);
    desplazamiento += 30 + nombre.length + f.datos.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)].map((p) => p.slice().buffer as ArrayBuffer), { type: "application/vnd.google-earth.kmz" });
}

async function png(lienzo: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/png"));
  if (!blob) throw new Error("No se pudo generar la imagen.");
  return new Uint8Array(await blob.arrayBuffer());
}

/** Reproyecta la imagen (filas en Web Mercator) a latitud lineal, como espera un GroundOverlay de KML. */
function aLatitudLineal(r: ResultadoSimulacion, fuente: HTMLCanvasElement): HTMLCanvasElement {
  const { ancho, alto, caja } = r.malla;
  const ctxF = fuente.getContext("2d")!;
  const datosF = ctxF.getImageData(0, 0, ancho, alto).data;
  const destino = document.createElement("canvas");
  destino.width = ancho;
  destino.height = alto;
  const ctxD = destino.getContext("2d")!;
  const img = ctxD.createImageData(ancho, alto);
  const yN = latAMercator(caja.norte);
  const yS = latAMercator(caja.sur);
  for (let j = 0; j < alto; j++) {
    const lat = caja.norte - ((j + 0.5) / alto) * (caja.norte - caja.sur);
    const fila = Math.min(alto - 1, Math.max(0, Math.floor(((yN - latAMercator(lat)) / (yN - yS)) * alto)));
    img.data.set(datosF.subarray(fila * ancho * 4, (fila + 1) * ancho * 4), j * ancho * 4);
  }
  ctxD.putImageData(img, 0, 0);
  return destino;
}

const SUBTITULO: Record<UnidadId, string> = {
  margen: "Margen sobre la sensibilidad",
  dbm: "Potencia recibida",
  uv: "Tensión en el receptor (50 Ω)",
  dbuvm: "Intensidad de campo",
};

/** Leyenda del mapa de señal según la unidad y la escala de colores elegidas. */
function leyendaPng(r: ResultadoSimulacion, v: Vista): HTMLCanvasElement {
  const rx = { sensibilidadDbm: r.sensibilidadDbm, gananciaRxDbi: r.gananciaRxDbi, frecuenciaMhz: r.frecuenciaMhz };
  const nivel = (dbm: number) => textoNivel(dbm, v.unidad, rx, 0);
  const filas: { color: string; texto: string; rango: string }[] =
    v.escala === "umbral"
      ? [
          { color: v.colorUmbral, texto: "Con señal", rango: `≥ ${nivel(v.umbralDbm)}` },
          { color: CLASES[4].color, texto: "Por debajo", rango: `< ${nivel(v.umbralDbm)}` },
        ]
      : v.escala === "arcoiris"
        ? [{ color: COLOR_BAJO_ESCALA, texto: "Por debajo del mínimo", rango: `< ${nivel(v.escalaMinDbm)}` }]
        : CLASES.map((k) => ({ color: k.color, texto: k.nombre, rango: k.id === "sin" ? `< ${nivel(20 + rx.sensibilidadDbm)}` : `≥ ${nivel(k.minimoDb + rx.sensibilidadDbm)}` }));
  const barra = v.escala === "arcoiris" ? 40 : 0;
  const alto = 52 + barra + filas.length * 24;
  const c = document.createElement("canvas");
  const esc = 2;
  c.width = 250 * esc;
  c.height = alto * esc;
  const ctx = c.getContext("2d")!;
  ctx.scale(esc, esc);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath();
  ctx.roundRect(0, 0, 250, alto, 8);
  ctx.fill();
  ctx.fillStyle = "#2B2F2E";
  ctx.font = "600 15px Arial, sans-serif";
  ctx.fillText("Nivel de señal", 12, 22);
  ctx.font = "11px Arial, sans-serif";
  ctx.fillStyle = "#6F7572";
  ctx.fillText(SUBTITULO[v.unidad], 12, 38);
  if (barra) {
    const g = ctx.createLinearGradient(12, 0, 238, 0);
    ARCOIRIS.forEach((color, i) => g.addColorStop(i / (ARCOIRIS.length - 1), color));
    ctx.fillStyle = g;
    ctx.fillRect(12, 48, 226, 14);
    ctx.fillStyle = "#6F7572";
    ctx.font = "11px Arial, sans-serif";
    ctx.fillText(nivel(v.escalaMinDbm), 12, 76);
    ctx.textAlign = "right";
    ctx.fillText(nivel(v.escalaMaxDbm), 238, 76);
    ctx.textAlign = "left";
  }
  filas.forEach((k, i) => {
    const y = 50 + barra + i * 24;
    ctx.fillStyle = k.color;
    ctx.fillRect(12, y, 26, 16);
    ctx.fillStyle = "#2B2F2E";
    ctx.font = "13px Arial, sans-serif";
    ctx.fillText(k.texto, 46, y + 12.5);
    ctx.fillStyle = "#6F7572";
    ctx.textAlign = "right";
    ctx.fillText(k.rango, 238, y + 12.5);
    ctx.textAlign = "left";
  });
  return c;
}

function torrePng(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 80;
  const ctx = c.getContext("2d")!;
  ctx.scale(2, 2);
  const torre = new Path2D("M16 9 L9.5 38 M16 9 L22.5 38 M11.4 29.5 H20.6 M12.9 22.5 H19.1 M14.3 16 H17.7 M11.4 29.5 L19.1 22.5 M20.6 29.5 L12.9 22.5 M12.9 22.5 L17.7 16 M19.1 22.5 L14.3 16 M7 38 H25 M10.2 3.2 a8 8 0 0 0 0 10.4 M21.8 3.2 a8 8 0 0 1 0 10.4");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4.2;
  ctx.stroke(torre);
  ctx.strokeStyle = "#2B2F2E";
  ctx.lineWidth = 1.8;
  ctx.stroke(torre);
  ctx.beginPath();
  ctx.arc(16, 8.4, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#2B2F2E";
  ctx.fill();
  return c;
}

function equipoPng(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.scale(2, 2);
  const cuerpo = new Path2D("M6 12 h12 a2 2 0 0 1 2 2 v14 a2 2 0 0 1 -2 2 h-12 a2 2 0 0 1 -2 -2 v-14 a2 2 0 0 1 2 -2 Z M15 12 V3");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.stroke(cuerpo);
  ctx.fillStyle = "#3F6F8F";
  ctx.fill(new Path2D("M6 12 h12 a2 2 0 0 1 2 2 v14 a2 2 0 0 1 -2 2 h-12 a2 2 0 0 1 -2 -2 v-14 a2 2 0 0 1 2 -2 Z"));
  ctx.strokeStyle = "#2B2F2E";
  ctx.lineWidth = 1.6;
  ctx.stroke(cuerpo);
  return c;
}

const xml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
/** Color KML (aabbggrr) desde #rrggbb. */
const kmlColor = (hex: string, alfa = "ff") => `${alfa}${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`.toLowerCase();
const num = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

export async function exportarKmz(e: Escenario, r: ResultadoSimulacion, antenas: Antena[], vista: Vista = VISTA_DEFECTO) {
  const enc = new TextEncoder();
  const cobertura = aLatitudLineal(r, pintarCobertura(r, "senal", true, undefined, undefined, opcionesEscala(vista)));
  const porId = new Map(antenas.map((a) => [a.id, a]));
  const { caja } = r.malla;
  const placemarks = antenas
    .map((a) => {
      const s = r.antenas.find((x) => x.id === a.id);
      const n = r.nodos.find((x) => x.id === a.id);
      const campo = (a.tipo ?? "antena") === "nodo";
      const detalle = [
        campo ? "Nodo de campo" : "Nodo antena",
        `Coordenadas: ${aGMS(a.lat, "lat")}, ${aGMS(a.lon, "lon")}`,
        `Altura: ${num(a.alturaM)} m · ${num(a.potenciaDbm, 0)} dBm · ${num(a.gananciaDbi)} dBi`,
        ...(esDireccional(a) ? [`Antena ${patronPorId(a.patron).nombre.toLowerCase()} apuntando a ${num(a.azimutDeg ?? 0, 0)}° (elevación ${num(a.elevacionDeg ?? 0, 0)}°)`] : []),
        a.pasarela ? "Pasarela" : n?.saltos === null || !n ? "Sin ruta a la pasarela" : `${n.saltos} salto(s) a la pasarela`,
        s ? `Alcance con servicio: ${s.alcanceLimitado ? "≥ " : ""}${num(s.alcanceKm, 2)} km · confiable: ${num(s.alcanceConfiableKm, 2)} km · Área: ${num(s.areaServicioKm2)} km²` : campo ? "Participa en la malla (no genera cobertura)" : "No incluido en la simulación",
      ].join("<br/>");
      return `<Placemark><name>${xml(a.nombre)}</name><styleUrl>#${campo ? "equipo" : "torre"}</styleUrl><description><![CDATA[${detalle}]]></description><Point><coordinates>${a.lon},${a.lat},0</coordinates></Point></Placemark>`;
    })
    .join("\n");
  const lineas = r.enlaces
    .filter((l) => l.clase !== "sin" && porId.has(l.a) && porId.has(l.b))
    .map((l) => {
      const a = porId.get(l.a)!;
      const b = porId.get(l.b)!;
      return `<Placemark><name>${xml(`${a.nombre} – ${b.nombre}: ${num(l.margen)} dB`)}</name><styleUrl>#enlace-${l.clase}</styleUrl><LineString><tessellate>1</tessellate><coordinates>${a.lon},${a.lat},0 ${b.lon},${b.lat},0</coordinates></LineString></Placemark>`;
    })
    .join("\n");
  const alcance = geojsonAlcance(r, antenas, null)
    .datos.features.map((f, i) => {
      const clase = f.properties?.clase === "confiable" ? "confiable" : "servicio";
      const coords = f.geometry.coordinates.map((c) => `${c[0]},${c[1]},0`).join(" ");
      return `<Placemark><name>${clase === "confiable" ? "Alcance confiable" : "Alcance con servicio"} ${i + 1}</name><styleUrl>#alcance-${clase}</styleUrl><LineString><tessellate>1</tessellate><coordinates>${coords}</coordinates></LineString></Placemark>`;
    })
    .join("\n");
  const mediciones = (e.mediciones ?? [])
    .filter((m) => m.puntos.length >= 2)
    .map((m) => {
      const res = resumenMedicion(m);
      const area = m.tipo === "area" && m.puntos.length >= 3;
      const coords = (area ? [...m.puntos, m.puntos[0]] : m.puntos).map((p) => `${p[0]},${p[1]},0`).join(" ");
      const texto = area ? `Área: ${formatoArea(res.area)} · perímetro ${formatoDistancia(res.longitud)}` : `Distancia: ${formatoDistancia(res.longitud)}`;
      const geom = area ? `<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>` : `<LineString><tessellate>1</tessellate><coordinates>${coords}</coordinates></LineString>`;
      return `<Placemark><name>${xml(m.nombre)}</name><description>${xml(texto)}</description><styleUrl>#medicion</styleUrl>${geom}</Placemark>`;
    })
    .join("\n");
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>${xml(e.nombre)}</name>
<description>${xml(`Modelo ${e.parametros.modelo === "itm" ? "Longley-Rice (ITM)" : "calibrado contra Radio Mobile"}. ${resumenRed(e.parametros)}.`)}</description>
<Style id="torre"><IconStyle><scale>1.2</scale><Icon><href>torre.png</href></Icon><hotSpot x="0.5" y="0" xunits="fraction" yunits="fraction"/></IconStyle><LabelStyle><scale>0.9</scale></LabelStyle></Style>
<Style id="equipo"><IconStyle><scale>0.9</scale><Icon><href>equipo.png</href></Icon><hotSpot x="0.5" y="0" xunits="fraction" yunits="fraction"/></IconStyle><LabelStyle><scale>0.8</scale></LabelStyle></Style>
<Style id="alcance-servicio"><LineStyle><color>${kmlColor("#FFB25B")}</color><width>2</width></LineStyle></Style>
<Style id="alcance-confiable"><LineStyle><color>${kmlColor("#8BD17C")}</color><width>2</width></LineStyle></Style>
<Style id="medicion"><LineStyle><color>${kmlColor("#1FC8F0")}</color><width>2.5</width></LineStyle><PolyStyle><color>${kmlColor("#1FC8F0", "33")}</color></PolyStyle></Style>
<Style id="enlace-solido"><LineStyle><color>${kmlColor(ENLACES.solido.color)}</color><width>3</width></LineStyle></Style>
<Style id="enlace-inestable"><LineStyle><color>${kmlColor(ENLACES.inestable.color)}</color><width>2.5</width></LineStyle></Style>
<GroundOverlay><name>Cobertura (nivel de señal)</name><color>b4ffffff</color><Icon><href>cobertura.png</href></Icon>
<LatLonBox><north>${caja.norte}</north><south>${caja.sur}</south><east>${caja.este}</east><west>${caja.oeste}</west></LatLonBox></GroundOverlay>
<ScreenOverlay><name>Leyenda</name><Icon><href>leyenda.png</href></Icon><overlayXY x="0" y="0" xunits="fraction" yunits="fraction"/><screenXY x="10" y="40" xunits="pixels" yunits="pixels"/><size x="250" y="0" xunits="pixels" yunits="pixels"/></ScreenOverlay>
<Folder><name>Nodos</name>
${placemarks}
</Folder>
<Folder><name>Enlaces de la malla</name>
${lineas}
</Folder>
<Folder><name>Rango de alcance</name>
${alcance}
</Folder>${
    mediciones
      ? `
<Folder><name>Mediciones</name>
${mediciones}
</Folder>`
      : ""
  }
</Document>
</kml>`;
  const archivo = zip([
    { nombre: "doc.kml", datos: enc.encode(kml) },
    { nombre: "cobertura.png", datos: await png(cobertura) },
    { nombre: "leyenda.png", datos: await png(leyendaPng(r, vista)) },
    { nombre: "torre.png", datos: await png(torrePng()) },
    { nombre: "equipo.png", datos: await png(equipoPng()) },
  ]);
  descargar(`${nombreArchivo(e.nombre)}.kmz`, archivo);
}
