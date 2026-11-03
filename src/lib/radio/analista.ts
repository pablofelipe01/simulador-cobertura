// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El analista de Melki: evalúa una red diseñada como lo haría un ingeniero de radio con el documento de Trama en la
// mano. Mide cobertura, costo (por km² cubierto y por usuario), enlaces, saltos, capacidad del gateway y presupuesto;
// la compara con el dimensionamiento del documento; da un veredicto (óptima, viable con reservas o insuficiente) y
// recomendaciones acotadas: cada una con su costo, sin pasarse de la meta, del presupuesto ni de torres de 30 m, y
// sin gateways de más (solo los que pida la capacidad). Todas las cifras salen del cálculo; nada se inventa.
import { numeroLocal, porTexto, tx } from "../idioma";
import { ENLACES } from "./constantes";
import { CAPACIDAD_TRAMA, costoRedTrama, PRECIOS, SF_TRAMA, TERRENOS_TRAMA, pesosTrama, type CostoRed, type SfTrama, type TerrenoTrama } from "./trama";

export type Veredicto = "optima" | "reservas" | "insuficiente";

export type IdRecomendacion = "economica" | "meta" | "torres" | "enlaces" | "radios" | "sitio" | "respaldo" | "presupuesto";

export type Recomendacion = { id: IdRecomendacion; texto: string; costoCop?: number };

export type EntradaAnalisis = {
  /** Área objetivo (km²), meta y cobertura lograda (% del área con la señal pedida). */
  areaKm2: number;
  metaPct: number;
  coberturaPct: number;
  /** La señal pedida, en palabras («señal media o mejor»). */
  clases: string;
  respaldo: boolean;
  /** La red de esta área: gateways y repetidores (los nuevos y los que ya estaban). */
  gateways: number;
  repetidores: number;
  /** Lo que puso el diseño (lo que se compra con el presupuesto; lo que ya estaba no se vuelve a pagar). */
  nuevos: { gateways: number; repetidores: number };
  /** Altura de las torres de los repetidores del diseño (m). */
  alturaM: number;
  /** Margen del enlace de cada repetidor del diseño con la red (dB). */
  enlacesDb: number[];
  maxSaltos: number;
  limiteSaltos: number;
  /** Repetidores sin ruta al gateway en la simulación. */
  sinRuta: number;
  /** Repetidores que son paso obligado de otros (si fallan, una parte de la red se queda sin salida). */
  criticos: number;
  /** Lo que hizo el diseño: repetidores que sobraban y se quitaron, si frenó y la opción económica. */
  podados: number;
  frenado: { minPct: number; mejorPct: number } | null;
  economica: { repetidores: number; coberturaPct: number } | null;
  /** El repetidor que menos aporta por sí solo (% del área que se perdería sin él). */
  aporteMin: { nombre: string; pct: number } | null;
  usuarios: { n: number; quienes: string } | null;
  presupuestoCop: number | null;
  sf: SfTrama;
  logistica: number;
  departamento: string | null;
  terreno: TerrenoTrama | null;
};

export type AnalisisRed = {
  veredicto: Veredicto;
  titulo: string;
  hallazgos: string[];
  recomendaciones: Recomendacion[];
  costo: CostoRed;
  /** Radios de más en el gateway (por la capacidad) y su costo. */
  radiosExtra: number;
  costoRadiosExtra: number;
  /** Inversión total (con las radios de más) y por km² cubierto. */
  inversion: number;
  costoKm2: number;
  costoUsuario: number | null;
  capacidad: { usuarios: number; radios: number; sitios: number; capacidadSitio: number; usoPct: number } | null;
  referencia: { repetidores: number; radioKm: number; terreno: string } | null;
};

const pct = (x: number) => {
  const v = Math.floor(x * 10) / 10;
  return tx(`${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`, `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`);
};
const km2 = (x: number) => `${numeroLocal(x, { maximumFractionDigits: x >= 100 ? 0 : 1 })} km²`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
/** «familias» → «familia», «hogares» → «hogar», «sensores» → «sensor». */
const singular = (q: string) => porTexto(q, (s) => (/[oa]res$/.test(s) ? s.slice(0, -2) : s.replace(/s$/, "")));
/** En inglés: «families» → «family», «households» → «household», «people» → «person». */
const singularEn = (q: string) => porTexto(q, (s) => (s === "people" ? "person" : /ies$/.test(s) ? `${s.slice(0, -3)}y` : s.replace(/s$/, "")));

