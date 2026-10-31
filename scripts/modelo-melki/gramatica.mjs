// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// La gramática con que se escriben las frases de entrenamiento del Modelo Melki. Una plantilla se lee así:
//   (a|b|c)   una de las opciones
//   [a|b]     opcional (la mitad de las veces), y si va, una de las opciones
//   {ranura}  un valor de la ranura (una distancia, un lugar, un nodo…)
//   @MACRO    otra plantilla con nombre
//   <armar|hacer>  uno de esos verbos, conjugado de las formas en que se piden las cosas («ármame», «me puedes
//                  armar», «quiero que me armes», «¿me armas…?», «vamos a armar»…)
// Todo es reproducible: el azar sale de una semilla.

/** Azar con semilla (mulberry32): el mismo entrenamiento da el mismo modelo. */
export function azar(semilla) {
  let a = semilla >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.elegir = (lista) => lista[Math.floor(f() * lista.length)];
  f.entero = (min, max) => min + Math.floor(f() * (max - min + 1));
  return f;
}

/* ───────────── Verbos ───────────── */

// imp: imperativos (tú y usted, con y sin «me»); inf: infinitivo; infMe: con «me»; subj: subjuntivo; pres: presente
const V = (imp, inf, infMe, subj, pres) => ({ imp: imp.split("|"), inf: inf.split("|"), infMe: infMe ? infMe.split("|") : [], subj: subj.split("|"), pres: pres.split("|") });

