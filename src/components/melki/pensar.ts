// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Cómo piensa Melki con la IA local cuando su intérprete no entendió: el modelo recibe el pedido, un catálogo de las
// órdenes que el simulador sabe hacer y el estado de la red, y devuelve un JSON con órdenes en español (que el
// intérprete de Melki verifica antes de hacerlas) o una respuesta corta. Una guardia revisa las cifras: un número que
// no esté en lo que dijo la persona ni en el estado del simulador es inventado, y esa orden o respuesta no se usa.
import type { MensajeChat } from "./ia-local";

/** La forma del JSON que devuelve el modelo. */
export const ESQUEMA_PENSAR = {
  type: "object",
  properties: {
    ordenes: { type: "array", items: { type: "string" }, maxItems: 4 },
    respuesta: { type: "string" },
  },
  required: ["ordenes", "respuesta"],
} as const;

/** Órdenes que el intérprete de Melki entiende tal cual (el modelo las imita). */
export const CATALOGO_ORDENES = [
  "ármame una red de 5 millas a la redonda de Barranca de Upía, Meta",
  "ármame una red que cubra 11.226 hectáreas con señal media o mejor en el 95 %",
  "ármame una red sostenible que cubra todo el municipio de Cumaral, Meta",
  "ármame una red para 400 familias en 3 km a la redonda del gateway con un presupuesto de 80 millones",
  "cubre un círculo de 10 km de diámetro alrededor del Repetidor 2 con señal estable",
  "cubre un área de 2 x 1 millas con respaldo",
  "ármame una red de 800 yardas a la redonda de aquí aunque cueste más",
  "pon el gateway en 4.5149, -73.0024",
  "pon el gateway en Cumaral",
  "agrega un repetidor a 2 millas al norte del gateway",
  "sube el Repetidor 2 a 12 m",
  "sube todos los repetidores a 12 m",
  "borra el Repetidor 3",
  "borra todas las personas",
  "simula",
  "puebla la zona con 250 personas",
  "pon 250 personas alrededor de cada repetidor y haz la prueba de estrés",
  "¿hasta cuántos pagos aguanta?",
  "¿cuánto cuesta la red?",
  "optimiza la red al menor costo",
  "ajústamelo sin pasar de 20 m",
  "llévame a Villavicencio",
  "muestra las vías",
  "oculta las vías",
  "explícame la red punto por punto",
  "cambia a Meshtastic",
  "deshaz lo último",
] as const;

/** Las instrucciones del modelo (cortas: en una tarjeta gráfica integrada cada palabra cuesta tiempo). */
export function instruccionesPensar(): string {
  return [
    "Eres el entendimiento de Melki, el asistente del Simulador de cobertura de la red Trama (malla de radio LoRa con MeshCore o Meshtastic para veredas sin señal en Colombia).",
    'Respondes SOLO un JSON: {"ordenes": [...], "respuesta": "..."}.',
    "«ordenes»: de 0 a 4 órdenes en español, cada una completa y con la forma de las del CATÁLOGO (el simulador las verifica antes de hacerlas). Copia los números, las unidades (km, metros, millas, yardas, pies, cuadras, hectáreas), los lugares y los nombres de nodos tal como los dijo la persona. Nunca inventes una cifra que no dijo: si falta el tamaño o el lugar, deja la orden sin él (el simulador lo pregunta).",
    "«respuesta»: si es una pregunta, contéstala corto (una a tres frases) usando SOLO las cifras del ESTADO; si el dato no está, dilo. Si hay órdenes, una frase corta con lo que entendiste. Trata a la persona de usted.",
    "Si pide una red más barata o económica: «optimiza la red al menor costo». Si pide que funcione mejor o con más señal: «ajústamelo». Si habla de algo ajeno al simulador, ordenes vacío y en respuesta que fuiste diseñado para el simulador.",
    `CATÁLOGO:\n${CATALOGO_ORDENES.map((x) => `- ${x}`).join("\n")}`,
  ].join("\n");
}

/** Los mensajes para el modelo: las instrucciones, el estado del simulador (recortado) y el pedido. */
export function mensajesPensar(pedido: string, estadoSimulador: Record<string, unknown> | null): MensajeChat[] {
  const estado = estadoSimulador ? JSON.stringify(estadoSimulador).slice(0, 2400) : "{}";
  return [
    { role: "system", content: instruccionesPensar() },
    { role: "user", content: `ESTADO: ${estado}\nPEDIDO: ${pedido.trim().slice(0, 600)}` },
  ];
}

export type Pensamiento = { ordenes: string[]; respuesta: string };

/** Lee el JSON del modelo (aunque venga envuelto en texto o en un bloque de código). */
export function leerPensamiento(texto: string): Pensamiento | null {
  const ini = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (ini < 0 || fin <= ini) return null;
  try {
    const v = JSON.parse(texto.slice(ini, fin + 1)) as { ordenes?: unknown; respuesta?: unknown };
    const ordenes = Array.isArray(v.ordenes) ? v.ordenes.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter((x) => x.length >= 3 && x.length <= 300).slice(0, 4) : [];
    const respuesta = typeof v.respuesta === "string" ? v.respuesta.trim().slice(0, 700) : "";
    return { ordenes, respuesta };
  } catch {
    return null;
  }
}

/** Los números de un texto, normalizados («11.226» → 11226, «95,6» → 95.6, «4.5149» → 4.5149). */
export function numerosDe(texto: string): number[] {
  const salida: number[] = [];
  for (const m of texto.matchAll(/-?\d+(?:[.,]\d+)*/g)) {
    const s = m[0];
    let v: number;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) v = Number(s.replace(/\./g, "").replace(",", "."));
    else if (/^-?\d{1,3}(,\d{3}){2,}(\.\d+)?$/.test(s)) v = Number(s.replace(/,/g, ""));
    else v = Number(s.replace(",", "."));
    if (Number.isFinite(v)) salida.push(v);
  }
  return salida;
}

/**
 * Las cifras de `texto` que no salen de las fuentes (lo que dijo la persona y el estado del simulador). Vale una cifra
 * redondeada de la fuente (95,6 → 96 o 95,6) y los pesos en millones (248.300.000 → 248 o 248,3); sin `redondeo`
 * (para las órdenes), solo la cifra exacta. Hasta un «5 km» que no se dijo es inventado: el tamaño de una red lo decide
 * la persona, no el modelo.
 */
export function cifrasInventadas(texto: string, fuentes: string[], redondeo = true): number[] {
  const conocidas = new Set<string>();
  const sumar = (v: number) => {
    conocidas.add(String(v));
    conocidas.add(String(Math.abs(v)));
    if (!redondeo) return;
    conocidas.add(String(Math.round(v)));
    conocidas.add(String(Math.round(v * 10) / 10));
  };
  for (const f of fuentes)
    for (const v of numerosDe(f)) {
      sumar(v);
      // Pesos dichos en millones o en miles de millones («248 millones», «$1,2 mil M») y miles («15 mil»)
      if (redondeo && Math.abs(v) >= 1e5) {
        sumar(Math.round(v / 1e6));
        sumar(Math.round(v / 1e5) / 10);
        sumar(Math.round(v / 1e8) / 10);
        sumar(Math.round(v / 1e3));
      }
    }
  return numerosDe(texto).filter((v) => !conocidas.has(String(v)) && !conocidas.has(String(Math.abs(v))));
}