/** Cuánto cuesta un repetidor puesto (equipo, instalación y transporte, con la logística de la región). */
export function costoRepetidorInstalado(logistica = 1): number {
  const c = costoRedTrama(0, 1, 0, "xiao", logistica);
  return c.inversion.total;
}

/** Cuánto cuesta el sitio de un gateway puesto (con una radio, Starlink, instalación y transporte). */
export function costoGatewayInstalado(logistica = 1): number {
  return costoRedTrama(1, 0, 0, "xiao", logistica).inversion.total;
}

/**
 * Cuántos repetidores caben en un presupuesto (pesos), contando el sitio del gateway si hay que ponerlo y las radios
 * de más que pida la gente. Null si el presupuesto no alcanza ni para el gateway.
 */
export function repetidoresEnPresupuesto(presupuestoCop: number, gatewayNuevo: boolean, logistica = 1, radiosExtra = 0): number | null {
  const fijo = (gatewayNuevo ? costoGatewayInstalado(logistica) : 0) + radiosExtra * PRECIOS.radio;
  if (presupuestoCop < fijo) return null;
  return Math.floor((presupuestoCop - fijo) / costoRepetidorInstalado(logistica));
}

/** Radios (frecuencias) que necesita la gente en el gateway y sitios de gateway que eso exige. */
export function capacidadPara(usuarios: number, sf: SfTrama): { radios: number; sitios: number; porRadio: number; porSitio: number } {
  const porRadio = SF_TRAMA[sf].usuariosFrecuencia;
  const radios = Math.max(1, Math.ceil(usuarios / porRadio));
  return { radios, sitios: Math.ceil(radios / CAPACIDAD_TRAMA.radiosPorSitio), porRadio, porSitio: porRadio * CAPACIDAD_TRAMA.radiosPorSitio };
}

/** El SF del preset llevado a la tabla de capacidad de Trama (9, 10 u 11). */
export function sfTrama(sf: number): SfTrama {
  return sf <= 9 ? 9 : sf === 10 ? 10 : 11;
}

