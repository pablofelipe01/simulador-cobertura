// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Modelo Longley-Rice (ITM, Irregular Terrain Model) de la NTIA/ITS, versión 1.2.2, en modo punto a punto.
// Es el mismo modelo que usa Radio Mobile. Traducción directa del algoritmo publicado
// (G. A. Hufford, «The ITS Irregular Terrain Model, version 1.2.2: The Algorithm», 1995; código de dominio público).
// Se usa para el informe de radioenlace y para ajustar el modelo calibrado cuando cambian los parámetros de red.

/** Clima de radio del ITM (mismo orden que Radio Mobile). */
export type ClimaItm = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const CLIMAS: readonly { id: ClimaItm; nombre: string; refractividad: number }[] = [
  { id: 1, nombre: "Ecuatorial", refractividad: 360 },
  { id: 2, nombre: "Continental subtropical", refractividad: 320 },
  { id: 3, nombre: "Marítimo subtropical", refractividad: 370 },
  { id: 4, nombre: "Desierto", refractividad: 280 },
  { id: 5, nombre: "Continental templado", refractividad: 301 },
  { id: 6, nombre: "Marítimo templado sobre tierra", refractividad: 320 },
  { id: 7, nombre: "Marítimo templado sobre mar", refractividad: 350 },
];

/** Modo de variabilidad (Radio Mobile: Spot, Accidental, Móvil, Difusión). */
export type ModoVariabilidad = 0 | 1 | 2 | 3;

export type EntradaItm = {
  /** Elevaciones del perfil (m) a intervalos iguales, desde el transmisor hasta el receptor (al menos 3). */
  elev: ArrayLike<number>;
  /** Número de puntos usados de `elev` (por defecto todos). */
  n?: number;
  /** Distancia total del trayecto (m). */
  distanciaM: number;
  alturaTxM: number;
  alturaRxM: number;
  frecuenciaMhz: number;
  /** Polarización: 0 horizontal, 1 vertical. */
  polarizacion: 0 | 1;
  permitividad: number;
  conductividad: number;
  refractividad: number;
  clima: ClimaItm;
  modo: ModoVariabilidad;
  /** Porcentajes (1–99). */
  tiempo: number;
  ubicaciones: number;
  situaciones: number;
  /** Devuelve variables internas (para pruebas). */
  depurar?: boolean;
};

export type SalidaItm = {
  /** Pérdida básica de transmisión (dB) para los porcentajes pedidos. */
  perdidaDb: number;
  /** Pérdida en espacio libre (dB). */
  espacioLibreDb: number;
  /** Atenuación de referencia (mediana sobre espacio libre, dB). */
  referenciaDb: number;
  /** Modo de propagación. */
  modo: "linea-vista" | "difraccion" | "dispersion";
  /** Código de advertencia del ITM: 0 válido, 1–3 parámetros fuera de rango recomendado, 4 resultado no fiable. */
  aviso: number;
  /** Irregularidad del terreno Δh (m). */
  irregularidadM: number;
  /** Distancias al horizonte desde cada extremo (m). */
  horizontesM: [number, number];
  detalle?: Record<string, number>;
};

const THIRD = 1 / 3;

type C = { re: number; im: number };
const cAbs = (z: C) => Math.hypot(z.re, z.im);
const cDiv = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const cSqrt = (z: C): C => {
  const r = cAbs(z);
  const re = Math.sqrt((r + z.re) / 2);
  const im = Math.sqrt(Math.max(0, (r - z.re) / 2));
  return { re, im: z.im < 0 ? -im : im };
};
const cAbs2 = (z: C) => z.re * z.re + z.im * z.im;
const dim = (x: number, y: number) => (x > y ? x - y : 0);

/** Estado interno de una predicción (equivale a prop_type, propa_type y propv_type). */
class Prop {
  // prop_type
  aref = 0;
  dist = 0;
  hg: [number, number] = [0, 0];
  wn = 0;
  dh = 0;
  ens = 0;
  gme = 0;
  zgnd: C = { re: 0, im: 0 };
  he: [number, number] = [0, 0];
  dl: [number, number] = [0, 0];
  the: [number, number] = [0, 0];
  kwx = 0;
  mdp = 0;
  // propa_type
  dlsa = 0;
  dx = 0;
  ael = 0;
  ak1 = 0;
  ak2 = 0;
  aed = 0;
  emd = 0;
  aes = 0;
  ems = 0;
  dls: [number, number] = [0, 0];
  dla = 0;
  tha = 0;
  // propv_type
  sgc = 0;
  lvar = 0;
  mdvar = 0;
  klim = 0;
  // Estados «static» de las subrutinas del original
  ad_wd1 = 0;
  ad_xd1 = 0;
  ad_afo = 0;
  ad_qk = 0;
  ad_aht = 0;
  ad_xht = 0;
  as_ad = 0;
  as_rr = 0;
  as_etq = 0;
  as_h0s = 0;
  al_wls = 0;
  lr_wlos = false;
  lr_wscat = false;
  lr_dmin = 0;
  lr_xae = 0;
  av_kdv = 0;
  av_dexa = 0;
  av_de = 0;
  av_vmd = 0;
  av_vs0 = 0;
  av_sgl = 0;
  av_sgtm = 0;
  av_sgtp = 0;
  av_sgtd = 0;
  av_tgtd = 0;
  av_gm = 0;
  av_gp = 0;
  av_cv1 = 0;
  av_cv2 = 0;
  av_yv1 = 0;
  av_yv2 = 0;
  av_yv3 = 0;
  av_csm1 = 0;
  av_csm2 = 0;
  av_ysm1 = 0;
  av_ysm2 = 0;
  av_ysm3 = 0;
  av_csp1 = 0;
  av_csp2 = 0;
  av_ysp1 = 0;
  av_ysp2 = 0;
  av_ysp3 = 0;
  av_csd1 = 0;
  av_zd = 0;
  av_cfm1 = 0;
  av_cfm2 = 0;
  av_cfm3 = 0;
  av_cfp1 = 0;
  av_cfp2 = 0;
  av_cfp3 = 0;
  av_ws = false;
  av_w1 = false;
}

