// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Lo que se puede pedir en el simulador, como intenciones del Modelo Melki. El modelo elige la intención; con los datos
// del pedido (ranuras.ts) cada intención arma la orden en las palabras que Melki ya entiende (y que el intérprete
// verifica antes de hacerla), da la orden directa o dice qué tema del cerebro contesta. Las que borran o reemplazan algo
// («delicadas») nunca se hacen solas: se ofrecen con un botón.
import type { Orden } from "../ordenes";
import type { Ranuras } from "./ranuras";

export type GrupoIntencion = "diseno" | "piezas" | "red" | "gente" | "ajustes" | "mapa" | "escenario" | "melki" | "pregunta" | "fuera";

export type Intencion = {
  id: string;
  grupo: GrupoIntencion;
  /** Qué hace, en pocas palabras (el botón de «¿Quiso decir…?» cuando no hay una frase más precisa). */
  nombre: string;
  /** Borra o reemplaza algo: se ofrece con un botón, nunca se hace sola. */
  delicada?: boolean;
  /** La orden en las palabras de Melki, o null si faltan datos que no se pueden suponer. */
  frase?: (r: Ranuras) => string | null;
  /** La orden ya armada (las que no se dicen con una frase, como aceptar la propuesta). */
  directa?: (r: Ranuras) => Orden | null;
  /** El tema del cerebro que la contesta. */
  tema?: string;
  /** Cómo decirla con todos sus datos, para cuando falta uno («borra el Repetidor 2»). */
  ejemplo?: string;
};

/** «el Repetidor 2», «la Persona 1». */
export const elNodo = (n: string) => `${/^(persona|antena|torre)\b/i.test(n) ? "la" : "el"} ${n}`;
/** «del Repetidor 2», «de la Persona 1». */
export const deNodo = (n: string) => (/^(persona|antena|torre)\b/i.test(n) ? `de la ${n}` : `del ${n}`);

const unir = (...partes: (string | false | undefined | null)[]) => partes.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

/** Lo que acompaña un diseño: la señal, el respaldo, la gente, la plata y «aunque cueste más». */
const extrasDiseno = (r: Ranuras) => unir(r.senal && `con ${r.senal}`, r.respaldo && "con respaldo", r.gente && `para ${r.gente}`, r.plata && `con un presupuesto de ${r.plata}`, r.aCualquierCosto && "aunque cueste más");

/** El centro de un diseño a la redonda: un nodo, un lugar, una coordenada o aquí (sin decirlo, el gateway o el mapa). */
function centroDiseno(r: Ranuras): string {
  if (r.nodos[0]) return deNodo(r.nodos[0]);
  if (r.lugar) return `en ${r.lugar}`;
  if (r.coord) return `de ${r.coord}`;
  if (r.aqui) return "de aquí";
  return "";
}

/** «Todo el municipio», «todo el pueblo», «el departamento entero». */
const TODO_EL_LUGAR = /\b(tod[oa]s? (el|la|los|las) (municipio|pueblo|departamento|region|zona|territorio|vereda|ciudad)|(municipio|pueblo|departamento) (entero|completo)|cubrir (el|la) (municipio|pueblo|departamento))\b/;

/** Dónde poner una pieza: a una distancia y rumbo de un nodo, en una coordenada o en un lugar. */
function dondePieza(r: Ranuras): string {
  if (r.dist && r.rumbo) return unir(`a ${r.dist.texto} al ${r.rumbo}`, r.referencia && deNodo(r.referencia));
  if (r.coord) return `en ${r.coord}`;
  if (r.lugar) return `en ${r.lugar}`;
  return "";
}

const conAltura = (r: Ranuras, texto: string) => (r.altura ? `${texto} a ${r.altura}` : texto);