export function analizarRed(e: EntradaAnalisis): AnalisisRed {
  const cumplida = e.coberturaPct >= e.metaPct - 1e-6;
  const hallazgos: string[] = [];
  const recomendaciones: Recomendacion[] = [];
  let veredicto: Veredicto = "optima";
  const bajar = (v: Veredicto) => {
    if (v === "insuficiente" || (v === "reservas" && veredicto === "optima")) veredicto = v;
  };

  // Capacidad: una radio del gateway por cada 150 usuarios (SF11), hasta 4 radios por sitio
  let capacidad: AnalisisRed["capacidad"] = null;
  let radiosExtra = 0;
  if (e.usuarios) {
    const c = capacidadPara(e.usuarios.n, e.sf);
    const capacidadSitio = Math.max(1, e.gateways) * c.porSitio;
    capacidad = { usuarios: e.usuarios.n, radios: c.radios, sitios: c.sitios, capacidadSitio, usoPct: (100 * e.usuarios.n) / capacidadSitio };
    radiosExtra = Math.max(0, Math.min(c.radios, Math.max(1, e.gateways) * CAPACIDAD_TRAMA.radiosPorSitio) - Math.max(1, e.gateways));
  }
  const costo = costoRedTrama(e.gateways, e.repetidores, e.usuarios?.n ?? 0, "xiao", e.logistica);
  const costoRadiosExtra = radiosExtra * PRECIOS.radio;
  const inversion = costo.inversion.total + costoRadiosExtra;
  const infra = inversion - costo.inversion.personas;
  const cubiertoKm2 = Math.max(1e-6, (e.areaKm2 * e.coberturaPct) / 100);
  const costoKm2 = infra / cubiertoKm2;
  const costoUsuario = e.usuarios ? inversion / e.usuarios.n : null;

  // 1) Cobertura y optimización
  if (e.podados > 0)
    hallazgos.push(
      tx(
        `Optimización: quité ${plural(e.podados, "repetidor que sobraba", "repetidores que sobraban")} (su área ya la cubrían otros), sin bajar de la meta ni debilitar ningún enlace.`,
        `Optimization: I removed ${plural(e.podados, "spare repeater", "spare repeaters")} (others already covered their area), without dropping below the target or weakening any link.`,
      ),
    );
  else if (e.aporteMin && e.repetidores > 1)
    hallazgos.push(
      tx(
        `Optimización: no sobra ningún repetidor; el que menos aporta (${e.aporteMin.nombre}) cubre él solo el ${pct(e.aporteMin.pct)} del área.`,
        `Optimization: no repeater is redundant; the one that contributes least (${e.aporteMin.nombre}) covers ${pct(e.aporteMin.pct)} of the area on its own.`,
      ),
    );
  if (e.frenado) {
    bajar("insuficiente");
    hallazgos.push(
      tx(
        `Freno de rendimiento: me detuve en el ${pct(e.coberturaPct)} porque lo que faltaba eran huecos pequeños; el mejor repetidor siguiente cubría apenas el ${pct(e.frenado.mejorPct)} del área (el mínimo que acepto es ${pct(e.frenado.minPct)}).`,
        `Efficiency brake: I stopped at ${pct(e.coberturaPct)} because what was missing were small gaps; the next best repeater covered only ${pct(e.frenado.mejorPct)} of the area (the minimum I accept is ${pct(e.frenado.minPct)}).`,
      ),
    );
  } else if (!cumplida) bajar("insuficiente");

  // 2) Enlaces y saltos
  const firme = e.enlacesDb.length ? Math.min(...e.enlacesDb) : null;
  const debiles = e.enlacesDb.filter((m) => m < ENLACES.solido.minimoDb).length;
  if (debiles) bajar("reservas");
  if (e.sinRuta) bajar("insuficiente");
  if (e.maxSaltos >= e.limiteSaltos && e.repetidores) bajar("reservas");
  const enlaceTxt =
    firme === null
      ? ""
      : debiles
        ? tx(
            `${plural(debiles, "enlace queda débil", "enlaces quedan débiles")} (menos de ${ENLACES.solido.minimoDb} dB; el peor, ${Math.round(firme)} dB)`,
            `${plural(debiles, "link remains weak", "links remain weak")} (under ${ENLACES.solido.minimoDb} dB; the worst, ${Math.round(firme)} dB)`,
          )
        : tx(`enlaces de al menos ${Math.round(firme)} dB (firmes)`, `all links of at least ${Math.round(firme)} dB (firm)`);
  if (enlaceTxt || e.repetidores) {
    const alTope = e.maxSaltos >= e.limiteSaltos && e.repetidores;
    const partes = [
      enlaceTxt,
      tx(`máximo ${plural(e.maxSaltos, "salto", "saltos")} al gateway (límite ${e.limiteSaltos}${alTope ? ", al tope" : ""})`, `at most ${plural(e.maxSaltos, "hop", "hops")} to the gateway (limit ${e.limiteSaltos}${alTope ? ", at the limit" : ""})`),
      e.sinRuta ? tx(`${plural(e.sinRuta, "repetidor sin ruta", "repetidores sin ruta")} al gateway`, `${plural(e.sinRuta, "repeater without a route", "repeaters without a route")} to the gateway`) : "",
      e.criticos ? tx(`${plural(e.criticos, "repetidor es paso obligado", "repetidores son paso obligado")} de otros`, `${plural(e.criticos, "repeater is a mandatory pass-through", "repeaters are mandatory pass-throughs")} for others`) : "",
    ]
      .filter(Boolean)
      .join("; ");
    hallazgos.push(tx(`Enlaces: ${partes}.`, `Links: ${partes}.`));
  }

  // 3) Costo
  const conRadios = radiosExtra ? tx(`, con ${plural(radiosExtra, "radio de más", "radios de más")} en el gateway`, `, with ${plural(radiosExtra, "extra radio", "extra radios")} at the gateway`) : "";
  hallazgos.push(
    tx(
      `Costo: inversión de unos ${pesosTrama(inversion)}${conRadios} (${pesosTrama(costoKm2)} por km² cubierto${costoUsuario !== null ? `, ${pesosTrama(costoUsuario)} por ${singular(e.usuarios!.quienes)}` : ""}) y unos ${pesosTrama(costo.mensual.total)} al mes de operación.`,
      `Cost: an investment of about ${pesosTrama(inversion)}${conRadios} (${pesosTrama(costoKm2)} per km² covered${costoUsuario !== null ? `, ${pesosTrama(costoUsuario)} per ${singularEn(e.usuarios!.quienes)}` : ""}) and about ${pesosTrama(costo.mensual.total)} per month to operate.`,
    ),
  );

  // 4) Capacidad
  if (capacidad && e.usuarios) {
    const q = e.usuarios.quienes;
    const porRadio = SF_TRAMA[e.sf].usuariosFrecuencia;
    if (capacidad.sitios > Math.max(1, e.gateways)) {
      bajar("insuficiente");
      hallazgos.push(
        tx(
          `Capacidad: ${numeroLocal(e.usuarios.n)} ${q} piden ${capacidad.radios} radios (una por cada ${porRadio} con SF${e.sf}); un sitio admite ${CAPACIDAD_TRAMA.radiosPorSitio}, así que hacen falta ${capacidad.sitios} sitios de gateway.`,
          `Capacity: ${numeroLocal(e.usuarios.n)} ${q} need ${capacidad.radios} radios (one per ${porRadio} with SF${e.sf}); a site takes ${CAPACIDAD_TRAMA.radiosPorSitio}, so ${capacidad.sitios} gateway sites are needed.`,
        ),
      );
      const faltan = capacidad.sitios - Math.max(1, e.gateways);
      const c = costoGatewayInstalado(e.logistica) + (CAPACIDAD_TRAMA.radiosPorSitio - 1) * PRECIOS.radio;
      recomendaciones.push({
        id: "sitio",
        texto: tx(
          `${faltan === 1 ? "Un sitio de gateway más" : `${faltan} sitios de gateway más`} con ${CAPACIDAD_TRAMA.radiosPorSitio} radios (unos ${pesosTrama(c * faltan)}): es lo único que justifica otro gateway; la cobertura ya está.`,
          `${faltan === 1 ? "One more gateway site" : `${faltan} more gateway sites`} with ${CAPACIDAD_TRAMA.radiosPorSitio} radios (about ${pesosTrama(c * faltan)}): it is the only thing that justifies another gateway; the coverage is already there.`,
        ),
        costoCop: c * faltan,
      });
    } else {
      if (capacidad.usoPct > 85) bajar("reservas");
      hallazgos.push(
        tx(
          `Capacidad: ${numeroLocal(e.usuarios.n)} ${q} caben con ${plural(capacidad.radios, "radio", "radios")} en el gateway (una por cada ${porRadio} con SF${e.sf}; el sitio admite ${CAPACIDAD_TRAMA.radiosPorSitio}, ${numeroLocal(capacidad.capacidadSitio)} en total): queda usado el ${pct(capacidad.usoPct)}.`,
          `Capacity: ${numeroLocal(e.usuarios.n)} ${q} fit with ${plural(capacidad.radios, "radio", "radios")} at the gateway (one per ${porRadio} with SF${e.sf}; the site takes ${CAPACIDAD_TRAMA.radiosPorSitio}, ${numeroLocal(capacidad.capacidadSitio)} in total): ${pct(capacidad.usoPct)} of it is in use.`,
        ),
      );
      if (radiosExtra)
        recomendaciones.push({
          id: "radios",
          texto: tx(
            `Ponga ${plural(radiosExtra, "radio más", "radios más")} en el gateway (Heltec T114 con antena, unos ${pesosTrama(costoRadiosExtra)}): ya está sumado en la inversión.`,
            `Add ${plural(radiosExtra, "more radio", "more radios")} at the gateway (Heltec T114 with antenna, about ${pesosTrama(costoRadiosExtra)}): it's already included in the investment.`,
          ),
          costoCop: costoRadiosExtra,
        });
    }
  }
  // Muchos repetidores colgados de un solo sitio: el diseño de Trama reparte hasta 19 celdas por sitio
  if (e.repetidores > CAPACIDAD_TRAMA.celdasPorSitio * Math.max(1, e.gateways)) {
    bajar("reservas");
    hallazgos.push(
      tx(
        `Escala: ${e.repetidores} repetidores para ${plural(Math.max(1, e.gateways), "gateway", "gateways")}; el documento de Trama planea hasta ${CAPACIDAD_TRAMA.celdasPorSitio} por sitio (dos anillos), porque todo el tráfico sale por el gateway.`,
        `Scale: ${e.repetidores} repeaters for ${plural(Math.max(1, e.gateways), "gateway", "gateways")}; the Trama document plans up to ${CAPACIDAD_TRAMA.celdasPorSitio} per site (two rings), because all the traffic goes out through the gateway.`,
      ),
    );
  }

  // 5) Presupuesto (lo nuevo: lo que ya estaba en el área no se vuelve a comprar)
  const nueva = costoRedTrama(e.nuevos.gateways, e.nuevos.repetidores, e.usuarios?.n ?? 0, "xiao", e.logistica).inversion.total + costoRadiosExtra;
  const pasado = e.presupuestoCop !== null && nueva > e.presupuestoCop * 1.0001;
  if (e.presupuestoCop) {
    const uso = (100 * nueva) / e.presupuestoCop;
    if (pasado) {
      bajar("insuficiente");
      hallazgos.push(
        tx(
          `Presupuesto: lo nuevo cuesta ${pesosTrama(nueva)} y el presupuesto es ${pesosTrama(e.presupuestoCop)} (se pasa en ${pesosTrama(nueva - e.presupuestoCop)}).`,
          `Budget: the new equipment costs ${pesosTrama(nueva)} and the budget is ${pesosTrama(e.presupuestoCop)} (over by ${pesosTrama(nueva - e.presupuestoCop)}).`,
        ),
      );
    } else hallazgos.push(tx(`Presupuesto: lo nuevo usa ${pesosTrama(nueva)} de ${pesosTrama(e.presupuestoCop)} (el ${pct(uso)}).`, `Budget: the new equipment uses ${pesosTrama(nueva)} of ${pesosTrama(e.presupuestoCop)} (${pct(uso)}).`));
  }

  // 6) La referencia del documento de Trama (celdas hexagonales con el alcance supuesto por terreno)
  let referencia: AnalisisRed["referencia"] = null;
  if (e.terreno) {
    const t = TERRENOS_TRAMA[e.terreno];
    const radioKm = t.radioKm * SF_TRAMA[e.sf].factorRadio;
    const ref = Math.max(1, Math.ceil(e.areaKm2 / (2.598 * radioKm * radioKm)));
    const terreno = porTexto(t.nombre, (x) => x.toLowerCase());
    referencia = { repetidores: ref, radioKm, terreno };
    const comparacion =
      e.repetidores <= ref
        ? tx("la red usa lo mismo o menos", "the network uses the same or fewer")
        : tx(
            `aquí, con el relieve real y torres de ${e.alturaM} m, hicieron falta ${e.repetidores}${e.alturaM < 12 ? "; con torres más altas se acercaría" : ""}`,
            `here, with the real terrain and ${e.alturaM} m towers, ${e.repetidores} were needed${e.alturaM < 12 ? "; with taller towers it would get closer" : ""}`,
          );
    hallazgos.push(
      tx(
        `Referencia de Trama: para ${km2(e.areaKm2)} de ${terreno} el documento estima ${plural(ref, "repetidor", "repetidores")} (supone ${numeroLocal(radioKm, { maximumFractionDigits: 1 })} km de alcance en sitio alto); ${comparacion}.`,
        `Trama reference: for ${km2(e.areaKm2)} of ${terreno} the document estimates ${plural(ref, "repeater", "repeaters")} (it assumes ${numeroLocal(radioKm, { maximumFractionDigits: 1 })} km of range from a high site); ${comparacion}.`,
      ),
    );
  }

  // Recomendaciones acotadas
  if (e.economica && e.economica.repetidores < e.nuevos.repetidores) {
    const ahorro = (e.nuevos.repetidores - e.economica.repetidores) * costoRepetidorInstalado(e.logistica);
    recomendaciones.unshift({
      id: "economica",
      texto: tx(
        `Si quiere ahorrar: con ${plural(e.economica.repetidores, "repetidor", "repetidores")} (en vez de ${e.nuevos.repetidores}) queda en ≈ ${pct(e.economica.coberturaPct)} y ahorra unos ${pesosTrama(ahorro)}.`,
        `If you want to save: with ${plural(e.economica.repetidores, "repeater", "repeaters")} (instead of ${e.nuevos.repetidores}) it stays at ≈ ${pct(e.economica.coberturaPct)} and saves about ${pesosTrama(ahorro)}.`,
      ),
      costoCop: -ahorro,
    });
  }
  if (e.frenado)
    recomendaciones.push({
      id: "meta",
      texto: tx(
        `Si de verdad necesita el ${pct(e.metaPct)}, lo sigo sin el freno, pero cada repetidor más cubrirá menos del ${pct(e.frenado.minPct)} del área (unos ${pesosTrama(costoRepetidorInstalado(e.logistica))} cada uno).`,
        `If you really need ${pct(e.metaPct)}, I'll keep going without the brake, but each additional repeater will cover less than ${pct(e.frenado.minPct)} of the area (about ${pesosTrama(costoRepetidorInstalado(e.logistica))} each).`,
      ),
    });
  else if (!cumplida)
    recomendaciones.push({
      id: "torres",
      texto: tx(
        `Para acercarse a la meta sin sembrar más: torres más altas (hasta 30 m, no más) o el ajuste de alturas y apoyos.`,
        `To get closer to the target without seeding more: taller towers (up to 30 m, no more) or the height and support adjustment.`,
      ),
    });
  if (debiles)
    recomendaciones.push({
      id: "enlaces",
      texto: tx(
        `Afirmar ${debiles === 1 ? "el enlace débil" : "los enlaces débiles"} con el ajuste (alturas y apoyos), antes que poner más repetidores.`,
        `Strengthen ${debiles === 1 ? "the weak link" : "the weak links"} with the adjustment (heights and supports) before adding more repeaters.`,
      ),
    });
  if (e.presupuestoCop && pasado) {
    const n = repetidoresEnPresupuesto(e.presupuestoCop, e.nuevos.gateways > 0, e.logistica, radiosExtra);
    recomendaciones.push({
      id: "presupuesto",
      texto: tx(
        `Con ${pesosTrama(e.presupuestoCop)} alcanza para ${n === null ? "ni el sitio del gateway" : plural(n, "repetidor", "repetidores")} con el gateway: rehágala con ese tope o use la opción económica.`,
        n === null
          ? `${pesosTrama(e.presupuestoCop)} doesn't cover even the gateway site: redo it with that cap or use the economical option.`
          : `${pesosTrama(e.presupuestoCop)} covers ${plural(n, "repeater", "repeaters")} with the gateway: redo it with that cap or use the economical option.`,
      ),
    });
  }
  if (e.criticos >= 2 && !e.respaldo && cumplida && recomendaciones.length < 3)
    recomendaciones.push({
      id: "respaldo",
      texto: tx(
        `Si la red no puede caerse, el respaldo (dos nodos por punto) quita los pasos obligados; cuesta más repetidores, así que solo si el servicio lo exige.`,
        `If the network can't go down, backup (two nodes per point) removes the mandatory pass-throughs; it takes more repeaters, so only if the service demands it.`,
      ),
    });

  const titulo =
    veredicto === "optima"
      ? tx("red óptima", "optimal network")
      : veredicto === "reservas"
        ? tx("red viable con reservas", "viable network with caveats")
        : tx("red insuficiente para lo pedido", "network insufficient for what was requested");
  return { veredicto, titulo, hallazgos, recomendaciones: recomendaciones.slice(0, 3), costo, radiosExtra, costoRadiosExtra, inversion, costoKm2, costoUsuario, capacidad, referencia };
}

/** ¿Es el hallazgo del costo? («Costo: …» o «Cost: …», también con los textos marcados del motor). */
const esCosto = (h: string) => /^\u0001?(Costo|Cost):/.test(h);

/** El análisis en texto, para la respuesta de Melki. */
export function textoAnalisis(a: AnalisisRed, conCosto = true): string[] {
  const lineas = [tx(`Análisis de Melki: ${a.titulo}.`, `Melki's analysis: ${a.titulo}.`), ...a.hallazgos.filter((h) => conCosto || !esCosto(h)).map((h) => `• ${h}`)];
  if (a.recomendaciones.length)
    lineas.push(
      tx("Recomendaciones (sin salirse de la meta, del presupuesto ni de lo que pide la capacidad):", "Recommendations (within the target, the budget and what capacity requires):"),
      ...a.recomendaciones.map((r) => `• ${r.texto}`),
    );
  return lineas;
}