export const VERBOS = {
  armar: V("arma|ármame|arme|ármeme|ármenme", "armar", "armarme", "armes|arme", "armas|arma"),
  hacer: V("haz|hazme|haga|hágame|hágannos", "hacer", "hacerme", "hagas|haga", "haces|hace"),
  disenar: V("diseña|diséñame|diseñe|diséñeme", "diseñar", "diseñarme", "diseñes|diseñe", "diseñas|diseña"),
  montar: V("monta|móntame|monte|mónteme", "montar", "montarme", "montes|monte", "montas|monta"),
  crear: V("crea|créame|cree|créeme", "crear", "crearme", "crees|cree", "creas|crea"),
  construir: V("construye|constrúyeme|construya|constrúyame", "construir", "construirme", "construyas|construya", "construyes|construye"),
  levantar: V("levanta|levántame|levante|levánteme", "levantar", "levantarme", "levantes|levante", "levantas|levanta"),
  planear: V("planea|planéame|planee|planéeme|planifica|planifícame", "planear|planificar", "planearme|planificarme", "planees|planee|planifiques", "planeas|planea|planificas"),
  calcular: V("calcula|calcúlame|calcule|calcúleme", "calcular", "calcularme", "calcules|calcule", "calculas|calcula"),
  configurar: V("configura|configúrame|configure|configúreme", "configurar", "configurarme", "configures|configure", "configuras|configura"),
  proponer: V("propón|propónme|proponga|propóngame", "proponer", "proponerme", "propongas|proponga", "propones|propone"),
  cubrir: V("cubre|cúbreme|cubra|cúbrame", "cubrir", "cubrirme", "cubras|cubra", "cubres|cubre"),
  dar: V("da|dame|dé|deme|dele|dale", "dar", "darme", "des|dé", "das|da"),
  poner: V("pon|ponme|ponga|póngame|ponle|póngale", "poner", "ponerme|ponerle", "pongas|ponga", "pones|pone"),
  agregar: V("agrega|agrégame|agregue|agrégueme|agrégale", "agregar", "agregarme|agregarle", "agregues|agregue", "agregas|agrega"),
  anadir: V("añade|añádeme|añada|añádame|añádele", "añadir", "añadirme|añadirle", "añadas|añada", "añades|añade"),
  colocar: V("coloca|colócame|coloque|colóqueme|colócale", "colocar", "colocarme", "coloques|coloque", "colocas|coloca"),
  ubicar: V("ubica|ubícame|ubique|ubíqueme", "ubicar", "ubicarme", "ubiques|ubique", "ubicas|ubica"),
  instalar: V("instala|instálame|instale|instáleme", "instalar", "instalarme", "instales|instale", "instalas|instala"),
  meter: V("mete|méteme|métele|meta|métame|métale", "meter", "meterme|meterle", "metas|meta", "metes|mete"),
  echar: V("echa|échame|échale|eche|échele", "echar", "echarme|echarle", "eches|eche", "echas|echa"),
  sembrar: V("siembra|siémbrame|siembre|siémbreme", "sembrar", "sembrarme", "siembres|siembre", "siembras|siembra"),
  conectar: V("conecta|conéctame|conecte|conécteme", "conectar", "conectarme", "conectes|conecte", "conectas|conecta"),
  enlazar: V("enlaza|enlázame|enlace|enlázale", "enlazar", "enlazarme", "enlaces|enlace", "enlazas|enlaza"),
  mover: V("mueve|muéveme|mueva|muévame", "mover", "moverme", "muevas|mueva", "mueves|mueve"),
  correr: V("corre|córreme|corra|córrame", "correr", "correrme", "corras|corra", "corres|corre"),
  trasladar: V("traslada|trasládame|traslade|trasládeme", "trasladar", "trasladarme", "traslades|traslade", "trasladas|traslada"),
  reubicar: V("reubica|reubícame|reubique|reubíqueme", "reubicar", "reubicarme", "reubiques|reubique", "reubicas|reubica"),
  pasar: V("pasa|pásame|pase|páseme", "pasar", "pasarme", "pases|pase", "pasas|pasa"),
  borrar: V("borra|bórrame|borre|bórreme", "borrar", "borrarme", "borres|borre", "borras|borra"),
  eliminar: V("elimina|elimíname|elimine|elimíneme", "eliminar", "eliminarme", "elimines|elimine", "eliminas|elimina"),
  quitar: V("quita|quítame|quite|quíteme", "quitar", "quitarme", "quites|quite", "quitas|quita"),
  sacar: V("saca|sácame|saque|sáqueme", "sacar", "sacarme", "saques|saque", "sacas|saca"),
  subir: V("sube|súbeme|súbele|suba|súbale", "subir", "subirme|subirle", "subas|suba", "subes|sube"),
  bajar: V("baja|bájame|bájale|baje|bájele", "bajar", "bajarme|bajarle", "bajes|baje", "bajas|baja"),
  cambiar: V("cambia|cámbiame|cámbiale|cambie|cámbiele", "cambiar", "cambiarme|cambiarle", "cambies|cambie", "cambias|cambia"),
  renombrar: V("renombra|renómbrame|renombre|renómbreme", "renombrar", "renombrarme", "renombres|renombre", "renombras|renombra"),
  llamar: V("llama|llámalo|llámala|llame|llámelo", "llamar", "llamarlo", "llames|llame", "llamas|llama"),
  duplicar: V("duplica|duplícame|duplique|duplíqueme", "duplicar", "duplicarme", "dupliques|duplique", "duplicas|duplica"),
  copiar: V("copia|cópiame|copie|cópieme|clona", "copiar|clonar", "copiarme", "copies|copie", "copias|copia"),
  apuntar: V("apunta|apúntame|apunte|apúnteme", "apuntar", "apuntarme", "apuntes|apunte", "apuntas|apunta"),
  orientar: V("orienta|oriéntame|oriente|oriénteme|dirige", "orientar|dirigir", "orientarme", "orientes|oriente", "orientas|orienta"),
  enviar: V("envía|envíame|envíe|envíeme", "enviar", "enviarme", "envíes|envíe", "envías|envía"),
  mandar: V("manda|mándame|mándale|mande|mándele", "mandar", "mandarme|mandarle", "mandes|mande", "mandas|manda"),
  probar: V("prueba|pruébame|pruebe|pruébeme", "probar", "probarme", "pruebes|pruebe", "pruebas|prueba"),
  simular: V("simula|simúlame|simule|simúleme|simúlalo", "simular", "simularme", "simules|simule", "simulas|simula"),
  correrSim: V("corre|córrela|corra|córrala", "correr", "correrla", "corras|corra", "corres|corre"),
  mostrar: V("muestra|muéstrame|muestre|muéstreme", "mostrar", "mostrarme", "muestres|muestre", "muestras|muestra"),
  ensenar: V("enseña|enséñame|enseñe|enséñeme", "enseñar", "enseñarme", "enseñes|enseñe", "enseñas|enseña"),
  ocultar: V("oculta|ocúltame|oculte|ocúlteme", "ocultar", "ocultarme", "ocultes|oculte", "ocultas|oculta"),
  esconder: V("esconde|escóndeme|esconda|escóndame", "esconder", "esconderme", "escondas|esconda", "escondes|esconde"),
  apagar: V("apaga|apágame|apague|apágueme", "apagar", "apagarme", "apagues|apague", "apagas|apaga"),
  prender: V("prende|préndeme|prenda|préndame|enciende|enciéndeme", "prender|encender", "prenderme|encenderme", "prendas|prenda|enciendas", "prendes|prende|enciendes"),
  activar: V("activa|actívame|active|actíveme", "activar", "activarme", "actives|active", "activas|activa"),
  desactivar: V("desactiva|desactívame|desactive|desactíveme", "desactivar", "desactivarme", "desactives|desactive", "desactivas|desactiva"),
  llevar: V("lleva|llévame|lleve|lléveme|llévanos", "llevar", "llevarme", "lleves|lleve", "llevas|lleva"),
  decir: V("di|dime|diga|dígame", "decir", "decirme", "digas|diga", "dices|dice"),
  contar: V("cuenta|cuéntame|cuente|cuénteme", "contar", "contarme", "cuentes|cuente", "cuentas|cuenta"),
  explicar: V("explica|explícame|explique|explíqueme", "explicar", "explicarme", "expliques|explique", "explicas|explica"),
  exportar: V("exporta|expórtame|exporte|expórteme", "exportar", "exportarme", "exportes|exporte", "exportas|exporta"),
  descargar: V("descarga|descárgame|descargue|descárgueme|baja|bájame", "descargar|bajar", "descargarme|bajarme", "descargues|descargue", "descargas|descarga"),
  guardar: V("guarda|guárdame|guarde|guárdeme", "guardar", "guardarme", "guardes|guarde", "guardas|guarda"),
  cargar: V("carga|cárgame|cargue|cárgueme", "cargar", "cargarme", "cargues|cargue", "cargas|carga"),
  abrir: V("abre|ábreme|abra|ábrame", "abrir", "abrirme", "abras|abra", "abres|abre"),
  poblar: V("puebla|puéblame|pueble|puébleme", "poblar", "poblarme", "puebles|pueble", "pueblas|puebla"),
  llenar: V("llena|lléname|llene|lléneme", "llenar", "llenarme", "llenes|llene", "llenas|llena"),
  optimizar: V("optimiza|optimízame|optimice|optimíceme", "optimizar", "optimizarme", "optimices|optimice", "optimizas|optimiza"),
  ajustar: V("ajusta|ajústame|ajuste|ajústeme|ajústamelo", "ajustar", "ajustarme", "ajustes|ajuste", "ajustas|ajusta"),
  arreglar: V("arregla|arréglame|arregle|arrégleme|arréglamelo", "arreglar", "arreglarme", "arregles|arregle", "arreglas|arregla"),
  mejorar: V("mejora|mejórame|mejore|mejóreme", "mejorar", "mejorarme", "mejores|mejore", "mejoras|mejora"),
  medir: V("mide|mídeme|mida|mídame", "medir", "medirme", "midas|mida", "mides|mide"),
  dimensionar: V("dimensiona|dimensióname|dimensione|dimensióneme", "dimensionar", "dimensionarme", "dimensiones|dimensione", "dimensionas|dimensiona"),
  estimar: V("estima|estímame|estime|estímeme", "estimar", "estimarme", "estimes|estime", "estimas|estima"),
  deshacer: V("deshaz|deshazme|deshaga|deshágame", "deshacer", "deshacerme", "deshagas|deshaga", "deshaces|deshace"),
  revertir: V("revierte|revierta|reviérteme", "revertir", "revertirme", "reviertas|revierta", "reviertes|revierte"),
  presentar: V("presenta|preséntame|presente|preséntenos|preséntame", "presentar", "presentarme", "presentes|presente", "presentas|presenta"),
  hablar: V("habla|háblame|hable|hábleme", "hablar", "hablarme", "hables|hable", "hablas|habla"),
  leer: V("lee|léeme|lea|léame", "leer", "leerme", "leas|lea", "lees|lee"),
  escuchar: V("escucha|escúchame|escuche|escúcheme", "escuchar", "escucharme", "escuches|escuche", "escuchas|escucha"),
  limpiar: V("limpia|límpiame|limpie|límpieme", "limpiar", "limpiarme", "limpies|limpie", "limpias|limpia"),
  encuadrar: V("encuadra|encuádrame|encuadre|encuádreme", "encuadrar", "encuadrarme", "encuadres|encuadre", "encuadras|encuadra"),
  centrar: V("centra|céntrame|centre|céntreme", "centrar", "centrarme", "centres|centre", "centras|centra"),
  aceptar: V("acepta|acéptala|acepte|acéptela", "aceptar", "aceptarla", "aceptes|acepte", "aceptas|acepta"),
  descartar: V("descarta|descártala|descarte|descártela", "descartar", "descartarla", "descartes|descarte", "descartas|descarta"),
  aplicar: V("aplica|aplícala|aplique|aplíquela", "aplicar", "aplicarla", "apliques|aplique", "aplicas|aplica"),
  usar: V("usa|úsala|use|úsela|utiliza", "usar|utilizar", "usarla", "uses|use", "usas|usa"),
  dejar: V("deja|déjame|deje|déjeme|déjalo", "dejar", "dejarme", "dejes|deje", "dejas|deja"),
  empezar: V("empieza|empiece|comienza|arranca", "empezar|comenzar|arrancar", "empezarme", "empieces|empiece", "empiezas|empieza"),
  ir: V("ve|vaya|vamos|llévame|vete", "ir", "irme", "vayas|vaya", "vas|va"),
  buscar: V("busca|búscame|busque|búsqueme", "buscar", "buscarme", "busques|busque", "buscas|busca"),
  revisar: V("revisa|revísame|revise|revíseme", "revisar", "revisarme", "revises|revise", "revisas|revisa"),
  ver: V("muéstrame|enséñame|déjame ver|mira|mire", "ver|mirar", "verme", "veas|vea", "ves|ve"),
};