function aknfe(v2: number): number {
  return v2 < 5.76 ? 6.02 + 9.11 * Math.sqrt(v2) - 1.27 * v2 : 12.953 + 4.343 * Math.log(v2);
}

function fht(x: number, pk: number): number {
  let fhtv: number;
  if (x < 200) {
    const w = -Math.log(pk);
    if (pk < 1e-5 || x * w * w * w > 5495) {
      fhtv = -117;
      if (x > 1) fhtv = 17.372 * Math.log(x) + fhtv;
    } else fhtv = (2.5e-5 * x * x) / pk - 8.686 * w - 15;
  } else {
    fhtv = 0.05751 * x - 4.343 * Math.log(x);
    if (x < 2000) {
      const w = 0.0134 * x * Math.exp(-0.005 * x);
      fhtv = (1 - w) * fhtv + w * (17.372 * Math.log(x) - 117);
    }
  }
  return fhtv;
}

function h0f(r: number, et: number): number {
  const a = [25, 80, 177, 395, 705];
  const b = [24, 45, 68, 80, 105];
  let it = Math.trunc(et);
  let q: number;
  if (it <= 0) {
    it = 1;
    q = 0;
  } else if (it >= 5) {
    it = 5;
    q = 0;
  } else q = et - it;
  const x = (1 / r) ** 2;
  let h0fv = 4.343 * Math.log((a[it - 1] * x + b[it - 1]) * x + 1);
  if (q !== 0) h0fv = (1 - q) * h0fv + q * 4.343 * Math.log((a[it] * x + b[it]) * x + 1);
  return h0fv;
}

function ahd(td: number): number {
  const a = [133.4, 104.6, 71.8];
  const b = [0.332e-3, 0.212e-3, 0.157e-3];
  const c = [-4.343, -1.086, 2.171];
  const i = td <= 10e3 ? 0 : td <= 70e3 ? 1 : 2;
  return a[i] + b[i] * td + c[i] * Math.log(td);
}

function adiff(d: number, p: Prop): number {
  if (d === 0) {
    let q = p.hg[0] * p.hg[1];
    p.ad_qk = p.he[0] * p.he[1] - q;
    if (p.mdp < 0) q += 10;
    p.ad_wd1 = Math.sqrt(1 + p.ad_qk / q);
    p.ad_xd1 = p.dla + p.tha / p.gme;
    q = (1 - 0.8 * Math.exp(-p.dlsa / 50e3)) * p.dh;
    q *= 0.78 * Math.exp(-((q / 16) ** 0.25));
    p.ad_afo = Math.min(15, 2.171 * Math.log(1 + 4.77e-4 * p.hg[0] * p.hg[1] * p.wn * q));
    p.ad_qk = 1 / cAbs(p.zgnd);
    p.ad_aht = 20;
    p.ad_xht = 0;
    for (let j = 0; j < 2; j++) {
      const a = (0.5 * p.dl[j] ** 2) / p.he[j];
      const wa = (a * p.wn) ** THIRD;
      const pk = p.ad_qk / wa;
      const qq = ((1.607 - pk) * 151 * wa * p.dl[j]) / a;
      p.ad_xht += qq;
      p.ad_aht += fht(qq, pk);
    }
    return 0;
  }
  const th = p.tha + d * p.gme;
  const ds = d - p.dla;
  let q = 0.0795775 * p.wn * ds * th * th;
  let adiffv = aknfe((q * p.dl[0]) / (ds + p.dl[0])) + aknfe((q * p.dl[1]) / (ds + p.dl[1]));
  const a = ds / th;
  const wa = (a * p.wn) ** THIRD;
  const pk = p.ad_qk / wa;
  q = (1.607 - pk) * 151 * wa * th + p.ad_xht;
  const ar = 0.05751 * q - 4.343 * Math.log(q) - p.ad_aht;
  q = (p.ad_wd1 + p.ad_xd1 / d) * Math.min((1 - 0.8 * Math.exp(-d / 50e3)) * p.dh * p.wn, 6283.2);
  const wd = 25.1 / (25.1 + Math.sqrt(q));
  adiffv = ar * wd + (1 - wd) * adiffv + p.ad_afo;
  return adiffv;
}

