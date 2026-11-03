// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// La gramática de las frases de entrenamiento del Modelo Melki en inglés. Las plantillas se escriben igual que en
// español (gramatica.mjs: «(a|b)», «[a|b]», «{ranura}», «@MACRO»); cambia «<verbo>»: aquí se pide en inglés
// («build me…», «can you build…», «would you mind building…», «I'd like to build…», «let's build…»). También cambian
// el pulido de la frase y el ruido (muletillas, contracciones sin apóstrofo, errores del dictado en inglés).
import { azar, compilar } from "./gramatica.mjs";

export { azar };

/* ───────────── Verbos ───────────── */

// base: imperativo (= infinitivo); ger: con -ing («would you mind building…»); me: con «me» («build me…», «show me…»)
const V = (base, ger, me = "") => ({ base: base.split("|"), ger: ger.split("|"), me: me ? me.split("|") : [] });

export const VERBOS = {
  build: V(
    "build|make|set up|put together|create|lay out|draw up|deploy|work out|come up with|put up|roll out|assemble",
    "building|making|setting up|putting together|creating|laying out|drawing up|deploying|rolling out",
    "build me|make me|set me up|put together for me|create me|draw me up|get me",
  ),
  design: V("design|plan|lay out|draft|sketch out|map out|engineer|plan out", "designing|planning|laying out|drafting|sketching out|mapping out", "design me|plan me|draft me|sketch me"),
  propose: V("propose|suggest|come up with|recommend|put forward", "proposing|suggesting|coming up with|recommending", "propose me|suggest me"),
  calculate: V("calculate|compute|work out|figure out|estimate", "calculating|computing|working out|figuring out|estimating", "calculate me|work out for me|figure out for me"),
  configure: V("configure|set up|configure up", "configuring|setting up", "configure me|set me up"),
  cover: V("cover|blanket|provide coverage for|get coverage over|bring coverage to|serve", "covering|blanketing|serving|providing coverage for", "cover me"),
  put: V("put|place|add|set|drop|stick|pop|plant", "putting|placing|adding|setting|dropping|sticking", "put me|place me|add me|give me|get me"),
  add: V("add|insert|include|throw in|put in|add in", "adding|inserting|including|throwing in", "add me|give me"),
  place: V("place|position|locate|site|plant|station", "placing|positioning|locating|siting", "place me"),
  install: V("install|mount|set up|deploy|put up|erect", "installing|mounting|setting up|deploying|putting up", "install me|set me up"),
  connect: V("connect|link|hook up|link up|tie in|bring in", "connecting|linking|hooking up|linking up", "connect me"),
  seed: V("seed|sow|plant|lay down", "seeding|sowing|planting", ""),
  move: V("move|shift|relocate|drag|reposition|push|slide|nudge|transfer|carry", "moving|shifting|relocating|dragging|repositioning|pushing|sliding", ""),
  delete: V("delete|remove|erase|get rid of|take out|wipe out|eliminate|trash|ditch|scrap", "deleting|removing|erasing|getting rid of|taking out|eliminating|scrapping", ""),
  clear: V("clear|wipe|clean|clean up|clear out|erase", "clearing|wiping|cleaning up|clearing out", ""),
  raise: V("raise|lift|increase|bump up|push up|elevate|put up", "raising|lifting|increasing|bumping up|elevating", ""),
  lower: V("lower|reduce|bring down|drop|decrease", "lowering|reducing|bringing down|dropping|decreasing", ""),
  change: V("change|set|switch|adjust|modify|update|make", "changing|setting|switching|adjusting|modifying|updating", ""),
  rename: V("rename|re-name|relabel", "renaming|relabeling", ""),
  call: V("call|name|label|title", "calling|naming|labeling", ""),
  duplicate: V("duplicate|copy|clone|replicate", "duplicating|copying|cloning|replicating", "duplicate me|copy me|clone me"),
  point: V("point|aim|orient|direct|turn|face|swing", "pointing|aiming|orienting|directing|turning", ""),
  send: V("send|fire off|shoot|dispatch|transmit", "sending|firing off|shooting|dispatching|transmitting", ""),
  test: V("test|try|check|trial|try out", "testing|trying|checking|trying out", ""),
  simulate: V("simulate|run|calculate|compute|process|crunch", "simulating|running|calculating|computing|processing", "simulate me|run me"),
  show: V("show|display|bring up|reveal|pull up|turn on", "showing|displaying|bringing up|revealing|pulling up", "show me"),
  hide: V("hide|remove|turn off|switch off|take away|get rid of|disable|take off", "hiding|removing|turning off|switching off", ""),
  enable: V("turn on|enable|activate|switch on", "turning on|enabling|activating|switching on", ""),
  disable: V("turn off|disable|deactivate|switch off|shut off", "turning off|disabling|deactivating|switching off", ""),
  tell: V("tell|give|show", "telling|giving|showing", "tell me|give me|show me"),
  explain: V("explain|describe|break down|go over", "explaining|describing|breaking down|going over", "explain to me|walk me through"),
  export: V("export|download|save|output", "exporting|downloading|saving", "export me|download me"),
  load: V("load|open|bring up|pull up|launch|put on", "loading|opening|bringing up|pulling up|launching", "load me|open me|load up"),
  populate: V("populate|fill|fill up|load", "populating|filling|filling up", ""),
  optimize: V("optimize|optimise|tune|improve|fine-tune", "optimizing|optimising|tuning|improving", ""),
  adjust: V("adjust|fix|tweak|correct|tune|rework|sort out", "adjusting|fixing|tweaking|correcting|reworking", ""),
  improve: V("improve|enhance|upgrade|boost", "improving|enhancing|upgrading", ""),
  measure: V("measure|gauge|check", "measuring|gauging|checking", ""),
  size: V("size|dimension|scale|spec out", "sizing|dimensioning|scaling|specing out", ""),
  estimate: V("estimate|calculate|work out|figure out", "estimating|calculating|working out|figuring out", ""),
  undo: V("undo|revert|roll back|reverse|take back", "undoing|reverting|rolling back|reversing", ""),
  open: V("open|bring up|pull up|launch|start|get out", "opening|bringing up|pulling up|launching", "open me|get me"),
  use: V("use|apply|go with|switch to", "using|applying|going with|switching to", ""),
  find: V("find|locate|search for|look for|look up|track down", "finding|locating|searching for|looking for|tracking down", "find me"),
  start: V("start|begin|kick off|launch", "starting|beginning|kicking off|launching", ""),
  present: V("present|show|pitch|run through", "presenting|showing|pitching", "present me|show me"),
  speak: V("speak|talk|read aloud|read out loud", "speaking|talking|reading aloud", ""),
  check: V("check|review|inspect|analyze|analyse|look at|examine", "checking|reviewing|inspecting|analyzing|looking at", "check me"),
};