/* La pieza se nombra («agrega un dron a la malla» no es un repetidor): con errores de dictado, pero se nombra */
const DICE_GATEWAY = /\b(gate\w*|get\w*|geit\w*|gueit\w*|pasarel\w*|starlink|estarlink|internet|principal)\b/;
const DICE_REPETIDOR = /\b(repe\w*|repi\w*|router\w*|ruter\w*|retransmi\w*|nodo\w*|antena\w*|torre\w*)\b/;
const DICE_PERSONA = /\b(person\w*|perzon\w*|usuari\w*|familia\w*|casa\w*|viviend\w*|vecin\w*|client\w*|billeter\w*|habitant\w*|finca\w*|gente)\b/;

export const INTENCIONES: Intencion[] = [
  /* ───────────── Diseño de la red ───────────── */
  {
    id: "disenar",
    grupo: "diseno",
    nombre: "Armar una red sostenible",
    frase: (r) => {
      if (TODO_EL_LUGAR.test(r.tn)) return unir("ármame una red sostenible que cubra todo el", r.departamento || /\bdepartamento\b/.test(r.tn) ? "departamento" : "municipio", r.lugar && `de ${r.lugar}`, r.gente && `para ${r.gente}`, r.plata && `con un presupuesto de ${r.plata}`);
      if (r.area) return unir(`ármame una red que cubra ${r.area}`, r.pct ? `con ${r.senal ?? "señal media o mejor"} en el ${r.pct}` : r.senal && `con ${r.senal}`, r.lugar && `en ${r.lugar}`, r.respaldo && "con respaldo", r.gente && `para ${r.gente}`, r.plata && `con un presupuesto de ${r.plata}`, r.aCualquierCosto && "aunque cueste más");
      if (r.dist) return unir(`ármame una red de ${r.dist.texto}`, r.dist.diametro ? "de diámetro" : "a la redonda", centroDiseno(r), extrasDiseno(r));
      return unir("hazme una red sostenible", r.lugar && `en ${r.lugar}`, r.gente && `para ${r.gente}`, r.plata && `con un presupuesto de ${r.plata}`);
    },
  },
  /* ───────────── Piezas de la malla ───────────── */
  { id: "poner-gateway", grupo: "piezas", nombre: "Poner el gateway", frase: (r) => (DICE_GATEWAY.test(r.tnPieza) ? conAltura(r, unir("pon el gateway", dondePieza(r))) : null) },
  { id: "poner-repetidor", grupo: "piezas", nombre: "Agregar un repetidor", frase: (r) => (DICE_REPETIDOR.test(r.tnPieza) ? conAltura(r, unir("agrega un repetidor", dondePieza(r))) : null) },
  { id: "poner-persona", grupo: "piezas", nombre: "Poner una persona", frase: (r) => (DICE_PERSONA.test(r.tnPieza) ? unir("pon una persona", dondePieza(r)) : null) },
  { id: "sembrar", grupo: "piezas", nombre: "Conectar a los que faltan", frase: () => "conecta a los que faltan" },
  {
    id: "mover-nodo",
    grupo: "piezas",
    nombre: "Mover un nodo",
    ejemplo: "mueve el Repetidor 2 a 4.3, -73.2» o «mueve el Repetidor 2 a 1 km al norte",
    frase: (r) => {
      if (!r.nodos[0]) return null;
      if (r.coord) return `mueve ${elNodo(r.nodos[0])} a ${r.coord}`;
      if (r.dist && r.rumbo) return unir(`mueve ${elNodo(r.nodos[0])} a ${r.dist.texto} al ${r.rumbo}`, r.referencia && r.referencia !== r.nodos[0] && deNodo(r.referencia));
      if (r.lugar) return `mueve ${elNodo(r.nodos[0])} a ${r.lugar}`;
      return null;
    },
  },
  { id: "borrar-nodo", grupo: "piezas", nombre: "Borrar un nodo", ejemplo: "borra el Repetidor 2", delicada: true, frase: (r) => (r.nodos[0] ? `borra ${elNodo(r.nodos[0])}` : null) },
  { id: "borrar-personas", grupo: "piezas", nombre: "Borrar todas las personas", delicada: true, frase: () => "borra todas las personas" },
  { id: "borrar-repetidores", grupo: "piezas", nombre: "Borrar todos los repetidores", delicada: true, frase: () => "borra todos los repetidores" },
  { id: "renombrar", grupo: "piezas", nombre: "Cambiar el nombre de un nodo", ejemplo: "renombra el Repetidor 2 como \"La Loma\"", frase: (r) => (r.nodos[0] && r.nombre ? `renombra ${elNodo(r.nodos[0])} como "${r.nombre}"` : null) },
  {
    id: "altura",
    grupo: "piezas",
    nombre: "Cambiar la altura de las antenas",
    ejemplo: "sube el Repetidor 2 a 12 m» o «sube todos los repetidores a 15 m",
    frase: (r) => {
      if (!r.altura) return null;
      const verbo = /\b(baj\w*|reduc\w*|disminu\w*|rebaj\w*|menos alt\w*)\b/.test(r.tn) ? "baja" : "sube";
      if (r.nodos[0]) return `${verbo} ${elNodo(r.nodos[0])} a ${r.altura}`;
      // Todas solo si se dijo (un nodo mal escrito no vuelve el pedido «todos los repetidores»)
      return /\b(todos|todas|cada|los repetidores|las antenas|las torres|los nodos)\b/.test(r.tn) ? `${verbo} todos los repetidores a ${r.altura}` : null;
    },
  },
  { id: "duplicar", grupo: "piezas", nombre: "Duplicar un nodo", ejemplo: "duplica el Repetidor 2", frase: (r) => (r.nodos[0] ? `duplica ${elNodo(r.nodos[0])}` : null) },
  { id: "apuntar", grupo: "piezas", nombre: "Apuntar una antena hacia otro nodo", ejemplo: "apunta el Repetidor 2 hacia el Gateway", frase: (r) => (r.nodos.length >= 2 ? `apunta ${elNodo(r.nodos[0])} hacia ${elNodo(r.nodos[1])}` : null) },
  { id: "mensaje", grupo: "piezas", nombre: "Enviar un mensaje de prueba", frase: (r) => (r.nodos[0] && !/^gateway$/i.test(r.nodos[0]) ? `envía un mensaje de prueba desde ${elNodo(r.nodos[0])}` : "envía un mensaje de prueba") },
  { id: "info-nodo", grupo: "piezas", nombre: "Contar cómo está un nodo", ejemplo: "¿cómo está el Repetidor 2?", frase: (r) => (r.nodos[0] ? `¿cómo está ${elNodo(r.nodos[0])}?` : null) },
  /* ───────────── La red: simular, resultados y medidas ───────────── */
  { id: "simular", grupo: "red", nombre: "Simular la red", frase: () => "simula" },
  { id: "auto-on", grupo: "red", nombre: "Simular solo con cada cambio", frase: () => "activa simular al cambiar" },
  { id: "auto-off", grupo: "red", nombre: "No simular solo con cada cambio", frase: () => "desactiva simular al cambiar" },
  { id: "costo-red", grupo: "red", nombre: "Decir cuánto cuesta la red", frase: (r) => (r.lugar && r.departamento ? `¿cuánto cuesta la red para ${r.lugar}?` : "¿cuánto cuesta la red?") },
  { id: "listar", grupo: "red", nombre: "Decir qué nodos hay", frase: () => "¿qué nodos hay?" },
  { id: "donde-nodo", grupo: "red", nombre: "Mostrar dónde está un nodo", ejemplo: "¿dónde está el Repetidor 2?", frase: (r) => (r.nodos[0] ? `¿dónde está ${elNodo(r.nodos[0])}?` : null) },
  { id: "senal-punto", grupo: "red", nombre: "Decir qué señal hay en un punto", ejemplo: "¿qué señal hay en 4.25, -73.30?", frase: (r) => (r.coord ? `¿qué señal hay en ${r.coord}?` : null) },
  { id: "distancia", grupo: "red", nombre: "Medir la distancia entre dos nodos", ejemplo: "distancia entre el Gateway y el Repetidor 2", frase: (r) => (r.nodos.length >= 2 ? `distancia entre ${elNodo(r.nodos[0])} y ${elNodo(r.nodos[1])}` : null) },
  { id: "perfil", grupo: "red", nombre: "Ver el perfil del enlace entre dos nodos", ejemplo: "perfil entre el Gateway y el Repetidor 2", frase: (r) => (r.nodos.length >= 2 ? `perfil entre ${elNodo(r.nodos[0])} y ${elNodo(r.nodos[1])}` : null) },
  { id: "informe", grupo: "red", nombre: "Hacer el informe de radioenlace", ejemplo: "informe de radioenlace entre el Gateway y el Repetidor 2", frase: (r) => (r.nodos.length >= 2 ? `informe de radioenlace entre ${elNodo(r.nodos[0])} y ${elNodo(r.nodos[1])}` : null) },
  { id: "encuadrar", grupo: "red", nombre: "Mostrar toda la red", frase: () => "muéstrame toda la red" },
  { id: "que-hago", grupo: "red", nombre: "Decir qué sigue", directa: () => ({ tipo: "que-hago" }) },
  { id: "estado-red", grupo: "red", nombre: "Contar cómo quedó la red", tema: "estado" },
  /* ───────────── Gente, carga y capacidad ───────────── */
  { id: "poblar", grupo: "gente", nombre: "Poblar la zona con personas", frase: (r) => (r.cantidad ? `puebla la zona con ${r.cantidad} personas` : "puebla la zona") },
  {
    id: "zonas",
    grupo: "gente",
    nombre: "Poner gente alrededor de los repetidores",
    frase: (r) => unir(`pon ${r.cantidad ?? 250} personas alrededor`, r.nodos[0] ? deNodo(r.nodos[0]) : "de cada repetidor", r.estres && "y haz la prueba de estrés"),
  },
  { id: "estres", grupo: "gente", nombre: "Hacer la prueba de estrés", frase: () => "haz la prueba de estrés" },
  { id: "carga", grupo: "gente", nombre: "Probar cuánto tráfico aguanta", frase: (r) => (r.cantidad ? `envía ${r.cantidad} ${r.trafico} al tiempo` : `¿hasta cuántos ${r.trafico} aguanta?`) },
  { id: "quitar-zonas", grupo: "gente", nombre: "Quitar las zonas de popularidad", delicada: true, frase: () => "quita las zonas" },
  { id: "quitar-pobladas", grupo: "gente", nombre: "Quitar la gente poblada", delicada: true, frase: () => "quita las personas pobladas" },
  { id: "optimizar-carga", grupo: "gente", nombre: "Optimizar la red para la carga", frase: () => "optimiza la red para la carga" },
  { id: "usuarios-estres", grupo: "gente", nombre: "Decir a quiénes no les funciona", frase: () => "¿a quiénes no les funciona?" },
  { id: "dimensionar", grupo: "gente", nombre: "Dimensionar la red para los usuarios", ejemplo: "dimensiona la red para 5.000 usuarios", frase: (r) => (r.gente ? `dimensiona la red para ${r.gente}` : r.cantidad ? `dimensiona la red para ${r.cantidad} usuarios` : null) },
  /* ───────────── Ajustes de la red ───────────── */
  { id: "ajustar", grupo: "ajustes", nombre: "Ajustar la red para que sea factible", frase: (r) => (r.altura ? `ajústamelo sin pasar de ${r.altura}` : "ajústamelo") },
  { id: "ajustar-economico", grupo: "ajustes", nombre: "Dejar la red lo más económica posible", frase: () => "dame la opción más económica" },
  { id: "protocolo", grupo: "ajustes", nombre: "Cambiar el protocolo de la malla", ejemplo: "cambia a Meshtastic» o «cambia a MeshCore", frase: (r) => (r.protocolo ? `cambia a ${r.protocolo}` : null) },
  { id: "relieve-plano", grupo: "ajustes", nombre: "Simular con el terreno plano", frase: () => "usa el relieve plano" },
  { id: "relieve-real", grupo: "ajustes", nombre: "Simular con el relieve real", frase: () => "usa el relieve real" },
  { id: "area-objetivo", grupo: "ajustes", nombre: "Usar el área medida como área objetivo", frase: () => "usa el área que medí como área objetivo" },
  { id: "quitar-area-objetivo", grupo: "ajustes", nombre: "Quitar el área objetivo", frase: () => "quita el área objetivo" },
  { id: "aceptar-propuesta", grupo: "ajustes", nombre: "Poner los repetidores propuestos", directa: () => ({ tipo: "aceptar-siembra" }) },
  { id: "descartar-propuesta", grupo: "ajustes", nombre: "Descartar la propuesta", directa: () => ({ tipo: "descartar-siembra" }) },
  { id: "descartar-ajuste", grupo: "ajustes", nombre: "Descartar el ajuste propuesto", directa: () => ({ tipo: "descartar-ajuste" }) },
  /* ───────────── El mapa ───────────── */
  { id: "ir-lugar", grupo: "mapa", nombre: "Llevar el mapa a un lugar", ejemplo: "llévame a Villavicencio", frase: (r) => (r.lugar ? `llévame a ${r.lugar}` : r.coord ? `llévame a ${r.coord}` : null) },
  { id: "capa-mostrar", grupo: "mapa", nombre: "Mostrar una capa del mapa", ejemplo: "muestra las vías» o «muestra lo rojo", frase: (r) => (r.capa ? `muestra ${r.capa}` : null) },
  { id: "capa-ocultar", grupo: "mapa", nombre: "Ocultar una capa del mapa", ejemplo: "oculta los ríos", frase: (r) => (r.capa ? `oculta ${r.capa}` : null) },
  { id: "fondo-mapa", grupo: "mapa", nombre: "Cambiar el fondo del mapa", ejemplo: "pon el mapa satelital", frase: (r) => (r.fondo ? `pon el mapa ${r.fondo}` : null) },
  { id: "paneles-ocultar", grupo: "mapa", nombre: "Dejar solo el mapa", frase: () => "pantalla limpia" },
  { id: "paneles-mostrar", grupo: "mapa", nombre: "Mostrar los paneles", frase: () => "muestra los paneles" },
  { id: "modo-avanzado", grupo: "mapa", nombre: "Pasar al modo avanzado", frase: () => "modo avanzado" },
  { id: "modo-sembrar", grupo: "mapa", nombre: "Pasar al modo «Sembrar la malla»", frase: () => "modo sembrar la malla" },
  { id: "regla", grupo: "mapa", nombre: "Abrir la regla para medir", frase: () => "abre la regla" },
  { id: "inspeccionar", grupo: "mapa", nombre: "Tocar un punto para ver su señal", directa: () => ({ tipo: "herramienta", herramienta: "inspeccionar" }) },
  { id: "borrar-mediciones", grupo: "mapa", nombre: "Borrar las mediciones", delicada: true, frase: () => "borra las mediciones" },
  { id: "donde-estamos", grupo: "mapa", nombre: "Decir dónde estamos", frase: () => "¿dónde estamos?" },
  { id: "animacion-on", grupo: "mapa", nombre: "Animar el flujo de la red", frase: () => "anima la red" },
  { id: "animacion-off", grupo: "mapa", nombre: "Quitar la animación de la red", frase: () => "quita la animación" },
  /* ───────────── El escenario ───────────── */
  { id: "ejemplo", grupo: "escenario", nombre: "Cargar el ejemplo", delicada: true, frase: () => "carga el ejemplo" },
  { id: "ejemplo-malla", grupo: "escenario", nombre: "Cargar el ejemplo de malla", delicada: true, frase: () => "carga el ejemplo de malla" },
  { id: "nuevo", grupo: "escenario", nombre: "Empezar un escenario nuevo", delicada: true, frase: () => "escenario nuevo" },
  { id: "exportar", grupo: "escenario", nombre: "Exportar el escenario", frase: (r) => `exporta en ${r.formato ?? "kmz"}` },
  { id: "nombre-escenario", grupo: "escenario", nombre: "Ponerle nombre al escenario", ejemplo: "llama al escenario \"Piloto Norte\"", frase: (r) => (r.nombre ? `llama al escenario "${r.nombre}"` : null) },
  /* ───────────── Melki ───────────── */
  // Deshacer no tiene «rehacer»: entendido por el modelo, se ofrece con un botón
  { id: "deshacer", grupo: "melki", nombre: "Deshacer lo último", delicada: true, frase: () => "deshaz lo último" },
  { id: "tours", grupo: "melki", nombre: "Ver los tours guiados", frase: () => "hazme un tour" },
  { id: "recorrido", grupo: "melki", nombre: "Recorrer la red punto por punto", frase: () => "explícame la red punto por punto" },
  { id: "pitch", grupo: "melki", nombre: "Presentar el modelo de negocio", frase: () => "preséntame el modelo de negocio" },
  { id: "voz-on", grupo: "melki", nombre: "Leer en voz alta lo que responde", frase: () => "háblame" },
  { id: "voz-off", grupo: "melki", nombre: "Responder solo por escrito", frase: () => "no hables" },
  { id: "asistente-on", grupo: "melki", nombre: "Activar el Asistente Melki (por voz)", frase: () => "activa el asistente" },
  { id: "asistente-off", grupo: "melki", nombre: "Que el asistente deje de escuchar", frase: () => "deja de escuchar" },
  { id: "capacidades", grupo: "melki", nombre: "Contar qué puede hacer Melki", tema: "capacidades" },
  { id: "saludo", grupo: "melki", nombre: "Saludar", tema: "saludo" },
  { id: "gracias", grupo: "melki", nombre: "Agradecer", tema: "gracias" },
  { id: "quien", grupo: "melki", nombre: "Contar quién es Melki", tema: "quien" },
  { id: "modelo-melki", grupo: "melki", nombre: "Explicar cómo entiende Melki", tema: "modelo-melki" },
  /* ───────────── Preguntas (las contesta el cerebro) ───────────── */
  { id: "q-que-es", grupo: "pregunta", nombre: "Qué es el simulador y cómo se usa", tema: "que-es" },
  { id: "q-agregar", grupo: "pregunta", nombre: "Cómo se agrega una antena", tema: "agregar" },
  { id: "q-diseno", grupo: "pregunta", nombre: "Cómo se diseña una red para un área", tema: "diseno" },
  { id: "q-nodos", grupo: "pregunta", nombre: "Qué tipos de nodo hay", tema: "nodos" },
  { id: "q-regla", grupo: "pregunta", nombre: "Cómo se mide con la regla", tema: "regla" },
  { id: "q-referencia", grupo: "pregunta", nombre: "Qué muestra el mapa de referencia", tema: "referencia" },
  { id: "q-buscar", grupo: "pregunta", nombre: "Cómo se busca un lugar", tema: "buscar" },
  { id: "q-alcance", grupo: "pregunta", nombre: "Hasta dónde llega una antena", tema: "alcance" },
  { id: "q-coordenadas", grupo: "pregunta", nombre: "Cómo se escriben las coordenadas", tema: "coordenadas" },
  { id: "q-mover", grupo: "pregunta", nombre: "Cómo se mueve una antena", tema: "mover" },
  { id: "q-eliminar", grupo: "pregunta", nombre: "Cómo se borra una antena", tema: "eliminar" },
  { id: "q-simular", grupo: "pregunta", nombre: "Qué hace «Simular»", tema: "simular" },
  { id: "q-colores", grupo: "pregunta", nombre: "Qué significan los colores del mapa", tema: "colores" },
  { id: "q-margen", grupo: "pregunta", nombre: "Qué es el margen de un enlace", tema: "margen" },
  { id: "q-presupuesto", grupo: "pregunta", nombre: "Cómo se calcula el balance del enlace", tema: "presupuesto" },
  { id: "q-presets", grupo: "pregunta", nombre: "Qué ajuste de radio usar", tema: "presets" },
  { id: "q-frecuencia", grupo: "pregunta", nombre: "Qué frecuencia usa la red", tema: "frecuencia" },
  { id: "q-altura", grupo: "pregunta", nombre: "Qué altura conviene", tema: "altura" },
  { id: "q-malla", grupo: "pregunta", nombre: "Cómo funciona la malla", tema: "malla" },
  { id: "q-saltos", grupo: "pregunta", nombre: "Qué son los saltos", tema: "saltos" },
  { id: "q-gateway", grupo: "pregunta", nombre: "Qué hace el gateway", tema: "pasarela" },
  { id: "q-protocolos", grupo: "pregunta", nombre: "MeshCore o Meshtastic", tema: "protocolos" },
  { id: "q-gateway-medido", grupo: "pregunta", nombre: "Qué se midió del gateway", tema: "gateway-medido" },
  { id: "q-usuarios-prueba", grupo: "pregunta", nombre: "Qué dicen los colores de las personas", tema: "usuarios-prueba" },
  { id: "q-optimizar-carga", grupo: "pregunta", nombre: "Qué hace la optimización para la carga", tema: "optimizar-carga" },
  { id: "q-pitch", grupo: "pregunta", nombre: "Cómo se paga la red (el modelo de negocio)", tema: "pitch" },
  { id: "q-recorrido-red", grupo: "pregunta", nombre: "Qué es el recorrido de la red", tema: "recorrido-red" },
  { id: "q-analista", grupo: "pregunta", nombre: "Cómo diseña Melki la red", tema: "analista" },
  { id: "q-ia-local", grupo: "pregunta", nombre: "La IA local de este equipo", tema: "ia-local" },
  { id: "q-ia-voz", grupo: "pregunta", nombre: "Conectar a Melki con Gemini", tema: "ia-voz" },
  { id: "q-roles", grupo: "pregunta", nombre: "Qué roles tienen los nodos", tema: "roles" },
  { id: "q-factibilidad", grupo: "pregunta", nombre: "Qué es la factibilidad", tema: "factibilidad" },
  { id: "q-respaldo", grupo: "pregunta", nombre: "Qué es el respaldo", tema: "respaldo" },
  { id: "q-modos", grupo: "pregunta", nombre: "Qué antena cubre cada punto", tema: "modos" },
  { id: "q-medir", grupo: "pregunta", nombre: "Cómo saber si llega señal a un punto", tema: "medir" },
  { id: "q-perfil", grupo: "pregunta", nombre: "Qué es el perfil del enlace", tema: "perfil" },
  { id: "q-modelo-propagacion", grupo: "pregunta", nombre: "Cómo calcula la propagación", tema: "modelo" },
  { id: "q-relieve", grupo: "pregunta", nombre: "Cómo usa el relieve", tema: "relieve" },
  { id: "q-privacidad", grupo: "pregunta", nombre: "Qué pasa con mis datos", tema: "privacidad" },
  { id: "q-capas", grupo: "pregunta", nombre: "Qué capas tiene el mapa", tema: "capas" },
  { id: "q-exportar", grupo: "pregunta", nombre: "Cómo se guarda o se exporta", tema: "exportar" },
  { id: "q-receptor", grupo: "pregunta", nombre: "Qué es el receptor", tema: "receptor" },
  { id: "q-confiabilidad", grupo: "pregunta", nombre: "Qué es la confiabilidad", tema: "confiabilidad" },
  { id: "q-red-radio-mobile", grupo: "pregunta", nombre: "Qué parámetros de red usa", tema: "red-radio-mobile" },
  { id: "q-direccionales", grupo: "pregunta", nombre: "Qué son las antenas direccionales", tema: "direccionales" },
  { id: "q-entorno", grupo: "pregunta", nombre: "Cómo afectan árboles y casas", tema: "entorno" },
  { id: "q-unidades", grupo: "pregunta", nombre: "Qué unidades de señal usa", tema: "unidades" },
  { id: "q-informe", grupo: "pregunta", nombre: "Qué es el informe de radioenlace", tema: "informe" },
  { id: "q-dictado", grupo: "pregunta", nombre: "Cómo funciona el dictado", tema: "dictado" },
  { id: "q-autoria", grupo: "pregunta", nombre: "Quién hizo el simulador", tema: "autoria" },
  { id: "q-manos-libres", grupo: "pregunta", nombre: "Cómo funciona el Asistente Melki", tema: "manos-libres" },
  { id: "q-cobertura-maxima", grupo: "pregunta", nombre: "Cuál es la cobertura máxima", tema: "cobertura-maxima" },
  { id: "q-rendimiento", grupo: "pregunta", nombre: "Por qué tarda la simulación", tema: "rendimiento" },
  { id: "q-mejorar", grupo: "pregunta", nombre: "Cómo mejorar la cobertura", tema: "mejorar" },
  { id: "q-ajuste", grupo: "pregunta", nombre: "Qué hace «Ajústamelo»", tema: "ajuste" },
  { id: "q-area-objetivo", grupo: "pregunta", nombre: "Qué es el área objetivo", tema: "area-objetivo" },
  { id: "q-equipos", grupo: "pregunta", nombre: "Qué equipos usa Trama", tema: "equipos" },
  { id: "q-trama", grupo: "pregunta", nombre: "Qué es Trama y qué pasa por la red", tema: "trama" },
  { id: "q-animacion", grupo: "pregunta", nombre: "Qué son las luces que se mueven", tema: "animacion" },
  { id: "q-repetidor", grupo: "pregunta", nombre: "Dónde va un repetidor", tema: "repetidor" },
  { id: "q-persona", grupo: "pregunta", nombre: "Qué lleva cada persona", tema: "persona" },
  { id: "q-mensaje", grupo: "pregunta", nombre: "Cómo viaja un pago o un mensaje", tema: "mensaje" },
  { id: "q-capacidad", grupo: "pregunta", nombre: "Cuánto tráfico aguanta la red", tema: "capacidad" },
  { id: "q-estres", grupo: "pregunta", nombre: "Qué es la prueba de estrés", tema: "estres" },
  { id: "q-poblar", grupo: "pregunta", nombre: "Qué hace «Poblar personas»", tema: "poblar" },
  { id: "q-precios", grupo: "pregunta", nombre: "Cuánto cuestan los equipos", tema: "precios" },
  { id: "q-dimensionamiento", grupo: "pregunta", nombre: "Cómo se dimensiona la red de un departamento", tema: "dimensionamiento" },
  { id: "q-letra-pequena", grupo: "pregunta", nombre: "Qué tan exactas son las cifras", tema: "letra-pequena" },
  { id: "q-sin-cobertura", grupo: "pregunta", nombre: "Por qué hay zonas sin cobertura", tema: "sin-cobertura" },
  /* ───────────── Fuera del simulador ───────────── */
  { id: "fuera", grupo: "fuera", nombre: "Algo fuera del simulador" },
  { id: "ruido", grupo: "fuera", nombre: "Algo que no se entiende (el dictado escribió mal)" },
];

export const INTENCION = new Map(INTENCIONES.map((i) => [i.id, i]));