function ascat(d: number, p: Prop): number {
  if (d === 0) {
    p.as_ad = p.dl[0] - p.dl[1];
    p.as_rr = p.he[1] / p.he[0];
    if (p.as_ad < 0) {
      p.as_ad = -p.as_ad;
      p.as_rr = 1 / p.as_rr;
    }
    p.as_etq = (5.67e-6 * p.ens - 2.32e-3) * p.ens + 0.031;
    p.as_h0s = -15;
    return 0;
  }
  let h0: number;
  if (p.as_h0s > 15) h0 = p.as_h0s;
  else {
    const th = p.the[0] + p.the[1] + d * p.gme;
    let r2 = 2 * p.wn * th;
    const r1 = r2 * p.he[0];
    r2 *= p.he[1];
    if (r1 < 0.2 && r2 < 0.2) return 1001;
    let ss = (d - p.as_ad) / (d + p.as_ad);
    let q = p.as_rr / ss;
    ss = Math.max(0.1, ss);
    q = Math.min(Math.max(0.1, q), 10);
    const z0 = ((d - p.as_ad) * (d + p.as_ad) * th * 0.25) / d;
    const et = ((p.as_etq * Math.exp(-(Math.min(1.7, z0 / 8.0e3) ** 6)) + 1) * z0) / 1.7556e3;
    const ett = Math.max(et, 1);
    h0 = (h0f(r1, ett) + h0f(r2, ett)) * 0.5;
    h0 += Math.min(h0, (1.38 - Math.log(ett)) * Math.log(ss) * Math.log(q) * 0.49);
    h0 = dim(h0, 0);
    if (et < 1) h0 = et * h0 + (1 - et) * 4.343 * Math.log(((1 + 1.4142 / r1) * (1 + 1.4142 / r2)) ** 2 * ((r1 + r2) / (r1 + r2 + 2.8284)));
    if (h0 > 15 && p.as_h0s >= 0) h0 = p.as_h0s;
  }
  p.as_h0s = h0;
  const th = p.tha + d * p.gme;
  return ahd(th * d) + 4.343 * Math.log(47.7 * p.wn * th ** 4) - 0.1 * (p.ens - 301) * Math.exp((-th * d) / 40e3) + h0;
}

/** Inversa de la normal complementaria: valor z tal que Q(z) = q. */
export function qerfi(q: number): number {
  const c0 = 2.515516698;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;
  const x = 0.5 - q;
  let t = Math.max(0.5 - Math.abs(x), 0.000001);
  t = Math.sqrt(-2 * Math.log(t));
  let v = t - ((c2 * t + c1) * t + c0) / (((d3 * t + d2) * t + d1) * t + 1);
  if (x < 0) v = -v;
  return v;
}

function qlrps(fmhz: number, zsys: number, en0: number, ipol: number, eps: number, sgm: number, p: Prop) {
  const gma = 157e-9;
  p.wn = fmhz / 47.7;
  p.ens = en0;
  if (zsys !== 0) p.ens *= Math.exp(-zsys / 9460);
  p.gme = gma * (1 - 0.04665 * Math.exp(p.ens / 179.3));
  const zq: C = { re: eps, im: (376.62 * sgm) / p.wn };
  let zg = cSqrt({ re: zq.re - 1, im: zq.im });
  if (ipol !== 0) zg = cDiv(zg, zq);
  p.zgnd = zg;
}

function alos(d: number, p: Prop): number {
  if (d === 0) {
    p.al_wls = 0.021 / (0.021 + (p.wn * p.dh) / Math.max(10e3, p.dlsa));
    return 0;
  }
  let q = (1 - 0.8 * Math.exp(-d / 50e3)) * p.dh;
  const s = 0.78 * q * Math.exp(-((q / 16) ** 0.25));
  q = p.he[0] + p.he[1];
  const sps = q / Math.sqrt(d * d + q * q);
  const num: C = { re: sps - p.zgnd.re, im: -p.zgnd.im };
  const den: C = { re: sps + p.zgnd.re, im: p.zgnd.im };
  const f = Math.exp(-Math.min(10, p.wn * s * sps));
  let r = cDiv(num, den);
  r = { re: r.re * f, im: r.im * f };
  q = cAbs2(r);
  if (q < 0.25 || q < sps) {
    const k = Math.sqrt(sps / q);
    r = { re: r.re * k, im: r.im * k };
  }
  let alosv = p.emd * d + p.aed;
  q = (p.wn * p.he[0] * p.he[1] * 2) / d;
  if (q > 1.57) q = 3.14 - 2.4649 / q;
  alosv = (-4.343 * Math.log(cAbs2({ re: Math.cos(q) + r.re, im: -Math.sin(q) + r.im })) - alosv) * p.al_wls + alosv;
  return alosv;
}