// Pedir con cortesía: aceptan el verbo con «me» («can you show me…»)
const PODER = ["can you", "could you", "would you", "will you", "can you please", "could you please", "would you please", "please", "kindly", "just", "go ahead and", "I need you to", "I want you to", "I'd like you to", "I would like you to", "would you be able to", "any chance you could", "do you think you could", "can u", "could u", "pls", "plz", "now", "ok now", "can you just", "could you maybe", "would you kindly", "I'd appreciate it if you could", "I was hoping you could", "I was wondering if you could", "it'd be great if you could", "you can", "you could", "would it be possible to"];
// Sin «me» después («let's build…», «I want to build…»)
const QUERER = ["I want to", "I need to", "I'd like to", "I would like to", "I wanna", "I gotta", "we need to", "we should", "we have to", "I have to", "time to", "I'm trying to", "I am trying to", "I'm looking to", "try to", "we want to", "we'd like to", "let's", "let us", "let me", "lemme", "help me", "can I", "can we", "could we", "how about we", "why don't we", "maybe we could", "it would be nice to", "I'm going to", "I'm gonna", "we're going to", "I plan to", "the idea is to", "the plan is to", "my goal is to", "I'd love to", "we must", "go and", "I wish to", "I intend to"];
// Con -ing («would you mind building…»)
const GERUNDIO = ["would you mind", "do you mind", "how about", "what about", "I'm thinking about", "I'm thinking of", "start", "try", "consider", "I'm interested in", "can you start", "I'd like to start", "we should start", "how about you start"];

