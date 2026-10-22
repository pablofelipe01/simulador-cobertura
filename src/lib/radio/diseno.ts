// Diseño de la malla por área: dado un polígono y una meta («señal media o mejor en el 99,9 % del área»),
// elige dónde va el gateway (si aún no hay) y siembra repetidores, uno a uno, donde más área nueva cubren,
// siempre enlazados a la red (≥ 30 dB) y dentro del límite de saltos. Todo con el relieve real y con el
// mismo cálculo del mapa de cobertura. Primero se trabaja con una muestra gruesa del área y luego se
// verifica con una muestra del tamaño de las celdas del mapa, tapando los huecos pequeños que queden.
import { cajaPoligono, celdasEnPoligono, centroPoligono, dentroPoligono, muestrasEnPoligono, type Poligono } from "./area";
import { crearMalla, evaluadorMargen } from "./cobertura";
import { UMBRAL_SERVICIO_DB } from "./constantes";
import { areaPoligonoM2, desplazar, distanciaM, metrosPorGrado } from "./geo";
import { enlaceEntre } from "./malla";
import { longitudOnda } from "./modelo";
import { calculoRed, completarParametros } from "./red";
import type { Relieve } from "./relieve";
import type { Antena, Caja, Parametros } from "./tipos";

export type PedidoDiseno = {
  area: Poligono;
  /** Margen mínimo que debe tener cada punto (dB): 30 = señal media o mejor. */
  margenObjetivoDb: number;
  /** % del área que debe quedar con ese margen (0-100). */
  porcentajeObjetivo: number;
  /** Respaldo: cada punto con al menos dos nodos que le den ese margen. */
  respaldo?: boolean;
  /** Infraestructura activa que ya existe (gateways y repetidores); cuenta en la cobertura y sirve de enlace. */
  existentes: Antena[];
  /** Gateway nuevo (plantilla), si todavía no hay ninguno. Con `gatewayFijo` va donde dice la plantilla. */
  gateway: Antena | null;
  gatewayFijo?: boolean;
  /** Plantilla de los repetidores (altura y equipo). */
  repetidor: Antena;
  parametros: Parametros;
  maxRepetidores?: number;
};

export type NodoDiseno = {
  id: string;
  pieza: "gateway" | "repetidor";
  lat: number;
  lon: number;
  sueloM: number;
  /** Nodo de la red con el que enlaza y margen de ese enlace (dB); null para el gateway. */
  desdeId: string | null;
  enlaceDb: number | null;
  saltos: number;
  /** % del área cubierta (con la meta) después de poner este nodo. */
  coberturaPct: number;
};

export type Diseno = {
  nodos: NodoDiseno[];
  areaKm2: number;
  muestras: number;
  /** Cobertura estimada (% del área con el margen objetivo) antes (solo la red existente) y después. */
  inicialPct: number;
  coberturaPct: number;
  objetivoPct: number;
  margenObjetivoDb: number;
  respaldo: boolean;
  alcanzado: boolean;
  motivo: string | null;
  /** Algunos puntos que quedan por debajo de la meta [lon, lat]. */
  huecos: [number, number][];
};

const ENLACE_SOLIDO_DB = 30;
const ENLACE_MINIMO_DB = 22;
const MUESTRAS_GRUESAS = 3000;
const MUESTRAS_FINAS = 40000;
const MAX_CANDIDATOS = 300;

/** Caja de trabajo: el área con un borde para buscar sitios por fuera de ella (lomas cercanas). */
export function cajaDiseno(area: Poligono, existentes: { lat: number; lon: number }[] = []): Caja {
  const c = cajaPoligono(area);
  const m = metrosPorGrado((c.sur + c.norte) / 2);
  const diagonal = distanciaM(c.sur, c.oeste, c.norte, c.este);
  const borde = Math.min(3000, Math.max(600, diagonal * 0.12));
  let caja = { oeste: c.oeste - borde / m.lon, este: c.este + borde / m.lon, sur: c.sur - borde / m.lat, norte: c.norte + borde / m.lat };
  for (const q of existentes) caja = { oeste: Math.min(caja.oeste, q.lon), este: Math.max(caja.este, q.lon), sur: Math.min(caja.sur, q.lat), norte: Math.max(caja.norte, q.lat) };
  return caja;
}

/** Puntos del área con el mejor y el segundo mejor margen de la red, y el margen de cada candidato. */
type Conjunto = { lats: Float64Array; lons: Float64Array; mejor: Int16Array; segundo: Int16Array; filas: (Int8Array | undefined)[] };