function lrprop(d: number, p: Prop) {
  if (p.mdp !== 0) {
    for (let j = 0; j < 2; j++) p.dls[j] = Math.sqrt((2 * p.he[j]) / p.gme);
    p.dlsa = p.dls[0] + p.dls[1];
    p.dla = p.dl[0] + p.dl[1];
    p.tha = Math.max(p.the[0] + p.the[1], -p.dla * p.gme);
    p.lr_wlos = false;
    p.lr_wscat = false;
    if (p.wn < 0.838 || p.wn > 210) p.kwx = Math.max(p.kwx, 1);
    for (let j = 0; j < 2; j++) if (p.hg[j] < 1 || p.hg[j] > 1000) p.kwx = Math.max(p.kwx, 1);
    for (let j = 0; j < 2; j++) if (Math.abs(p.the[j]) > 200e-3 || p.dl[j] < 0.1 * p.dls[j] || p.dl[j] > 3 * p.dls[j]) p.kwx = Math.max(p.kwx, 3);
    if (p.ens < 250 || p.ens > 400 || p.gme < 75e-9 || p.gme > 250e-9 || p.zgnd.re <= Math.abs(p.zgnd.im) || p.wn < 0.419 || p.wn > 420) p.kwx = 4;
    for (let j = 0; j < 2; j++) if (p.hg[j] < 0.5 || p.hg[j] > 3000) p.kwx = 4;
    p.lr_dmin = Math.abs(p.he[0] - p.he[1]) / 200e-3;
    adiff(0, p);
    p.lr_xae = (p.wn * p.gme ** 2) ** -THIRD;
    const d3 = Math.max(p.dlsa, 1.3787 * p.lr_xae + p.dla);
    const d4 = d3 + 2.7574 * p.lr_xae;
    const a3 = adiff(d3, p);
    const a4 = adiff(d4, p);
    p.emd = (a4 - a3) / (d4 - d3);
    p.aed = a3 - p.emd * d3;
  }
  if (p.mdp >= 0) {
    p.mdp = 0;
    p.dist = d;
  }
  if (p.dist > 0) {
    if (p.dist > 1000e3) p.kwx = Math.max(p.kwx, 1);
    if (p.dist < p.lr_dmin) p.kwx = Math.max(p.kwx, 3);
    if (p.dist < 1e3 || p.dist > 2000e3) p.kwx = 4;
  }
  if (p.dist < p.dlsa) {
    if (!p.lr_wlos) {
      alos(0, p);
      const d2 = p.dlsa;
      const a2 = p.aed + d2 * p.emd;
      let d0 = 1.908 * p.wn * p.he[0] * p.he[1];
      let d1: number;
      if (p.aed >= 0) {
        d0 = Math.min(d0, 0.5 * p.dla);
        d1 = d0 + 0.25 * (p.dla - d0);
      } else d1 = Math.max(-p.aed / p.emd, 0.25 * p.dla);
      const a1 = alos(d1, p);
      let wq = false;
      if (d0 < d1) {
        const a0 = alos(d0, p);
        const q = Math.log(d2 / d0);
        p.ak2 = Math.max(0, ((d2 - d0) * (a1 - a0) - (d1 - d0) * (a2 - a0)) / ((d2 - d0) * Math.log(d1 / d0) - (d1 - d0) * q));
        wq = p.aed >= 0 || p.ak2 > 0;
        if (wq) {
          p.ak1 = (a2 - a0 - p.ak2 * q) / (d2 - d0);
          if (p.ak1 < 0) {
            p.ak1 = 0;
            p.ak2 = dim(a2, a0) / q;
            if (p.ak2 === 0) p.ak1 = p.emd;
          }
        }
      }
      if (!wq) {
        p.ak1 = dim(a2, a1) / (d2 - d1);
        p.ak2 = 0;
        if (p.ak1 === 0) p.ak1 = p.emd;
      }
      p.ael = a2 - p.ak1 * d2 - p.ak2 * Math.log(d2);
      p.lr_wlos = true;
    }
    if (p.dist > 0) p.aref = p.ael + p.ak1 * p.dist + p.ak2 * Math.log(p.dist);
  }
  if (p.dist <= 0 || p.dist >= p.dlsa) {
    if (!p.lr_wscat) {
      ascat(0, p);
      const d5 = p.dla + 200e3;
      const d6 = d5 + 200e3;
      const a6 = ascat(d6, p);
      const a5 = ascat(d5, p);
      if (a5 < 1000) {
        p.ems = (a6 - a5) / 200e3;
        p.dx = Math.max(p.dlsa, Math.max(p.dla + 0.3 * p.lr_xae * Math.log(47.7 * p.wn), (a5 - p.aed - p.ems * d5) / (p.emd - p.ems)));
        p.aes = (p.emd - p.ems) * p.dx + p.aed;
      } else {
        p.ems = p.emd;
        p.aes = p.aed;
        p.dx = 10e6;
      }
      p.lr_wscat = true;
    }
    if (p.dist > p.dx) p.aref = p.aes + p.ems * p.dist;
    else p.aref = p.aed + p.emd * p.dist;
  }
  p.aref = Math.max(p.aref, 0);
}