/** Un verbo pedido como se pide algo en inglés («build me», «can you build», «would you mind building», «let's build»). */
export function pedirCon(v, r) {
  const x = r();
  const conMe = () => (v.me.length && r() < 0.3 ? r.elegir(v.me) : r.elegir(v.base));
  if (x < 0.36) return conMe();
  if (x < 0.57) return `${r.elegir(PODER)} ${conMe()}`;
  if (x < 0.64) return `${r.elegir(GERUNDIO)} ${r.elegir(v.ger)}`;
  return `${r.elegir(QUERER)} ${r.elegir(v.base)}`;
}

/* ───────────── Plantillas ───────────── */

/** Saca una frase de una plantilla compilada (como en gramatica.mjs, con los verbos en inglés). */
export function expandir(partes, r, ranuras, macros, prof = 0) {
  if (prof > 12) throw new Error("Plantilla demasiado anidada");
  let s = "";
  for (const p of partes) {
    if (p.t === "txt") s += p.v;
    else if (p.t === "alt") s += expandir(r.elegir(p.v), r, ranuras, macros, prof + 1);
    else if (p.t === "opc") s += r() < 0.5 ? expandir(r.elegir(p.v), r, ranuras, macros, prof + 1) : "";
    else if (p.t === "ran") {
      const lista = ranuras[p.v];
      if (!lista) throw new Error(`Ranura desconocida {${p.v}}`);
      s += expandir(r.elegir(lista), r, ranuras, macros, prof + 1);
    } else if (p.t === "macro") {
      const m = macros[p.v];
      if (!m) throw new Error(`Macro desconocida @${p.v}`);
      s += expandir(r.elegir(m), r, ranuras, macros, prof + 1);
    } else if (p.t === "verbo") {
      const v = VERBOS[r.elegir(p.v)];
      if (!v) throw new Error(`Verbo desconocido <${p.v.join("|")}>`);
      s += pedirCon(v, r);
    }
  }
  return s;
}

/** Compila todas las plantillas de un diccionario {nombre: [plantillas]}. */
export const compilarTodas = (dic) => Object.fromEntries(Object.entries(dic).map(([k, lista]) => [k, lista.map((t) => compilar(t))]));

// «a» antes de vocal suena «an» («an antenna», «an 8 m tower»)
const CON_AN = /\b([Aa]) (?=(?:antenna|area|example|AI|extra|hour|optimal|option|overview|estimate|economical|eighty|eight|11|18|80|8|easy|empty|old|identical|initial|inspector|investor|onboarding|intro|automatic|alternative|engineer|elevation|update|island|open|ok|actual|account|idea|image|inventory|identical|uplink|internet|aerial)\b)/g;

/** Deja la frase limpia: espacios, comas, signos y «a/an». */
export function pulir(s) {
  let t = s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/,+/g, ",")
    .replace(/\b(the|a|an|to|of|in|on|at|for|with|me) \1\b/gi, "$1")
    .replace(CON_AN, "$1n ")
    .trim();
  t = t.replace(/^[,.\s]+/, "").replace(/,\s*$/, "");
  return t;
}

/* ───────────── Ruido: lo que pasa al escribir rápido o al dictar en inglés ───────────── */

const PREFIJOS = ["please", "hey", "hey Melki", "Melki", "ok Melki", "hi", "hello", "hi Melki", "so", "ok", "okay", "alright", "all right", "now", "and now", "then", "ok so", "um", "uh", "well", "right", "listen", "look", "excuse me", "sorry", "one thing", "next", "also", "and", "oh", "actually", "hmm", "yo", "good morning", "good afternoon", "great", "perfect", "cool", "nice", "ok now", "alright then", "Melki please", "hey there", "so now", "right so", "and then", "hey Milky", "Milky", "hey Melky", "okay so", "so basically", "quick one", "one more thing", "anyway", "now then", "ok cool", "good", "fine", "let's see", "erm", "sir"];
const SUFIJOS = ["please", "pls", "plz", "thanks", "thank you", "now", "right now", "asap", "quickly", "when you can", "if possible", "if you can", "for me", "Melki", "ok?", "okay?", "will you?", "can you?", "real quick", "thanks a lot", "cheers", "if you don't mind", "please and thank you", "now please", "for now", "again", "too", "as well", "thx", "ty", "please Melki", "would you?", "yeah?", "right?", "already", "now thanks", "mate", "buddy"];