const PODER = ["puedes", "podrías", "puede", "podría", "será que puedes", "será que puede", "sería posible", "se puede", "es posible", "alcanzas a", "me haces el favor de", "hágame el favor de", "hazme el favor de", "me ayudas a", "ayúdame a", "ayúdeme a", "por favor"];
const PODER_ME = ["me puedes", "me podrías", "me puede", "me podría", "será que me puedes", "será que me puede"];
const QUERER_QUE = ["quiero que", "necesito que", "quisiera que", "me gustaría que", "te pido que", "le pido que", "ocupo que", "requiero que", "dale y", "a ver si", "porfa"];
const IR_A = ["vamos a", "hay que", "toca", "tocaría", "necesito", "quiero", "quisiera", "me gustaría", "necesitamos", "queremos", "deberíamos", "quiero que me ayudes a", "ayúdame a", "intenta", "trata de", "procede a", "empecemos a"];

/** Un verbo conjugado como se pide algo («ármame», «me puedes armar», «quiero que me armes», «vamos a armar»). */
export function pedirCon(v, r) {
  const x = r();
  if (x < 0.36) return r.elegir(v.imp);
  if (x < 0.5) return `${r.elegir(PODER)} ${r.elegir([...v.inf, ...v.infMe])}`;
  if (x < 0.58) return `${r.elegir(PODER_ME)} ${r.elegir(v.inf)}`;
  if (x < 0.72) return `${r.elegir(QUERER_QUE)} ${r() < 0.55 ? "me " : ""}${r.elegir(v.subj)}`;
  if (x < 0.82) return `${r() < 0.4 ? "¿" : ""}${r() < 0.6 ? "me " : ""}${r.elegir(v.pres)}`;
  return `${r.elegir(IR_A)} ${r.elegir(v.inf)}`;
}