function curve(c1: number, c2: number, x1: number, x2: number, x3: number, de: number): number {
  return ((c1 + c2 / (1 + ((de - x2) / x3) ** 2)) * (de / x1) ** 2) / (1 + (de / x1) ** 2);
}

const BV1 = [-9.67, -0.62, 1.26, -9.21, -0.62, -0.39, 3.15];
const BV2 = [12.7, 9.19, 15.5, 9.05, 9.19, 2.86, 857.9];
const XV1 = [144.9e3, 228.9e3, 262.6e3, 84.1e3, 228.9e3, 141.7e3, 2222e3];
const XV2 = [190.3e3, 205.2e3, 185.2e3, 101.1e3, 205.2e3, 315.9e3, 164.8e3];
const XV3 = [133.8e3, 143.6e3, 99.8e3, 98.6e3, 143.6e3, 167.4e3, 116.3e3];
const BSM1 = [2.13, 2.66, 6.11, 1.98, 2.68, 6.86, 8.51];
const BSM2 = [159.5, 7.67, 6.65, 13.11, 7.16, 10.38, 169.8];
const XSM1 = [762.2e3, 100.4e3, 138.2e3, 139.1e3, 93.7e3, 187.8e3, 609.8e3];
const XSM2 = [123.6e3, 172.5e3, 242.2e3, 132.7e3, 186.8e3, 169.6e3, 119.9e3];
const XSM3 = [94.5e3, 136.4e3, 178.6e3, 193.5e3, 133.5e3, 108.9e3, 106.6e3];
const BSP1 = [2.11, 6.87, 10.08, 3.68, 4.75, 8.58, 8.43];
const BSP2 = [102.3, 15.53, 9.6, 159.3, 8.12, 13.97, 8.19];
const XSP1 = [636.9e3, 138.7e3, 165.3e3, 464.4e3, 93.2e3, 216.0e3, 136.2e3];
const XSP2 = [134.8e3, 143.7e3, 225.7e3, 93.1e3, 135.9e3, 152.0e3, 188.5e3];
const XSP3 = [95.6e3, 98.6e3, 129.7e3, 94.2e3, 113.4e3, 122.7e3, 122.9e3];
const BSD1 = [1.224, 0.801, 1.38, 1.0, 1.224, 1.518, 1.518];
const BZD1 = [1.282, 2.161, 1.282, 20, 1.282, 1.282, 1.282];
const BFM1 = [1.0, 1.0, 1.0, 1.0, 0.92, 1.0, 1.0];
const BFM2 = [0.0, 0.0, 0.0, 0.0, 0.25, 0.0, 0.0];
const BFM3 = [0.0, 0.0, 0.0, 0.0, 1.77, 0.0, 0.0];
const BFP1 = [1.0, 0.93, 1.0, 0.93, 0.93, 1.0, 1.0];
const BFP2 = [0.0, 0.31, 0.0, 0.19, 0.31, 0.0, 0.0];
const BFP3 = [0.0, 2.0, 0.0, 1.79, 2.0, 0.0, 0.0];