/** Errores del dictado y del teclado en palabras del simulador. */
const DICTADO = [
  [/\brepeater\b/gi, ["repeter", "repiter", "re peater", "repeat her", "repeator", "repeather", "repeater", "repetidor", "reaper", "repeated"]],
  [/\brepeaters\b/gi, ["repeters", "repiters", "repeators", "repeaters", "repeat hers", "repetidores"]],
  [/\bgateway\b/gi, ["gate way", "getaway", "gatway", "gateaway", "gate-way", "gateway", "gateway", "gatewey", "the gate"]],
  [/\bMeshtastic\b/gi, ["mesh tastic", "meshtastik", "mestastic", "mesh tactic", "mesh-tastic", "meshtastic"]],
  [/\bMeshCore\b/gi, ["mesh core", "meshcor", "mesh-core", "mesh corps", "mesh course", "meshcore"]],
  [/\bsimulate\b/gi, ["simulat", "stimulate", "simulate", "simulator", "simmulate", "similate"]],
  [/\bsimulation\b/gi, ["stimulation", "simulacion", "simulaton", "simulation"]],
  [/\bantenna\b/gi, ["antena", "antennae", "anttena", "and tena", "antenna"]],
  [/\bantennas\b/gi, ["antenas", "antennae", "antenna's", "antennas"]],
  [/\bcoverage\b/gi, ["covrage", "coverge", "cover age", "coverage", "covarage"]],
  [/\bsignal\b/gi, ["signall", "singal", "signal", "sygnal"]],
  [/\bmesh\b/gi, ["mash", "mess", "mesh", "mush"]],
  [/\bpeople\b/gi, ["peeple", "ppl", "people", "peopel"]],
  [/\bkilometers\b/gi, ["kilometres", "kms", "km", "kilometer", "klicks", "kilomiters"]],
  [/\bhectares\b/gi, ["hectars", "hectors", "hectares", "ha", "hectareas"]],
  [/\bWhatsApp\b/gi, ["whatsapp", "whats app", "watsapp", "whatsap"]],
  [/\bmeters\b/gi, ["metres", "meter", "mts", "metters"]],
  [/\bStarlink\b/gi, ["star link", "starlink", "starling", "star-link"]],
  [/\bLoRa\b/g, ["Laura", "lora", "lore a", "LoRa"]],
  [/\bnetwork\b/gi, ["netwrok", "net work", "network", "netowrk"]],
  [/\bplease\b/gi, ["pls", "plz", "please", "pleas"]],
  [/\byou\b/gi, ["u", "you", "ya"]],
  [/\byour\b/gi, ["ur", "your", "you're"]],
  [/\bwant to\b/gi, ["wanna", "want to"]],
  [/\bgoing to\b/gi, ["gonna", "going to"]],
  [/\bfrom\b/gi, ["frm", "from", "form"]],
  [/\bthe\b/gi, ["teh", "the", "da"]],
];

