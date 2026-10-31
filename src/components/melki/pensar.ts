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

/**
 * Órdenes que el intérprete de Melki entiende tal cual (el modelo las imita). Pocas y variadas: el pedido entero va a la
 * tarjeta gráfica de un golpe, y en una integrada cada palabra de más es tiempo y carga (v14.1: de 27 a 18).
 */
export const CATALOGO_ORDENES = [
  "ármame una red de 5 millas a la redonda de Barranca de Upía, Meta",
  "ármame una red que cubra 11.226 hectáreas con señal media o mejor en el 95 %",
  "ármame una red sostenible que cubra todo el municipio de Cumaral, Meta",
  "ármame una red para 400 familias en 3 km a la redonda del gateway con un presupuesto de 80 millones",
  "ármame una red de 800 yardas a la redonda de aquí aunque cueste más",
  "pon el gateway en Cumaral",
  "agrega un repetidor a 2 millas al norte del gateway",
  "sube todos los repetidores a 12 m",
  "borra el Repetidor 3",
  "simula",
  "pon 250 personas alrededor de cada repetidor y haz la prueba de estrés",
  "¿cuánto cuesta la red?",
  "optimiza la red al menor costo",
  "ajústamelo sin pasar de 20 m",
  "llévame a Villavicencio",
  "muestra las vías",
  "explícame la red punto por punto",
  "deshaz lo último",
] as const;

/** Las instrucciones del modelo (cortas: en una tarjeta gráfica integrada cada palabra cuesta tiempo). */
export function instruccionesPensar(): string {
  return [
    "Eres el entendimiento de Melki, asistente del Simulador de cobertura de Trama (malla LoRa con MeshCore o Meshtastic para veredas de Colombia).",
    'Responde SOLO este JSON: {"ordenes": [...], "respuesta": "..."}.',
    "ordenes: 0 a 4 órdenes en español con la forma del CATÁLOGO. Copia números, unidades, lugares y nombres de nodos como los dijo la persona; nunca inventes una cifra (si falta el tamaño o el lugar, deja la orden sin él).",
    "respuesta: si es una pregunta, contesta en 1 a 3 frases solo con cifras del ESTADO (si no está el dato, dilo); si hay órdenes, una frase con lo que entendiste. Trata a la persona de usted.",
    "Más barata: «optimiza la red al menor costo». Que funcione mejor: «ajústamelo». Si es ajeno al simulador: ordenes vacío y respuesta diciendo que solo sabes del simulador.",
    `CATÁLOGO:\n${CATALOGO_ORDENES.map((x) => `- ${x}`).join("\n")}`,
  ].join("\n");
}

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/**
 * El estado del simulador en corto para el modelo (lo de estadoParaIA que sirve para entender y responder: la red, la
 * cobertura, los costos, la prueba de estrés y cada nodo en una línea). Las cifras van tal cual están en el estado, así
 * la guardia las reconoce. Hasta `max` caracteres.
 */
export function estadoCompacto(e: Record<string, unknown> | null, max = 1100): string {
  if (!e) return "{}";
  const c: Record<string, unknown> = {};
  for (const k of ["protocolo", "simulado", "gateways", "repetidores", "personas", "personasConectadas", "personasSinCobertura"]) if (e[k] !== undefined && e[k] !== null) c[k] = e[k];
  const centro = objeto(e.mapaCentro);
  if (centro?.lugar) c.lugar = centro.lugar;
  const cob = objeto(e.cobertura);
  if (cob) {
    const a = objeto(cob.areaObjetivo);
    c.cobertura = {
      conServicioPct: cob.conServicioPct,
      senalMediaOMejorPct: cob.senalMediaOMejorPct,
      confiablePct: cob.confiablePct,
      ...(a ? { areaObjetivo: { nombre: a.nombre, areaKm2: a.areaKm2, senalMediaOMejorPct: a.senalMediaOMejorPct } } : {}),
      factibilidad: cob.factibilidad,
    };
  } else if (typeof e.cobertura === "string") c.cobertura = e.cobertura;
  const costos = objeto(e.costos);
  if (costos) c.costos = { inversionTotal: costos.inversionTotal, operacionMes: costos.operacionMes, redCompletaMes: costos.redCompletaMes };
  const est = objeto(e.pruebaEstres);
  if (est) c.pruebaEstres = { personas: est.personas, lesFuncionaPct: est.lesFuncionaPct, capacidadReal: est.capacidadReal, estado: est.estado };
  if (Array.isArray(e.infraestructura))
    c.nodos = e.infraestructura.slice(0, 12).map((n) => {
      const x = objeto(n) ?? {};
      const enl = objeto(x.enlace);
      return [x.nombre, x.alturaAntenaM != null ? `${x.alturaAntenaM} m` : null, x.saltos != null ? `${x.saltos} saltos` : null, x.alcanceKm != null ? `alcance ${x.alcanceKm} km` : null, enl ? `enlace ${enl.margenDb} dB con ${enl.con}` : null].filter(Boolean).join(", ");
    });
  let s = JSON.stringify(c);
  // Si no cabe, primero se van los nodos del final (lo general es lo que más sirve)
  while (s.length > max && Array.isArray(c.nodos) && (c.nodos as string[]).length > 0) {
    c.nodos = (c.nodos as string[]).slice(0, -1);
    s = JSON.stringify(c);
  }
  return s.slice(0, max);
}

/** Los mensajes para el modelo: las instrucciones, el estado del simulador (en corto) y el pedido. */
export function mensajesPensar(pedido: string, estadoSimulador: Record<string, unknown> | null): MensajeChat[] {
  return [
    { role: "system", content: instruccionesPensar() },
    { role: "user", content: `ESTADO: ${estadoCompacto(estadoSimulador)}\nPEDIDO: ${pedido.trim().slice(0, 400)}` },
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