function avar(zzt: number, zzl: number, zzc: number, p: Prop): number {
  const rt = 7.8;
  const rl = 24;
  if (p.lvar > 0) {
    if (p.lvar >= 5) {
      if (p.klim <= 0 || p.klim > 7) {
        p.klim = 5;
        p.kwx = Math.max(p.kwx, 2);
      }
      const k = p.klim - 1;
      p.av_cv1 = BV1[k];
      p.av_cv2 = BV2[k];
      p.av_yv1 = XV1[k];
      p.av_yv2 = XV2[k];
      p.av_yv3 = XV3[k];
      p.av_csm1 = BSM1[k];
      p.av_csm2 = BSM2[k];
      p.av_ysm1 = XSM1[k];
      p.av_ysm2 = XSM2[k];
      p.av_ysm3 = XSM3[k];
      p.av_csp1 = BSP1[k];
      p.av_csp2 = BSP2[k];
      p.av_ysp1 = XSP1[k];
      p.av_ysp2 = XSP2[k];
      p.av_ysp3 = XSP3[k];
      p.av_csd1 = BSD1[k];
      p.av_zd = BZD1[k];
      p.av_cfm1 = BFM1[k];
      p.av_cfm2 = BFM2[k];
      p.av_cfm3 = BFM3[k];
      p.av_cfp1 = BFP1[k];
      p.av_cfp2 = BFP2[k];
      p.av_cfp3 = BFP3[k];
    }
    if (p.lvar >= 4) {
      let kdv = p.mdvar;
      p.av_ws = kdv >= 20;
      if (p.av_ws) kdv -= 20;
      p.av_w1 = kdv >= 10;
      if (p.av_w1) kdv -= 10;
      if (kdv < 0 || kdv > 3) {
        kdv = 0;
        p.kwx = Math.max(p.kwx, 2);
      }
      p.av_kdv = kdv;
    }
    if (p.lvar >= 3) {
      const q = Math.log(0.133 * p.wn);
      p.av_gm = p.av_cfm1 + p.av_cfm2 / ((p.av_cfm3 * q) ** 2 + 1);
      p.av_gp = p.av_cfp1 + p.av_cfp2 / ((p.av_cfp3 * q) ** 2 + 1);
    }
    if (p.lvar >= 2) p.av_dexa = Math.sqrt(18e6 * p.he[0]) + Math.sqrt(18e6 * p.he[1]) + (575.7e12 / p.wn) ** THIRD;
    p.av_de = p.dist < p.av_dexa ? (130e3 * p.dist) / p.av_dexa : 130e3 + p.dist - p.av_dexa;
    const de = p.av_de;
    p.av_vmd = curve(p.av_cv1, p.av_cv2, p.av_yv1, p.av_yv2, p.av_yv3, de);
    p.av_sgtm = curve(p.av_csm1, p.av_csm2, p.av_ysm1, p.av_ysm2, p.av_ysm3, de) * p.av_gm;
    p.av_sgtp = curve(p.av_csp1, p.av_csp2, p.av_ysp1, p.av_ysp2, p.av_ysp3, de) * p.av_gp;
    p.av_sgtd = p.av_sgtp * p.av_csd1;
    p.av_tgtd = (p.av_sgtp - p.av_sgtd) * p.av_zd;
    if (p.av_w1) p.av_sgl = 0;
    else {
      const q = (1 - 0.8 * Math.exp(-p.dist / 50e3)) * p.dh * p.wn;
      p.av_sgl = (10 * q) / (q + 13);
    }
    p.av_vs0 = p.av_ws ? 0 : (5 + 3 * Math.exp(-de / 100e3)) ** 2;
    p.lvar = 0;
  }
  let zt = zzt;
  let zl = zzl;
  const zc = zzc;
  const kdv = p.av_kdv;
  if (kdv === 0) {
    zt = zc;
    zl = zc;
  } else if (kdv === 1) zl = zc;
  else if (kdv === 2) zl = zt;
  if (Math.abs(zt) > 3.1 || Math.abs(zl) > 3.1 || Math.abs(zc) > 3.1) p.kwx = Math.max(p.kwx, 1);
  let sgt: number;
  if (zt < 0) sgt = p.av_sgtm;
  else if (zt <= p.av_zd) sgt = p.av_sgtp;
  else sgt = p.av_sgtd + p.av_tgtd / zt;
  const sgl = p.av_sgl;
  const vs = p.av_vs0 + (sgt * zt) ** 2 / (rt + zc * zc) + (sgl * zl) ** 2 / (rl + zc * zc);
  let yr: number;
  if (kdv === 0) {
    yr = 0;
    p.sgc = Math.sqrt(sgt * sgt + sgl * sgl + vs);
  } else if (kdv === 1) {
    yr = sgt * zt;
    p.sgc = Math.sqrt(sgl * sgl + vs);
  } else if (kdv === 2) {
    yr = Math.sqrt(sgt * sgt + sgl * sgl) * zt;
    p.sgc = Math.sqrt(vs);
  } else {
    yr = sgt * zt + sgl * zl;
    p.sgc = Math.sqrt(vs);
  }
  let avarv = p.aref - p.av_vmd - yr - p.sgc * zc;
  if (avarv < 0) avarv = (avarv * (29 - avarv)) / (29 - 10 * avarv);
  return avarv;
}

/** Horizontes del perfil. pfl: [np, xi, z0..znp]. */
function hzns(pfl: Float64Array, p: Prop) {
  const np = Math.trunc(pfl[0]);
  const xi = pfl[1];
  const za = pfl[2] + p.hg[0];
  const zb = pfl[np + 2] + p.hg[1];
  const qc = 0.5 * p.gme;
  let q = qc * p.dist;
  p.the[1] = (zb - za) / p.dist;
  p.the[0] = p.the[1] - q;
  p.the[1] = -p.the[1] - q;
  p.dl[0] = p.dist;
  p.dl[1] = p.dist;
  if (np >= 2) {
    let sa = 0;
    let sb = p.dist;
    let wq = true;
    for (let i = 1; i < np; i++) {
      sa += xi;
      sb -= xi;
      q = pfl[i + 2] - (qc * sa + p.the[0]) * sa - za;
      if (q > 0) {
        p.the[0] += q / sa;
        p.dl[0] = sa;
        wq = false;
      }
      if (!wq) {
        q = pfl[i + 2] - (qc * sb + p.the[1]) * sb - zb;
        if (q > 0) {
          p.the[1] += q / sb;
          p.dl[1] = sb;
        }
      }
    }
  }
}