// Contracciones: con y sin apóstrofo, o abiertas («what's», «whats», «what is»)
const CONTRACCIONES = [
  [/\bwhat's\b/gi, ["whats", "what is", "what's", "wats"]],
  [/\bwhat is\b/gi, ["what's", "whats", "what is"]],
  [/\bdon't\b/gi, ["dont", "do not", "don't"]],
  [/\bdoesn't\b/gi, ["doesnt", "does not", "doesn't"]],
  [/\bisn't\b/gi, ["isnt", "is not", "isn't"]],
  [/\bcan't\b/gi, ["cant", "cannot", "can not", "can't"]],
  [/\bI'm\b/g, ["im", "I am", "Im", "i'm"]],
  [/\bI'd\b/g, ["id", "I would", "Id", "i'd"]],
  [/\bI'll\b/g, ["ill", "I will", "Ill"]],
  [/\blet's\b/gi, ["lets", "let us", "let's"]],
  [/\bit's\b/gi, ["its", "it is", "it's"]],
  [/\bthere's\b/gi, ["theres", "there is", "there's"]],
  [/\bwhere's\b/gi, ["wheres", "where is", "where's"]],
  [/\bhow's\b/gi, ["hows", "how is", "how's"]],
  [/\bwho's\b/gi, ["whos", "who is", "who's"]],
  [/\bthat's\b/gi, ["thats", "that is", "that's"]],
  [/\byou're\b/gi, ["youre", "you are", "ur", "you're"]],
  [/\bwon't\b/gi, ["wont", "will not", "won't"]],
  [/\baren't\b/gi, ["arent", "are not", "aren't"]],
  [/\bwe're\b/gi, ["were", "we are", "we're"]],
  [/\bit'd\b/gi, ["itd", "it would", "it'd"]],
];

const VECINAS = { a: "qsz", e: "wrd", i: "uok", o: "ipl", u: "yij", s: "adw", r: "etf", t: "ryg", n: "bm", m: "n", l: "ko", c: "xv", d: "sfe", p: "o", b: "vn", g: "fh", v: "cb", h: "gj", y: "tu", w: "qe", k: "jl", f: "dg" };

/** Un error de tecleo en una palabra larga (una letra de menos, de más, cambiada o vecina). */
function tecleo(frase, r) {
  const palabras = frase.split(" ");
  const largas = palabras.map((p, i) => [p, i]).filter(([p]) => p.length >= 5 && /^[a-z]+$/i.test(p));
  if (!largas.length) return frase;
  const [p, i] = r.elegir(largas);
  const k = r.entero(1, p.length - 2);
  const x = r();
  let q;
  if (x < 0.3) q = p.slice(0, k) + p.slice(k + 1);
  else if (x < 0.55) q = p.slice(0, k) + p[k + 1] + p[k] + p.slice(k + 2);
  else if (x < 0.75) q = p.slice(0, k) + p[k] + p.slice(k);
  else {
    const v = VECINAS[p[k].toLowerCase()];
    q = v ? p.slice(0, k) + r.elegir(v.split("")) + p.slice(k + 1) : p;
  }
  palabras[i] = q;
  return palabras.join(" ");
}

/** Sin artículos, como se escribe de afán o se dicta en telegrama («add repeater north of gateway»). */
const sinArticulos = (f) => f.replace(/\b(the|a|an) (?=[a-z0-9])/gi, "").replace(/\s+/g, " ");

/** La misma frase como la escribiría o la dictaría alguien de afán: saludos, «please», contracciones, errores. */
export function ensuciar(frase, r) {
  let f = frase;
  for (const [re, opciones] of DICTADO) if (f.search(re) >= 0 && r() < 0.2) f = f.replace(re, () => r.elegir(opciones));
  for (const [re, opciones] of CONTRACCIONES) if (f.search(re) >= 0 && r() < 0.35) f = f.replace(re, () => r.elegir(opciones));
  if (r() < 0.22) f = `${r.elegir(PREFIJOS)}${r() < 0.5 ? "," : ""} ${f.charAt(0).toLowerCase()}${f.slice(1)}`;
  if (r() < 0.16) f = `${f.replace(/[?.!]$/, "")} ${r.elegir(SUFIJOS)}`;
  if (r() < 0.06) f = sinArticulos(f);
  if (r() < 0.1) f = tecleo(f, r);
  if (r() < 0.04) f = tecleo(f, r);
  // Sin apóstrofos ni signos (el teclado del celular o el dictado)
  if (r() < 0.2) f = f.replace(/['’]/g, "");
  if (r() < 0.3) f = f.replace(/[?!,.]/g, "");
  if (r() < 0.3) f = f.toLowerCase();
  return pulir(f);
}