/* ───────────── Plantillas ───────────── */

/**
 * Lee una plantilla y la deja lista para sacar frases. «(a|b)?» seguido de más texto también es opcional (y «,?», una
 * coma opcional); un «?» al final es el de la pregunta.
 */
export function compilar(plantilla) {
  const texto = plantilla.replace(/,\?/g, "[,]");
  let i = 0;
  const secuencia = (fin) => {
    const partes = [];
    let buf = "";
    const soltar = () => {
      if (buf) partes.push({ t: "txt", v: buf });
      buf = "";
    };
    while (i < texto.length) {
      const c = texto[i];
      if (fin.includes(c)) break;
      if (c === "(" || c === "[") {
        soltar();
        i++;
        const opciones = alternativas(c === "(" ? ")" : "]");
        const opcional = c === "(" && texto[i] === "?" && i + 1 < texto.length && !"])|".includes(texto[i + 1]);
        if (opcional) i++;
        partes.push({ t: c === "(" && !opcional ? "alt" : "opc", v: opciones });
        continue;
      }
      if (c === "{") {
        soltar();
        const j = texto.indexOf("}", i);
        partes.push({ t: "ran", v: texto.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
      if (c === "<") {
        soltar();
        const j = texto.indexOf(">", i);
        partes.push({ t: "verbo", v: texto.slice(i + 1, j).split("|") });
        i = j + 1;
        continue;
      }
      if (c === "@") {
        soltar();
        const m = texto.slice(i + 1).match(/^[A-Z_0-9]+/);
        partes.push({ t: "macro", v: m[0] });
        i += 1 + m[0].length;
        continue;
      }
      buf += c;
      i++;
    }
    soltar();
    return partes;
  };
  const alternativas = (cierre) => {
    const opciones = [];
    for (;;) {
      opciones.push(secuencia(`|${cierre}`));
      if (texto[i] === "|") {
        i++;
        continue;
      }
      i++; // el cierre
      return opciones;
    }
  };
  return secuencia("");
}

/** Saca una frase de una plantilla compilada. */
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

/** Deja la frase limpia: espacios, comas y signos de pregunta. */
export function pulir(s) {
  let t = s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/¿\s+/g, "¿")
    .replace(/,+/g, ",")
    .replace(/\b([Dd])e el\b/g, "$1el")
    .replace(/\b([Aa]) el\b/g, "$1l")
    .replace(/\ben (a|al|en)\b/g, "$1")
    .trim();
  t = t.replace(/^[,.\s]+/, "");
  // Un «¿» sin cerrar se cierra al final
  if (t.includes("¿") && !t.includes("?")) t += "?";
  return t;
}

/* ───────────── Ruido: lo que pasa al escribir rápido o al dictar ───────────── */

const PREFIJOS = ["por favor", "porfa", "oye", "oiga", "hola", "hola Melki", "Melki", "oye Melki", "hey Melki", "bueno", "bueno entonces", "listo", "listo entonces", "a ver", "mira", "mire", "dale", "venga", "ey", "ok", "okey", "vale", "perfecto", "ahora", "y ahora", "entonces", "ahora sí", "una cosa", "oye una cosa", "disculpa", "disculpe", "perdón", "eh", "este", "pues", "bueno pues", "listo pues", "Melki por favor", "hey", "buenas", "buenos días", "buenas tardes", "ya", "ajá", "y", "ahora bien", "otra cosa", "de pronto", "mmm", "a ver Melki"];
const SUFIJOS = ["por favor", "porfa", "porfis", "gracias", "ya", "ahora", "rápido", "de una", "cuando puedas", "si se puede", "si es posible", "¿sí?", "¿listo?", "¿puedes?", "¿se puede?", "pues", "Melki", "ahorita", "ahora mismo", "de una vez", "si puedes", "te lo agradezco", "muchas gracias", "plis", "please", "¿vale?", "¿ok?", "porfavor"];

/** Errores del dictado y del teclado en palabras del simulador. */
const DICTADO = [
  [/\brepetidor\b/g, ["repetidora", "repetido", "re petidor", "repertidor", "repetidro", "repetidor"]],
  [/\brepetidores\b/g, ["repetidoras", "repetidore", "repetidores"]],
  [/\bgateway\b/gi, ["getway", "geitway", "gueitwey", "gate way", "getwey", "geteway", "gateway", "gatewey", "el gate"]],
  [/\bMeshtastic\b/gi, ["mestastic", "mesh tastic", "meshtastik", "mestástic"]],
  [/\bMeshCore\b/gi, ["mesh core", "mescor", "mes cor", "meshcor", "mesh cord"]],
  [/\bestrés\b/g, ["estres", "stress", "estress", "estrés"]],
  [/\bWhatsApp\b/gi, ["wasap", "guasap", "whatsap", "wassap", "whats"]],
  [/\bkilómetros\b/g, ["kilometros", "kms", "km", "kilómetro"]],
  [/\bhectáreas\b/g, ["hectarias", "ectareas", "hectareas", "has"]],
  [/\bsimula\b/g, ["simúla", "simula", "simulá", "simulala"]],
  [/\bseñal\b/g, ["senal", "señal", "seña"]],
  [/\bantena\b/g, ["antena", "antenna", "anttena"]],
  [/\bcobertura\b/g, ["covertura", "cobertura", "cobertur"]],
  [/\bmalla\b/g, ["maya", "malla", "maia"]],
  [/\bpersonas\b/g, ["persona", "perzonas", "personas"]],
];

const VECINAS = { a: "qsz", e: "wrd", i: "uok", o: "ipl", u: "yij", s: "adw", r: "etf", t: "ryg", n: "bm", m: "n", l: "ko", c: "xv", d: "sfe", p: "o", b: "vn", g: "fh", v: "cb" };

/** Un error de tecleo en una palabra larga (una letra de menos, de más, cambiada o vecina). */
function tecleo(frase, r) {
  const palabras = frase.split(" ");
  const largas = palabras.map((p, i) => [p, i]).filter(([p]) => p.length >= 5 && /^[a-záéíóúñ]+$/i.test(p));
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

/** La misma frase como la escribiría o la dictaría alguien de afán: saludos, «por favor», tildes, errores. */
export function ensuciar(frase, r) {
  let f = frase;
  for (const [re, opciones] of DICTADO) if (f.search(re) >= 0 && r() < 0.35) f = f.replace(re, () => r.elegir(opciones));
  if (r() < 0.22) f = `${r.elegir(PREFIJOS)}${r() < 0.5 ? "," : ""} ${f.charAt(0).toLowerCase()}${f.slice(1)}`;
  if (r() < 0.16) f = `${f.replace(/[?.!]$/, "")} ${r.elegir(SUFIJOS)}`;
  if (r() < 0.1) f = tecleo(f, r);
  if (r() < 0.04) f = tecleo(f, r);
  // Sin tildes ni signos (el teclado del celular o el dictado)
  if (r() < 0.3) f = f.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!,.]/g, "");
  if (r() < 0.25) f = f.toLowerCase();
  return pulir(f);
}