/** Recta de mínimos cuadrados del perfil entre x1 y x2; devuelve [z0, zn] (alturas de la recta en los extremos). */
function z1sq1(z: Float64Array, x1: number, x2: number): [number, number] {
  const xn = z[0];
  let xa = Math.trunc(dim(x1 / z[1], 0));
  let xb = xn - Math.trunc(dim(xn, x2 / z[1]));
  if (xb <= xa) {
    xa = dim(xa, 1);
    xb = xn - dim(xn, xb + 1);
  }
  let ja = Math.trunc(xa);
  const jb = Math.trunc(xb);
  const n = jb - ja;
  xa = xb - xa;
  let x = -0.5 * xa;
  xb += x;
  // Regla del trapecio: los extremos pesan la mitad (algoritmo 1.2.2 de Hufford)
  let a = 0.5 * (z[ja + 2] + z[jb + 2]);
  let b = 0.5 * (z[ja + 2] - z[jb + 2]) * x;
  for (let i = 2; i <= n; i++) {
    ja++;
    x += 1;
    a += z[ja + 2];
    b += z[ja + 2] * x;
  }
  a = xa ? a / xa : 0;
  b = (b * 12) / ((xa * xa + 2) * xa);
  return [a - b * xb, a + b * (xn - xb)];
}

/** Elemento ir-ésimo (en orden descendente) de a[0..nn] (selección parcial; reordena a). */
function qtile(nn: number, a: Float64Array, off: number, ir: number): number {
  let q = 0;
  let m = 0;
  let n = nn;
  const k = Math.min(Math.max(0, ir), n);
  let i0 = 0;
  let j1 = 0;
  let goto10 = true;
  for (;;) {
    if (goto10) {
      q = a[off + k];
      i0 = m;
      j1 = n;
    }
    let i = i0;
    while (i <= n && a[off + i] >= q) i++;
    if (i > n) i = n;
    let j = j1;
    while (j >= m && a[off + j] <= q) j--;
    if (j < m) j = m;
    if (i < j) {
      const r = a[off + i];
      a[off + i] = a[off + j];
      a[off + j] = r;
      i0 = i + 1;
      j1 = j - 1;
      goto10 = false;
    } else if (i < k) {
      a[off + k] = a[off + i];
      a[off + i] = q;
      m = i + 1;
      goto10 = true;
    } else if (j > k) {
      a[off + k] = a[off + j];
      a[off + j] = q;
      n = j - 1;
      goto10 = true;
    } else break;
  }
  return q;
}

/** Irregularidad del terreno Δh (rango intercuantil 10–90 % de las desviaciones respecto a la recta). */
function d1thx(pfl: Float64Array, x1: number, x2: number): number {
  const np = Math.trunc(pfl[0]);
  let xa = x1 / pfl[1];
  let xb = x2 / pfl[1];
  if (xb - xa < 2) return 0;
  let ka = Math.trunc(0.1 * (xb - xa + 8));
  ka = Math.min(Math.max(4, ka), 25);
  const n = 10 * ka - 5;
  const kb = n - ka + 1;
  const sn = n - 1;
  const s = new Float64Array(n + 2);
  s[0] = sn;
  s[1] = 1;
  xb = (xb - xa) / sn;
  let k = Math.trunc(xa + 1);
  xa -= k;
  for (let j = 0; j < n; j++) {
    while (xa > 0 && k < np) {
      xa -= 1;
      k++;
    }
    s[j + 2] = pfl[k + 2] + (pfl[k + 2] - pfl[k + 1]) * xa;
    xa += xb;
  }
  let [za, zb] = z1sq1(s, 0, sn);
  zb = (zb - za) / sn;
  for (let j = 0; j < n; j++) {
    s[j + 2] -= za;
    za += zb;
  }
  let v = qtile(n - 1, s, 2, ka - 1) - qtile(n - 1, s, 2, kb - 1);
  v /= 1 - 0.8 * Math.exp(-(x2 - x1) / 50e3);
  return v;
}