export function disenar(pedido: PedidoDiseno, relieve: Relieve, caja: Caja): Diseno {
  const p = completarParametros(pedido.parametros);
  const red = calculoRed(p);
  const lambda = longitudOnda(p.frecuenciaMhz);
  const radioM = p.radioKm * 1000;
  const objetivoDb = pedido.margenObjetivoDb;
  const objetivoPct = Math.min(100, Math.max(1, pedido.porcentajeObjetivo));
  const respaldo = Boolean(pedido.respaldo);
  const maximo = pedido.maxRepetidores ?? 40;
  const areaM2 = areaPoligonoM2(pedido.area);
  const areaKm2 = areaM2 / 1e6;
  const limiteSaltos = p.limiteSaltos;
  const suelo = (lat: number, lon: number) => relieve.elevacion(lat, lon);
  const enlace = (a: Antena, b: Antena) => enlaceEntre(a, b, p, relieve, red, lambda).margen;

  /** Margen de una antena en cada punto del conjunto (−128 fuera de su radio de estudio). */
  const fila = (a: Antena, lats: Float64Array, lons: Float64Array) => {
    const ev = evaluadorMargen(a, p, relieve);
    const m = metrosPorGrado(a.lat);
    const salida = new Int8Array(lats.length);
    for (let k = 0; k < lats.length; k++) {
      const dy = (lats[k] - a.lat) * m.lat;
      const dx = (lons[k] - a.lon) * m.lon;
      if (dx * dx + dy * dy > radioM * radioM) salida[k] = -128;
      else {
        // Hacia abajo: así «≥ 30» en entero equivale a «≥ 30» en el margen real del mapa
        const v = Math.floor(ev(lats[k], lons[k]));
        salida[k] = v > 127 ? 127 : v < -127 ? -127 : v;
      }
    }
    return salida;
  };
  const conjunto = (lats: Float64Array, lons: Float64Array, nodosRed: Antena[]): Conjunto => {
    const c: Conjunto = { lats, lons, mejor: new Int16Array(lats.length).fill(-128), segundo: new Int16Array(lats.length).fill(-128), filas: [] };
    for (const a of nodosRed) aplicar(c, fila(a, lats, lons));
    return c;
  };
  const aplicar = (c: Conjunto, f: Int8Array) => {
    for (let k = 0; k < f.length; k++) {
      const v = f[k];
      if (v > c.mejor[k]) {
        c.segundo[k] = c.mejor[k];
        c.mejor[k] = v;
      } else if (v > c.segundo[k]) c.segundo[k] = v;
    }
  };
  const cubierto = (c: Conjunto, k: number) => (respaldo ? c.segundo[k] : c.mejor[k]) >= objetivoDb;
  const contar = (c: Conjunto) => {
    let n = 0;
    for (let k = 0; k < c.lats.length; k++) if (cubierto(c, k)) n++;
    return n;
  };
  const descubiertos = (c: Conjunto) => {
    const lista: number[] = [];
    for (let k = 0; k < c.lats.length; k++) if (!cubierto(c, k)) lista.push(k);
    return lista;
  };
  /** Puntos que pasarían a quedar cubiertos con la fila f. */
  const ganancia = (c: Conjunto, f: Int8Array, lista: number[]) => {
    let n = 0;
    for (const k of lista) {
      const v = f[k];
      if (respaldo) {
        const segundoNuevo = v >= c.mejor[k] ? c.mejor[k] : Math.max(c.segundo[k], v);
        if (segundoNuevo >= objetivoDb) n++;
      } else if (v >= objetivoDb) n++;
    }
    return n;
  };

  // Muestra gruesa del área
  const gruesa = muestrasEnPoligono(pedido.area, MUESTRAS_GRUESAS);
  const red0 = [...pedido.existentes];
  const A = conjunto(gruesa.lats, gruesa.lons, red0);
  const PA = A.lats.length;
  const inicialPct = PA ? (100 * contar(A)) / PA : 0;

  type NodoRed = { a: Antena; saltos: number };
  const redNodos: NodoRed[] = [];
  const colocados: Antena[] = [...pedido.existentes];
  const gatewaysExistentes = pedido.existentes.filter((a) => a.pasarela);
  const pendientes = pedido.existentes.filter((a) => !a.pasarela);
  for (const g of gatewaysExistentes) redNodos.push({ a: g, saltos: 0 });
  const nodos: NodoDiseno[] = [];
  let pctActual = inicialPct;

  // Gateway nuevo: donde más área cubre cerca del centro (o donde lo pidió el usuario)
  if (!gatewaysExistentes.length && pedido.gateway) {
    let gw: Antena;
    if (pedido.gatewayFijo) gw = { ...pedido.gateway, id: "diseno-gateway" };
    else {
      const centro = centroPoligono(pedido.area);
      const radioArea = Math.sqrt(areaM2 / Math.PI);
      const opciones: Antena[] = [];
      for (const r of [0, 0.12, 0.24, 0.36]) {
        const pasos = r === 0 ? 1 : 10;
        for (let s = 0; s < pasos; s++) {
          const q = r === 0 ? centro : desplazar(centro.lat, centro.lon, r * radioArea, (360 * s) / pasos);
          if (r > 0 && !dentroPoligono(q.lon, q.lat, pedido.area)) continue;
          opciones.push({ ...pedido.gateway, id: "diseno-gateway", lat: q.lat, lon: q.lon });
        }
      }
      let elegido = opciones[0];
      let mejorPuntaje = -Infinity;
      const lista = descubiertos(A);
      for (const o of opciones) {
        const puntaje = ganancia(A, fila(o, A.lats, A.lons), lista) + suelo(o.lat, o.lon) / 1e4;
        if (puntaje > mejorPuntaje) {
          mejorPuntaje = puntaje;
          elegido = o;
        }
      }
      gw = elegido;
    }
    aplicar(A, fila(gw, A.lats, A.lons));
    redNodos.push({ a: gw, saltos: 0 });
    colocados.push(gw);
    pctActual = PA ? (100 * contar(A)) / PA : 0;
    nodos.push({ id: gw.id, pieza: "gateway", lat: gw.lat, lon: gw.lon, sueloM: Math.round(suelo(gw.lat, gw.lon)), desdeId: null, enlaceDb: null, saltos: 0, coberturaPct: pctActual });
  }

  // Los repetidores existentes se unen a la red si alcanzan a un nodo de ella (enlace ≥ 20 dB, como la malla)
  for (let cambio = true; cambio && pendientes.length; ) {
    cambio = false;
    for (let i = pendientes.length - 1; i >= 0; i--) {
      const a = pendientes[i];
      let mejorSaltos = Infinity;
      for (const r of redNodos) if (r.saltos + 1 < mejorSaltos && enlace(r.a, a) >= UMBRAL_SERVICIO_DB) mejorSaltos = r.saltos + 1;
      if (mejorSaltos < Infinity) {
        redNodos.push({ a, saltos: mejorSaltos });
        pendientes.splice(i, 1);
        cambio = true;
      }
    }
  }

  // Sitios candidatos: una cuadrícula sobre el área y sus alrededores
  const candidatos: Antena[] = [];
  const mCaja = metrosPorGrado((caja.sur + caja.norte) / 2);
  const anchoM = (caja.este - caja.oeste) * mCaja.lon;
  const altoM = (caja.norte - caja.sur) * mCaja.lat;
  const sepCand = Math.max(150, Math.sqrt((anchoM * altoM) / MAX_CANDIDATOS));

  type Enganche = { saltos: number; margen: number; desde: string };
  const enganche: (Enganche | null)[] = [];
  const debil: (Enganche | null)[] = [];
  const usado: boolean[] = [];
  const actualizar = (c: number, r: NodoRed) => {
    if (usado[c]) return;
    const m = enlace(r.a, candidatos[c]);
    const s = r.saltos + 1;
    const mejorQue = (e: Enganche | null) => !e || s < e.saltos || (s === e.saltos && m > e.margen);
    if (m >= ENLACE_SOLIDO_DB && mejorQue(enganche[c])) enganche[c] = { saltos: s, margen: m, desde: r.a.id };
    else if (m >= ENLACE_MINIMO_DB && mejorQue(debil[c])) debil[c] = { saltos: s, margen: m, desde: r.a.id };
  };
  const agregarCandidato = (lat: number, lon: number) => {
    if (lat < caja.sur || lat > caja.norte || lon < caja.oeste || lon > caja.este) return;
    const c = candidatos.length;
    candidatos.push({ ...pedido.repetidor, id: `cand-${c}`, lat, lon });
    enganche[c] = null;
    debil[c] = null;
    usado[c] = false;
    for (const r of redNodos) actualizar(c, r);
  };
  for (let y = sepCand / 2; y < altoM; y += sepCand) for (let x = sepCand / 2; x < anchoM; x += sepCand) agregarCandidato(caja.norte - y / mCaja.lat, caja.oeste + x / mCaja.lon);

  const filaCand = (c: Conjunto, i: number) => (c.filas[i] ??= fila(candidatos[i], c.lats, c.lons));

  let repetidores = 0;
  let motivo: string | null = null;
  const dentroDeSaltos = (e: Enganche | null) => (e !== null && e.saltos <= limiteSaltos ? e : null);
  const conjuntos: Conjunto[] = [A];

  const poner = (c: number, e: Enganche) => {
    usado[c] = true;
    repetidores++;
    const a = { ...candidatos[c], id: `diseno-${repetidores}` };
    const rn: NodoRed = { a, saltos: e.saltos };
    for (const cj of conjuntos) aplicar(cj, filaCand(cj, c));
    redNodos.push(rn);
    colocados.push(a);
    for (let k = 0; k < candidatos.length; k++) actualizar(k, rn);
    return { a, e };
  };

  /**
   * Siembra repetidores hasta que el conjunto llegue a la meta. `total` y `fuera` permiten medir el % sobre
   * todos los puntos del área cuando el conjunto solo tiene los que faltan (la muestra fina).
   */
  const sembrarHasta = (c: Conjunto, metaPct: number, total: number, fuera: number) => {
    let ampliaciones = 0;
    const imposibles = new Set<number>();
    const pct = () => (100 * (fuera + contar(c))) / Math.max(1, total);
    while (c.lats.length && pct() < metaPct) {
      if (!redNodos.length) return "No hay gateway: ponga el Gateway + Internet o déjeme elegir dónde va.";
      if (repetidores >= maximo) return `Llegué al máximo de ${maximo} repetidores.`;
      const lista = descubiertos(c);
      let elegido = -1;
      let mejorG = 0;
      let mejorSuelo = -Infinity;
      const evaluar = (aceptable: (i: number) => Enganche | null) => {
        for (let i = 0; i < candidatos.length; i++) {
          if (usado[i] || !aceptable(i)) continue;
          const g = ganancia(c, filaCand(c, i), lista);
          if (!g) continue;
          const sc = suelo(candidatos[i].lat, candidatos[i].lon);
          if (g > mejorG || (g === mejorG && sc > mejorSuelo)) {
            mejorG = g;
            elegido = i;
            mejorSuelo = sc;
          }
        }
      };
      // 1) El candidato enlazado (≥ 30 dB, dentro del límite de saltos) que más área nueva cubre
      evaluar((i) => dentroDeSaltos(enganche[i]));
      if (elegido < 0) evaluar((i) => dentroDeSaltos(debil[i]));
      if (elegido < 0) evaluar((i) => enganche[i] ?? debil[i]);
      if (elegido >= 0) {
        const e = dentroDeSaltos(enganche[elegido]) ?? dentroDeSaltos(debil[elegido]) ?? enganche[elegido] ?? debil[elegido]!;
        const { a } = poner(elegido, e);
        nodos.push({ id: a.id, pieza: "repetidor", lat: a.lat, lon: a.lon, sueloM: Math.round(suelo(a.lat, a.lon)), desdeId: e.desde, enlaceDb: e.margen, saltos: e.saltos, coberturaPct: pct() });
        continue;
      }
      // 2) Un sitio que cubriría pero no alcanza la red: se pone un relevo enlazado hacia él
      let objetivo = -1;
      let gObjetivo = 0;
      for (let i = 0; i < candidatos.length; i++) {
        if (usado[i] || imposibles.has(i)) continue;
        const g = ganancia(c, filaCand(c, i), lista);
        if (g > gObjetivo) {
          gObjetivo = g;
          objetivo = i;
        }
      }
      if (objetivo >= 0) {
        const t = candidatos[objetivo];
        let relevo = -1;
        let mejorDist = Infinity;
        for (let i = 0; i < candidatos.length; i++) {
          if (usado[i] || i === objetivo || !enganche[i]) continue;
          const d = distanciaM(candidatos[i].lat, candidatos[i].lon, t.lat, t.lon);
          if (d < mejorDist) {
            mejorDist = d;
            relevo = i;
          }
        }
        const desdeRed = Math.min(...redNodos.map((r) => distanciaM(r.a.lat, r.a.lon, t.lat, t.lon)));
        if (relevo >= 0 && mejorDist < desdeRed - 200) {
          const e = enganche[relevo]!;
          const { a } = poner(relevo, e);
          nodos.push({ id: a.id, pieza: "repetidor", lat: a.lat, lon: a.lon, sueloM: Math.round(suelo(a.lat, a.lon)), desdeId: e.desde, enlaceDb: e.margen, saltos: e.saltos, coberturaPct: pct() });
          continue;
        }
        imposibles.add(objetivo);
        continue;
      }
      // 3) Ningún sitio cubre lo que falta: se prueban sitios en los huecos y a su alrededor
      if (ampliaciones < 2 && lista.length) {
        ampliaciones++;
        for (const k of repartir(lista, c.lats, c.lons, 24)) {
          agregarCandidato(c.lats[k], c.lons[k]);
          for (let s = 0; s < 8; s++) {
            const q = desplazar(c.lats[k], c.lons[k], Math.max(250, sepCand / 2), s * 45);
            agregarCandidato(q.lat, q.lon);
          }
        }
        continue;
      }
      return "En los puntos que faltan el relieve no deja llegar con esa señal desde ningún sitio cercano enlazado a la red (hondonadas o detrás de lomas).";
    }
    return null;
  };

  // Fase 1: muestra gruesa
  motivo = sembrarHasta(A, objetivoPct, PA, 0);

  // Fase 2: las celdas del mapa dentro del área (las mismas que pintará la simulación); se tapan los huecos
  // pequeños que la muestra gruesa no vio. Si un repetidor nuevo corre la cuadrícula del mapa, se repite.
  let pctFinal = 0;
  let faltantes: [number, number][] = [];
  let celdas = 0;
  let firmaMalla = "";
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const malla = crearMalla(colocados, p);
    const firma = `${malla.caja.oeste}|${malla.caja.norte}|${malla.celdaM}`;
    if (firma === firmaMalla) break;
    firmaMalla = firma;
    const fina = celdasEnPoligono(malla, pedido.area, MUESTRAS_FINAS);
    const PF = fina.lats.length;
    celdas = PF;
    const F = conjunto(fina.lats, fina.lons, colocados);
    const faltan = descubiertos(F);
    pctFinal = PF ? (100 * (PF - faltan.length)) / PF : 0;
    faltantes = faltan.map((k) => [fina.lons[k], fina.lats[k]] as [number, number]);
    if (motivo || !PF || pctFinal >= objetivoPct) break;
    const sub: Conjunto = {
      lats: Float64Array.from(faltan, (k) => fina.lats[k]),
      lons: Float64Array.from(faltan, (k) => fina.lons[k]),
      mejor: Int16Array.from(faltan, (k) => F.mejor[k]),
      segundo: Int16Array.from(faltan, (k) => F.segundo[k]),
      filas: [],
    };
    conjuntos.push(sub);
    const antes = repetidores;
    motivo = sembrarHasta(sub, objetivoPct, PF, PF - faltan.length);
    conjuntos.pop();
    const restantes = descubiertos(sub);
    pctFinal = (100 * (PF - restantes.length)) / PF;
    faltantes = restantes.map((k) => [sub.lons[k], sub.lats[k]] as [number, number]);
    if (motivo || repetidores === antes) break;
  }
  return cerrar(pctFinal, faltantes);

  function cerrar(coberturaPct: number, faltantes: [number, number][]): Diseno {
    const alcanzado = coberturaPct >= objetivoPct - 1e-9;
    const idx = faltantes.map((_, i) => i);
    const la = Float64Array.from(faltantes, (q) => q[1]);
    const lo = Float64Array.from(faltantes, (q) => q[0]);
    return {
      nodos,
      areaKm2,
      muestras: celdas,
      inicialPct,
      coberturaPct,
      objetivoPct,
      margenObjetivoDb: objetivoDb,
      respaldo,
      alcanzado,
      motivo: alcanzado ? null : (motivo ?? "En los puntos que faltan el relieve no deja llegar con esa señal desde ningún sitio cercano enlazado a la red (hondonadas o detrás de lomas)."),
      huecos: repartir(idx, la, lo, 12).map((k) => faltantes[k]),
    };
  }
}

/** Hasta `n` puntos de la lista bien repartidos (el más lejano de los ya elegidos, cada vez). */
function repartir(lista: number[], lats: Float64Array, lons: Float64Array, n: number): number[] {
  if (lista.length <= n) return [...lista];
  const elegidos = [lista[0]];
  const dist = lista.map((k) => distanciaM(lats[k], lons[k], lats[lista[0]], lons[lista[0]]));
  while (elegidos.length < n) {
    let mejor = 0;
    for (let i = 1; i < lista.length; i++) if (dist[i] > dist[mejor]) mejor = i;
    if (dist[mejor] === 0) break;
    const k = lista[mejor];
    elegidos.push(k);
    for (let i = 0; i < lista.length; i++) dist[i] = Math.min(dist[i], distanciaM(lats[lista[i]], lons[lista[i]], lats[k], lons[k]));
  }
  return elegidos;
}