function qlrpfl(pfl: Float64Array, klimx: number, mdvarx: number, p: Prop) {
  const np = Math.trunc(pfl[0]);
  p.dist = pfl[0] * pfl[1];
  hzns(pfl, p);
  const xl: [number, number] = [0, 0];
  for (let j = 0; j < 2; j++) xl[j] = Math.min(15 * p.hg[j], 0.1 * p.dl[j]);
  xl[1] = p.dist - xl[1];
  p.dh = d1thx(pfl, xl[0], xl[1]);
  if (p.dl[0] + p.dl[1] > 1.5 * p.dist) {
    const [za, zb] = z1sq1(pfl, xl[0], xl[1]);
    p.he[0] = p.hg[0] + dim(pfl[2], za);
    p.he[1] = p.hg[1] + dim(pfl[np + 2], zb);
    for (let j = 0; j < 2; j++) p.dl[j] = Math.sqrt((2 * p.he[j]) / p.gme) * Math.exp(-0.07 * Math.sqrt(p.dh / Math.max(p.he[j], 5)));
    let q = p.dl[0] + p.dl[1];
    if (q <= p.dist) {
      const t = p.dist / q;
      q = t * t;
      for (let j = 0; j < 2; j++) {
        p.he[j] *= q;
        p.dl[j] = Math.sqrt((2 * p.he[j]) / p.gme) * Math.exp(-0.07 * Math.sqrt(p.dh / Math.max(p.he[j], 5)));
      }
    }
    for (let j = 0; j < 2; j++) {
      const qq = Math.sqrt((2 * p.he[j]) / p.gme);
      p.the[j] = (0.65 * p.dh * (qq / p.dl[j] - 1) - 2 * p.he[j]) / qq;
    }
  } else {
    const [za] = z1sq1(pfl, xl[0], 0.9 * p.dl[0]);
    const [, zb] = z1sq1(pfl, p.dist - 0.9 * p.dl[1], xl[1]);
    p.he[0] = p.hg[0] + dim(pfl[2], za);
    p.he[1] = p.hg[1] + dim(pfl[np + 2], zb);
  }
  p.mdp = -1;
  p.lvar = Math.max(p.lvar, 3);
  if (mdvarx >= 0) {
    p.mdvar = mdvarx;
    p.lvar = Math.max(p.lvar, 4);
  }
  if (klimx > 0) {
    p.klim = klimx;
    p.lvar = 5;
  }
  lrprop(0, p);
}

/** Memoria reutilizable para el perfil en formato ITM (evita crear arreglos por celda). */
let bufferPfl = new Float64Array(1024);

/** Prepara el cálculo (constantes eléctricas, horizontes, alturas efectivas y atenuación de referencia). */
function preparar(e: EntradaItm): { p: Prop; fs: number; zsys: number } {
  const n = e.n ?? e.elev.length;
  const np = n - 1;
  if (bufferPfl.length < n + 2) bufferPfl = new Float64Array(n + 64);
  const pfl = bufferPfl;
  pfl[0] = np;
  pfl[1] = e.distanciaM / np;
  for (let i = 0; i < n; i++) pfl[i + 2] = e.elev[i];

  const p = new Prop();
  p.hg = [e.alturaTxM, e.alturaRxM];
  p.klim = e.clima;
  p.kwx = 0;
  p.lvar = 5;
  p.mdp = -1;
  // Altura media del sistema: promedio del 80 % central del perfil (como el original)
  const ja = Math.trunc(3 + 0.1 * np);
  const jb = np - ja + 6;
  let zsys = 0;
  for (let i = ja - 1; i < jb; i++) zsys += pfl[i];
  zsys /= jb - ja + 1;
  qlrps(e.frecuenciaMhz, zsys, e.refractividad, e.polarizacion, e.permitividad, e.conductividad, p);
  qlrpfl(pfl, p.klim, e.modo, p);
  const fs = 32.45 + 20 * Math.log10(e.frecuenciaMhz) + 20 * Math.log10(p.dist / 1000);
  return { p, fs, zsys };
}

/**
 * Predicción punto a punto del ITM sobre un perfil de terreno.
 * Devuelve la pérdida básica de transmisión para los porcentajes pedidos (como «pérdida de trayectoria» en Radio Mobile).
 */
export function itmPuntoAPunto(e: EntradaItm): SalidaItm {
  const { p, fs, zsys } = preparar(e);
  const ref = p.aref;
  const perdida = avar(qerfi(e.tiempo / 100), qerfi(e.ubicaciones / 100), qerfi(e.situaciones / 100), p) + fs;
  const q = p.dist - p.dla;
  const modo = q < 0 ? "linea-vista" : p.dist <= p.dlsa || p.dist <= p.dx ? "difraccion" : "dispersion";
  const salida: SalidaItm = { perdidaDb: perdida, espacioLibreDb: fs, referenciaDb: ref, modo, aviso: p.kwx, irregularidadM: p.dh, horizontesM: [p.dl[0], p.dl[1]] };
  if (e.depurar) salida.detalle = { he0: p.he[0], he1: p.he[1], the0: p.the[0], the1: p.the[1], dla: p.dla, dlsa: p.dlsa, tha: p.tha, aed: p.aed, emd: p.emd, gme: p.gme, ens: p.ens, zsys };
  return salida;
}

export type Estadistica = Pick<EntradaItm, "clima" | "modo" | "tiempo" | "ubicaciones" | "situaciones">;

/**
 * Pérdida para dos juegos de parámetros estadísticos (clima, modo y porcentajes) sobre el mismo trayecto
 * y las mismas constantes eléctricas: la parte determinística se calcula una sola vez.
 */
export function itmDosEstadisticas(e: EntradaItm, otra: Estadistica): [number, number] {
  const { p, fs } = preparar(e);
  const a = avar(qerfi(e.tiempo / 100), qerfi(e.ubicaciones / 100), qerfi(e.situaciones / 100), p) + fs;
  p.klim = otra.clima;
  p.mdvar = otra.modo;
  p.lvar = 5;
  const b = avar(qerfi(otra.tiempo / 100), qerfi(otra.ubicaciones / 100), qerfi(otra.situaciones / 100), p) + fs;
  return [a, b];
}
