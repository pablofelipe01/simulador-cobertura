// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Órdenes para Melki: entiende pedidos en español con coordenadas (decimales o en grados, minutos y segundos)
// y los ejecuta en el simulador: inscribir, mover, editar o borrar nodos, cambiar parámetros, simular, ir a un lugar,
// medir distancias, ver perfiles y la señal en un punto. Todo se procesa aquí mismo, sin servicios externos.
import { CLASES, ENLACES, EQUIPOS, LIMITE_SALTOS_MAXIMO, META_UTIL_ESTUDIO_PCT, PRESETS, presetEquivalente, presetPorId, UMBRAL_CONFIABLE_DB, UMBRAL_SERVICIO_DB, type EquipoId, type PresetId, type ProtocoloId } from "@/lib/radio/constantes";
import { entornoPorId, perdidaEntorno } from "@/lib/radio/entorno";
import { consejoRed, piezaDe, type EstadoRed, type Pieza } from "@/lib/radio/estado-red";
import { INTENTOS, type ViajeMensaje } from "@/lib/radio/mensaje";
import type { DestinoSiembra, Siembra } from "@/lib/radio/siembra";
import type { Diseno } from "@/lib/radio/diseno";
import { resumenCambios, textoCambio, type Ajuste, type PermisosAjuste, type SitioAjuste } from "@/lib/radio/ajuste";
import { areaM2, cajaPoligono, conArea, coberturaEnArea, dentroPoligono, margenEnPunto, poligonoCaja, poligonoCirculo, poligonoRectangulo, porcentajeSobre, radioDeArea, recortarPoligono, sirveAlArea, type Poligono, type Rumbo } from "@/lib/radio/area";
import { aDecimal, aGMS, desplazar, distanciaM, formatoDistancia, leerCoordenada, puntoCardinal, rumbo, rumboTexto } from "@/lib/radio/geo";
import type { ClimaItm } from "@/lib/radio/itm";
import { anchosHaz, esDireccional, patronPorId } from "@/lib/radio/patron";
import { CLIMAS, CONFIABILIDADES, RED_REFERENCIA, SUELOS, VARIABILIDADES } from "@/lib/radio/red";
import type { Antena, AreaObjetivo, EntornoId, Escenario, Medicion, ObjetivoArea, Parametros, PatronId, ResultadoSimulacion, Rol, SueloId, TipoNodo, VariabilidadId } from "@/lib/radio/tipos";
import { textoNivel, uvADbm, type UnidadId } from "@/lib/radio/unidades";
import { decidirLugar, nombreLugar, pareceNombre, type CandidatoLugar, type Lugar } from "@/lib/geo/referencia";
import { decimalLocal, numeroLocal, retraducir, tx } from "@/lib/idioma";

import type { CurvaCargaResultado, ResultadoCarga } from "@/lib/radio/carga";
import type { ResultadoEstres, LimitePunto } from "@/lib/radio/estres";
import type { CifraPitch, DatosPitch, MapaPitch } from "@/lib/negocio/pitch";
import type { PropuestaOptimizar, ResultadoOptimizar } from "@/lib/radio/optimizar";
import { PROTOCOLOS } from "@/lib/radio/protocolos";
import { analizarRed, capacidadPara, costoGatewayInstalado, costoRepetidorInstalado, repetidoresEnPresupuesto, sfTrama, textoAnalisis } from "@/lib/radio/analista";
import { analizarOptimo, cumpleSinNodo, sobraNodo, type ZonaOptimo } from "@/lib/radio/optimo";
import { costoRedTrama, DEPARTAMENTOS_TRAMA, pesosTrama, type CostoRed, type NodoUsuario, type SfTrama, type TerrenoTrama } from "@/lib/radio/trama";

import type { EscalaSenal, ModoApp, Vista } from "../simulador/estado";
import { ALTURA_REPETIDOR_DEFECTO } from "../simulador/piezas";
import type { AreaPoblar, OpcionesCarga, PedidoPoblar, ResultadoPoblar } from "../simulador/panel-capacidad";
import type { CentroZona, OpcionesEstres, PedidoPunto, PedidoZonas, ResultadoPunto, ResultadoZonas } from "../simulador/panel-estres";
import { ejecutarCapacidad, interpretarCapacidad, seguirConZonas } from "./capacidad";
import {
  cifraLocal,
  circuloEnTexto,
  distancia,
  factorArea,
  ladoEnTexto,
  leerNumero,
  LONGITUDES,
  medidasEnCifras,
  NUMERO,
  presupuestoEnTexto,
  rectanguloEnTexto,
  sinTildes,
  textoDicho,
  textoDichoLocal,
  textoDistancia,
  textoMetros,
  tieneDistancia,
  UNIDAD_AREA,
  UNIDAD_LONGITUD,
  unidadAreaImperial,
  unidadDe,
  usuariosEnTexto,
  type Distancia,
  type Presupuesto,
} from "./medidas";
import type { AccionRespuesta, Respuesta } from "./cerebro";

/** Cambios de la vista que Melki puede pedir (unidad y escala de colores del mapa de señal). */
export type CambiosVista = Partial<
  Pick<
    Vista,
    | "unidad"
    | "escala"
    | "escalaMinDbm"
    | "escalaMaxDbm"
    | "umbralDbm"
    | "modo"
    | "animarRed"
    | "fondo"
    | "refDivision"
    | "refRios"
    | "refNombres"
    | "refVias"
    | "mostrarEnlaces"
    | "mostrarAlcance"
    | "mostrarCirculos"
    | "relieve3d"
    | "opacidad"
    | "mostrarSinServicio"
    | "mostrarAnillos"
    | "mostrarHaces"
    | "leyenda"
  >
>;

/** Dónde va el área del diseño: un punto, el gateway o el centro del mapa que está viendo el usuario. */
export type CentroArea = { tipo: "coord"; coord: Coordenada; nombre?: string } | { tipo: "gateway" } | { tipo: "mapa" };

/** Área pedida para el diseño: una forma alrededor de un centro, o un área medida con la regla. */
export type AreaPedida =
  /**
   * Una forma alrededor de un centro. `medida` es lo dicho con su conversión («un círculo de 5 millas de radio
   * (8,05 km)») y `etiqueta`, el nombre corto del área en el mapa («radio de 5 millas (8,05 km)»).
   */
  | { forma: "circulo" | "cuadrado" | "rectangulo"; areaM2: number; anchoM?: number; altoM?: number; centro: CentroArea; medida?: string; etiqueta?: string }
  | { forma: "medicion"; id: string }
  /**
   * Un polígono ya conocido (para rehacer o ampliar un diseño, o todo un municipio); `dibujar` lo vuelve a poner como
   * medición, con `etiqueta` en su nombre («Área objetivo · Barranca de Upía (Meta)»).
   */
  | { forma: "poligono"; puntos: Poligono; nombre: string; dibujar: boolean; etiqueta?: string };

export type Coordenada = { lat: number; lon: number; corregido?: boolean; desde?: string };

type DatosNodo = Partial<Pick<Antena, "nombre" | "alturaM" | "gananciaDbi" | "potenciaDbm" | "pasarela" | "tipo" | "patron" | "azimutDeg" | "elevacionDeg" | "equipo">>;

/** Lo que se pregunta al dudar de un lugar: cada opción es la orden completa con ese lugar. */
export type OpcionLugar = { texto: string; orden: Orden; lugar?: Lugar };

/**
 * Lo que se sabe además de la orden: `nota`, lo que entendió de un lugar mal dicho («Entendí «Barranca de Upía
 * (Meta)».»), y `lugarUsado`, el lugar de la orden (para «ahí», «ese municipio» en la siguiente).
 */
export type Orden = OrdenSola & { nota?: string; lugarUsado?: Lugar };

/** v17.5 · Las órdenes que solo consultan (no cambian nada del mapa): la distancia, el costo, el informe de un enlace… */
const CONSULTAS = new Set<string>(["distancia", "perfil", "senal", "donde", "listar", "informe", "costo-red", "optimo", "que-hago", "usuarios-estres", "trama-departamento", "trama-dimensionar", "cobertura-area"]);

/**
 * ¿La orden solo consulta? (también cuánto aguanta un punto sin llenarlo y la curva de carga). Una pregunta mal oída
 * puede corregirse por cómo suena hacia una de estas, nunca hacia una que cambie el mapa.
 */
export const esConsulta = (o: Orden) => CONSULTAS.has(o.tipo) || (o.tipo === "limite" && !o.llenar) || (o.tipo === "carga" && o.curva);

type OrdenSola =
  | { tipo: "agregar"; coord?: Coordenada; datos: DatosNodo }
  | { tipo: "mover"; id: string; coord?: Coordenada }
  | { tipo: "eliminar"; id: string }
  | { tipo: "renombrar"; id: string; nombre: string }
  | { tipo: "editar"; id: string; cambios: Partial<Antena>; descripcion: string }
  | { tipo: "parametros"; cambios: Partial<Parametros>; descripcion: string }
  | { tipo: "vista"; cambios: CambiosVista; descripcion: string }
  | { tipo: "informe"; a: string; b: Referencia }
  | { tipo: "apuntar-omni"; id: string; azimutDeg: number; destino?: string }
  | { tipo: "simular" }
  | { tipo: "ir"; coord?: Coordenada; lugar?: Lugar; id?: string; consulta?: string }
  | { tipo: "distancia"; a: Referencia; b: Referencia }
  | { tipo: "perfil"; a: string; b: Referencia }
  | { tipo: "senal"; coord: Coordenada }
  | { tipo: "donde"; ref: Referencia }
  | { tipo: "listar"; filtro?: "repetidores" | "personas" | "gateways" }
  | { tipo: "herramienta"; herramienta: "regla" | "inspeccionar" | "agregar" | "lapiz" | "mover" }
  | { tipo: "ejemplo" }
  | { tipo: "nuevo"; confirmado?: boolean }
  | { tipo: "exportar"; formato: "kmz" | "json" | "csv" }
  | { tipo: "borrar-mediciones" }
  | { tipo: "coordenada-sola"; coord: Coordenada }
  /* Modo «Sembrar la malla» */
  | { tipo: "pieza"; pieza: Pieza; coord?: Coordenada; datos: DatosNodo; mover?: boolean }
  | { tipo: "sembrar"; destino: "faltantes" | { coord: Coordenada; nombre: string } | { id: string } }
  | { tipo: "aceptar-siembra" }
  | { tipo: "descartar-siembra" }
  | { tipo: "mensaje"; id?: string }
  | { tipo: "modo"; modo: ModoApp }
  | { tipo: "ejemplo-malla" }
  | { tipo: "que-hago" }
  /* Agente: diseño por área, órdenes en lote y vista */
  | {
      tipo: "disenar";
      area: AreaPedida;
      margenDb: number;
      clases: string;
      porcentaje: number;
      respaldo: boolean;
      alturaM: number;
      gateway: Coordenada | null;
      maxRepetidores: number;
      /** Escenario al que se vuelve antes de diseñar de nuevo (rehacer con otras torres o meta). */
      reemplazar?: Escenario;
      /** Después del diseño: zonas de popularidad en cada nodo y, si se pidió, la prueba de estrés. */
      despues?: DespuesDiseno;
      /** «Una red sostenible y viable»: el diseño cuenta además su viabilidad técnica y su costo con los precios de Trama. */
      sostenible?: boolean;
      /** La gente que debe atender («para 400 familias»): la capacidad del gateway entra en el análisis. */
      usuarios?: { n: number; quienes: string };
      /** El presupuesto («con 80 millones»): limita los repetidores y entra en el análisis. */
      presupuesto?: Presupuesto;
      /** «Aunque cueste más», «cueste lo que cueste»: sin el freno de rendimiento (siembra hasta la meta o el máximo). */
      aCualquierCosto?: boolean;
      /** El máximo de repetidores lo dijo el usuario («hasta 20 repetidores»). */
      maxDicho?: boolean;
    }
  /** Falta dónde o de qué tamaño hacer la red («hazme una red sostenible»): lo pregunta y queda esperando la respuesta. */
  | { tipo: "pedir-diseno"; lugar?: LugarPedido; sostenible: boolean; despues?: DespuesDiseno }
  /** «¿Se refiere a Barranca de Upía (Meta)?»: el lugar dicho puede ser varios; cada opción es la orden con ese lugar. */
  | { tipo: "elegir"; pregunta: string; opciones: OpcionLugar[]; dicho: string; original: string }
  /** No reconoció el lugar: lo pide de nuevo («¿me repite el municipio y el departamento?»). */
  | { tipo: "pedir-lugar"; dicho: string; original: string; sugerencias: Lugar[]; rechazo?: boolean }
  /** Una respuesta sin cambios en el mapa (un área muy grande, un lugar sin contorno…). */
  | { tipo: "aviso"; texto: string; acciones?: AccionRespuesta[] }
  /** La red de todo el municipio que se está viendo (el botón de «¿dónde estamos?»). */
  | { tipo: "red-municipio"; sostenible: boolean }
  /** «¿Cuánto cuesta la red?»: la inversión y la operación de la red del mapa con los precios de Trama. */
  | { tipo: "costo-red" }
  /** v17.2 · «¿Necesito más antenas?», «¿sobran antenas?»: el criterio de óptimo sobre la red simulada. */
  | { tipo: "optimo" }
  /** La persona deja el nodo que Melki cuestionó; con `ultima`, Melki no vuelve a preguntar. */
  | { tipo: "dejar-nodo"; nombres: string[]; ultima?: boolean }
  /** La opción económica de un diseño: quitar esos repetidores y medir de nuevo la cobertura del área. */
  | { tipo: "usar-economica"; ids: string[]; nombres: string[]; area: Poligono; margenDb: number; respaldo: boolean; clases: string; metaPct: number; ahorroCop: number }
  | { tipo: "eliminar-varios"; ids: string[]; descripcion: string }
  | { tipo: "editar-varios"; ids: string[]; cambios: Partial<Antena>; descripcion: string; deltaAlturaM?: number }
  | { tipo: "auto"; valor: boolean }
  | { tipo: "encuadrar" }
  /** v17.6 · Acercar (pasos > 0) o alejar (pasos < 0) el mapa sin moverlo: «acerca el mapa», «zoom out a little». */
  | { tipo: "zoom"; pasos: number }
  | { tipo: "cobertura-area"; id: string; margenDb: number }
  | { tipo: "relieve"; valor: "teselas" | "plano" }
  | { tipo: "nombre-escenario"; nombre: string }
  | { tipo: "duplicar"; id: string }
  | { tipo: "seleccionar"; id: string }
  /** Paneles a los lados del mapa: «pantalla limpia» los oculta para trabajar por voz con solo el mapa. */
  /** «barra»: pidieron mostrar (true) u ocultar (false) la barra de herramientas de arriba, que solo abre su flechita. */
  | { tipo: "paneles"; izquierdo?: boolean; derecho?: boolean; barra?: boolean }
  /* Ajuste inteligente (cobertura–costo) y área objetivo */
  | { tipo: "ajustar"; aplicar: boolean; opcion: OpcionAjusteId; opciones: OpcionesAjuste; avisos: string[] }
  | { tipo: "aplicar-ajuste"; ajuste: Ajuste; indice: number; base: Escenario }
  | { tipo: "descartar-ajuste" }
  | { tipo: "area-objetivo"; quitar: boolean; id?: string; metaPct?: number; margenDb?: number }
  /* Gente, capacidad y Trama */
  | { tipo: "poblar"; pedido: PedidoPoblar }
  | { tipo: "quitar-pobladas" }
  | { tipo: "carga"; opciones: Partial<OpcionesCarga>; curva: boolean }
  /** Zonas de popularidad (N personas a la redonda de cada nodo o de los nombrados) y, si se pidió, la prueba de estrés. */
  | { tipo: "zonas"; pedido: PedidoZonas; estres: Partial<OpcionesEstres> | null }
  | { tipo: "quitar-zonas"; centros?: string[] }
  | { tipo: "estres"; opciones: Partial<OpcionesEstres> }
  /** Optimizar la red para la carga de la prueba (gateways y antenas de apoyo, ajustes) y aplicar una propuesta. */
  | { tipo: "optimizar"; opciones: Partial<OpcionesEstres> }
  | { tipo: "aplicar-optimizacion"; indice: number; combinada: boolean }
  /** Persona por persona: a quién le funciona y a quién no, y por qué. */
  | { tipo: "usuarios-estres"; opciones: Partial<OpcionesEstres> }
  /** Límite de un punto (o de cada uno, sin `centros`) y, con `llenar`, ponerle esa gente y confirmarlo. */
  | { tipo: "limite"; centros?: string[]; n?: number; radioKm?: number; llenar: boolean; opciones: Partial<OpcionesEstres> }
  | { tipo: "trama-departamento"; id: string; adopcionPct: number; sf: SfTrama; nodo: NodoUsuario }
  | { tipo: "trama-dimensionar"; usuarios: number; areaKm2: number | null; terreno: TerrenoTrama; sf: SfTrama; nodo: NodoUsuario };

export type OpcionAjusteId = "economica" | "recomendada" | "maxima";

export type Referencia = { tipo: "nodo"; id: string } | { tipo: "coord"; coord: Coordenada };

/** Un lugar ya ubicado (municipio o coordenada) para centrar el diseño. */
export type LugarPedido = { lat: number; lon: number; nombre: string; lugar?: Lugar };

/** Lo que se hace después de diseñar: zonas de popularidad en cada nodo y, si se pidió, la prueba de estrés. */
export type DespuesDiseno = { zonas: PedidoZonas; estres: Partial<OpcionesEstres> | null };

export type Pendiente =
  | { tipo: "agregar"; datos: DatosNodo }
  | { tipo: "mover"; id: string }
  | { tipo: "pieza"; pieza: Pieza; datos: DatosNodo }
  /** Una red por diseñar a la que le falta el lugar o el tamaño. */
  | { tipo: "disenar"; lugar?: LugarPedido; sostenible: boolean; despues?: DespuesDiseno }
  /** Melki preguntó «¿se refiere a…?»: «sí», «la segunda» o el nombre eligen. */
  | { tipo: "elegir"; opciones: OpcionLugar[]; dicho: string; original: string }
  /** Melki pidió el lugar de nuevo: la respuesta es el lugar que faltaba en la orden original. */
  | { tipo: "lugar"; dicho: string; original: string }
  | null;

export type Api = {
  antenas(): Antena[];
  parametros(): Parametros;
  seleccion(): string | null;
  resultado(): ResultadoSimulacion | null;
  instantanea(): Escenario;
  agregar(datos: DatosNodo & { lat: number; lon: number }): Antena;
  editar(id: string, cambios: Partial<Antena>): void;
  eliminar(id: string): void;
  parametrosCambiar(cambios: Partial<Parametros>): void;
  simular(): void;
  centrar(lat: number, lon: number, zoom?: number): void;
  encuadrarCaja(caja: [number, number, number, number]): void;
  /** Marca un punto en el mapa; con `tarjeta` = false, sin la tarjeta de acciones (solo el marcador con su nombre). */
  marcar(lat: number, lon: number, titulo: string, tarjeta?: boolean): void;
  /** Dibuja una medición; con `seleccionar` = false no abre el panel de la regla (el área de un diseño). */
  medir(m: Medicion, seleccionar?: boolean): void;
  perfil(a: Antena, b: Antena | { lat: number; lon: number }, informe?: boolean): void;
  vista(cambios: CambiosVista): void;
  senal(lat: number, lon: number): void;
  herramienta(h: "regla" | "inspeccionar" | "agregar" | "lapiz" | "mover"): void;
  ejemplo(): void;
  nuevo(): void;
  exportar(f: "kmz" | "json" | "csv"): boolean;
  borrarMediciones(): void;
  ubicacion(lat: number, lon: number): string | null;
  buscarLugar(texto: string): Lugar[];
  /** Lugares que pueden ser lo dicho (compara cómo suena, con el departamento dicho), del más probable al menos. */
  reconocerLugar?(texto: string): CandidatoLugar[];
  /** Contorno de un municipio o departamento ([lon, lat]), para cubrirlo entero. */
  contornoLugar?(l: Lugar): Poligono | null;
  /** Lo que se ve del mapa: [oeste, sur, este, norte]. */
  cajaMapa?(): [number, number, number, number] | null;
  /* Modo «Sembrar la malla» */
  modo(): ModoApp;
  cambiarModo(m: ModoApp): void;
  /** Pone una pieza (gateway, repetidor o persona) con sus valores de Trama. */
  ponerPieza(pieza: Pieza, lat: number, lon: number, datos?: DatosNodo): Antena;
  /** Arma la herramienta para poner la pieza con un clic en el mapa. */
  armarPieza(pieza: Pieza): void;
  /** Estado de la red frente al gateway (con la última simulación). */
  red(): EstadoRed;
  /** Propone repetidores hacia los destinos (sembrado automático). */
  sembrar(destinos: DestinoSiembra[]): Promise<Siembra | null>;
  propuesta(): Siembra | null;
  /** Pone los repetidores propuestos; devuelve cuántos nodos puso. */
  aceptarSiembra(): number;
  descartarSiembra(): void;
  /** Envía un mensaje desde ese nodo hasta el gateway y lo anima en el mapa (null si falta simular). */
  enviarMensaje(desdeId: string): ViajeMensaje | null;
  ejemploMalla(): void;
  /* Agente: varias órdenes, lotes, vista y diseño por área */
  seleccionar(id: string | null): void;
  eliminarVarias(ids: string[]): void;
  restaurar(e: Escenario): void;
  encuadrarTodo(): void;
  /** v17.6 · Acerca (pasos > 0) o aleja (pasos < 0) el mapa sin moverlo. */
  zoom?(pasos: number): void;
  autoSimular(): boolean;
  fijarAutoSimular(v: boolean): void;
  /** Centro del mapa que está viendo el usuario. */
  centroMapa(): { lat: number; lon: number } | null;
  mediciones(): Medicion[];
  /** Diseña la malla para cubrir el área (gateway y repetidores) con el relieve real; no cambia el escenario. */
  disenarArea(o: OpcionesDiseno): Promise<Diseno | null>;
  /** Pone los nodos del diseño; devuelve los nodos puestos. */
  aplicarDiseno(d: Diseno, alturaRepetidorM: number): Antena[];
  /** Simula (si hace falta) y entrega el próximo resultado al día. */
  esperarResultado(): Promise<ResultadoSimulacion | null>;
  /** Ajuste inteligente (cobertura–costo): calcula las opciones y las muestra en el panel y el mapa. */
  ajustarRed(o?: OpcionesAjuste): Promise<Ajuste | null>;
  /** Aplica una opción del ajuste (sobre la base, si se da: «usar la económica» después de otra); devuelve los apoyos puestos. */
  aplicarAjuste(a: Ajuste, i: number, base?: Escenario): Antena[] | null;
  mostrarAjuste(a: Ajuste, i?: number): void;
  descartarAjuste(): void;
  areaObjetivo(): AreaObjetivo | null;
  /** Marca un área de la regla como área objetivo (o la quita con id null). */
  fijarAreaObjetivo(id: string | null, objetivo?: ObjetivoArea): void;
  fijarRelieve(v: "teselas" | "plano"): void;
  renombrarEscenario(nombre: string): void;
  duplicar(id: string): void;
  /** Muestra u oculta los paneles de los lados (en el celular cierra la hoja abierta); dice en qué pantalla está. */
  paneles(c: { izquierdo?: boolean; derecho?: boolean }): "escritorio" | "celular";
  /* Gente y capacidad */
  /** Áreas donde se pueden poblar personas (área objetivo, áreas de la regla, zona de la red, área de estudio). */
  areasPoblar(): AreaPoblar[];
  /** Reparte personas al azar en un área y simula su conexión. */
  poblar(o: PedidoPoblar): ResultadoPoblar;
  /** Quita las personas pobladas al azar; devuelve cuántas. */
  quitarPobladas(): number;
  /** Prueba de carga (pagos o mensajes de texto —WhatsApp, consultas a la IA— al tiempo) y, con `curva`, hasta cuántos aguanta la frecuencia. */
  probarCarga(o: Partial<OpcionesCarga>, curva?: boolean): Promise<{ carga: ResultadoCarga; curva: CurvaCargaResultado | null } | null>;
  /** Gateways y repetidores donde se puede poner una zona de popularidad, con las personas que ya tienen. */
  centrosZona(): CentroZona[];
  /** Zonas de popularidad: N personas a la redonda de los nodos pedidos (o de todos). */
  poblarZonas(o: PedidoZonas): ResultadoZonas;
  /** Quita las zonas de popularidad (de esos nodos o todas); devuelve cuántas personas. */
  quitarZonas(centros?: string[]): number;
  /** Prueba de estrés de la hora pico por repetidor y, con `rampa`, hasta dónde aguanta cada uno. */
  probarEstres(o: Partial<OpcionesEstres>): Promise<ResultadoEstres | null>;
  /** La última prueba de estrés al día con la red de ahora. */
  estres?(): ResultadoEstres | null;
  /** Optimiza la red para la carga de la prueba: gateways y antenas de apoyo y ajustes, probados con la misma carga. */
  optimizarRed?(o: Partial<OpcionesEstres>): Promise<ResultadoOptimizar | null>;
  optimizacion?(): ResultadoOptimizar | null;
  /** Aplica una propuesta de la optimización y vuelve a probar la hora pico. */
  aplicarOptimizacion?(p: PropuestaOptimizar): Promise<boolean>;
  /** Un punto: poner N personas y probar la hora pico, buscar su límite o llenarlo hasta el límite. */
  evaluarPunto(o: PedidoPunto): Promise<ResultadoPunto>;
  /** El límite de cada punto (o de los pedidos), uno a la vez con los demás como están. */
  evaluarPuntos(o: { centros?: string[]; n?: number; radioKm?: number; opciones?: Partial<OpcionesEstres> }): Promise<{ limites: LimitePunto[]; zonas: ResultadoZonas | null; error: string | null }>;
  /* Presentación del modelo de negocio (pitch) */
  /** El mapa para la presentación: proyectar puntos, mover la cámara y seguir sus movimientos. */
  mapaPitch?(): MapaPitch | null;
  /** La red de ahora para armar el pitch (simulación y prueba de estrés al día). */
  datosPitch?(): DatosPitch;
};

/** Pedido de ajuste automático que arma Melki (qué puede cambiar, límites y sitios dados). */
export type OpcionesAjuste = {
  permisos?: Partial<PermisosAjuste>;
  alturaMaxM?: number;
  maxApoyos?: number;
  sitios?: SitioAjuste[];
  fijos?: string[];
};

/** Pedido de diseño por área que arma Melki. */
export type OpcionesDiseno = {
  area: Poligono;
  margenDb: number;
  porcentaje: number;
  respaldo: boolean;
  alturaRepetidorM: number;
  gateway: Coordenada | null;
  maxRepetidores: number;
  /** Freno de rendimiento: no poner repetidores que cubran menos de `minPct` % del área. */
  eficiencia?: { minPct: number } | null;
};

const n = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.,\-°'"\s]/g, " ")
    .replace(/\bnodo\s*-?\s*antena(s?)\b/g, "nodo antena$1")
    .replace(/\s+/g, " ")
    .trim();
/** La frase como la compara el intérprete (también la usa el Modelo Melki para sacar sus datos). */
export const textoOrden = n;
const num = (s: string) => Number(s.replace(",", "."));
/** «1,5» o «1.5»: con `d` decimales y el separador del idioma de la pantalla (solo para mostrar). */
const f1 = (x: number, d = 1) => decimalLocal(x, d);
/** Número sin decimales si es entero (20 m), con uno si no (1,5 m). */
const fn = (x: number) => (Number.isInteger(x) ? String(x) : f1(x));
/** El artículo en inglés antes de un número dicho: «an 18 m tower», «a 15 m tower». */
const articuloIngles = (cifra: string) => (/^(?:8|1[18](?![\d]))/.test(cifra) ? "an" : "a");
/** Una lista en inglés con «and» al final («roads, rivers and links»); en español esas listas van con comas. */
const listaIngles = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""));

/* ───────────── Coordenadas en texto libre ───────────── */

function ajustarColombia(lat: number, lon: number, conHemisferio: boolean): Coordenada | null {
  let corregido = false;
  // Longitud primero: «-73,12, 4,51»
  if (Math.abs(lat) > 20 && Math.abs(lat) <= 82 && Math.abs(lon) <= 14) [lat, lon] = [lon, lat];
  // Longitud sin signo en Colombia: se toma al oeste
  if (!conHemisferio && lon >= 66 && lon <= 82 && lat >= -5 && lat <= 14) {
    lon = -lon;
    corregido = true;
  }
  if (Math.abs(lat) > 85 || Math.abs(lon) > 180) return null;
  return { lat, lon, corregido };
}

/** Busca una coordenada (latitud y longitud) dentro de un texto. */
export function extraerCoordenadas(texto: string): Coordenada | null {
  const t = texto.replace(/[’′´`]/g, "'").replace(/[”″“]/g, '"').replace(/''/g, '"').replace(/º/g, "°");
  // 1) Grados, minutos y segundos: 4°30'44,3" N 73°07'24" O
  const gms = /(-?\d{1,3})\s*°\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*'\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*"\s*)?\s*(norte|sur|oeste|occidente|este|[NSEOW](?![a-zA-Z]))?/gi;
  const partes = [...t.matchAll(gms)];
  if (partes.length >= 2) {
    const valores = partes.slice(0, 2).map((m) => {
      const h = (m[4] ?? "").toUpperCase();
      const hem = h.startsWith("NORTE") ? "N" : h.startsWith("SUR") ? "S" : h.startsWith("OESTE") || h.startsWith("OCC") ? "O" : h.startsWith("ESTE") ? "E" : h;
      const texto = `${m[1]}°${m[2] ? `${m[2]}'` : ""}${m[3] ? `${m[3]}"` : ""} ${hem}`.trim();
      return { hem, texto };
    });
    let lat: number | null = null;
    let lon: number | null = null;
    for (const v of valores) {
      if ("NS".includes(v.hem) && v.hem) lat = leerCoordenada(v.texto, "lat");
      else if ("EOW".includes(v.hem) && v.hem) lon = leerCoordenada(v.texto, "lon");
    }
    if (lat === null && lon === null) {
      lat = leerCoordenada(valores[0].texto, "lat");
      lon = leerCoordenada(valores[1].texto, "lon");
    } else if (lat === null) lat = leerCoordenada(valores.find((v) => !"EOW".includes(v.hem) || !v.hem)?.texto ?? "", "lat");
    else if (lon === null) lon = leerCoordenada(valores.find((v) => !"NS".includes(v.hem) || !v.hem)?.texto ?? "", "lon");
    if (lat !== null && lon !== null) return ajustarColombia(lat, lon, valores.some((v) => v.hem));
  }
  // 2) Decimales: «4.5123, -73.1234», «4,5123; -73,1234», «lat 4.51 lon -73.12»
  const limpio = t.replace(/\b(latitud|lat|longitud|long|lon|lng)\b\s*:?/gi, " ");
  const dec = /(-?\d{1,3}(?:\.\d+|,\d{2,}))\s*°?\s*([NS](?![a-zA-Z]))?\s*(?:[,;/]|\sy\s|\s)\s*(-?\d{1,3}(?:\.\d+|,\d{2,}))\s*°?\s*([EOW](?![a-zA-Z]))?/i;
  const m = limpio.match(dec);
  if (m) {
    let lat = num(m[1]);
    let lon = num(m[3]);
    if (m[2]?.toUpperCase() === "S") lat = -Math.abs(lat);
    if (m[4] && "OW".includes(m[4].toUpperCase())) lon = -Math.abs(lon);
    return ajustarColombia(lat, lon, Boolean(m[2] || m[4]));
  }
  return null;
}

/** Todas las coordenadas de un texto («en 4.51, -73.12; 4.60, -73.05 y 4°30' N 73°10' O»). */
export function extraerVariasCoordenadas(texto: string): Coordenada[] {
  const t = texto.replace(/[’′´`]/g, "'").replace(/[”″“]/g, '"').replace(/''/g, '"').replace(/º/g, "°");
  const salida: Coordenada[] = [];
  const gms = [...t.matchAll(/(-?\d{1,3})\s*°\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*'\s*)?(?:(\d{1,2}(?:[.,]\d+)?)\s*"\s*)?\s*(norte|sur|oeste|occidente|este|[NSEOW](?![a-zA-Z]))?/gi)];
  if (gms.length >= 4) {
    for (let i = 0; i + 1 < gms.length; i += 2) {
      const c = extraerCoordenadas(`${gms[i][0]} ${gms[i + 1][0]}`);
      if (c) salida.push(c);
    }
    return salida;
  }
  const limpio = t.replace(/\b(latitud|lat|longitud|long|lon|lng)\b\s*:?/gi, " ");
  for (const m of limpio.matchAll(/(-?\d{1,3}(?:\.\d+|,\d{2,}))\s*°?\s*([NS](?![a-zA-Z]))?\s*(?:[,;/]|\sy\s|\s)\s*(-?\d{1,3}(?:\.\d+|,\d{2,}))\s*°?\s*([EOW](?![a-zA-Z]))?/gi)) {
    const c = extraerCoordenadas(m[0]);
    if (c) salida.push(c);
  }
  return salida;
}

/* ───────────── Nodos y datos en el texto ───────────── */

/** v17.3 · Una lista larga: los primeros y cuántos más («…, Persona 15 y 285 más»), para no llenar el chat con cientos de nombres. */
function listaCorta(items: string[], separador: string, max = 15): string {
  if (items.length <= max) return items.join(separador);
  return `${items.slice(0, max).join(separador)}${tx(` y ${items.length - max} más`, ` and ${items.length - max} more`)}`;
}

function buscarNodo(tn: string, antenas: Antena[], seleccion: string | null, excluir?: string): Antena | null {
  const candidatos = [...antenas].filter((a) => a.id !== excluir).sort((a, b) => b.nombre.length - a.nombre.length);
  for (const a of candidatos) {
    const nombre = n(a.nombre);
    if (nombre.length >= 2 && new RegExp(`(^|[^a-z0-9])${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(tn)) return a;
  }
  if (/\b(la|el) (ultima|ultimo)\b/.test(tn) && antenas.length) return antenas[antenas.length - 1];
  if (/\b(seleccionad[ao]|esta antena|este nodo|esa antena|ese nodo)\b/.test(tn) && seleccion) return antenas.find((a) => a.id === seleccion) ?? null;
  if (antenas.length === 1 && /\b(antena|nodo|torre)\b/.test(tn)) return antenas[0];
  return null;
}

export function nodosMencionados(tn: string, antenas: Antena[]): Antena[] {
  const encontrados: { a: Antena; pos: number }[] = [];
  for (const a of [...antenas].sort((x, y) => y.nombre.length - x.nombre.length)) {
    const nombre = n(a.nombre);
    const pos = tn.search(new RegExp(`(^|[^a-z0-9])${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`));
    if (pos >= 0 && !encontrados.some((e) => Math.abs(e.pos - pos) < 2)) encontrados.push({ a, pos });
  }
  return encontrados.sort((x, y) => x.pos - y.pos).map((e) => e.a);
}

function nombreNuevo(texto: string): string | undefined {
  const comillas = texto.match(/["“«']([^"”»']{2,40})["”»']/);
  if (comillas) return comillas[1].trim();
  const m = texto.match(
    /(?:llamad[oa]|de nombre|con (?:el )?nombre(?: de)?|nombre:?|que se llame)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9][\wÁÉÍÓÚÑáéíóúñ .-]{0,38}?)(?=\s+(?:en|a|con|de|ubicad[oa]|que|y|para|sobre)\b|[,.;]|$)/i,
  );
  return m ? m[1].trim() : undefined;
}

function datosNodo(texto: string, tn: string): DatosNodo {
  const d: DatosNodo = {};
  const nombre = nombreNuevo(texto);
  if (nombre) d.nombre = nombre;
  const altura = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*s\.?\s*n)/i);
  if (altura) d.alturaM = Math.min(300, Math.max(0.5, num(altura[1])));
  const ganancia = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
  if (ganancia) d.gananciaDbi = num(ganancia[1]);
  const potencia = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbm\b/i);
  if (potencia) d.potenciaDbm = num(potencia[1]);
  if (/\b(pasarela|gateway)\b/.test(tn)) d.pasarela = true;
  const tipo = tipoNodo(tn);
  if (tipo) d.tipo = tipo;
  const patron = patronEnTexto(tn);
  if (patron && patron !== "omni") {
    d.patron = patron;
    d.equipo = "personalizado";
    if (d.gananciaDbi === undefined) d.gananciaDbi = patronPorId(patron).gananciaTipica;
    const az = /\b(apunt\w*|orient\w*|azimut|hacia|mirando)\b/.test(tn) ? azimutEnTexto(texto.replace(/\d+(?:[.,]\d+)?\s*°\s*\d/g, ""), tn) : null;
    d.azimutDeg = az ?? 0;
    d.elevacionDeg = 0;
  }
  return d;
}

function tipoNodo(tn: string): TipoNodo | null {
  if (/\bnodo antena\b|\bantena\b|\btorre\b|\brepetidor\b|\brouter\b/.test(tn)) return "antena";
  if (/\bnodo\b|\bsensor\b|\bportatil\b|\brastreador\b|\btracker\b|equipo de campo|nodo de campo/.test(tn)) return "nodo";
  return null;
}

/**
 * Ajuste de radio en el texto: «SF9», «SF10 a 250 kHz», «SF9 de 62,5», «el de capacidad», «el de alcance»,
 * «el de EE. UU.». Sin ancho de banda se entiende el de Trama (250 kHz).
 */
/** «Cambia a Meshtastic», «usa MeshCore», «que los clientes no repitan» (CLIENT_MUTE). */
function protocoloEnTexto(tn: string): { protocolo?: ProtocoloId; usuariosRepiten?: boolean } | null {
  const mt = /\bme(sh|s)\s?t[a]?stic\w*\b|\bmeshtastic\b/.test(tn);
  const mc = /\bme(sh|s)\s?cor\w*\b/.test(tn);
  const mudo = /\b(client ?mute|mud[oa]s?|que no repitan|no repitan|sin repetir|no retransmitan)\b/.test(tn);
  const repiten = !mudo && /\b(que (los clientes|las personas|los equipos|todos) repitan|repitan todos|client\b)\b/.test(tn);
  if (!mt && !mc && !mudo && !repiten) return null;
  // Las preguntas («¿qué es Meshtastic?», «diferencia entre MeshCore y Meshtastic») las contesta el cerebro
  const orden = /\b(usa|usar|cambia\w*|pasa\w*|pon\w*|configura\w*|trabaj\w*|simula\w*|prueba\w*|deja\w*|vuelve\w*|selecciona\w*|escoge\w*|quiero|activa\w*|protocolo)\b/.test(tn);
  if (!orden || /^(que|cual|cuales|como|por que|para que|en que)\s+(es|son|significa|diferencia\w*|se diferencia\w*|cambia)\b/.test(tn) || /\bdiferencia\w*\b/.test(tn)) return null;
  if ((mudo || repiten) && !/\b(clientes?|personas?|equipos?|usuarios?|billeteras?|nodos?|client)\b/.test(tn)) return null;
  return { ...(mt && !mc ? { protocolo: "meshtastic" as const } : mc && !mt ? { protocolo: "meshcore" as const } : {}), ...(mudo ? { usuariosRepiten: false } : repiten ? { usuariosRepiten: true } : {}) };
}

function presetEnTexto(tn: string): PresetId | null {
  // Los presets de Meshtastic por su nombre
  for (const [re, id] of [
    [/\blong ?fast\b/, "MT_LONG_FAST"],
    [/\blong ?moderate\b/, "MT_LONG_MODERATE"],
    [/\blong ?slow\b/, "MT_LONG_SLOW"],
    [/\bmedium ?slow\b/, "MT_MEDIUM_SLOW"],
    [/\bmedium ?fast\b/, "MT_MEDIUM_FAST"],
    [/\bshort ?fast\b/, "MT_SHORT_FAST"],
  ] as const)
    if (re.test(tn)) return id;
  if (/\b(de|el|modo|ajuste|radio|preset|velocidad) (de )?(capacidad|mas capacidad)\b/.test(tn)) return "SF9_250";
  if (/\b(de|el|modo|ajuste|radio|preset) (de )?(alcance|mas alcance|largo alcance)\b/.test(tn)) return "SF11_250";
  // «usa» es el verbo: Estados Unidos se nombra completo («el ajuste de Estados Unidos», «el de EE. UU.»)
  if (/\b(estados unidos|ee ?uu|norteamerica\w*)\b/.test(tn) && /\b(preset|ajuste|radio|config\w*|el de)\b/.test(tn)) return "SF7_62";
  const m = tn.match(/\bsf ?(7|8|9|10|11)\b/);
  if (!m) return null;
  const sf = Number(m[1]);
  const angosto = /\b62(?:[.,]5)?\b|\bangost\w*|\bestrech\w*|\bcomunidad\b/.test(tn);
  const id = `SF${sf}_${angosto ? "62" : "250"}` as PresetId;
  return PRESETS.some((p) => p.id === id) ? id : sf >= 9 && sf <= 11 ? (`SF${sf}_250` as PresetId) : (`SF${sf}_62` as PresetId);
}

/* ───────────── Antenas direccionales, red y vista ───────────── */

/** El nombre del tipo de antena dentro de una frase en inglés («a Yagi antenna», «a panel antenna»). */
const nombreAntenaIngles = (p: PatronId) => patronPorId(p).nombre.toLowerCase().replace(/\byagi\b/, "Yagi");

/** Tipo de antena mencionado en el texto. */
function patronEnTexto(tn: string): PatronId | null {
  if (/\byagi\b/.test(tn)) return "yagi";
  if (/\bparabolic\w*|\bplato\b|\brejilla\b/.test(tn)) return "parabolica";
  if (/\bsector\w*/.test(tn)) return /\b120\b/.test(tn) ? "sectorial-120" : "sectorial-90";
  if (/\bpanel\b/.test(tn)) return "panel";
  if (/\bomni\w*/.test(tn)) return "omni";
  return null;
}

const CARDINALES: [RegExp, number][] = [
  [/\b(noreste|nororiente|nor ?este)\b/, 45],
  [/\b(noroeste|noroccidente|nor ?oeste)\b/, 315],
  [/\b(sureste|suroriente|sur ?este|sudeste)\b/, 135],
  [/\b(suroeste|suroccidente|sur ?oeste|sudoeste)\b/, 225],
  [/\b(norte)\b/, 0],
  [/\b(sur)\b/, 180],
  [/\b(este|oriente)\b/, 90],
  [/\b(oeste|occidente)\b/, 270],
];

/** Azimut pedido: «45°», «a 120 grados», «al noreste»; null si no se menciona. */
function azimutEnTexto(texto: string, tn: string): number | null {
  const g = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:°|º|grados?\b)/i);
  if (g) return ((num(g[1]) % 360) + 360) % 360;
  const resto = tn.replace(/.*\b(apunt\w*|orient\w*|dirig\w*|gir\w*|hacia|mirando)\b/, "");
  for (const [re, grados] of CARDINALES) if (re.test(resto)) return grados;
  return null;
}

const PREGUNTA = /^(que|como|cual|cuales|por que|porque|para que|explica\w*|dime|cuentame)\b|\b(que es|que son|que significa|para que sirve|como funciona)\b/;

function climaEnTexto(tn: string): ClimaItm | null {
  if (/\becuatorial\b/.test(tn)) return 1;
  if (/\bdesert\w*|\bdesierto\b|\barido\b/.test(tn)) return 4;
  if (/\bmaritimo templado\b.*\bmar\b|\bsobre el mar\b|\bsobre mar\b/.test(tn)) return 7;
  if (/\bmaritimo templado\b|\bmaritimo\b.*\btierra\b/.test(tn)) return 6;
  if (/\bmaritimo subtropical\b|\bmaritimo\b/.test(tn)) return 3;
  if (/\bcontinental templado\b|\btemplado\b/.test(tn)) return 5;
  if (/\bcontinental subtropical\b|\bsubtropical\b|\bcontinental\b/.test(tn)) return 2;
  return null;
}

function sueloEnTexto(tn: string): SueloId | null {
  if (/\bagua de mar\b|\bmar\b|\bsalad\w*/.test(tn)) return "mar";
  if (/\bagua dulce\b|\brio\b|\blago\b|\bcienaga\b|\bagua\b/.test(tn)) return "agua-dulce";
  if (/\bpobre\b|\bseco\b|\barenos\w*|\bdesert\w*/.test(tn)) return "pobre";
  if (/\bbueno\b|\bhumed\w*|\bfertil\b|\bpantanos\w*/.test(tn)) return "bueno";
  if (/\bpromedio\b|\bmedio\b|\bnormal\b|\bcomun\b/.test(tn)) return "promedio";
  return null;
}

function entornoEnTexto(tn: string): EntornoId | null {
  if (/\b(centro urbano|ciudad densa|edificios altos|urbano denso)\b/.test(tn)) return "urbano-denso";
  if (/\b(vegetacion densa|bosque|selva|monte|montes|arboles altos|bosques)\b/.test(tn)) return "bosque";
  if (/\b(plantacion\w*|palma\w*|palmeras|palmares|frutales|cultivo alto|cultivos altos)\b/.test(tn)) return "plantacion";
  if (/\b(cultivos?|arboles dispersos|vegetacion ligera|vegetacion|potreros? con arboles|arboles)\b/.test(tn)) return "cultivos";
  if (/\b(pueblo|suburban\w*|caserio|casas)\b/.test(tn)) return "suburbano";
  if (/\b(ciudad|urbano|urbana|edificios)\b/.test(tn)) return "urbano";
  if (/\b(campo abierto|sabana|sin vegetacion|sin obstaculos|despejad\w*|zona abierta|terreno abierto|llanura abierta|sin entorno|sin perdidas? (de|por) entorno)\b/.test(tn)) return "abierto";
  return null;
}

/** Nivel con unidad en el texto («-100 dBm», «5 µV», «20 dB»), convertido a dBm. */
function nivelesEnTexto(texto: string, sensibilidad: number): number[] {
  const t = texto.replace(/−/g, "-");
  const aDbmU = (v: number, unidad: string) => {
    const u = unidad.toLowerCase();
    return u === "dbm" ? v : u === "db" ? v + sensibilidad : uvADbm(v);
  };
  const UNIDAD = "(dbm|µ\\s?v|uv|microvolt\\w*|db)\\b";
  // Rango con una sola unidad al final: «de -120 a -70 dBm»
  const rango = t.match(new RegExp(`(-?\\d{1,3}(?:[.,]\\d+)?)\\s*(?:dbm|db|µv|uv)?\\s*(?:a|y|hasta|–)\\s*(-?\\d{1,3}(?:[.,]\\d+)?)\\s*${UNIDAD}`, "i"));
  if (rango) return [aDbmU(num(rango[1]), rango[3]), aDbmU(num(rango[2]), rango[3])];
  return [...t.matchAll(new RegExp(`(-?\\d{1,3}(?:[.,]\\d+)?)\\s*${UNIDAD}`, "gi"))].map((m) => aDbmU(num(m[1]), m[2]));
}

function unidadEnTexto(texto: string, tn: string): UnidadId | null {
  if (/db\s*[µu]\s*v\s*\/\s*m|campo el[eé]ctrico|intensidad de campo/i.test(texto)) return "dbuvm";
  if (/[µ]\s?v\b|\buv\b|microvolt/i.test(texto)) return "uv";
  if (/\bdbm\b/.test(tn)) return "dbm";
  if (/\bmargen\b|\ben db\b|\bdecibel\w*/.test(tn)) return "margen";
  return null;
}

/* ───────────── Números, áreas, lugares y posiciones relativas ───────────── */

export { leerNumero };

/**
 * Área pedida en el texto (m²). Si después se corrige («11.000 ha… exactos 11.226»), vale la corrección. En millas,
 * yardas o pies cuadrados (y acres o fanegadas) trae también lo dicho con su conversión: «2 millas cuadradas (5,18 km²)».
 */
export function areaEnTexto(bajo: string): { m2: number; unidad: string; dicho?: string } | null {
  const lista = [...bajo.matchAll(new RegExp(`${NUMERO}\\s*${UNIDAD_AREA}`, "g"))];
  if (!lista.length) return null;
  const ultimo = lista[lista.length - 1];
  const unidad = ultimo[3];
  let m2 = leerNumero(`${ultimo[1]}${ultimo[2] ? " mil" : ""}`) * factorArea(unidad);
  const resto = bajo.slice((ultimo.index ?? 0) + ultimo[0].length);
  const correccion = resto.match(new RegExp(`\\b(?:exact\\w*|en realidad|mejor dicho|o sea|perdon|corrijo|correccion|siendo precis\\w*|precisamente|en total)\\b[^0-9]{0,24}${NUMERO}(?!\\s*(?:%|por ciento|m\\b|metros|km\\b|kilometros|db|dbi|dbm|repetidor))`));
  if (correccion) m2 = leerNumero(`${correccion[1]}${correccion[2] ? " mil" : ""}`) * factorArea(unidad);
  if (!(m2 > 0)) return null;
  const valor = m2 / factorArea(unidad);
  const imperial = unidadAreaImperial(unidad, valor);
  return { m2, unidad, ...(imperial ? { dicho: `${cifraLocal(valor)} ${imperial} (${m2 >= 1e6 ? `${cifraLocal(m2 / 1e6)} km²` : `${cifraLocal(m2 / 1e4)} ha`})` } : {}) };
}

/** «11.226 ha (112,26 km²)», «850 ha», «3,5 ha» (en inglés «11,226 ha (112.26 km²)»). */
export function textoArea(m2: number): string {
  const ha = m2 / 1e4;
  const haTxt = ha >= 100 ? numeroLocal(Math.round(ha)) : f1(ha, ha < 10 ? 1 : 0);
  const km2 = m2 / 1e6;
  const kmTxt = km2 >= 1000 ? numeroLocal(Math.round(km2)) : f1(km2, km2 >= 100 ? 1 : 2).replace(/[.,]0+$/, "");
  return m2 >= 1e6 ? `${haTxt} ha (${kmTxt} km²)` : `${haTxt} ha`;
}

/* ───────────── Lugares dichos (aunque el dictado los escriba mal) ───────────── */

/** Un lugar dicho que puede ser varios («barranco vía» → ¿Barranca de Upía, Barranquilla o Barranco Mina?). */
type DudaLugar = { dicho: string; opciones: CandidatoLugar[] };

/**
 * Lo que se vio de los lugares mientras se interpreta una orden: las dudas (para preguntar «¿se refiere a…?»), los
 * lugares usados (para recordarlos en la conversación), los corregidos (para decir qué entendió) y el lugar elegido
 * para lo dicho cuando ya se resolvió la duda.
 */
let sesionLugares: { dudas: DudaLugar[]; intentos: DudaLugar[]; usados: Lugar[]; corregidos: { dicho: string; lugar: Lugar }[]; forzar?: { dicho: string; lugar: Lugar } } | null = null;

function usarLugar(l: Lugar, c?: CandidatoLugar, dicho?: string) {
  if (!sesionLugares) return;
  sesionLugares.usados.push(l);
  if (c && !c.exacto && dicho) sesionLugares.corregidos.push({ dicho, lugar: l });
}

function registrarDuda(d: DudaLugar) {
  if (sesionLugares && !sesionLugares.dudas.some((x) => x.dicho === d.dicho)) sesionLugares.dudas.push(d);
}

const escRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Los lugares que pueden ser lo dicho: por cómo suena (si el simulador lo ofrece) o con el buscador. */
export function candidatosLugar(frase: string, api: Api): CandidatoLugar[] {
  if (api.reconocerLugar) return api.reconocerLugar(frase);
  const tn = n(frase);
  return api
    .buscarLugar(frase)
    .slice(0, 6)
    .flatMap((l): CandidatoLugar[] => {
      const nombre = n(l.nombre);
      if (nombre.length >= 4 && new RegExp(`(^|[^a-z])${escRe(nombre)}($|[^a-z])`).test(tn)) return [{ lugar: l, parecido: 1, puntaje: 1.08, exacto: true, departamentoDicho: null }];
      // Pegado o con una letra distinta («barrancaupía», «barranca de opia»): se acepta como antes, sin preguntar
      if (pareceNombre(frase, l.nombre)) return [{ lugar: l, parecido: 0.96, puntaje: 0.96, exacto: false, departamentoDicho: null }];
      return [];
    });
}

/** Palabras que siguen a «en», «de»… y no son un lugar («en la loma», «de señal media», «en todo el municipio»). */
export const NO_ES_LUGAR =
  /^(un|una|unos|unas|mi|su|sus|este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|area|zona|zonas|mapa|campo|loma|lomas|casa|finca|punto|puntos|centro|red|malla|torre|torres|altura|metros|km|rango|radio|diametro|diametros|redonda|alrededores|total|todo|toda|todos|todas|forma|manera|marco|base|cada|que|senal|cobertura|calidad|buena|buenas|media|medias|estable|estables|baja|bajas|hectareas?|ha|personas?|gente|repetidor\w*|gateway|nodos?|antenas?|popularidad|hora|dia|pagos?|mensajes?|parte|mitad|sector|lado|costado|region|norte(?! de santander)|sur|oeste|oriente|occidente|nororiente|noroccidente|suroriente|suroccidente|pantalla|vista|ahi|alli|alla|nuevo|nueva|cuenta|serio|general|promedio|verdad|realidad|lugar|sitio|municipio|pueblo|departamento|ciudad|vereda|tal|tales|sabana|sabanas|llano|llanos|monte|montes|montana|montanas|selva|rio|rios|quebrada|quebradas|veredas?|fincas?|hacienda|haciendas|potreros?|cerros?|valles?|caserios?|parques?|carretera|via|vias|rural|rurales|urbana|urbano|casco|plaza|colegio|escuela|hospital|cuenta|serio|general|promedio|vivo|directo|linea|favor|economia|economica|economico|costos?|precios?|dinero|plata|inversion|presupuesto|energia|solar|internet|starlink|capacidad|estres|carga|trafico|whatsapp|usuarios?|billeteras?|quiebre|quebrarse|maximo|minimo|limite|aguante|ver|saber|probar|mirar|medir|calcular|hacer|tener|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|cientos|mil|millon|millones|por ciento|porciento|nada|algo|ella|el|ellos|siguiente|siguientes|anterior|misma|mismo|otra|otro|nueva|nuevo|manera|modo|momento|tiempo|caso|vez|veces)\b/;

/**
 * Un municipio, departamento o país nombrado después de «en», «cerca de», «del municipio de»…: prueba las palabras que
 * siguen, de la frase más larga a la más corta («en Barranca de Upía en un rango de…» → «Barranca de Upía»), y se queda
 * con el lugar que mejor suena como lo dicho, aunque el dictado lo haya escrito mal («barranco vía meta» → Barranca de
 * Upía, Meta). Si puede ser varios, deja la duda para preguntar «¿se refiere a…?» (con `estricto`, solo si se parecen
 * bastante: en una frase larga cualquier palabra podría parecerse a algún municipio).
 */
function lugarEnTexto(tn: string, api: Api, estricto = true): Lugar | null {
  const re = /\b(?:en|alrededor de|cerca de|junto a|sobre|por|del municipio de|municipio de|de|para)\s+(?:el municipio de |el pueblo de |la ciudad de |el departamento del? |el )?([a-z][a-z ]{2,60})/g;
  let duda: DudaLugar | null = null;
  let intento: DudaLugar | null = null;
  // Lo que no se reconoce se vuelve a mirar por dentro («de diámetro en Villavicencio» → «en Villavicencio»); lo que se
  // halla por dentro solo vale si es seguro (no pregunta «¿se refiere a…?» por una palabra suelta)
  let finPrevio = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tn))) {
    const interior = m.index < finPrevio;
    finPrevio = Math.max(finPrevio, m.index + m[0].length);
    re.lastIndex = m.index + m[0].length - m[1].length;
    const palabras = m[1].split(/\s+\d/)[0].trim().split(/\s+/).slice(0, 6);
    let mejor: { c: CandidatoLugar; frase: string } | null = null;
    let primera: DudaLugar | null = null;
    for (let k = palabras.length; k >= 1; k--) {
      let frase = palabras.slice(0, k).join(" ");
      // v17.4 · El dictado parte los nombres: «Kumar al» es Cumaral y «via vicencio», Villavicencio («villa» se oye «vía»)
      if (k >= 2 && /\s(?:al|el|la|a)$/.test(frase)) frase = frase.replace(/\s+(al|el|la|a)$/, "$1");
      if (k >= 2 && /^via\s+[a-z]{4,}/.test(frase)) frase = frase.replace(/^via\s+/, "villa");
      // «La Macarena» sí; «la loma», «la zona» no
      const sinArticulo = frase.replace(/^(la|las|los|el)\s+/, "");
      if (sinArticulo.length < 3 || /^(la|las|los|el)$/.test(sinArticulo) || NO_ES_LUGAR.test(sinArticulo) || /\b(que|con|para|hacia|cubr\w*|y|o|de|del|en|el|la|los|las|a|al)$/.test(frase)) continue;
      const forzado = sesionLugares?.forzar;
      if (forzado && forzado.dicho === frase) {
        usarLugar(forzado.lugar);
        return forzado.lugar;
      }
      const d = decidirLugar(candidatosLugar(frase, api));
      // La frase más larga que parecía un nombre (por si no se reconoce ninguna: «en xyz» → «no reconocí xyz»)
      if (!interior && !primera && nombreCompacto(sinArticulo).length >= 6 && !frase.split(" ").some((w) => NO_ES_LUGAR.test(w))) primera = { dicho: frase, opciones: d.opciones.filter((c) => c.puntaje >= 0.66) };
      if (d.tipo === "seguro") {
        if (!mejor || d.candidato.puntaje > mejor.c.puntaje + 1e-9) mejor = { c: d.candidato, frase };
      } else if (!interior && d.tipo === "dudoso" && !duda && d.opciones[0] && (d.opciones[0].puntaje >= (estricto ? 0.78 : 0.7) || d.opciones[0].exacto)) duda = { dicho: frase, opciones: d.opciones };
    }
    if (mejor) {
      usarLugar(mejor.c.lugar, mejor.c, mejor.frase);
      return mejor.c.lugar;
    }
    intento ??= primera;
  }
  if (duda) {
    registrarDuda(duda);
    return duda.opciones[0].lugar;
  }
  if (intento && sesionLugares && !sesionLugares.intentos.some((x) => x.dicho === intento.dicho)) sesionLugares.intentos.push(intento);
  return null;
}

/** «Barranca de Upía» → «barrancaupia» (como lo compara el reconocimiento de lugares). */
const nombreCompacto = (t: string) => n(t).replace(/[^a-z ]/g, " ").replace(/\b(de|del|la|las|los|el|y)\b/g, " ").replace(/\s+/g, "");

/** «Ubícame en barranca de upa meta»: el lugar de lo que sigue al verbo (o null, con las pistas para preguntar). */
function lugarDeConsulta(consulta: string, api: Api): { lugar: Lugar | null; sugerencias: Lugar[] } {
  const forzado = sesionLugares?.forzar;
  if (forzado && forzado.dicho === consulta) {
    usarLugar(forzado.lugar);
    return { lugar: forzado.lugar, sugerencias: [] };
  }
  // Primero lo dicho completo; si no, sus partes («barranca de upía meta rápido» → «barranca de upía meta»). v17.4: el
  // dictado parte «Villanueva» o «Villavicencio» en «via nueva», «via vicencio» («villa» se oye «vía»)
  let d = decidirLugar(candidatosLugar(consulta, api));
  if (d.tipo !== "seguro" && /^v[ií]a\s+[a-z]{4,}/i.test(consulta)) {
    const villa = decidirLugar(candidatosLugar(consulta.replace(/^v[ií]a\s+/i, "villa"), api));
    if (villa.tipo === "seguro") d = villa;
  }
  if (d.tipo === "seguro") {
    usarLugar(d.candidato.lugar, d.candidato, consulta);
    return { lugar: d.candidato.lugar, sugerencias: [] };
  }
  const parte = lugarEnTexto(`en ${consulta}`, api, false);
  if (parte) return { lugar: parte, sugerencias: [] };
  if (d.tipo === "dudoso") {
    registrarDuda({ dicho: consulta, opciones: d.opciones });
    return { lugar: d.opciones[0].lugar, sugerencias: [] };
  }
  return { lugar: null, sugerencias: d.opciones.map((c) => c.lugar) };
}

/** «¿Se refiere a…?» con las opciones (nombres repetidos: «Hay tres municipios llamados Granada. ¿Cuál…?»). */
function preguntaLugar(opciones: OpcionLugar[], dicho: string): string {
  const lista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")}${tx(" o ", " or ")}${xs[xs.length - 1]}` : (xs[0] ?? ""));
  const lugares = opciones.flatMap((o) => (o.lugar ? [o.lugar] : []));
  const mismos = lugares.length > 1 && new Set(lugares.map((l) => n(l.nombre))).size === 1;
  if (mismos)
    return tx(
      `Hay ${lugares.length === 2 ? "dos lugares" : `${lugares.length} lugares`} llamados ${lugares[0].nombre}. ¿Cuál: ${lista(lugares.map(nombreLugar))}?`,
      `There are ${lugares.length === 2 ? "two places" : `${lugares.length} places`} called ${lugares[0].nombre}. Which one: ${lista(lugares.map(nombreLugar))}?`,
    );
  return tx(`No estoy seguro de haber entendido «${dicho}». ¿Se refiere a ${lista(lugares.map(nombreLugar))}?`, `I'm not sure I understood “${dicho}”. Do you mean ${lista(lugares.map(nombreLugar))}?`);
}

export const RUMBOS = "norte|sur|este|oeste|oriente|occidente|noreste|noroeste|sureste|suroeste|nororiente|noroccidente|suroriente|suroccidente|sudeste|sudoeste";

/** Cada rumbo dicho (de `RUMBOS`) en inglés, para mostrarlo: «al nororiente» → «northeast». */
const RUMBO_INGLES: Record<string, string> = {
  norte: "north",
  sur: "south",
  este: "east",
  oriente: "east",
  oeste: "west",
  occidente: "west",
  noreste: "northeast",
  nororiente: "northeast",
  noroeste: "northwest",
  noroccidente: "northwest",
  sureste: "southeast",
  suroriente: "southeast",
  sudeste: "southeast",
  suroeste: "southwest",
  suroccidente: "southwest",
  sudoeste: "southwest",
};
const rumboIngles = (t: string) => RUMBO_INGLES[t] ?? t;

/**
 * Posición relativa: «a 10 km al norte del gateway», «2 km al noreste de Repetidor 1», «a 500 m al sur de
 * 4.2, -73.37», «a 8 km del gateway hacia el oriente», «5 km al este de Cumaral».
 */
function relativaEnTexto(texto: string, tn: string, api: Api, antenas: Antena[], ultimo?: Antena): (Coordenada & { desde: string }) | null {
  // En km, metros, millas, yardas, pies o cuadras («a 2 millas al norte del gateway»)
  const dist = String.raw`(\d+(?:[.,]\d+)?)\s*${UNIDAD_LONGITUD}`;
  const enMetros = (v: string, u: string) => num(v) * LONGITUDES[unidadDe(u) ?? "m"].metros;
  const dicho = (v: string, u: string, metros: number) => {
    const unidad = unidadDe(u) ?? "m";
    return unidad === "km" || unidad === "m" ? formatoDistancia(metros) : textoDistancia(distancia(num(v), unidad));
  };
  const a = tn.match(new RegExp(`${dist}\\s+(?:mas\\s+)?(?:al|hacia el|hacia|rumbo al?|en direccion al?)?\\s*(${RUMBOS})\\s+(?:de|del|desde)\\s+(.{2,60})`));
  const b = a ? null : tn.match(new RegExp(`${dist}\\s+(?:de|del|desde)\\s+(.{2,40}?)\\s+(?:al|hacia el|hacia|rumbo al?)\\s+(${RUMBOS})\\b`));
  // Sin punto de partida («un repetidor a 10 km al este»): desde el último nodo que se tocó o desde el gateway
  if (!a && !b) {
    const c = tn.match(new RegExp(`${dist}\\s+(?:mas\\s+)?(?:al|hacia el|hacia|rumbo al?|en direccion al?)\\s*(${RUMBOS})\\b(?!\\s+(?:de|del|desde)\\b)`));
    const desde = ultimo ?? antenas.find((x) => x.pasarela && x.activa);
    if (!c || !desde) return null;
    const metrosC = enMetros(c[1], c[2]);
    const g = CARDINALES.find(([re]) => re.test(c[3]))?.[1];
    if (g === undefined || !(metrosC > 0) || metrosC > 200000) return null;
    const q = desplazar(desde.lat, desde.lon, metrosC, g);
    return { lat: q.lat, lon: q.lon, desde: tx(`a ${dicho(c[1], c[2], metrosC)} al ${c[3]} de ${desde.nombre}`, `${dicho(c[1], c[2], metrosC)} ${rumboIngles(c[3])} of ${desde.nombre}`) };
  }
  const metros = enMetros((a ?? b)![1], (a ?? b)![2]);
  const rumboTxt = a ? a[3] : b![4];
  const frase = ` ${a ? a[4] : b![3]} `;
  const grados = CARDINALES.find(([re]) => re.test(rumboTxt))?.[1];
  if (grados === undefined || !(metros > 0) || metros > 200000) return null;
  let base: { lat: number; lon: number; nombre: string } | null = null;
  const nodo = nodosMencionados(frase, antenas)[0] ?? piezaGenerica(frase, antenas, ultimo);
  if (nodo) base = { lat: nodo.lat, lon: nodo.lon, nombre: nodo.nombre };
  if (!base) {
    const c = extraerCoordenadas(texto);
    if (c) base = { lat: c.lat, lon: c.lon, nombre: tx("ese punto", "that point") };
  }
  if (!base) {
    const l = lugarEnTexto(`en${frase}`, api);
    if (l) base = { lat: l.lat, lon: l.lon, nombre: l.nombre };
  }
  if (!base) return null;
  const q = desplazar(base.lat, base.lon, metros, grados);
  return {
    lat: q.lat,
    lon: q.lon,
    desde: tx(`a ${dicho((a ?? b)![1], (a ?? b)![2], metros)} al ${rumboTxt} de ${base.nombre}`, `${dicho((a ?? b)![1], (a ?? b)![2], metros)} ${rumboIngles(rumboTxt)} of ${base.nombre}`),
  };
}

/**
 * «El repetidor», «la persona», «el gateway» sin nombre: el último que se tocó si es de ese tipo,
 * si no el último de ese tipo en la lista.
 */
function piezaGenerica(frase: string, antenas: Antena[], ultimo?: Antena): Antena | undefined {
  const tipo: Pieza | null = /\b(gateway|getway|internet|pasarela)\b/.test(frase)
    ? "gateway"
    : /^\s*(?:(?:desde|de|del|al)\s+)?(?:el\s+|ese\s+|este\s+)?(repetidor|router)\b(?!\s*\d)/.test(frase)
      ? "repetidor"
      : /^\s*(?:(?:desde|de|del)\s+)?(?:la\s+|esa\s+|esta\s+)?persona\b(?!\s*\d)/.test(frase)
        ? "persona"
        : null;
  if (!tipo) return undefined;
  if (ultimo && piezaDe(ultimo) === tipo) return ultimo;
  return [...antenas].reverse().find((a) => a.activa && piezaDe(a) === tipo);
}

/* ───────────── v17.4 · «Cerca de…» y el nodo que se mueve ───────────── */

/** «Cerca del gateway», «junto a la Persona 2», «al lado del Repetidor 1» («near», «next to» y «beside» llegan así del inglés). */
const CERCA_DE =
  /\b(?:muy |bien |mas )?(?:cerca|cerquita|junto|al lado|a un lado|a un costado|al costado|pegad[oa]|pegadit[oa]|al pie)\s+(?:de\s+(?:la|el|los|las)\s+|del\s+|de\s+|a\s+(?:la|el|los|las)\s+|al\s+|a\s+)?(.{2,60})/;
/** «Acerca el Repetidor 1 al gateway», «arrímalo a la Persona 2», «júntalo con el Repetidor 2»: también es «cerca de…». */
const ACERCAR =
  /\b(?:acerca(?!\s+del?\b)|acercalo|acercala|acerquelo|acerquela|arrima|arrimalo|arrimala|junta|juntalo|juntala|pega|pegalo|pegala)\b\s*(?:a\s+(?=(?:el|la|los|las)\s|[a-z]+\s+\d))?(?:(?:el|la|los|las)\s+)?(.{0,40}?)\s*\b(?:a|al|a la|hacia el|hacia la|hacia|con el|con la|con)\s+(.{2,60})/;
/** «Lleva el Repetidor 1 al gateway», «mueve la Persona 2 a la Persona 1» (a un nodo): también es junto a él. */
// (con «mueve» o «lleva» hace falta lo que se mueve antes del «a»: en «mueve a Persona 1 500 m al oriente» la «a» es de
// persona, no del destino; «muévelo al gateway» ya lo trae)
const HACIA_NODO =
  /\b(?:(?:muevelo|muevela|llevalo|llevala|pasalo|pasala|mandalo|mandala|trasladalo|trasladala)\b.*?|(?:mueve|mover|lleva|llevar|traslada|trasladar|pasa|manda)\b\s+\S.*?)\s(?:a|al|a la|hasta el|hasta la|hasta)\s+((?:el |la )?[a-z][a-z0-9 ]{1,40}?)\s*$/;
/** El «cerca de…» de la frase: lo que sigue (el nodo de referencia) y dónde empieza. */
function cercaDicho(tn: string): { resto: string; inicio: number } | null {
  const c = tn.match(CERCA_DE);
  if (c) return { resto: c[1], inicio: c.index ?? 0 };
  const a = tn.match(ACERCAR);
  if (a) return { resto: a[2], inicio: (a.index ?? 0) + a[0].length - a[2].length };
  const h = tn.match(HACIA_NODO);
  if (h) return { resto: h[1], inicio: (h.index ?? 0) + h[0].length - h[1].length - (h[0].length - h[0].trimEnd().length) };
  return null;
}
/** A cuánto de un nodo queda lo que se pone o se mueve «cerca» de él. */
export const DISTANCIA_CERCA_M = 200;
const RUMBOS_8: [string, string][] = [
  ["norte", "north"],
  ["noreste", "northeast"],
  ["este", "east"],
  ["sureste", "southeast"],
  ["sur", "south"],
  ["suroeste", "southwest"],
  ["oeste", "west"],
  ["noroeste", "northwest"],
];
const rumbo8 = (g: number) => RUMBOS_8[Math.round((((g % 360) + 360) % 360) / 45) % 8];
/** Verbos con los que un nodo que ya existe cambia de sitio («pon el Repetidor 1 cerca del gateway» es moverlo). */
const VERBO_MOVER_NODO =
  /\b(mueve|mover|muevelo|muevela|muevete|muevanlo|muevanla|traslad\w*|reubic\w*|desplaz\w*|corre|correlo|correla|lleva|llevalo|llevala|acerca(?!\s+del?\b)|acercalo|acercala|arrima\w*|juntalo|juntala|pegalo|pegala|pon|ponlo|ponla|coloca|colocalo|colocala|ubica|ubicalo|ubicala|situa\w*)\b/;
/** Los que solo pueden ser un traslado (con «pon», «lleva» o «ubica» hace falta decir a dónde). */
const SOLO_MOVER = /\b(mueve|mover|muevelo|muevela|muevete|muevanlo|muevanla|traslad\w*|reubic\w*|desplaz\w*|corre|correlo|correla)\b/;

/** Los nodos nombrados con su posición en la frase, en orden. */
function mencionesDeNodos(tn: string, antenas: Antena[]): { a: Antena; pos: number }[] {
  const encontrados: { a: Antena; pos: number }[] = [];
  for (const a of [...antenas].sort((x, y) => y.nombre.length - x.nombre.length)) {
    const nombre = n(a.nombre);
    if (nombre.length < 2) continue;
    // La posición es la del nombre (no la del espacio de antes)
    const m = tn.match(new RegExp(`(^|[^a-z0-9])${escRe(nombre)}($|[^a-z0-9])`));
    if (!m || m.index === undefined) continue;
    const pos = m.index + m[1].length;
    if (!encontrados.some((e) => Math.abs(e.pos - pos) < 2)) encontrados.push({ a, pos });
  }
  return encontrados.sort((x, y) => x.pos - y.pos);
}

/** Dónde empieza el destino de un traslado o de una pieza nueva: «cerca de…», «a 2 km al norte…», una coordenada. */
function inicioDelDestino(tn: string): number {
  const marcas = [
    cercaDicho(tn)?.inicio ?? -1,
    tn.search(new RegExp(String.raw`\b\d+(?:[.,]\d+)?\s*${UNIDAD_LONGITUD}\s+(?:mas\s+)?(?:al|hacia|rumbo|en direccion)\b`)),
    tn.search(/-?\b\d{1,3}[.,]\d+\s*,\s*-?\d{1,3}[.,]\d+/),
  ].filter((i) => i >= 0);
  return marcas.length ? Math.min(...marcas) : -1;
}

/**
 * v17.4 · El nodo que cambia de sitio: el que se nombra antes del destino («mueve el Repetidor 1 cerca del gateway»
 * mueve el Repetidor 1, no el gateway); «muévelo…», «ponlo cerca de…», el último que se tocó.
 */
function nodoQueSeMueve(tn: string, antenas: Antena[], ultimo: Antena | undefined, destino: number, sel: string | null): Antena | undefined {
  if (!VERBO_MOVER_NODO.test(tn)) return undefined;
  const menciones = mencionesDeNodos(tn, antenas);
  const antes = menciones.filter((x) => destino < 0 || x.pos < destino);
  if (antes.length) return antes[0].a;
  const previo = destino < 0 ? tn : tn.slice(0, destino);
  if (/\b(gateway|getway|pasarela)\b/.test(previo)) return piezaGenerica(previo, antenas, ultimo);
  // «Mueve ese nodo…» es el seleccionado (si hay uno); «muévelo…», el último que se tocó
  const dicho = buscarNodo(previo, antenas, sel);
  if (dicho) return dicho;
  if (ultimo && CLITICO.test(previo)) return ultimo;
  // «Mueve el repetidor al gateway», «lleva la persona al Repetidor 1»: el repetidor (o la persona) de siempre (el último
  // que se tocó, si es de ese tipo), no el nodo del destino
  const pieza = previo.replace(/^.*?\b(?:mueve|mover|lleva|llevar|traslada\w*|reubica\w*|desplaza\w*|corre|pasa|manda|acerca|arrima|junta|pega|pon|coloca|ubica|situa\w*)\b\s*/, "");
  if (pieza !== previo) return piezaGenerica(` ${pieza}`, antenas, ultimo);
  return undefined;
}

/**
 * v17.4 · «Cerca del gateway», «junto a la Persona 2»: un punto a 200 m de ese nodo. Al mover un nodo, del lado en que
 * está (se acerca sin dar la vuelta); una pieza nueva, del lado más despejado de los demás nodos.
 */
function cercaEnTexto(tn: string, antenas: Antena[], movido: Antena | undefined, ultimo: Antena | undefined): (Coordenada & { desde: string }) | null {
  const c = cercaDicho(tn);
  if (!c) return null;
  const frase = ` ${c.resto} `;
  const destino = mencionesDeNodos(frase, antenas)[0]?.a ?? piezaGenerica(frase.replace(/^\s*(?:la|el|los|las)\s+/, " "), antenas, ultimo);
  if (!destino || destino.id === movido?.id) return null;
  const d = DISTANCIA_CERCA_M;
  let grados = 0;
  if (movido && distanciaM(destino.lat, destino.lon, movido.lat, movido.lon) > 1) grados = rumbo(destino.lat, destino.lon, movido.lat, movido.lon);
  else {
    let mejor = -1;
    for (let k = 0; k < 8; k++) {
      const q = desplazar(destino.lat, destino.lon, d, k * 45);
      const libre = Math.min(Infinity, ...antenas.filter((a) => a.id !== destino.id && a.id !== movido?.id).map((a) => distanciaM(q.lat, q.lon, a.lat, a.lon)));
      if (libre > mejor + 1) {
        mejor = libre;
        grados = k * 45;
      }
    }
  }
  const q = desplazar(destino.lat, destino.lon, d, grados);
  const [es, en] = rumbo8(grados);
  return { lat: q.lat, lon: q.lon, desde: tx(`a ${formatoDistancia(d)} al ${es} de ${destino.nombre}`, `${formatoDistancia(d)} ${en} of ${destino.nombre}`) };
}

/** Coordenada del pedido: relativa («a 10 km al norte del gateway»), escrita, o el centro de un lugar nombrado. */
function ubicacionEnTexto(texto: string, tn: string, api: Api, antenas: Antena[], conLugar: boolean): (Coordenada & { desde?: string; lugar?: Lugar }) | null {
  const rel = relativaEnTexto(texto, tn, api, antenas);
  if (rel) return rel;
  const c = extraerCoordenadas(texto);
  if (c) return c;
  if (!conLugar) return null;
  const l = lugarEnTexto(tn, api);
  return l ? { lat: l.lat, lon: l.lon, desde: tx(`en ${l.nombre}${l.tipo === "municipio" ? ` (${l.detalle})` : ""}`, `in ${l.nombre}${l.tipo === "municipio" ? ` (${l.detalle})` : ""}`), lugar: l } : null;
}

/**
 * v17.4 · «Mueve el gateway a Cumaral», «lleva el Repetidor 1 hasta Restrepo»: el centro del municipio (o del lugar) dicho
 * después de «a», «hasta» o «hacia» (con un número es una distancia o una coordenada, y con un nodo, «cerca de» él).
 */
function lugarDelTraslado(tn: string, api: Api): (Coordenada & { desde: string; lugar: Lugar }) | null {
  if (!SOLO_MOVER.test(tn) && !/\b(lleva|llevalo|llevala)\b/.test(tn)) return null;
  const m = tn.match(/\s(?:a|al|hasta|hacia)\s+(?!\d|-)(?!(?:el\s+|la\s+)?(?:norte|sur|este|oeste|oriente|occidente|noreste|noroeste|sureste|suroeste|sudeste|sudoeste|nororiente|noroccidente|suroriente|suroccidente)\b)([a-z][a-z .,]{2,60})$/);
  if (!m) return null;
  const l = lugarEnTexto(`en ${m[1].replace(/[.,]+$/, "")}`, api);
  return l ? { lat: l.lat, lon: l.lon, desde: tx(`en ${l.nombre}${l.tipo === "municipio" ? ` (${l.detalle})` : ""}`, `in ${l.nombre}${l.tipo === "municipio" ? ` (${l.detalle})` : ""}`), lugar: l } : null;
}

/**
 * v17.4 · Una altura relativa: «súbelo 5 m», «súbelo 5 m más», «bájalo 3 metros», «ponlo 5 m más alto», «súmale 2 m»,
 * «sube el Repetidor 1 en 5 m», «quítale 3 m» (+5, −3…). Con «a», «hasta» o «de» la altura es la dicha («súbelo a 20 m»,
 * «déjalo en 20 m», «ponlo 20 m»): null.
 */
export function cambioDeAltura(tn: string, actual?: number): number | null {
  const m = tn.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*s\.?\s*n)/);
  if (!m || m.index === undefined) return null;
  const valor = num(m[1]);
  if (!(valor > 0)) return null;
  const antes = tn.slice(0, m.index).trim();
  const despues = tn.slice(m.index + m[0].length).trim();
  const masAlto = /^(?:mas\s+)?(?:alto|arriba|hacia arriba)\b/.test(despues);
  const masBajo = /^(?:mas\s+)?(?:bajo|abajo|hacia abajo)\b|^menos\b/.test(despues);
  const fuerte = /^(?:mas|menos|extra|adicional(?:es)?)\b/.test(despues) || /\b(?:otros|otras)$/.test(antes);
  const verboBaja = /\b(baj\w*|disminu\w*|reduc\w*|rebaj\w*|recort\w*|restal\w*|resta|quital\w*|descend\w*)\b/.test(antes);
  const verboSube = /\b(sub\w*|eleva\w*|levanta\w*|aument\w*|increment\w*|suma|sumal\w*|agregal\w*|anadel\w*|alza\w*|dale)\b/.test(antes);
  const marcaAbsoluta = /\b(?:a|hasta|de)$/.test(antes) || (/\ben$/.test(antes) && (!(verboSube || verboBaja) || /\b(deja\w*|pon\w*|qued\w*)\b/.test(antes)));
  if (!fuerte && !masAlto && !masBajo && (marcaAbsoluta || !(verboSube || verboBaja))) return null;
  // «Sube el Repetidor 1 25 metros» con el repetidor a 15 m: el reconocimiento se comió el «a» (es «a 25 m»); «súbelo 5
  // metros» sí suma (5 m es menos de lo que ya tiene). Con «más», «otros» o «en» siempre suma
  if (actual !== undefined && verboSube && !verboBaja && !fuerte && !masAlto && !/\ben$/.test(antes) && valor > actual) return null;
  const signo = masBajo ? -1 : masAlto ? 1 : verboBaja ? -1 : 1;
  return signo * valor;
}

/** La altura que resulta de sumarle o restarle algo (entre 0,5 y 300 m, como en el panel). */
const alturaCon = (actual: number, cambio: number) => Math.round(Math.min(300, Math.max(0.5, actual + cambio)) * 10) / 10;

/* ───────────── Zonas para el diseño: un municipio entero, una parte, lo que se ve ───────────── */

/** «Todo el municipio», «el municipio completo», «cubre el municipio de…» (sin un tamaño). */
const MUNICIPIO_ENTERO =
  /\b(?:tod[oa]s?\s+(?:el\s+|la\s+)?(?:municipio|territorio|jurisdiccion|area\s+(?:del|de este|de ese)\s+municipio|pueblo)|(?:municipio|territorio)\s+(?:complet[oa]|enter[oa])|(?:cubr\w*|abarc\w*|cobertura\s+(?:a|en|para|de)|de\s+cobertura\s+a)\s+(?:a\s+)?(?:todo\s+)?el\s+municipio)\b/;
const DEPARTAMENTO_ENTERO = /\b(?:tod[oa]\s+el\s+departamento|el\s+departamento\s+(?:complet[oa]|enter[oa])|(?:cubr\w*|abarc\w*)\s+(?:todo\s+)?el\s+departamento)\b/;
/** «Cubre todo Barranca de Upía», «dale cobertura a todo Cumaral». */
const TODO_LUGAR = /\b(?:cubr\w*|abarc\w*|cobertura\s+(?:a|en|para|de)|a)\s+tod[oa]\s+(?!el\b|la\b|lo\b|los\b|las\b|esto\b|eso\b|esta\b|esa\b|este\b|ese\b|mi\b|su\b)([a-z][a-z ]{2,60})/;
/** «La zona norte», «la mitad sur», «el oriente del municipio». */
const ZONA_RUMBO =
  /\b(?:zona|parte|mitad|sector|lado|costado|region|area)\s+(norte|sur|oriental|occidental|este|oeste|oriente|occidente|nororiental|noroccidental|suroriental|suroccidental|noreste|noroeste|sureste|suroeste|nororiente|noroccidente|suroriente|suroccidente)\b|\b(?:al|el|en el)\s+(norte|sur|oriente|occidente|este|oeste|noreste|noroeste|sureste|suroeste|nororiente|noroccidente|suroriente|suroccidente)\s+(?:del?|de la)\s+(?:municipio|sector|pueblo|territorio)\b/;
/** «Lo que estoy viendo», «la zona que se ve», «toda la pantalla». */
const VISTA_MAPA =
  /\b(?:lo que (?:estoy viendo|veo|se ve|muestra el mapa|tengo en (?:la )?pantalla)|(?:la |esta |esa |toda la )?(?:zona|area|parte|region) que (?:estoy viendo|veo|se ve|tengo en (?:la )?pantalla)|toda la pantalla|la vista actual|(?:el|este) mapa que (?:estoy viendo|veo))\b/;
/** «Ese sector», «ese municipio», «ahí»: el último lugar del que se habló. */
const ESE_LUGAR = /\b(?:ese|este|aquel|el mismo) (?:sector|lugar|sitio|municipio|pueblo|territorio)\b|\b(?:esa|esta|aquella|la misma) (?:zona|region)\b|\b(?:ahi|alli|alla)\b/;

const RUMBO_DE: Record<string, Rumbo> = {
  norte: "norte",
  sur: "sur",
  oriental: "este",
  este: "este",
  oriente: "este",
  occidental: "oeste",
  oeste: "oeste",
  occidente: "oeste",
  nororiental: "noreste",
  noreste: "noreste",
  nororiente: "noreste",
  noroccidental: "noroeste",
  noroeste: "noroeste",
  noroccidente: "noroeste",
  suroriental: "sureste",
  sureste: "sureste",
  suroriente: "sureste",
  suroccidental: "suroeste",
  suroeste: "suroeste",
  suroccidente: "suroeste",
};
const ADJETIVO_RUMBO: Record<Rumbo, string> = { norte: "norte", sur: "sur", este: "oriental", oeste: "occidental", noreste: "nororiental", noroeste: "noroccidental", sureste: "suroriental", suroeste: "suroccidental" };
const ADJETIVO_RUMBO_INGLES: Record<Rumbo, string> = { norte: "northern", sur: "southern", este: "eastern", oeste: "western", noreste: "northeastern", noroeste: "northwestern", sureste: "southeastern", suroeste: "southwestern" };

type ZonaDiseno = { puntos: Poligono; nombre: string; etiqueta: string; lugar?: Lugar } | { aviso: string };

/** El municipio que se está viendo en el mapa (por el nombre que da el mapa en su centro). */
function lugarDeLaVista(api: Api): Lugar | null {
  const c = api.centroMapa();
  const u = c ? api.ubicacion(c.lat, c.lon) : null;
  if (!u) return null;
  const d = decidirLugar(candidatosLugar(u.replace(/[()]/g, " "), api));
  return d.tipo === "seguro" ? d.candidato.lugar : null;
}

/**
 * El área del diseño cuando no se dio un tamaño: todo un municipio (o un departamento), su zona norte, sur, oriental u
 * occidental, lo que se ve en el mapa o «ese sector» (el último lugar del que se habló). El lugar se toma de lo dicho,
 * de la conversación o del mapa.
 */
function zonaDeDiseno(tn: string, api: Api, contexto: ContextoOrden): ZonaDiseno | null {
  const rumboTxt = tn.match(ZONA_RUMBO);
  const rumbo = rumboTxt ? RUMBO_DE[rumboTxt[1] ?? rumboTxt[2]] : undefined;
  const departamento = DEPARTAMENTO_ENTERO.test(tn);
  const todoLugar = tn.match(TODO_LUGAR);
  const entero = MUNICIPIO_ENTERO.test(tn) || departamento || Boolean(todoLugar);
  const ese = ESE_LUGAR.test(tn);
  if (VISTA_MAPA.test(tn)) {
    const caja = api.cajaMapa?.();
    if (!caja) return null;
    const puntos = poligonoCaja(caja);
    return { puntos, nombre: tx("en la zona que está viendo en el mapa", "in the area you're viewing on the map"), etiqueta: tx("Lo que se ve del mapa", "Visible map area") };
  }
  if (!rumbo && !entero && !(ese && contexto.ultimoLugar)) return null;
  let lugar = (todoLugar ? lugarEnTexto(`en ${todoLugar[1]}`, api) : null) ?? lugarEnTexto(tn, api);
  if (!lugar && contexto.ultimoLugar) {
    lugar = contexto.ultimoLugar;
    usarLugar(lugar);
  }
  lugar ??= lugarDeLaVista(api);
  if (!lugar) return { aviso: tx("¿Qué municipio cubro? Dígame el nombre y el departamento, por ejemplo «todo el municipio de Barranca de Upía, Meta».", "Which municipality should I cover? Tell me its name and department, for example “the whole municipality of Barranca de Upía, Meta”.") };
  if (departamento && lugar.tipo === "municipio") {
    const d = candidatosLugar(lugar.detalle, api).find((c) => c.lugar.tipo === "departamento" && c.exacto);
    if (d) lugar = d.lugar;
  }
  if (lugar.tipo === "pais") return { aviso: tx("Un país entero es demasiado para diseñarlo de una vez. Dígame un municipio, por ejemplo «todo el municipio de Barranca de Upía, Meta».", "A whole country is too much to design at once. Tell me a municipality, for example “the whole municipality of Barranca de Upía, Meta”.") };
  const contorno = api.contornoLugar?.(lugar);
  if (!contorno)
    return {
      aviso: tx(
        `No tengo el contorno de ${nombreLugar(lugar)} para cubrirlo entero. Dígame un tamaño, por ejemplo «11.226 hectáreas en ${lugar.nombre}».`,
        `I don't have the boundary of ${nombreLugar(lugar)} to cover it entirely. Tell me a size, for example “11,226 hectares in ${lugar.nombre}”.`,
      ),
    };
  const puntos = rumbo ? recortarPoligono(contorno, rumbo) : contorno;
  const area = areaM2(puntos);
  const quien = lugar.tipo === "municipio" ? `el municipio de ${lugar.nombre} (${lugar.detalle})` : nombreLugar(lugar);
  const deQuien = quien.replace(/^el /, "del ");
  const quienEn = lugar.tipo === "municipio" ? `the municipality of ${lugar.nombre} (${lugar.detalle})` : nombreLugar(lugar);
  if (area > 3e9)
    return {
      aviso: tx(
        `${quien.charAt(0).toUpperCase()}${quien.slice(1)}${rumbo ? `, en su zona ${ADJETIVO_RUMBO[rumbo]},` : ""} mide ${textoArea(area)}: es demasiado para diseñarlo de una vez (el tope es 300.000 ha). Pídamelo por partes: un municipio o una zona («la zona norte del municipio de …»).`,
        `${quienEn.charAt(0).toUpperCase()}${quienEn.slice(1)}${rumbo ? `, in its ${ADJETIVO_RUMBO_INGLES[rumbo]} zone,` : ""} measures ${textoArea(area)}: that's too much to design at once (the limit is 300,000 ha). Ask me for it in parts: a municipality or a zone (“the northern zone of the municipality of …”).`,
      ),
    };
  return {
    puntos,
    nombre: tx(
      rumbo ? `en la zona ${ADJETIVO_RUMBO[rumbo]} ${deQuien.startsWith("del ") ? deQuien : `de ${deQuien}`}` : `en todo ${quien}`,
      rumbo ? `in the ${ADJETIVO_RUMBO_INGLES[rumbo]} zone of ${quienEn}` : lugar.tipo === "municipio" ? `in the whole municipality of ${lugar.nombre} (${lugar.detalle})` : `in all of ${quienEn}`,
    ),
    etiqueta: `${lugar.nombre}${lugar.tipo === "municipio" ? ` (${lugar.detalle})` : ""}${rumbo ? tx(` · zona ${ADJETIVO_RUMBO[rumbo]}`, ` · ${ADJETIVO_RUMBO_INGLES[rumbo]} zone`) : ""}`,
    lugar,
  };
}

/** La clase de señal de los diseños de los botones: media o mejor (≥ 30 dB). */
const clasesMedia = () => tx("señal media o mejor (buena, estable o media; ≥ 30 dB)", "fair or better signal (good, stable or fair; ≥ 30 dB)");

/** El diseño de todo un municipio (o su zona), sostenible: señal media o mejor en el 95 % (lo que ofrecen los botones). */
function disenoDeZona(z: Extract<ZonaDiseno, { puntos: Poligono }>, sostenible = true): Orden {
  return {
    tipo: "disenar",
    area: { forma: "poligono", puntos: z.puntos, nombre: z.nombre, dibujar: true, etiqueta: z.etiqueta },
    margenDb: 30,
    clases: clasesMedia(),
    porcentaje: 95,
    respaldo: false,
    alturaM: ALTURA_REPETIDOR_DEFECTO,
    gateway: null,
    maxRepetidores: 60,
    ...(sostenible ? { sostenible: true } : {}),
    ...(z.lugar ? { lugarUsado: z.lugar } : {}),
  };
}

/**
 * v17.2 · El lápiz de malla: la zona dibujada en el mapa (cerrada, o la franja a lo largo de un trazo abierto) con el
 * criterio de equilibrio, el punto entre la estabilidad de la señal y el costo: señal media o mejor en el 95 % de lo
 * dibujado, enlaces sólidos, sin repetidores que casi no aporten (el freno de rendimiento) y sin los que sobran (la poda),
 * con su costo y su viabilidad.
 */
export function disenoDibujado(puntos: Poligono, trazo: "zona" | "franja", anchoM?: number): Orden {
  const etiqueta =
    trazo === "zona"
      ? tx("Zona dibujada", "Drawn zone")
      : tx(`Franja dibujada (${fn((anchoM ?? 0) / 1000)} km de ancho)`, `Drawn strip (${fn((anchoM ?? 0) / 1000)} km wide)`);
  return disenoDeZona({ puntos, nombre: trazo === "zona" ? tx("en la zona que dibujó", "in the zone you drew") : tx("a lo largo del trazo que dibujó", "along the line you drew"), etiqueta });
}

/* ───────────── Criterio de óptimo (v17.2): ni una antena de más ───────────── */

/** La señal pedida, en palabras, por su margen. */
function clasesDeMargen(margenDb: number): string {
  if (margenDb >= 45) return tx("señal buena", "good signal");
  if (margenDb >= 37) return tx("señal estable o mejor", "stable or better signal");
  if (margenDb >= 30) return tx("señal media o mejor", "fair or better signal");
  return tx("servicio", "service");
}

/** «“R1”», «“R1” y “R2”», «“R1”, “R2” y “R3”» (en inglés con comillas inglesas y «and»). */
function listaNombres(nombres: string[]): string {
  const q = nombres.map((x) => tx(`«${x}»`, `“${x}”`));
  return q.length <= 1 ? (q[0] ?? "") : `${q.slice(0, -1).join(", ")} ${tx("y", "and")} ${q[q.length - 1]}`;
}

/** Dónde se mide el óptimo: el área objetivo con su meta o, sin ella, el área de estudio. */
function zonaOptimo(api: Api): { zona: ZonaOptimo; nombre: string | null } {
  const ao = api.areaObjetivo();
  return ao && ao.puntos.length >= 3 ? { zona: { poligono: ao.puntos, metaPct: ao.metaPct, margenDb: ao.margenDb, respaldo: ao.respaldo }, nombre: ao.nombre } : { zona: null, nombre: null };
}

const PRINCIPIO_OPTIMO = () =>
  tx(
    "Óptimo no es la red con más antenas: es el punto entre la estabilidad de la señal y el costo, la meta con la menor cantidad de equipos.",
    "Optimal isn't the network with the most antennas: it's the balance point between signal stability and cost, the target with the fewest devices.",
  );

/**
 * La respuesta a «¿necesito más antenas?» / «¿sobran antenas?» con la simulación al día: la cobertura frente a la meta,
 * lo que aporta cada nodo y los repetidores que se pueden quitar juntos sin bajar de ella (con lo que se ahorra).
 */
function respuestaOptimo(r: ResultadoSimulacion | null, api: Api): Respuesta {
  if (!r) return { texto: tx("No pude simular la red para revisarla. Intente de nuevo en un momento.", "I couldn't simulate the network to review it. Please try again in a moment.") };
  const antenas = api.antenas();
  const { zona, nombre } = zonaOptimo(api);
  const o = analizarOptimo(r, antenas, zona);
  const clase = clasesDeMargen(o.margenDb);
  const nombreDe = (id: string) => antenas.find((a) => a.id === id)?.nombre ?? id;
  const gw = antenas.find((a) => a.pasarela && a.activa) ?? antenas.find((a) => a.activa);
  const { logistica } = gw ? logisticaEn(api, gw.lat, gw.lon) : { logistica: 1 };
  const porRepetidor = costoRepetidorInstalado(logistica);
  const reps = o.aportes.filter((x) => !x.gateway);
  const sobran = o.sobran.ids;
  const cuales = listaNombres(sobran.map(nombreDe));
  const uno = sobran.length === 1;
  const partes = [PRINCIPIO_OPTIMO()];
  const acciones: AccionRespuesta[] = [];
  const quitar = (): AccionRespuesta => ({
    texto: uno ? tx(`Quitar «${nombreDe(sobran[0])}»`, `Remove “${nombreDe(sobran[0])}”`) : tx(`Quitar los ${sobran.length} que sobran`, `Remove the ${sobran.length} extra ones`),
    accion: "orden",
    orden: { tipo: "eliminar-varios", ids: sobran, descripcion: uno ? tx("el repetidor que sobraba", "the repeater that wasn't needed") : tx("los repetidores que sobraban", "the repeaters that weren't needed") },
  });
  const dejar = (): AccionRespuesta => ({ texto: uno ? tx("Dejarlo", "Keep it") : tx("Dejarlos", "Keep them"), accion: "orden", orden: { tipo: "dejar-nodo", nombres: sobran.map(nombreDe) } });
  if (zona && o.metaPct !== null) {
    partes.push(
      o.respaldo
        ? tx(`Con respaldo (dos nodos por punto), la red da ${clase} en el ${fp(o.utilPct)} % del área objetivo «${nombre}» (meta: ${fp(o.metaPct)} %).`, `With backup (two nodes per point), the network gives ${clase} in ${fp(o.utilPct)}% of the target area “${nombre}” (target: ${fp(o.metaPct)}%).`)
        : tx(`La red da ${clase} en el ${fp(o.utilPct)} % del área objetivo «${nombre}» (meta: ${fp(o.metaPct)} %).`, `The network gives ${clase} in ${fp(o.utilPct)}% of the target area “${nombre}” (target: ${fp(o.metaPct)}%).`),
    );
    if (o.respaldo)
      partes.push(
        tx(
          "Pidió respaldo: que las coberturas se crucen es justamente la idea, así que no le quito ningún nodo por repetir señal.",
          "You asked for backup: overlapping coverage is exactly the idea, so I won't remove any node for repeating signal.",
        ),
      );
    if (o.cumple && o.respaldo)
      partes.push(
        tx(
          `No necesita más antenas: con respaldo ya cumple la meta. Otra antena solo subiría el costo, unos ${pesosTrama(porRepetidor)} por repetidor instalado.`,
          `You don't need more antennas: with backup the target is already met. Another antenna would only raise the cost, about ${pesosTrama(porRepetidor)} per installed repeater.`,
        ),
      );
    else if (o.cumple) {
      if (sobran.length) {
        partes.push(
          tx(
            `No necesita más antenas: ya cumple la meta. Es más, ${uno ? `le sobra ${cuales}` : `le sobran ${sobran.length}: ${cuales}`}. Lo que ${uno ? "cubre" : "cubren"} ya lo cubren otros nodos y nadie depende de ${uno ? "él" : "ellos"} para llegar al gateway; sin ${uno ? "él" : "ellos"} la red sigue en el ${fp(o.sobran.utilSinEllosPct)} % y se ahorra unos ${pesosTrama(sobran.length * porRepetidor)}.`,
            `You don't need more antennas: the target is already met. In fact, ${uno ? `${cuales} isn't needed` : `${sobran.length} aren't needed: ${cuales}`}. What ${uno ? "it covers" : "they cover"} is already covered by other nodes and nobody depends on ${uno ? "it" : "them"} to reach the gateway; without ${uno ? "it" : "them"} the network stays at ${fp(o.sobran.utilSinEllosPct)}% and you save about ${pesosTrama(sobran.length * porRepetidor)}.`,
          ),
        );
        acciones.push(quitar(), dejar());
      } else if (reps.length) {
        const menor = [...reps].sort((a, b) => a.unicaPct - b.unicaPct)[0];
        partes.push(
          tx(
            `No necesita más antenas: ya cumple la meta y cada nodo aporta lo suyo (el que menos, «${menor.nombre}», suma por sí solo el ${fp(menor.unicaPct)} % del área). Otra antena solo subiría el costo, unos ${pesosTrama(porRepetidor)} por repetidor instalado, sin una mejora de estabilidad que se note.`,
            `You don't need more antennas: the target is met and every node does its share (the smallest, “${menor.nombre}”, adds ${fp(menor.unicaPct)}% of the area on its own). Another antenna would only raise the cost, about ${pesosTrama(porRepetidor)} per installed repeater, with no noticeable stability gain.`,
          ),
        );
      } else
        partes.push(
          tx(
            `No necesita repetidores: el gateway solo ya cumple la meta. Cada repetidor de más costaría unos ${pesosTrama(porRepetidor)} sin mejorar lo que se necesita.`,
            `You don't need repeaters: the gateway alone already meets the target. Each extra repeater would cost about ${pesosTrama(porRepetidor)} without improving what's needed.`,
          ),
        );
    } else {
      const mover = sobran.length ? tx(` Antes de comprar otra: ${cuales} casi no ${uno ? "aporta donde está" : "aportan donde están"}; ${uno ? "moverlo" : "moverlos"} hacia los huecos rinde más que sumar equipos.`, ` Before buying another one: ${cuales} ${uno ? "barely adds anything where it is" : "barely add anything where they are"}; moving ${uno ? "it" : "them"} toward the gaps pays off more than adding devices.`) : "";
      partes.push(
        tx(
          `Sí le falta: la meta es el ${fp(o.metaPct)} % y la red da el ${fp(o.utilPct)} %. Pero la respuesta no es poner antenas a ojo.${mover} Le propongo el ajuste: busca alturas, sitios y antenas de apoyo con la mejor relación entre cobertura y costo.`,
          `Yes, it falls short: the target is ${fp(o.metaPct)}% and the network gives ${fp(o.utilPct)}%. But the answer isn't to add antennas by eye.${mover} I suggest the adjustment: it looks for heights, sites and support antennas with the best coverage-to-cost ratio.`,
        ),
      );
      acciones.push({ texto: tx("Ajústamelo", "Adjust it for me"), accion: "orden", orden: { tipo: "ajustar", aplicar: false, opcion: "recomendada", opciones: {}, avisos: [] } });
    }
  } else {
    partes.push(
      tx(
        `Sin un área objetivo, la red se mide contra la factibilidad: ${clase} en el ${fp(META_UTIL_ESTUDIO_PCT)} % del área de estudio (la zona alrededor de los nodos, que crece con cada antena); hoy da el ${fp(o.utilPct)} %.`,
        `Without a target area, the network is measured against feasibility: ${clase} in ${fp(META_UTIL_ESTUDIO_PCT)}% of the study area (the zone around the nodes, which grows with every antenna); today it gives ${fp(o.utilPct)}%.`,
      ),
    );
    if (sobran.length) {
      const solape = Math.min(...sobran.map((id) => o.aportes.find((x) => x.id === id)?.solapePct ?? 100));
      partes.push(
        tx(
          `Lo que sí veo: ${cuales} ${uno ? "repite" : "repiten"} lo que ya cubren otros nodos (al menos el ${fp(solape)} % de su cobertura) y nadie depende de ${uno ? "él" : "ellos"} para llegar al gateway. ${uno ? "Quitarlo" : "Quitarlos"} ahorra unos ${pesosTrama(sobran.length * porRepetidor)}.`,
          `What I do see: ${cuales} ${uno ? "repeats" : "repeat"} what other nodes already cover (at least ${fp(solape)}% of ${uno ? "its" : "their"} coverage) and nobody depends on ${uno ? "it" : "them"} to reach the gateway. Removing ${uno ? "it" : "them"} saves about ${pesosTrama(sobran.length * porRepetidor)}.`,
        ),
      );
      acciones.push(quitar(), dejar());
    } else partes.push(tx("Ningún nodo está de más: cada uno cubre algo que los otros no.", "No node is extra: each one covers something the others don't."));
    partes.push(
      tx(
        "Para decirle si le faltan antenas, márqueme la zona que quiere cubrir: con el lápiz de malla le armo ahí la red óptima, o con la regla (Área) la mido contra su meta.",
        "To tell you whether antennas are missing, mark the zone you want to cover: with the mesh pencil I build the optimal network there, or with the ruler (Area) I measure it against its target.",
      ),
    );
    acciones.push({ texto: tx("Activar el lápiz", "Turn on the pencil"), accion: "orden", orden: { tipo: "herramienta", herramienta: "lapiz" } });
  }
  return { texto: partes.join(" "), acciones };
}

/**
 * v17.2 · Melki cuestiona el repetidor que la persona acaba de poner si casi no suma (ver `sobraNodo`): cuánto aporta,
 * que nadie depende de él, si la red ya cumple sin él y lo que cuesta; ofrece quitarlo o dejarlo. Null si sí hace falta.
 * Con `ultima`, «Dejarlo» le dice que no vuelve a preguntar.
 */
export function cuestionarNodo(r: ResultadoSimulacion, id: string, api: Api, ultima = false): Respuesta | null {
  const antenas = api.antenas();
  const a = antenas.find((x) => x.id === id);
  if (!a) return null;
  const { zona, nombre } = zonaOptimo(api);
  const o = analizarOptimo(r, antenas, zona);
  const x = sobraNodo(o, id);
  if (!x) return null;
  const clase = clasesDeMargen(o.margenDb);
  const { logistica } = logisticaEn(api, a.lat, a.lon);
  const costo = pesosTrama(costoRepetidorInstalado(logistica));
  const cuanto = zona
    ? x.propiaKm2 <= 0
      ? tx(`no cubre nada dentro del área objetivo «${nombre}»`, `it doesn't cover anything inside the target area “${nombre}”`)
      : tx(`por sí solo suma apenas el ${fp(x.unicaPct)} % del área objetivo con ${clase}`, `on its own it adds just ${fp(x.unicaPct)}% of the target area with ${clase}`)
    : tx(`el ${fp(x.solapePct)} % de lo que cubre ya lo cubren otros nodos con ${clase}`, `${fp(x.solapePct)}% of what it covers is already covered by other nodes with ${clase}`);
  // Con área objetivo: o la red cumple su meta sin él, o no llega a la meta ni con él y lo suyo ya lo cubren otros (ver
  // `sobraNodo`); nunca se dice que cumple sin él si no es así
  const meta =
    zona && o.metaPct !== null
      ? cumpleSinNodo(o, x)
        ? tx(` La red ya cumple su meta sin él: ${clase} en el ${fp(Math.max(0, o.utilPct - x.unicaPct))} % del área (meta: ${fp(o.metaPct)} %).`, ` The network already meets its target without it: ${clase} in ${fp(Math.max(0, o.utilPct - x.unicaPct))}% of the area (target: ${fp(o.metaPct)}%).`)
        : tx(
            ` La red todavía no llega a su meta (${fp(o.utilPct)} % de ${fp(o.metaPct)} %), pero lo que falta no está donde lo puso: el ${fp(x.solapePct)} % de lo que cubre ya lo cubren otros nodos.`,
            ` The network doesn't reach its target yet (${fp(o.utilPct)}% of ${fp(o.metaPct)}%), but what's missing isn't where you put it: ${fp(x.solapePct)}% of what it covers is already covered by other nodes.`,
          )
      : "";
  return {
    texto: tx(
      `¿Seguro que necesita «${a.nombre}»? Revisé la red con él: ${cuanto}, y nadie depende de él para llegar al gateway.${meta} Instalarlo cuesta unos ${costo}. Óptimo no es poner más antenas sino el punto entre la estabilidad de la señal y el costo. ¿Lo quito?`,
      `Are you sure you need “${a.nombre}”? I checked the network with it: ${cuanto}, and nobody depends on it to reach the gateway.${meta} Installing it costs about ${costo}. Optimal isn't adding more antennas but the balance point between signal stability and cost. Shall I remove it?`,
    ),
    acciones: [
      { texto: tx("Quitarlo", "Remove it"), accion: "orden", orden: { tipo: "eliminar", id } },
      { texto: tx("Dejarlo", "Keep it"), accion: "orden", orden: { tipo: "dejar-nodo", nombres: [a.nombre], ultima } },
    ],
  };
}

/** Cómo se usa el lápiz de malla (al activarlo por orden y en la ayuda). */
export const TEXTO_LAPIZ = () =>
  tx(
    "Activé el lápiz de malla: dibuje sobre el mapa como en Paint, manteniendo presionado. Si cierra la figura, la tomo como una zona; si traza una línea (una vía, un río), como una franja a lo largo de ella, del ancho que elija en la barra (1 km si no). Al soltar armo ahí la malla óptima: señal media o mejor en el 95 % con la menor cantidad de equipos, enlaces sólidos y su costo. Mientras dibuja, la rueda del ratón acerca y aleja el mapa (en el celular, con dos dedos); Esc, la X o «suelta el lápiz» lo sueltan.",
    "I turned on the mesh pencil: draw on the map as in Paint, holding the button down. If you close the shape, I take it as a zone; if you trace a line (a road, a river), as a strip along it, as wide as you choose in the bar (1 km otherwise). When you let go I build the optimal mesh there: fair or better signal in 95% with the fewest devices, solid links and its cost. While drawing, the mouse wheel zooms the map in and out (on a phone, use two fingers); Esc, the X or “put the pencil down” releases it.",
  );

/* ───────────── Diseño de la malla por área ───────────── */

const UMBRALES_SENAL: [RegExp, number][] = [
  [/\bbuenas?\b/, 45],
  [/\bestables?\b/, 37],
  [/\bconfiables?\b/, 37],
  [/\bmedias?\b/, 30],
  [/\bbajas?\b/, 20],
  [/\b(con servicio|servicio minimo|cualquier senal|minima)\b/, 20],
];

/** Calidad de señal pedida: el mínimo de las clases nombradas («entre buena, estable y media» → media, 30 dB). */
function margenPedido(tn: string): { margenDb: number; clases: string } {
  const i = tn.search(/\b(senal|calidad|nivel|clase|cobertura|margen)\b/);
  const zona = i >= 0 ? tn.slice(i) : tn;
  const db = zona.match(/\b(\d{1,2})\s*db\b/);
  if (db && /\b(margen|al menos|minimo|sobre|mayor|mas de)\b/.test(zona)) {
    const v = Math.min(60, Math.max(10, Number(db[1])));
    return { margenDb: v, clases: tx(`margen de al menos ${v} dB`, `margin of at least ${v} dB`) };
  }
  // También lo dicho justo después de «red» o «malla»: «una red media estable», «una malla estable»
  const pegado = tn.match(/\b(?:red|redes|malla|mallas)\s+((?:(?:de\s+)?(?:senal\s+)?(?:buenas?|estables?|medias?|bajas?|confiables?)\s*(?:y|o|,)?\s*){1,3})/)?.[1] ?? "";
  const halladas = UMBRALES_SENAL.filter(([re]) => re.test(zona) || re.test(pegado)).map(([, v]) => v);
  const m = halladas.length ? Math.min(...halladas) : 30;
  const clases = m >= 45 ? tx("señal buena (≥ 45 dB)", "good signal (≥ 45 dB)") : m >= 37 ? tx("señal estable o mejor (≥ 37 dB)", "stable or better signal (≥ 37 dB)") : m >= 30 ? clasesMedia() : tx("servicio (≥ 20 dB)", "service (≥ 20 dB)");
  return { margenDb: m, clases };
}

/**
 * Ajuste inteligente: «ajústamelo», «optimiza la red», «hazla factible», «mejora la cobertura al menor costo»,
 * «¿qué necesito para que sea factible?», con límites («sin pasar de 20 m», «máximo 3 antenas de apoyo», «no muevas
 * los nodos», «solo alturas») y sitios dados («las antenas de apoyo pueden ir en 4.51, -73.12; 4.6, -73.05»).
 */
function interpretarAjuste(texto: string, tn: string, antenas: Antena[]): Orden | null {
  const verbo =
    /\b(ajust(a|ala|alo|ame|amela|amelo|ar|arla|arlo|en|e)|reajust\w*|optimiz(?!ations?\b|ed\b|ers?\b)\w*|hazla factible|hacerla factible|volverla factible|vuelvela factible|dejala factible|dejarla factible|(que|para que) (sea|quede) (factible|viable)|mejor(a|ar|e|ame|amela|ala) (la |mi )?(red|malla|cobertura)|mejor relacion|relacion (costo|cobertura)|costo[- ]?beneficio|(al|con el) menor costo|menos costo|mas economic\w*|(que|lo que) (le )?falta para (ser|que sea|quedar) (factible|viable)|que necesit\w* para (ser|que sea|hacerla|dejarla|que quede) (factible|viable)|como (la )?(hago|dejo|vuelvo|pongo) (factible|viable)|antenas? de apoyo|apoyos?\b.*\b(sugi\w*|propon\w*|donde)|(sugi\w*|propon\w*|recomiend\w*) (antenas|puntos|sitios|apoyos|donde poner))\b/;
  // «Dame la mayor cobertura posible» es pedir la opción de máxima cobertura; «¿cómo dejo la mayor cobertura posible?»
  // pide consejos (los da el cerebro, con el botón para proponerla)
  const pideMaxima =
    /\b(dame|dejame|dejala|dejamela|pon\w*|hazme|hazla|busca\w*|consigue\w*|logra\w*|saca\w*|quiero|lleva\w*) (la red (a|con) )?(la )?(mayor|maxima|mejor) cobertura( posible)?\b/.test(tn) &&
    !/\b(como|recomiend\w*|recomendacion\w*|consejos?|que hago|que necesito|que debo)\b/.test(tn) &&
    !texto.includes("?");
  if (!verbo.test(tn) && !pideMaxima) return null;
  // No es el ajuste de la red: la vista, un parámetro o un nodo con su altura
  if (/\b(vista|pantalla|zoom|encuadr\w*|centra\w*|muestrame toda|ver toda)\b/.test(tn)) return null;
  if (/\b(radio de estudio|confiabilidad|preset|frecuencia|limite de saltos|hop|potencia|ganancia|altura del receptor|escala|unidad|opacidad|capa)\b/.test(tn)) return null;
  const nombrado = nodosMencionados(tn, antenas)[0];
  if (nombrado && /\b\d{1,2}(?:[.,]\d+)?\s*(m|mts?|metros?|dbi|dbm)\b/.test(tn) && !/\b(sin pasar de|maximo|max|hasta|no mas de|como mucho)\b/.test(tn)) return null;

  const pregunta = /\b(que necesit\w*|que (le )?falta|como (la )?(hago|dejo|vuelvo|pongo)|propon\w*|sugi\w*|recomiend\w*|muestr\w*|ensen\w*|que opciones|cuales opciones|como quedaria|que harias|que me recomiendas|donde (pongo|pondria|irian|van))\b/.test(tn) || texto.trim().startsWith("¿") || /\?\s*$/.test(texto);
  const opcion: OpcionAjusteId = /\b(mas economic\w*|la economica|lo minimo|lo mas barato|mas barat\w*|minimo indispensable)\b/.test(tn)
    ? "economica"
    : /\b(maxima cobertura|cobertura maxima|mayor cobertura|la maxima|cubr\w* (todo|lo maximo|al maximo|lo mas posible)|la mejor cobertura|toda la cobertura posible|lo maximo posible)\b/.test(tn)
      ? "maxima"
      : "recomendada";
  const avisos: string[] = [];
  const opciones: OpcionesAjuste = {};
  const alto = tn.match(/\b(?:sin pasar de|maximo|max|hasta|no mas de|como mucho|menos de|de maximo)\s+(?:de\s+)?(\d{1,3})\s*(?:m|mts?|metros?)\b/);
  if (alto) {
    const h = Number(alto[1]);
    if (h > 30) avisos.push(tx(`Más de 30 m no lo propongo: exige torres autosoportadas, mucho más costosas; trabajo con hasta 30 m.`, `I don't propose more than 30 m: it requires self-supporting towers, which are much more expensive; I work with up to 30 m.`));
    opciones.alturaMaxM = Math.max(6, Math.min(30, h));
  }
  const cuantas = tn.match(/\b(?:maximo|max|no mas de|hasta|como mucho|con)\s+(?:de\s+)?(\d{1,2}|una|un|dos|tres|cuatro|cinco)\s+(?:antenas?|apoyos?|repetidor\w*|nodos?)(?: de apoyo)?\b/);
  if (cuantas) {
    const v = { una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 }[cuantas[1] as "una"] ?? Number(cuantas[1]);
    opciones.maxApoyos = Math.max(0, Math.min(40, v));
  }
  const permisos: OpcionesAjuste["permisos"] = {};
  if (/\b(no (muevas|mueva|movamos|corras|cambies de sitio)|sin mover|dejalos (donde estan|en su sitio)|en el mismo sitio)\b/.test(tn)) permisos.mover = false;
  if (/\b(sin (antenas de )?apoyos?|sin agregar|no agregues|no pongas (mas|nuevas)|sin (mas|nuevas) antenas|sin nodos nuevos|con lo que (hay|tengo))\b/.test(tn)) permisos.apoyos = false;
  if (/\b(no (cambies|toques) (las |el tipo de |los tipos de )?antenas?|sin (antenas )?sectoriales|solo omni\w*)\b/.test(tn)) permisos.antenas = false;
  if (/\b(sin subir|no subas|no cambies las alturas|sin cambiar (las )?alturas|misma altura)\b/.test(tn)) permisos.alturas = false;
  if (/\bsolo (con |subiendo |cambiando )?(las )?(alturas?|torres)\b/.test(tn)) Object.assign(permisos, { apoyos: false, mover: false, antenas: false, alturas: true });
  if (/\bsolo (con )?(antenas de )?apoyos?\b/.test(tn)) Object.assign(permisos, { apoyos: true, mover: false, antenas: false, alturas: false });
  if (Object.keys(permisos).length) opciones.permisos = permisos;
  // Sitios dados: coordenadas en el pedido («las antenas de apoyo pueden ir en …», «usa estos puntos …»)
  const coords = extraerVariasCoordenadas(texto);
  if (coords.length && /\b(apoyo|sitios?|puntos?|fincas?|coordenadas|lugares|ubicaciones|pueden ir|podrian ir|disponibles|posibles)\b/.test(tn)) {
    opciones.sitios = coords.map((c, i) => ({ lat: c.lat, lon: c.lon, nombre: tx(`el sitio ${i + 1}`, `site ${i + 1}`) }));
  }
  return { tipo: "ajustar", aplicar: !pregunta, opcion, opciones, avisos };
}

/** «Usa el área que medí como área objetivo», «mide la factibilidad en esa área», «quita el área objetivo». */
function interpretarAreaObjetivo(texto: string, tn: string, api: Api): Orden | null {
  if (/\b(quita\w*|borra\w*|elimina\w*|sin)\b.*\barea objetivo\b|\b(evalua|mide|medir) (la factibilidad )?en (toda )?el area de estudio\b/.test(tn)) return { tipo: "area-objetivo", quitar: true };
  const fijar =
    /\barea objetivo\b/.test(tn) && /\b(usa|usar|pon|poner|marca|marcar|toma|tomar|deja|dejar|es|sea|como)\b/.test(tn) ||
    /\b(mide|medir|evalua|evaluar|calcula) (la )?(factibilidad|cobertura) (en|sobre|dentro de) (el|esta|esa|la) (area|zona|poligono)\b/.test(tn);
  if (!fijar) return null;
  const m = [...api.mediciones()].reverse().find((x) => x.tipo === "area");
  const pct = texto.toLowerCase().match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:%|por ciento)/);
  const { margenDb } = margenPedido(tn);
  return { tipo: "area-objetivo", quitar: false, id: m?.id, metaPct: pct ? Math.min(100, Math.max(1, leerNumero(pct[1]))) : undefined, margenDb };
}

/** «Vuélveme a hacerlo», «rehazlo», «hazlo de nuevo», «otra vez»: repetir el diseño (con otra meta o área). */
const REHACER = /\b(vuelve\w* a hacer\w*|volver a hacer\w*|rehac\w*|rehaz\w*|haz\w* de nuevo|hacerlo de nuevo|de nuevo el diseno|otra vez el diseno)\b/;

/** «Aunque cueste más», «cueste lo que cueste»: el usuario prefiere la meta al costo (sin el freno de rendimiento). */
export const A_CUALQUIER_COSTO =
  /\b(aunque cuest\w*( mas)?|aunque salga (mas )?car[oa]|cueste lo que cueste|cueste lo que sea|a toda costa|a cualquier (costo|precio)|sin importar (el |lo que )?(costo|precio|plata|cueste)|sin (el )?freno|sin limite de (costo|repetidores|plata))\b/;
/** «Aquí», «desde donde estoy»: el centro del mapa que se está viendo. */
export const AQUI = /\b(?:de|desde|alrededor de|en torno a)\s+(?:aqui|aca|este punto|donde estoy|donde estamos|lo que estoy viendo)\b/;

function interpretarDiseno(texto: string, tn: string, api: Api, antenas: Antena[], contexto: ContextoOrden = {}): Orden | null {
  const rehacer = REHACER.test(tn);
  if (!rehacer && !/\b(cubr\w*|cobertura|abarc\w*|red|malla|repetidor\w*|senal|disen\w*|arm\w*|planific\w*|cuant\w* (repetidores|nodos|antenas))\b/.test(tn)) return null;
  const bajo = sinTildes(texto);
  const area = areaEnTexto(bajo);
  const verboFuerte = /\b(cubr\w*|abarc\w*|cobertura|disen\w*|arm\w*|planific\w*)\b/.test(tn);
  // «5 millas a la redonda», «en un radio de 800 yardas», «10 km de diámetro»: con un verbo de cobertura o pidiendo una
  // red (no el radio de estudio de la simulación)
  const circulo = (verboFuerte || /\b(red|redes|malla)\b/.test(tn)) && !/\bradio del? estudio\b/.test(tn) ? circuloEnTexto(bajo) : null;
  const rect = rectanguloEnTexto(bajo);
  const lado = ladoEnTexto(bajo);
  const medida = (/\b(area|zona|poligono)\b.{0,30}\b(medi|medida|medido|dibuj\w*|marq\w*|traz\w*)\b|\b(area|zona|poligono)\b.{0,20}\bregla\b/.test(tn) || /\bcubr\w* (esta|esa|el|la) (area|zona|poligono)\b(?! de)/.test(tn));
  // Sin tamaño: todo el municipio, una zona de él, lo que se ve en el mapa o «ese sector»
  const zona = !area && !circulo && !lado && !(rect && verboFuerte) && (verboFuerte || /\b(red|malla)\b/.test(tn)) ? zonaDeDiseno(tn, api, contexto) : null;
  if (zona && "aviso" in zona && !medida) return { tipo: "aviso", texto: zona.aviso };
  if (!area && !circulo && !(rect && verboFuerte) && !lado && !medida && !zona) return null;
  if (!verboFuerte && !rehacer && !/\b(red|malla|repetidor\w*|cuant\w* (repetidores|nodos|antenas))\b/.test(tn)) return null;

  let pedida: AreaPedida | null = null;
  const pcts = [...bajo.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*(?:%|por ciento)/g)].map((m) => leerNumero(m[1])).filter((v) => v > 0 && v <= 100);
  const porcentaje = pcts.length ? pcts[pcts.length - 1] : 95;
  const { margenDb, clases } = margenPedido(tn);
  const respaldo = /\b(respaldo|redundan\w*|doble cobertura|dos nodos|dos repetidores por punto)\b/.test(tn);
  const altura = tn.match(/\b(?:repetidor\w*|torres?|mastiles?)\s+(?:de|a|con|en)\s+(\d{1,2}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b/) ?? tn.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\s+de altura\b/);
  // Como en Trama: el repetidor va en un tubo de 6 m salvo que se pida otra altura
  const alturaM = altura ? Math.min(60, Math.max(3, num(altura[1]))) : ALTURA_REPETIDOR_DEFECTO;
  const maxTxt = tn.match(/\b(?:maximo|max|no mas de|hasta|como mucho)\s+(?:de\s+)?(\d{1,3})\s+(?:repetidores|repetidoras|torres|nodos)\b/);
  const maxRepetidores = maxTxt ? Math.min(200, Math.max(1, Number(maxTxt[1]))) : 60;
  // La gente a atender, el presupuesto y si la meta va por encima del costo
  const usuarios = usuariosEnTexto(bajo);
  const presupuesto = presupuestoEnTexto(bajo);
  const extra = {
    ...(SOSTENIBLE.test(tn) ? { sostenible: true } : {}),
    ...(usuarios ? { usuarios } : {}),
    ...(presupuesto ? { presupuesto } : {}),
    ...(A_CUALQUIER_COSTO.test(tn) ? { aCualquierCosto: true } : {}),
    ...(maxTxt ? { maxDicho: true } : {}),
  };

  // Gateway en un punto pedido («con el gateway en 4.2, -73.37»)
  let gateway: Coordenada | null = null;
  const tramoGw = tn.match(/\b(?:gateway|getway|internet|starlink)\s+(?:en|ubicad[oa] en|queda en|esta en|sobre)\b/);
  if (tramoGw) gateway = extraerCoordenadas(texto.slice(Math.max(0, (tramoGw.index ?? 0) - 2)));

  // Rehacer sobre el área objetivo que ya está (del mismo tamaño): se diseña sobre ella, no sobre un círculo nuevo
  const objetivoIgual = rehacer && area ? [...api.mediciones()].reverse().find((x) => x.tipo === "area" && x.objetivo && Math.abs(areaM2(x.puntos) / area.m2 - 1) < 0.08) : undefined;
  if (objetivoIgual) pedida = { forma: "medicion", id: objetivoIgual.id };
  else if (medida && !area && !circulo && !rect && !lado) {
    const m = [...api.mediciones()].reverse().find((x) => x.tipo === "area");
    if (m) pedida = { forma: "medicion", id: m.id };
    else if (zona && "puntos" in zona) pedida = { forma: "poligono", puntos: zona.puntos, nombre: zona.nombre, dibujar: true, etiqueta: zona.etiqueta };
    else return { tipo: "disenar", area: { forma: "medicion", id: "" }, margenDb, clases, porcentaje, respaldo, alturaM, gateway, maxRepetidores, ...extra };
  } else if (zona && "puntos" in zona) {
    pedida = { forma: "poligono", puntos: zona.puntos, nombre: zona.nombre, dibujar: true, etiqueta: zona.etiqueta };
  } else {
    // Centro del área: un nodo nombrado («5 millas a la redonda del Repetidor 2»), el punto o el lugar dicho («en la
    // zona norte de Barranca de Upía»: el centro de esa zona), «aquí» (lo que se ve) o «ahí» / «ese municipio» (el
    // último lugar del que se habló)
    let centro: CentroArea | null = null;
    let u: (Coordenada & { desde?: string; lugar?: Lugar }) | null = gateway ? { ...gateway, desde: tx("alrededor del gateway", "around the gateway") } : null;
    const nodo = !u && (circulo || area) && /\b(a la redonda|alrededor|en torno|desde|centrad\w*|radio)\b/.test(tn) ? nodosMencionados(tn, antenas)[0] : undefined;
    if (nodo) u = { lat: nodo.lat, lon: nodo.lon, desde: tx(`alrededor de ${nodo.nombre}`, `around ${nodo.nombre}`) };
    if (!u && AQUI.test(tn)) centro = { tipo: "mapa" };
    if (!u && !centro) u = ubicacionEnTexto(texto, tn, api, antenas, true);
    if (!u && !centro && contexto.ultimoLugar && ESE_LUGAR.test(tn)) {
      const l = contexto.ultimoLugar;
      usarLugar(l);
      u = { lat: l.lat, lon: l.lon, desde: tx(`en ${nombreLugar(l)}`, `in ${nombreLugar(l)}`), lugar: l };
    }
    const rumboTxt = u?.lugar ? tn.match(ZONA_RUMBO) : null;
    const contorno = u?.lugar && rumboTxt ? api.contornoLugar?.(u.lugar) : null;
    if (u && u.lugar && rumboTxt && contorno) {
      const r = RUMBO_DE[rumboTxt[1] ?? rumboTxt[2]];
      const b = cajaPoligono(recortarPoligono(contorno, r));
      u = { lat: (b.sur + b.norte) / 2, lon: (b.oeste + b.este) / 2, desde: tx(`en la zona ${ADJETIVO_RUMBO[r]} de ${nombreLugar(u.lugar)}`, `in the ${ADJETIVO_RUMBO_INGLES[r]} zone of ${nombreLugar(u.lugar)}`), lugar: u.lugar };
    }
    if (u) centro = { tipo: "coord", coord: { lat: u.lat, lon: u.lon }, nombre: u.desde };
    else if (!centro && antenas.some((a) => a.pasarela && a.activa)) centro = { tipo: "gateway" };
    else if (!centro) centro = { tipo: "mapa" };
    if (lado) {
      const l = lado.metros;
      pedida = {
        forma: "cuadrado",
        areaM2: l * l,
        anchoM: l,
        altoM: l,
        centro,
        medida: tx(`un cuadrado de ${textoDistancia(lado)} de lado`, `a square ${textoDistancia(lado)} on each side`),
        etiqueta: tx(`cuadrado de ${textoDicho(lado)} de lado`, `square of ${textoDichoLocal(lado)} per side`),
      };
    } else if (rect && !area) {
      const a1 = rect.ancho.metros;
      const a2 = rect.alto.metros;
      const metrico = (d: Distancia) => d.unidad === "km" || d.unidad === "m";
      const dicho = tx(`${textoDicho(rect.ancho)} × ${textoDicho(rect.alto)}`, `${textoDichoLocal(rect.ancho)} × ${textoDichoLocal(rect.alto)}`);
      const conversion = metrico(rect.ancho) && metrico(rect.alto) ? "" : ` (${textoMetros(a1)} × ${textoMetros(a2)})`;
      pedida = {
        forma: "rectangulo",
        areaM2: a1 * a2,
        anchoM: a1,
        altoM: a2,
        centro,
        medida: tx(`un rectángulo de ${dicho}${conversion}`, `a rectangle of ${dicho}${conversion}`),
        etiqueta: dicho,
      };
    } else if (circulo && !area) {
      const r = circulo.radio.metros;
      pedida =
        circulo.como === "diametro"
          ? {
              forma: "circulo",
              areaM2: Math.PI * r * r,
              centro,
              medida: tx(`un círculo de ${textoDistancia(circulo.dicho)} de diámetro (radio de ${textoMetros(r)})`, `a circle ${textoDistancia(circulo.dicho)} in diameter (radius of ${textoMetros(r)})`),
              etiqueta: tx(`diámetro de ${textoDicho(circulo.dicho)}`, `diameter of ${textoDichoLocal(circulo.dicho)}`),
            }
          : {
              forma: "circulo",
              areaM2: Math.PI * r * r,
              centro,
              medida: tx(
                `un círculo de ${textoDistancia(circulo.radio)} de radio${circulo.como === "supuesto" ? ` (tomé los ${textoDicho(circulo.dicho)} como radio, a la redonda)` : ""}`,
                `a circle with a radius of ${textoDistancia(circulo.radio)}${circulo.como === "supuesto" ? ` (I took the ${textoDichoLocal(circulo.dicho)} as the radius, all around)` : ""}`,
              ),
              etiqueta: tx(`radio de ${textoDistancia(circulo.radio)}`, `radius of ${textoDistancia(circulo.radio)}`),
            };
    } else if (area) {
      const cuadrado = /\bcuadrad\w*/.test(tn) && !/\b(millas?|yardas?|pies|kilometros?|metros?)\s+cuadrad/.test(tn);
      const dicho = area.dicho ? { medida: area.dicho } : {};
      pedida = cuadrado ? { forma: "cuadrado", areaM2: area.m2, anchoM: Math.sqrt(area.m2), altoM: Math.sqrt(area.m2), centro, ...dicho } : { forma: "circulo", areaM2: area.m2, centro, ...dicho };
    }
  }
  if (!pedida) return null;
  return { tipo: "disenar", area: pedida, margenDb, clases, porcentaje, respaldo, alturaM, gateway, maxRepetidores, ...extra };
}

/** «Sostenible», «viable», «económica y técnicamente», «que funcione de la mejor manera»: la red se diseña y se evalúa con su costo. */
const SOSTENIBLE =
  /\b(sostenib\w*|sustentab\w*|viab\w*|rentab\w*|economic\w* y tecnic\w*|tecnic\w* y economic\w*|costo[- ]?eficien\w*|eficiente|que funcione (de la mejor manera|lo mejor posible|muy bien|bien)|equilibr\w*|balance\w*|relacion (calidad|costo|cobertura)[- ]\w+|(calidad|economi\w*|costos?)\b.{0,40}\b(cobertura|calidad|economi\w*)|mejor (relacion|equilibrio))\b/;
/** «Construye / hazme / ármame / diseña una red (o malla)». */
const CONSTRUIR_RED = /\b(constru\w*|hazme|haz|hacer|hagamos|arm\w*|disen\w*|crea\w*|planific\w*|mont\w*|levant\w*|propon\w*|necesito|quiero)\b.{0,50}\b(red|redes|malla)\b/;

/**
 * «Hazme una red sostenible» sin área, o «una red en Barranca de Upía» sin tamaño: Melki pregunta lo que falta y la
 * siguiente respuesta («en Barranca de Upía, 11.226 hectáreas») completa el diseño.
 */
function interpretarPedidoDeRed(texto: string, tn: string, api: Api, antenas: Antena[], contexto: ContextoOrden = {}): Orden | null {
  if (!CONSTRUIR_RED.test(tn)) return null;
  const sostenible = SOSTENIBLE.test(tn);
  let u = ubicacionEnTexto(texto, tn, api, antenas, true);
  if (!u && contexto.ultimoLugar && ESE_LUGAR.test(tn)) {
    const l = contexto.ultimoLugar;
    usarLugar(l);
    u = { lat: l.lat, lon: l.lon, desde: tx(`en ${nombreLugar(l)}`, `in ${nombreLugar(l)}`), lugar: l };
  }
  const lugar: LugarPedido | undefined = u ? { lat: u.lat, lon: u.lon, nombre: u.desde ?? tx(`en ${aDecimal(u.lat)}, ${aDecimal(u.lon)}`, `at ${aDecimal(u.lat)}, ${aDecimal(u.lon)}`), ...(u.lugar ? { lugar: u.lugar } : {}) } : undefined;
  if (!sostenible && !lugar) return null;
  return { tipo: "pedir-diseno", lugar, sostenible };
}

/** El municipio donde cae un punto (para ofrecer «todo el municipio» cuando la red se pide en unas coordenadas). */
function lugarDePunto(api: Api, lat: number, lon: number): Lugar | null {
  const u = api.ubicacion(lat, lon);
  if (!u) return null;
  const d = decidirLugar(candidatosLugar(u.replace(/[()]/g, " "), api));
  return d.tipo === "seguro" ? d.candidato.lugar : null;
}

/** Completa el diseño que esperaba el lugar o el tamaño. */
function completarDiseno(texto: string, tn: string, api: Api, antenas: Antena[], p: Extract<NonNullable<Pendiente>, { tipo: "disenar" }>, contexto: ContextoOrden = {}): Orden | null {
  const bajo = sinTildes(texto);
  const u = ubicacionEnTexto(texto, tn, api, antenas, true);
  const lugar: LugarPedido | undefined = u ? { lat: u.lat, lon: u.lon, nombre: u.desde ?? tx(`en ${aDecimal(u.lat)}, ${aDecimal(u.lon)}`, `at ${aDecimal(u.lat)}, ${aDecimal(u.lon)}`), ...(u.lugar ? { lugar: u.lugar } : {}) } : p.lugar;
  // «Todo», «el municipio completo», «la zona norte»: el municipio del lugar pedido (o donde caen sus coordenadas)
  const soloTodo = /^(tod[oa]|tod[oa] el municipio|el municipio( completo| entero)?|complet[oa]|enter[oa]|tod[oa] completo)$/.test(tn.replace(/[.,!]/g, "").trim());
  const zonaDicha = soloTodo || MUNICIPIO_ENTERO.test(tn) || ZONA_RUMBO.test(tn) || TODO_LUGAR.test(tn) || VISTA_MAPA.test(tn);
  const conTamano = areaEnTexto(bajo) || tieneDistancia(bajo) || zonaDicha;
  if (!conTamano) return u ? { tipo: "pedir-diseno", lugar, sostenible: p.sostenible, despues: p.despues } : null;
  // Solo una distancia («de 5 km», «3 millas»): es el radio, a la redonda del lugar
  const soloDistancia = !zonaDicha && !areaEnTexto(bajo) && !circuloEnTexto(bajo) && !rectanguloEnTexto(bajo) && !ladoEnTexto(bajo);
  const aLaRedonda = (s: string) => s.replace(new RegExp(String.raw`(\d+(?:[.,]\d+)?\s*${UNIDAD_LONGITUD})`, "i"), "$1 a la redonda");
  const frase = soloTodo ? "todo el municipio" : soloDistancia ? aLaRedonda(sinTildes(texto)) : texto;
  const fraseN = soloTodo ? "todo el municipio" : soloDistancia ? aLaRedonda(tn) : tn;
  const ultimoLugar = lugar?.lugar ?? (lugar ? lugarDePunto(api, lugar.lat, lugar.lon) : null) ?? contexto.ultimoLugar;
  const d = interpretarDiseno(`diseña una red ${p.sostenible ? "sostenible " : ""}que cubra ${frase}`, `disena una red ${p.sostenible ? "sostenible " : ""}que cubra ${fraseN}`, api, antenas, { ...contexto, ultimoLugar });
  if (d?.tipo === "aviso") return d;
  if (d?.tipo !== "disenar") return null;
  if (lugar && "centro" in d.area && d.area.centro.tipo !== "coord") d.area = { ...d.area, centro: { tipo: "coord", coord: { lat: lugar.lat, lon: lugar.lon }, nombre: lugar.nombre } };
  return { ...d, ...(p.sostenible ? { sostenible: true } : {}), ...(p.despues ? { despues: p.despues } : {}) };
}

/** «¿Cuánto cuesta la red?», «el presupuesto de la malla», «¿qué inversión necesito?» (la red del mapa, no un departamento). */
function interpretarCosto(tn: string, antenas: Antena[]): Orden | null {
  if (!antenas.some((a) => a.activa)) return null;
  if (/\b(optimiz\w*|ajust\w*|reduc\w*|baj\w*|menor costo|menos costo|abarat\w*)\b/.test(tn)) return null;
  if (!/\b(cuanto (cuesta|vale|costaria|sale|saldria|valdria|necesito)|que (costo|precio|valor|inversion) tiene|cual es el (costo|precio|valor|presupuesto)|costo|presupuesto|inversion|precio)\b/.test(tn)) return null;
  if (!/\b(red|malla|esto|todo|diseno|montaje|proyecto|obra|instalar\w*|montar\w*|construir\w*|detallad\w*|desglos\w*|total|completo)\b/.test(tn)) return null;
  if (/\b(departamento|pais|colombia|por (persona|usuario)|de un repetidor|un gateway|una persona|cada repetidor|starlink)\b/.test(tn)) return null;
  return { tipo: "costo-red" };
}

/* ───────────── Órdenes en lote, capas del mapa y otras de la pantalla ───────────── */

function interpretarLote(texto: string, tn: string, antenas: Antena[]): Orden | null {
  const g = tn.match(/\btod[oa]s\s+(?:l[oa]s\s+)?(repetidores|repetidoras|personas|gente|nodos de campo|nodos antena|antenas|nodos|torres|gateways|piezas)\b/);
  const menosGateway = /\btodo menos (el|los) gateways?\b|\btodos? (los nodos )?(excepto|menos) (el|los) gateways?\b/.test(tn);
  if (!g && !menosGateway) return null;
  const grupo = g?.[1] ?? "menos-gateway";
  const activas = antenas;
  const ids = activas
    .filter((a) => {
      const p = piezaDe(a);
      if (grupo === "menos-gateway") return p !== "gateway";
      if (/^(repetidor|torres)/.test(grupo)) return p === "repetidor";
      if (/^(personas|gente|nodos de campo)$/.test(grupo)) return (a.tipo ?? "antena") === "nodo";
      if (/^(antenas|nodos antena)$/.test(grupo)) return (a.tipo ?? "antena") === "antena";
      if (grupo === "gateways") return a.pasarela;
      return true;
    })
    .map((a) => a.id);
  const nombreEs = grupo === "menos-gateway" ? "todos los nodos menos el gateway" : `${/^(personas|gente|antenas|torres|piezas)$/.test(grupo) ? "todas las" : "todos los"} ${grupo === "gente" ? "personas" : grupo}`;
  const nombre = tx(nombreEs, grupo === "menos-gateway" ? "all nodes except the gateway" : `all ${GRUPO_INGLES[grupo] ?? grupo}`);
  // v17.4 · «Sube todos los repetidores 5 m (más)», «quítales 2 m a todas las antenas»: a cada uno lo suyo
  const delta = cambioDeAltura(tn);
  if (/\b(borra\w*|elimina\w*|quita\w*|saca\w*|suprim\w*)\b/.test(tn) && !/\bpasarela\b/.test(tn) && delta === null) return { tipo: "eliminar-varios", ids, descripcion: nombre };
  if (delta !== null)
    return {
      tipo: "editar-varios",
      ids,
      cambios: {},
      deltaAlturaM: delta,
      descripcion: tx(`${nombre} ${delta > 0 ? "suben" : "bajan"} ${fn(Math.abs(delta))} m`, `${nombre} ${delta > 0 ? "raised" : "lowered"} ${fn(Math.abs(delta))} m`),
    };
  const alturaTxt = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b/i);
  if (alturaTxt && /\b(sube|subir|subelos|baja|bajar|bajalos|pon\w*|cambia\w*|deja\w*|altura|queden|quede|quedan|esten|este|estan|ubica\w*|eleva\w*)\b/.test(tn)) {
    const h = Math.min(300, Math.max(0.5, num(alturaTxt[1])));
    return { tipo: "editar-varios", ids, cambios: { alturaM: h }, descripcion: tx(`${nombre} quedan a ${fn(h)} m`, `${nombre} now at ${fn(h)} m`) };
  }
  if (/\b(desactiv\w*|exclu\w*|apaga\w*)\b/.test(tn)) return { tipo: "editar-varios", ids, cambios: { activa: false }, descripcion: tx(`${nombre} quedan fuera de la simulación`, `${nombre} now excluded from the simulation`) };
  if (/\b(activ\w*|inclu\w*|enciend\w*|prende\w*)\b/.test(tn)) return { tipo: "editar-varios", ids, cambios: { activa: true }, descripcion: tx(`${nombre} vuelven a la simulación`, `${nombre} back in the simulation`) };
  const rol = rolEnTexto(tn);
  if (rol)
    return {
      tipo: "editar-varios",
      ids,
      cambios: { rol },
      descripcion: tx(
        `${nombre} quedan como ${rol === "REPETIDOR" ? "repetidores" : rol === "ROOM_SERVER" ? "room server" : "companion (no retransmiten)"}`,
        `${nombre} now set as ${rol === "REPETIDOR" ? "repeaters" : rol === "ROOM_SERVER" ? "room servers" : "companions (they don't retransmit)"}`,
      ),
    };
  return null;
}

/** Los grupos de «todos los…» en inglés, para mostrarlos. */
const GRUPO_INGLES: Record<string, string> = {
  repetidores: "repeaters",
  repetidoras: "repeaters",
  personas: "people",
  gente: "people",
  "nodos de campo": "field nodes",
  "nodos antena": "antenna nodes",
  antenas: "antennas",
  nodos: "nodes",
  torres: "towers",
  gateways: "gateways",
  piezas: "pieces",
};

/** Rol MeshCore en el texto («como repetidor», «que no retransmita», «room server»); acepta también los nombres viejos. */
function rolEnTexto(tn: string): Rol | null {
  if (!/\b(rol|como|modo|sea|sean|retransmit\w*)\b/.test(tn)) return null;
  // «¿Cómo está el Repetidor 3?» pregunta por el nodo; no le cambia el rol
  if (/^(como|que tal|cual|cuales|por que)\b/.test(tn) && !/\b(pon\w*|deja\w*|configur\w*|cambi\w*|vuelv\w*|conviert\w*|hazl[oa]|que sea|que quede)\b/.test(tn)) return null;
  if (/\b(room ?server|servidor de sala|sala de mensajes|tablero)\b/.test(tn)) return "ROOM_SERVER";
  if (/\b(companion|compania|billetera|client ?mute|cliente mudo|mudo|mudos|silencios\w*|no retransmit\w*|cliente|clientes|client)\b/.test(tn)) return "COMPANION";
  if (/\b(repetidor|repeater|router|enrutador|retransmisor|retransmit\w*)\b/.test(tn)) return "REPETIDOR";
  return null;
}

function equipoEnTexto(tn: string): EquipoId | null {
  if (!/\bequipo\b|\bradio portatil\b|\bnodo solar\b|\bp1\b|\bt1000\b|\bt114\b|\bxiao\b|\bbilletera\b|\btarjeta\b/.test(tn)) return null;
  if (/\b(t1000|tarjeta|sensecap t1000)\b/.test(tn)) return "t1000";
  if (/\b(xiao|billetera|portatil|de mano|handy)\b/.test(tn)) return "xiao";
  if (/\b(t114|heltec|radio del gateway)\b/.test(tn)) return "t114-8dbi";
  if (/\b(p1|solar|fibra|8 ?dbi|repetidor solar)\b/.test(tn)) return "p1-8dbi";
  return null;
}

/**
 * «Pantalla limpia», «deja solo el mapa», «oculta los paneles», «cierra el panel izquierdo», «oculta los resultados»,
 * «muestra los paneles», «abre el panel de resultados», «muéstrame las herramientas».
 */
/* ───────────── v17.6 · Acercar y alejar el mapa ───────────── */

/** Lo que aleja el mapa: «aléjalo», «zoom out», «más lejos», «quítale zoom», «menos zoom», «reduce la vista». */
const ZOOM_MENOS =
  /\b(?:alej\w*|zoom (?:out|afuera|para afuera|hacia afuera)|menos zoom|quit\w* (?:el |un poco de |algo de |un poquito de )?zoom|mas (?:lejos|lejitos|lejecitos)|(?:reduc|achic|disminu)\w* (?:el |la )?(?:mapa|vista|imagen|zoom))\b/;
/** Lo que lo acerca: «acerca el mapa», «acércate más», «zoom», «zoom in», «más cerca», «amplía la vista». */
const ZOOM_MAS = /\b(?:acerc\w*|acerq\w*|zoom|mas (?:cerca|cerquita|cerquitica)|(?:ampli|agrand)\w* (?:el |la )?(?:mapa|vista|imagen))\b/;
/** Lo único que puede acompañar la orden: el mapa, cuánto, la cortesía y las muletillas (con un nodo o un lugar es otra). */
const ZOOM_RELLENO = new Set(
  (
    "el la lo los las le les me se nos un una uno mapa vista imagen camara pantalla zoom poco poquito poquitico poquitin tantico tantito tris pelo algo " +
    "mas aun todavia otro otra otros otras vez veces de nuevo por favor porfa porfis porfavor melki oye hey ok okay bueno ahi ahora ahorita pues ya " +
    "hagale hagame dele dale sumerce mijo mija senor senora don mi bastante mucho muchisimo harto full al maximo tope todo que pueda puedas se " +
    "nivel niveles paso pasos punto puntos y hacia para adentro afuera dentro in out haz hazle hazme pon ponle ponme mete metele metale dame da quita " +
    "quitale quitele menos cerca cerquita cerquitica lejos lejitos lejecitos ver mejor rapido dos tres cuatro cinco seis"
  ).split(" "),
);
const VERBO_ZOOM = /^(?:acerc\w*|acerq\w*|alej\w*|ampli\w*|agrand\w*|reduc\w*|achic\w*|disminu\w*|\d{1,2})$/;

/**
 * v17.6 · «Acerca el mapa», «aléjalo un poquito», «más cerca», «haz zoom», «zoom out dos niveles» (y en inglés, «zoom in»,
 * «get closer», que el traductor deja así). Solo si no nombra otra cosa: «acerca el Repetidor 1 al gateway» lo mueve y
 * «acércate a Cumaral» lleva el mapa a Cumaral.
 */
export function interpretarZoom(tn: string): Orden | null {
  const t = tn.replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t || t.length > 80) return null;
  const menos = ZOOM_MENOS.test(t);
  const mas = ZOOM_MAS.test(t.replace(ZOOM_MENOS, " "));
  if (menos === mas) return null;
  if (!t.split(" ").every((w) => ZOOM_RELLENO.has(w) || VERBO_ZOOM.test(w))) return null;
  // «Aléjalo para ver todo» es ver toda la red (encuadrar)
  if (/\bver\b.*\btod[oa]s?\b/.test(t)) return null;
  const n = t.match(/\b(\d{1,2}|un|una|dos|tres|cuatro|cinco|seis) (?:niveles?|veces|pasos?|puntos?)\b/);
  const cifra = n ? ({ un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 } as Record<string, number>)[n[1]] ?? Number(n[1]) : 0;
  const pasos = n
    ? Math.min(6, Math.max(1, cifra))
    : /\b(?:maximo|tope|todo lo que)\b/.test(t)
      ? 5
      : /\b(?:bastante|mucho|muchisimo|harto|full)\b/.test(t)
        ? 2
        : /\b(?:poco|poquito|poquitico|poquitin|tantico|tantito|tris|pelo|algo)\b/.test(t)
          ? 0.5
          : 1;
  return { tipo: "zoom", pasos: menos ? -pasos : pasos };
}

/**
 * v17.6 · La leyenda («muestra la leyenda», «quita la leyenda», «muéstrame los colores») y el relieve en 3D a la vista
 * («muestra el relieve del terreno», «quiero ver los cerros», «quítale el 3D»). Va antes que las órdenes de los nodos:
 * «quítale el 3D» no borra el último nodo. Con otras capas en la misma frase lo resuelve la pantalla (más abajo).
 */
export function interpretarLeyendaRelieve(tn: string): Orden | null {
  if (PREGUNTA.test(tn) && !/\b(puedes|podrias)\b/.test(tn)) return null;
  if (/\b(vias|carreteras|caminos|rios|quebradas|limites|municipios|departamentos|nombres|etiquetas|poblados|enlaces|alcance|circulos|anillos|haces|sin servicio|satelit\w*|topografic\w*|calles)\b/.test(tn)) return null;
  // La leyenda (no «la leyenda del Silbón» ni «qué significan los colores», que contesta el cerebro)
  const leyenda = /\b(?:leyenda|convenciones|simbologia)\b/.test(tn) && !/\bleyendas? (?:del?|de la|de los|de las) (?!mapa|simulador|cobertura|senal|colores|red|malla)/.test(tn);
  const losColores = /^(?:(?:melki|oye|bueno|por favor) )*(?:muestra\w*|ensena\w*|abre|pon\w*|quiero ver|dejame ver|deja ver) (?:la leyenda de )?los colores(?: del mapa| de la cobertura| de la senal)?(?: por favor)?$/.test(tn);
  if (leyenda || losColores) {
    const quitar = /\b(?:quita\w*|oculta\w*|cierra\w*|pliega\w*|esconde\w*|apaga\w*|desactiva\w*|recoge\w*|minimi[sz]\w*|colapsa\w*|guarda\w*|sin)\b/.test(tn);
    const ver = losColores || /\b(?:muestra\w*|mostrar|abre|abrir|abrela|despliega\w*|desplega\w*|ensena\w*|pon\w*|activa\w*|saca\w*|quiero ver|ver|veo|deja\w* ver|vuelve\w*|trae\w*|prende\w*|enciende|maximi[sz]\w*|expande\w*)\b/.test(tn);
    if (quitar !== ver) return { tipo: "vista", cambios: { leyenda: ver }, descripcion: ver ? tx("muestra la leyenda", "shows the legend") : tx("pliega la leyenda", "collapses the legend") };
    return null;
  }
  // El relieve en 3D a la vista. Sin «real», «plano» ni «sin relieve», que son el relieve de la simulación
  const tresD = /\b(?:3d|3 d|(?:tres|3) dimensiones|tridimensional)\b/.test(tn);
  if ((tresD || /\b(?:relieve|relieves|montanas|cerros|lomas|colinas|serrania)\b/.test(tn)) && !/\b(?:simul\w*|calcul\w*|usa\w*|real|plano|plana|terreno plano)\b/.test(tn)) {
    const quitar = /\b(?:quita\w*|oculta\w*|esconde\w*|aplana\w*)\b/.test(tn) || (tresD && /\b(?:apaga\w*|desactiva\w*|sin)\b/.test(tn));
    const ver = /\b(?:muestra\w*|mostrar|ensena\w*|quiero ver|ver|veo|deja\w* ver|pon\w*|saca\w*)\b/.test(tn) || (tresD && /\b(?:activa\w*|enciende|prende\w*|cambia\w*|pasa\w*)\b/.test(tn));
    if (quitar !== ver) return { tipo: "vista", cambios: { relieve3d: ver }, descripcion: ver ? tx("muestra el relieve en 3D", "shows the terrain in 3D") : tx("ya no muestra el relieve en 3D", "no longer shows the terrain in 3D") };
  }
  return null;
}

export function interpretarPaneles(tn: string): Orden | null {
  const ocultar = /\b(oculta\w*|esconde\w*|quita\w*|cierra\w*|pliega\w*|recoge\w*|minimiza\w*|colapsa\w*|sin)\b/.test(tn);
  const mostrar = /\b(muestra\w*|mostrar|abre|abrir|despliega\w*|vuelve\w*|pon\w*|devuelve\w*|quiero ver|ver)\b/.test(tn);
  // La barra de herramientas de arriba se despliega solo con su flechita: Melki no la abre, explica dónde está
  if ((ocultar || mostrar) && /\b(barra (de herramientas |de botones |de menus? |de opciones )?(de arriba|superior|de encima)|menu de arriba|botones de arriba)\b/.test(tn))
    return { tipo: "paneles", barra: !ocultar };
  if (/\b(pantalla limpia|limpia la pantalla|limpiar la pantalla|despeja\w* (la pantalla|el mapa)|solo el mapa|solamente el mapa|mapa (completo|a pantalla completa|grande)|pantalla completa|modo limpio|sin paneles)\b/.test(tn) && !/\b(muestra|abre|vuelve)\w* (los )?paneles\b/.test(tn))
    return { tipo: "paneles", izquierdo: false, derecho: false };
  const izquierdo = /\b(panel (izquierdo|de la izquierda|lateral|de herramientas)|barra (izquierda|de la izquierda|lateral|de herramientas)|herramientas de la izquierda)\b|\blas herramientas$/.test(tn);
  const derecho = /\b(panel (derecho|de la derecha|de resultados?)|barra (derecha|de la derecha)|(el|los) resultados?)\b/.test(tn);
  const ambos = /\b(los paneles|ambos paneles|los dos paneles|paneles|las barras)\b/.test(tn);
  if (!izquierdo && !derecho && !ambos) return null;
  // «muestra los resultados» sin la palabra panel es pedir el resumen, no el panel
  if (!izquierdo && !ambos && derecho && !/\bpanel\b/.test(tn) && !ocultar) return null;
  if (!ocultar && !mostrar) return null;
  const valor = !ocultar;
  if (ambos && !izquierdo && !derecho) return { tipo: "paneles", izquierdo: valor, derecho: valor };
  return { tipo: "paneles", ...(izquierdo ? { izquierdo: valor } : {}), ...(derecho ? { derecho: valor } : {}) };
}

function interpretarPantalla(tn: string): Orden | null {
  if (PREGUNTA.test(tn) && !/\b(puedes|podrias)\b/.test(tn)) return null;
  // Simular al cambiar
  if (/\b(simular al cambiar|simulacion automatica|calculo automatico|simule solo|calcule solo|simula sol[oa]|calcula sol[oa])\b/.test(tn)) {
    if (/\b(desactiva\w*|apaga\w*|quita\w*|no|deten\w*|para)\b/.test(tn)) return { tipo: "auto", valor: false };
    return { tipo: "auto", valor: true };
  }
  // Relieve: real (teselas de elevación) o terreno plano
  if (/\b(terreno plano|sin relieve|relieve plano|tierra plana)\b/.test(tn) && !/\b(alcance|referencia)\b/.test(tn)) return { tipo: "relieve", valor: "plano" };
  if (/\b(relieve real|con relieve|terreno real|elevacion real|usa el relieve|usa la elevacion)\b/.test(tn)) return { tipo: "relieve", valor: "teselas" };
  // Ver toda la red
  if (/\b(muestrame|muestra|ensename|ensena|ver|veo|encuadra\w*|ajusta\w*|centra\w*|zoom|alej\w*)\b.*\b(toda la (red|malla)|todos los nodos|todas las antenas|todo)\b/.test(tn) && !/\b(antena|nodo|repetidor|persona) \d/.test(tn))
    return { tipo: "encuadrar" };
  const on = /\b(muestra\w*|mostrar|activa\w*|enciende|prende|pon\w*|quiero ver|ver|ensena\w*|agrega\w*)\b/.test(tn);
  // («sin servicio» es el nombre de una capa, no «quítala»; v17.6: «elimina los anillos» también la quita)
  const off = /\b(quita\w*|oculta\w*|apaga\w*|esconde\w*|desactiva\w*|elimina\w*|retira\w*|sin|no quiero ver)\b/.test(tn.replace(/\bsin (?:servicio|senal|cobertura|enlace)\b/g, " "));
  // Fondo del mapa
  if ((/\b(mapa|fondo|vista|capa|base)\b/.test(tn) || /\b(satelit\w*|opentopomap|open ?topo ?map|topografic\w*|curvas? de nivel)\b/.test(tn)) && (on || /\b(cambia\w*|usa\w*|pasa\w*)\b/.test(tn))) {
    const fondo = /\b(satelit\w*|imagenes satelitales|satelite)\b/.test(tn)
      ? "satelite"
      : /\b(?:opentopomap|open ?topo ?map|curvas? de nivel)\b/.test(tn)
        ? "opentopomap"
        : /\btopografic\w*/.test(tn)
          ? "topografico"
          : /\b(calles|callejero|openstreetmap|osm|carreteras)\b/.test(tn) && /\bmapa de\b/.test(tn)
            ? "calles"
            : null;
    if (fondo)
      return {
        tipo: "vista",
        cambios: { fondo },
        descripcion: {
          satelite: tx("se ve con imágenes satelitales", "now shows satellite imagery"),
          topografico: tx("se ve con el mapa topográfico", "now shows the topographic map"),
          opentopomap: tx("se ve con OpenTopoMap (curvas de nivel, ríos y quebradas)", "now shows OpenTopoMap (contour lines, rivers and streams)"),
          calles: tx("se ve con el mapa de calles", "now shows the street map"),
        }[fondo],
      };
  }
  // v17.6 · La opacidad dicha con cualquier verbo («baja la opacidad a 40 %», «pon la opacidad de la cobertura en 60 %»)
  const opacidad = tn.match(/\b(opacidad|transparencia)\b\D{0,30}?(\d{1,3})\s*(?:%|por ciento)?(?!\s*(?:km|m|metros?)\b)/);
  if (opacidad && !/\d\s*(km|kilometros?|metros?|millas?|db|dbm|dbi|mhz)\b/.test(tn)) {
    const v = Math.min(100, Math.max(5, Number(opacidad[2]))) / 100;
    const o = opacidad[1] === "transparencia" ? Math.max(0.05, 1 - v) : v;
    return { tipo: "vista", cambios: { opacidad: o }, descripcion: tx(`ahora muestra la cobertura con ${Math.round(o * 100)} % de opacidad`, `now shows the coverage at ${Math.round(o * 100)}% opacity`) };
  }
  // v17.6 · El color de la cobertura («colorea por señal», «cambia los colores a mejor antena», «pinta por respaldo»)
  const colorPor = tn.match(/\b(?:colorea\w*|pinta\w*|cambia\w* (?:los )?colores|colores)\b.*\b(?:por|a|pa|para|de|segun|con)\b (?:la |el )?(senal|mejor antena|mejor servidor|respaldo|redundancia)\b/);
  if (colorPor) {
    const modo = colorPor[1] === "senal" ? "senal" : /respaldo|redundancia/.test(colorPor[1]) ? "redundancia" : "servidor";
    return { tipo: "vista", cambios: { modo }, descripcion: { senal: tx("ahora muestra el mapa de señal", "now shows the signal map"), servidor: tx("ahora muestra cuál nodo antena atiende cada zona", "now shows which antenna node serves each area"), redundancia: tx("ahora muestra el respaldo (cuántos nodos antena llegan a cada punto)", "now shows the backup (how many antenna nodes reach each point)") }[modo] };
  }
  if (!on && !off) return null;
  // Con cantidades («radio de 12 km», «20 m», «-100 dBm») es un parámetro o un nodo, no una capa
  if (/\d\s*(km|kilometros?|m|metros?|millas?|yardas?|pies|cuadras?|db|dbm|dbi|mhz)\b/.test(tn)) return null;
  const valor = !off;
  const capas: [RegExp, keyof CambiosVista, string][] = [
    [/\b(vias|carreteras|caminos|trochas)\b/, "refVias", tx("las vías", "roads")],
    [/\b(rios|quebradas|cauces)\b/, "refRios", tx("los ríos", "rivers")],
    [/\b(limites|division politica|municipios|departamentos|fronteras)\b/, "refDivision", tx("los límites de municipios y departamentos", "municipal and departmental boundaries")],
    [/\b(nombres|etiquetas|poblados|pueblos|veredas)\b/, "refNombres", tx("los nombres de poblados y lugares", "names of towns and places")],
    [/\benlaces\b/, "mostrarEnlaces", tx("los enlaces entre nodos", "links between nodes")],
    [/\b(alcance|rango de alcance|contorno\w*)\b/, "mostrarAlcance", tx("el rango de alcance", "the range")],
    [/\b(circulos|circulos de estudio)\b/, "mostrarCirculos", tx("los círculos de estudio", "the study circles")],
    [/\b(3d|(?:tres|3) dimensiones|relieve en 3d|relieve 3d)\b/, "relieve3d", tx("el relieve en 3D", "the terrain in 3D")],
    [/\b(zonas? sin servicio|areas? sin servicio|lo rojo|donde no hay (?:servicio|senal|cobertura))\b/, "mostrarSinServicio", tx("las zonas sin servicio", "areas with no service")],
    [/\banillos\b/, "mostrarAnillos", tx("los anillos de distancia", "distance rings")],
    [/\b(haces|direccion de las antenas)\b/, "mostrarHaces", tx("la dirección de las antenas direccionales", "the direction of directional antennas")],
  ];
  const cambios: CambiosVista = {};
  const partes: string[] = [];
  for (const [re, clave, nombre] of capas) {
    if (!re.test(tn)) continue;
    (cambios as Record<string, unknown>)[clave] = valor;
    partes.push(nombre);
  }
  // Modo del mapa de cobertura
  if (valor && /\b(mejor antena|mejor servidor|quien atiende|que antena atiende|servidor)\b/.test(tn)) {
    cambios.modo = "servidor";
    partes.push(tx("cuál nodo antena atiende cada zona", "which antenna node serves each area"));
  } else if (valor && /\b(mapa|modo|ver|muestra\w*)\b.*\b(respaldo|redundancia)\b/.test(tn)) {
    cambios.modo = "redundancia";
    partes.push(tx("el respaldo (cuántos nodos antena llegan a cada punto)", "the backup (how many antenna nodes reach each point)"));
  } else if (valor && /\b(mapa|modo) de (la )?senal\b/.test(tn)) {
    cambios.modo = "senal";
    partes.push(tx("el mapa de señal", "the signal map"));
  }
  const op = tn.match(/\b(opacidad|transparencia)\b\D{0,14}(\d{1,3})\s*%?/);
  if (op) {
    const v = Math.min(100, Math.max(5, Number(op[2]))) / 100;
    cambios.opacidad = op[1] === "transparencia" ? Math.max(0.05, 1 - v) : v;
    partes.push(tx(`la cobertura con ${Math.round((cambios.opacidad ?? 0) * 100)} % de opacidad`, `the coverage at ${Math.round((cambios.opacidad ?? 0) * 100)}% opacity`));
  }
  if (!partes.length) return null;
  return { tipo: "vista", cambios, descripcion: tx(`${valor ? "ahora muestra" : "ya no muestra"} ${partes.join(", ")}`, `${valor ? "now shows" : "no longer shows"} ${listaIngles(partes)}`) };
}

/* ───────────── Varias órdenes en un mensaje ───────────── */

const VERBO_PASO =
  "pon|ponme|ponle|agrega|agregale|anade|crea|creame|inscribe|registra|instala|mueve|muevelo|muevela|borra|borralo|elimina|quita|quitale|sube|subelo|subela|baja|bajalo|bajala|cambia|cambiale|renombra|llama|llamalo|simula|calcula|envia|manda|conecta|siembra|lleva|muestra|muestrame|activa|desactiva|exporta|descarga|usa|marca|apunta|dale|haz|abre|ve|llevame|mide|cubre|arma|armame|disena|ponlo|ponla";

/** Divide un mensaje con varias órdenes: «pon el gateway en X, luego un repetidor a 10 km al norte y simula». */
/** Los verbos se reconocen con o sin tilde («súbela», «envía»). */
const VERBOS_PASO = VERBO_PASO.replace(/[aeiou]/g, (v) => `[${v}${{ a: "á", e: "é", i: "í", o: "ó", u: "ú" }[v]}]`);

export function dividirEnPasos(texto: string): string[] {
  const t = texto.replace(/\s+/g, " ").trim();
  // No se corta dentro de comillas
  const protegido = t.replace(/["“«][^"”»]*["”»]/g, (m) => m.replace(/[,;.]/g, (c) => ({ ",": "\u0001", ";": "\u0002", ".": "\u0003" })[c]!));
  const corte = new RegExp(
    String.raw`\s*;\s*|\.\s+(?=\S)|,?\s+(?:y\s+)?(?:luego|despues|después|a continuacion|a continuación|enseguida|por ultimo|por último|finalmente|al final)\s*,?\s+|,?\s+y\s+(?:tambien\s+|además\s+|ademas\s+)?(?=(?:${VERBOS_PASO})\b)|,\s+(?=(?:${VERBOS_PASO})\b)|(?:,\s*|\s+y\s+)(?=(?:un|una|otro|otra)\s+(?:repetidor|repetidora|persona|gateway|nodo|antena)\b)`,
    "giu",
  );
  const pasos = protegido
    .split(corte)
    .map((p) => p.replace(/[\u0001]/g, ",").replace(/[\u0002]/g, ";").replace(/[\u0003]/g, ".").replace(/^[,.;\s]+|[,.;\s]+$/g, "").trim())
    .filter((p) => p.length >= 3);
  return pasos.length ? pasos : [t];
}

/* ───────────── Interpretación ───────────── */

const VERBO_AGREGAR = /\b(inscrib\w*|registr\w*|agreg\w*|anad\w*|adicion\w*|ingres\w*|instal\w*|coloc\w*|crea|crear|creame|crealo|pon|poner|ponme|monta\w*|ubica (?:una|un|otra|otro)|ubicar (?:una|un|otra|otro)|nuev[oa]|mete|meter|incorpor\w*)\b/;
const OBJETO = /\b(antena|antenas|nodo|nodos|torre|repetidor|pasarela|router|sensor|equipo)\b/;

/**
 * Contexto de la conversación: el último nodo que Melki puso o cambió («súbelo a 20 m»), el último lugar del que se
 * habló («arma la red de todo ese municipio», «ahí») y, al elegir entre lugares parecidos, el lugar elegido para lo dicho.
 */
export type ContextoOrden = { ultimoNodo?: string | null; ultimoLugar?: Lugar | null; forzarLugar?: { dicho: string; lugar: Lugar } };

const CLITICO =
  /\b(subelo|subela|bajalo|bajala|muevelo|muevela|borralo|borrala|eliminalo|eliminala|quitalo|quitala|renombralo|renombrala|llamalo|llamala|apuntalo|apuntala|conviertelo|conviertela|activalo|activala|desactivalo|desactivala|ponle|dale|cambiale|subele|bajale|quitale|agregale|dejalo|dejala|elevalo|elevala|trasladalo|trasladala|reubicalo|reubicala|giralo|girala|inclinalo|inclinala|ponlo|ponla|llevalo|llevala|acercalo|acercala|colocalo|colocala|ubicalo|ubicala|arrimalo|arrimala|correlo|correla|juntalo|juntala|ese (nodo|repetidor|gateway|equipo)|este (nodo|repetidor|gateway|equipo)|esa (persona|antena|torre)|esta (persona|antena|torre))\b/;

/**
 * Interpreta la orden y, si un lugar dicho puede ser varios («barranco vía» → Barranca de Upía, Barranquilla…), la
 * convierte en la pregunta «¿se refiere a…?» con la orden completa para cada opción. Recuerda el lugar de la orden
 * (`lugarUsado`) y lo que entendió de un lugar mal dicho (`nota`).
 */
export function interpretarOrden(texto: string, api: Api, pendiente: Pendiente, contexto: ContextoOrden = {}): Orden | null {
  const previa = sesionLugares;
  sesionLugares = { dudas: [], intentos: [], usados: [], corregidos: [], forzar: contexto.forzarLugar };
  try {
    const o = interpretarOrdenBase(texto, api, pendiente, contexto);
    if (!o) return null;
    const sesion = sesionLugares;
    const duda = sesion.dudas[0];
    if (duda && !contexto.forzarLugar && o.tipo !== "elegir" && o.tipo !== "pedir-lugar" && o.tipo !== "aviso") {
      const opciones = opcionesDeLugar(texto, api, pendiente, contexto, duda.dicho, duda.opciones.map((c) => c.lugar));
      if (opciones.length === 1) opciones[0] = { ...opciones[0], texto: tx(`Sí, ${opciones[0].texto}`, `Yes, ${opciones[0].texto}`) };
      if (opciones.length) return { tipo: "elegir", pregunta: preguntaLugar(opciones, duda.dicho), opciones, dicho: duda.dicho, original: texto };
    }
    // Una red pedida «en» un lugar que no se reconoció iría al centro del mapa: mejor preguntar
    const intento = sesion.intentos[0];
    if (!duda && intento?.opciones.length && !contexto.forzarLugar && o.tipo === "disenar" && "centro" in o.area && o.area.centro.tipo !== "coord") {
      const opciones = opcionesDeLugar(texto, api, pendiente, contexto, intento.dicho, intento.opciones.map((c) => c.lugar));
      const sugerido = opciones.map((x) => x.texto);
      opciones.push({ texto: tx("En el centro del mapa", "At the center of the map"), orden: o });
      return {
        tipo: "elegir",
        pregunta: tx(
          `No reconocí «${intento.dicho}» como un municipio. ¿Se refiere a ${sugerido.length > 1 ? `${sugerido.slice(0, -1).join(", ")} o ${sugerido[sugerido.length - 1]}` : (sugerido[0] ?? "otro lugar")}? Si no, dígame el municipio y el departamento, o la armo en el centro del mapa.`,
          `I didn't recognize “${intento.dicho}” as a municipality. Do you mean ${sugerido.length > 1 ? `${sugerido.slice(0, -1).join(", ")} or ${sugerido[sugerido.length - 1]}` : (sugerido[0] ?? "another place")}? If not, tell me the municipality and the department, or I'll build it at the center of the map.`,
        ),
        opciones,
        dicho: intento.dicho,
        original: texto,
      };
    }
    const lugar = o.lugarUsado ?? sesion.usados[sesion.usados.length - 1];
    const corregido = sesion.corregidos[0];
    return { ...o, ...(lugar ? { lugarUsado: lugar } : {}), ...(corregido && !o.nota ? { nota: tx(`Entendí «${nombreLugar(corregido.lugar)}».`, `I understood “${nombreLugar(corregido.lugar)}”.`) } : {}) };
  } finally {
    sesionLugares = previa;
  }
}

/** La orden original con cada lugar posible (para «¿se refiere a…?»). */
function opcionesDeLugar(original: string, api: Api, pendiente: Pendiente, contexto: ContextoOrden, dicho: string, lugares: Lugar[]): OpcionLugar[] {
  const opciones: OpcionLugar[] = [];
  for (const l of lugares.slice(0, 4)) {
    const alt = interpretarOrden(original, api, pendiente, { ...contexto, forzarLugar: { dicho, lugar: l } });
    if (alt && alt.tipo !== "elegir" && alt.tipo !== "pedir-lugar" && alt.tipo !== "aviso") opciones.push({ texto: nombreLugar(l), orden: alt, lugar: l });
  }
  return opciones;
}

const SI_ELEGIR = /^(si|claro|correcto|exacto|eso|ese|esa|ese mismo|esa misma|ese es|esa es|afirmativo|dale|hazlo|listo|ok|okey|vale|de acuerdo|perfecto|asi es|por supuesto|efectivamente|si senor|si senora|si ese|si esa)\b/;
const NO_ELEGIR = /^(no|ninguno|ninguna|ningun|otro|otra|tampoco|negativo|para nada)\b/;
const ORDINALES: [RegExp, number | "ultima"][] = [
  [/\b(primer[oa]?|uno|1)\b/, 0],
  [/\b(segund[oa]|dos|2)\b/, 1],
  [/\b(tercer[oa]?|tres|3)\b/, 2],
  [/\b(cuart[oa]|cuatro|4)\b/, 3],
  [/\b(ultim[oa])\b/, "ultima"],
];

/** La respuesta a «¿se refiere a…?»: «sí», «la segunda», «Granada, Meta», «el del Meta» o «no, ninguno». */
function eleccionDe(tn: string, p: Extract<NonNullable<Pendiente>, { tipo: "elegir" }>): Orden | null {
  const t = tn.replace(/[.,;:!¡¿?]/g, " ").replace(/\s+/g, " ").trim();
  const corto = t.split(" ").length <= 6;
  const con = (x: string) => new RegExp(`(^|[^a-z])${escRe(n(x))}($|[^a-z])`).test(t);
  const conNombre = p.opciones.filter((o) => o.lugar && con(o.lugar.nombre));
  const conDepto = p.opciones.filter((o) => o.lugar?.tipo === "municipio" && con(o.lugar.detalle));
  const ambos = conNombre.filter((o) => conDepto.includes(o));
  const elegida = ambos.length === 1 ? ambos[0] : conDepto.length === 1 && corto ? conDepto[0] : conNombre.length === 1 ? conNombre[0] : null;
  if (elegida) return elegida.orden;
  if (corto)
    for (const [re, i] of ORDINALES) {
      if (!re.test(t)) continue;
      const k = i === "ultima" ? p.opciones.length - 1 : i;
      if (p.opciones[k]) return p.opciones[k].orden;
    }
  // Solo «no», «ninguno», «ninguno de esos»: lo pide de nuevo (si dice otro lugar, se toma ese)
  if (NO_ELEGIR.test(t) && /^(no|ninguno|ninguna|ningun|otro|otra|tampoco|negativo|para nada)( (es|era|ninguno|ninguna|de esos|de esas|de ellos|gracias|senor|senora|ese|esa))*$/.test(t)) return { tipo: "pedir-lugar", dicho: p.dicho, original: p.original, sugerencias: [], rechazo: true };
  if (SI_ELEGIR.test(t) && corto) return p.opciones[0].orden;
  return null;
}

/** Verbos de una orden nueva: si la respuesta trae uno, no es el lugar que se pidió sino otra orden. */
const VERBO_ORDEN_NUEVA = /\b(pon\w*|agreg\w*|arm\w*|disen\w*|simul\w*|borr\w*|quit\w*|muestr\w*|elimin\w*|crea\w*|sube|baja|cambi\w*|mueve|haz\w*|puebla\w*|envia\w*|manda\w*|activa\w*|apaga\w*)\b/;

/** La respuesta a «¿me repite el municipio?»: el lugar que faltaba en la orden original. */
function lugarPendiente(tn: string, api: Api, p: Extract<NonNullable<Pendiente>, { tipo: "lugar" }>, contexto: ContextoOrden): Orden | null {
  const consulta = tn.replace(/^(?:es|seria|me refiero a|quise decir|quiero decir|dije|en|a|al|el municipio de|el pueblo de)\s+/, "").replace(/\b(por favor|porfa|porfavor|gracias)\b/g, " ").replace(/\s+/g, " ").trim();
  if (consulta.length < 3) return null;
  let d = decidirLugar(candidatosLugar(consulta, api));
  if (d.tipo !== "seguro") {
    // Puede venir con más palabras («es barranca de upía en el meta, por favor»)
    const previa = sesionLugares;
    sesionLugares = { dudas: [], intentos: [], usados: [], corregidos: [] };
    try {
      const parte = lugarEnTexto(`en ${consulta}`, api, false);
      if (parte && !sesionLugares.dudas.length) d = { tipo: "seguro", candidato: { lugar: parte, parecido: 1, puntaje: 1, exacto: true, departamentoDicho: null }, opciones: [] };
    } finally {
      sesionLugares = previa;
    }
  }
  if (d.tipo === "seguro") return interpretarOrden(p.original, api, null, { ...contexto, forzarLugar: { dicho: p.dicho, lugar: d.candidato.lugar } });
  if (d.tipo === "dudoso") {
    const opciones = opcionesDeLugar(p.original, api, null, contexto, p.dicho, d.opciones.map((c) => c.lugar));
    if (opciones.length) return { tipo: "elegir", pregunta: preguntaLugar(opciones, consulta), opciones, dicho: p.dicho, original: p.original };
  }
  return { tipo: "pedir-lugar", dicho: p.dicho, original: p.original, sugerencias: d.opciones.map((c) => c.lugar) };
}

/**
 * v17.2 · Pedir el lápiz de malla: «activa el lápiz», «el pincel», «dame el lapicito», «quiero dibujar la malla», «la
 * dibujo yo». Nombrarlo de pasada no basta («pásame el lápiz» a alguien cercano no es una orden para Melki).
 */
export const LAPIZ = new RegExp(
  [
    String.raw`^(el |la |un |mi )?(lapiz|lapicito|pincel)( de (la )?malla)?$`,
    String.raw`\blapiz de (la )?malla\b`,
    String.raw`\b(activa\w*|activar|enciende\w*|encender|prende\w*|prender|usa|usar|usemos|abre|abrir|dame|damelo|pon|ponme|saca|sacame|toma|coge|agarra|selecciona\w*|elige|escoge|cambia a|cambiar a|modo|herramienta( de)?|quiero( usar)?|necesito)( el| un| mi)? (lapiz|lapicito|pincel)\b`,
    String.raw`\b(dibuj\w*|traz\w*)\b.{0,24}\bcon (el |un |mi )?(lapiz|lapicito|pincel)\b|\bcon (el |un |mi )?(lapiz|lapicito|pincel)\b.{0,24}\b(dibuj\w*|traz\w*)\b`,
    String.raw`\b(quiero|voy a|dejame|deja que|puedo|necesito|me gustaria) (yo )?(dibujar|trazar) (yo )?(la |una |mi |el )?(malla|red|zona|franja)\b`,
    String.raw`\b(quiero|voy a|dejame|puedo|me gustaria) (yo )?dibujar( yo)?$`,
    String.raw`\b(la |lo )?dibujo yo\b`,
    String.raw`\bdibujar (la malla |la red |la zona )?(a mano|a mano alzada)\b`,
  ].join("|"),
);
/** v17.2 · Soltar el lápiz de malla por orden: «suelta el lápiz», «desactiva el pincel», «ya no quiero dibujar». */
export const SOLTAR_LAPIZ =
  /\b(suelta\w*|soltar|quita\w*|quitar|desactiva\w*|desactivar|apaga\w*|apagar|cierra\w*|cerrar|guarda\w*|guardar|deja|dejar|termina\w*|terminar|sal de|salir de)( el| del| mi)? (lapiz|lapicito|pincel)\b|\b(ya )?no (quiero|voy a) dibujar\b|\b(deja|dejar|para|parar|termina|terminar) de dibujar\b/;
/** v17.5 · Soltar la regla por orden: «suelta la regla», «desactiva la regla», «ya no quiero medir». */
export const SOLTAR_REGLA =
  /\b(suelta\w*|soltar|quita\w*|quitar|desactiva\w*|desactivar|apaga\w*|apagar|cierra\w*|cerrar|guarda\w*|guardar|deja|dejar|termina\w*|terminar|sal de|salir de)( la| de la| mi)? regla\b|\b(ya )?no (quiero|voy a) medir\b|\b(deja|dejar|para|parar|termina|terminar) de medir\b/;
/** Un pedido de armar o ajustar la red («ármame una malla en Cumaral con menos repetidores», «ajústala con menos torres»). */
const ARMAR_O_AJUSTAR = /\b(constru\w*|hazme|hagamos|arma|armame|armamela|armala|armalo|armar|arme|armemos|disena\w*|disenar|crea|creame|crear|planifica\w*|montame|monta|montar|levantame|levanta|propon\w*|ajust\w*|reajust\w*|optimiz\w*)\b/;
/**
 * v17.2 · Preguntas del criterio de óptimo: «¿necesito más antenas?», «¿me faltan repetidores?», «¿sobran antenas?»,
 * «¿son demasiadas torres?», «¿por qué no pongo más?», «¿la red es óptima?», «¿puedo quitar repetidores?».
 */
export const PREGUNTA_OPTIMO = new RegExp(
  [
    String.raw`\b(necesito|necesitamos|necesita|hacen falta|hace falta|faltan|falta|me faltan|nos faltan|le faltan|requiero|requiere|debo poner|deberia poner|tengo que poner|hay que poner|conviene poner|vale la pena poner|pongo|ponemos|agrego|agregamos|le pongo|le agrego|le meto|meto) mas (antenas?|repetidor\w*|nodos?( antena)?|torres?)\b`,
    String.raw`\b(sobran?|estan de mas|esta de mas|hay de mas|son demasiad[oa]s|demasiad[oa]s|son muchas|son muchos|tantas|tantos) (antenas|repetidor\w*|nodos|torres)\b`,
    String.raw`\b(me|nos|le) (faltan|hacen falta|sobran) (antenas|repetidor\w*|nodos|torres)\b|^(faltan|hacen falta) (antenas|repetidores|nodos|torres)$`,
    String.raw`\b(antenas|repetidor\w*|nodos|torres) (de mas|que sobran|sobrantes|que no se necesitan|innecesari[oa]s)\b`,
    String.raw`\bpor ?que no (pongo|ponemos|agrego|agregamos|le pongo|meto|instalo|instalamos) mas\b`,
    String.raw`\b(la red|la malla|mi red|mi malla|esta red|esta malla) (es|esta|quedo|queda|ya es|ya esta|si es|si esta) (optima|optimo|bien dimensionad[ao]|sobredimensionad[ao]|subdimensionad[ao])\b`,
    String.raw`\b(es|esta) (optima|sobredimensionad[ao]) (la|mi|esta) (red|malla)\b`,
    String.raw`\b(puedo|podemos|se puede|se pueden|podria|podriamos) (quitar|eliminar|sacar|retirar)( algun[oa]s?| un[oa]s| antenas| repetidores| nodos| torres)? (de )?(las |los |mis |esas |esos )?(antenas|repetidores|nodos|torres)\b`,
    String.raw`\b(con menos|ahorrar\w*) (antenas|repetidor\w*|torres)\b`,
  ].join("|"),
);
/** Frases que nombran la red o el área de la red (no un sitio nuevo): «en el área objetivo», «en mi red». */
const ZONAS_DE_LA_RED = /\ben (el area( objetivo)?|la zona|la red|mi red|esta red|la malla|mi malla|el mapa|total|general)\b/g;
/** «¿Cómo funciona…?», «¿qué es…?», «¿para qué sirve…?»: una pregunta, no una orden. */
const PREGUNTA_COMO = /^(que es|que hace|como funciona|como se usa|como uso|como usar|para que sirve|para que es|explica\w*|que significa)\b/;

function interpretarOrdenBase(dicho: string, api: Api, pendiente: Pendiente, contexto: ContextoOrden = {}): Orden | null {
  // «Cinco millas», «un kilómetro y medio», «noventa y cinco por ciento»: en cifras para todos los intérpretes
  const texto = medidasEnCifras(dicho);
  const tn = n(texto);
  if (!tn) return null;
  // Respuestas a lo que Melki acaba de preguntar: «¿se refiere a…?» y «¿me repite el municipio?»
  if (pendiente?.tipo === "elegir") {
    const e = eleccionDe(tn, pendiente);
    if (e) return e;
    // Otro lugar en vez de las opciones («no, Barranca de Upía, Meta»)
    if (!VERBO_ORDEN_NUEVA.test(tn)) {
      const l = lugarPendiente(tn.replace(/^no\b[\s,]*/, ""), api, { tipo: "lugar", dicho: pendiente.dicho, original: pendiente.original }, contexto);
      if (l && l.tipo !== "pedir-lugar") return l;
    }
  }
  if (pendiente?.tipo === "lugar" && !VERBO_ORDEN_NUEVA.test(tn)) {
    const l = lugarPendiente(tn, api, pendiente, contexto);
    if (l) return l;
  }
  const antenas = api.antenas();
  const ultimo = contexto.ultimoNodo ? antenas.find((x) => x.id === contexto.ultimoNodo) : undefined;
  // «Mueve Repetidor 1 2 km al sur»: la distancia se cuenta desde ese mismo nodo. v17.4 · El que se mueve es el que se
  // nombra antes del destino («mueve el Repetidor 1 cerca del gateway»), y «cerca de…» es un punto a 200 m de ese nodo
  const iDestino = inicioDelDestino(tn);
  const movido = nodoQueSeMueve(tn, antenas, ultimo, iDestino, api.seleccion());
  const coord: Coordenada | null =
    relativaEnTexto(texto, tn, api, antenas, movido ?? ultimo) ??
    extraerCoordenadas(texto) ??
    (VERBO_AGREGAR.test(tn) || VERBO_MOVER_NODO.test(tn) || pendiente?.tipo === "agregar" || pendiente?.tipo === "mover" || pendiente?.tipo === "pieza" ? cercaEnTexto(tn, antenas, movido, ultimo) : null);
  const sel = api.seleccion();

  if (/\b(deshace\w*|deshaz|revierte|revertir|anula lo ultimo)\b/.test(tn)) return null; // lo maneja Melki (necesita la instantánea)
  const paneles = interpretarPaneles(tn);
  if (paneles) return paneles;
  // v17.6 · Acercar o alejar el mapa («acerca el mapa», «aléjalo un poco», «zoom in»)
  const zoom = interpretarZoom(tn);
  if (zoom) return zoom;
  const leyendaRelieve = interpretarLeyendaRelieve(tn);
  if (leyendaRelieve) return leyendaRelieve;

  // Completar un pedido que esperaba coordenadas (v17.4: también «cerca del Repetidor 1», donde el nodo es la referencia)
  if (pendiente && coord && !OBJETO.test((iDestino >= 0 ? tn.slice(0, iDestino) : tn).replace(/\b(en|a)\b/g, ""))) {
    if (pendiente.tipo === "agregar") return { tipo: "agregar", datos: pendiente.datos, coord };
    if (pendiente.tipo === "mover") return { tipo: "mover", id: pendiente.id, coord };
    if (pendiente.tipo === "pieza") return { tipo: "pieza", pieza: pendiente.pieza, datos: pendiente.datos, coord };
  }
  if (pendiente && coord) {
    if (pendiente.tipo === "agregar" && !VERBO_AGREGAR.test(tn)) return { tipo: "agregar", datos: { ...pendiente.datos, ...datosNodo(texto, tn) }, coord };
  }

  if (/\b(borra|borrar|elimina|eliminar|quita|quitar)\b.*\b(medicion|mediciones|regla|medidas)\b/.test(tn)) return { tipo: "borrar-mediciones" };
  if (/\b(nuevo escenario|escenario nuevo|empezar de cero|empieza de cero|empecemos de cero|empezamos de cero|desde cero|borra todo|borrar todo|limpia todo|limpiar todo|limpia el mapa|quita todo|vacia el mapa|vaciar el mapa|vacia todo)\b/.test(tn)) return { tipo: "nuevo" };
  // v17.3 · Si el mapa tiene un nodo «Ejemplo», «pon un repetidor al norte de Ejemplo» habla de ese nodo: solo «carga el
  // ejemplo», «pon el ejemplo de malla»… cargan el ejemplo (que reemplaza lo que hay en el mapa)
  const ejemploEsNodo = antenas.some((a) => /\b(ejemplo|example)\b/.test(n(a.nombre))) && !/\b(carga\w*|muestra\w*|abre|abrir|ver|pon)\s+(?:me\s+)?(?:el |un |otro |los )?(ejemplo|demostracion|demo)\b/.test(tn);
  if (!ejemploEsNodo && /\b(carga\w*|muestra\w*|abre|abrir|ver|pon)\b.*\b(ejemplo|demostracion|demo)\b/.test(tn)) return /\b(malla|sembr\w*|siembra|trama|gateway|repetidor\w*|personas?|gente)\b/.test(tn) ? { tipo: "ejemplo-malla" } : { tipo: "ejemplo" };

  const nombreEsc = texto.match(/(?:(?:ll[aá]ma|nombra|renombra|ponle (?:de )?nombre|nombre)\s+(?:al|el)\s+escenario|escenario\s+(?:se llama|llamado))\s*(?:como|a|por|:)?\s*["“«]?([^"”»]{2,60}?)["”»]?\s*$/i);
  if (nombreEsc) return { tipo: "nombre-escenario", nombre: nombreEsc[1].trim() };
  const recep = texto.match(/(?:ganancia del? receptor|receptor (?:con|de))\D{0,14}(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
  if (recep) return { tipo: "parametros", cambios: { gananciaRxDbi: num(recep[1]) }, descripcion: tx(`la ganancia del receptor a ${recep[1]} dBi`, `the receiver gain to ${recep[1].replace(",", ".")} dBi`) };

  // v17.2 · El lápiz de malla («activa el lápiz», «quiero dibujar la malla»); «¿cómo funciona el lápiz?» lo explica Melki
  // y «suelta el lápiz» lo suelta (vuelve a mover el mapa)
  if (SOLTAR_LAPIZ.test(tn) && !/\bregla\b/.test(tn) && !PREGUNTA_COMO.test(tn)) return { tipo: "herramienta", herramienta: "mover" };
  if (LAPIZ.test(tn) && !/\bregla\b/.test(tn) && !PREGUNTA_COMO.test(tn)) return { tipo: "herramienta", herramienta: "lapiz" };
  // v17.5 · «Suelta la regla», «desactiva la regla» («turn off the ruler»): vuelve a mover el mapa (antes la activaba)
  if (SOLTAR_REGLA.test(tn) && !/\b(lapiz|pincel|mediciones|medidas)\b/.test(tn) && !PREGUNTA_COMO.test(tn)) return { tipo: "herramienta", herramienta: "mover" };
  // v17.2 · El criterio de óptimo: «¿necesito más antenas?», «¿sobran repetidores?», «¿por qué no pongo más?» (sin un
  // sitio dicho: «necesito más antenas en Cumaral» o con una coordenada es otro pedido; «ármame una malla… con menos
  // repetidores» o «ajústala con menos torres» es armar o ajustar la red)
  if (PREGUNTA_OPTIMO.test(tn) && !ARMAR_O_AJUSTAR.test(tn) && !coord && !/\b(antenas?|repetidor\w*|nodos?|torres?|mas)\b.*\b(en|cerca de|hacia|alrededor de|al norte|al sur|al este|al oeste)\b/.test(tn.replace(ZONAS_DE_LA_RED, " ")))
    return { tipo: "optimo" };

  // Agente: cobertura del área medida, diseño por área, órdenes en lote y vista del mapa
  if (/\b(cuanto|que porcentaje|que %|como (queda|esta|va)|que tanto)\b.*\b(cubr\w*|cobertura|senal)\b.*\b(area|zona|poligono)\b/.test(tn)) {
    const m = [...api.mediciones()].reverse().find((x) => x.tipo === "area");
    if (m) return { tipo: "cobertura-area", id: m.id, margenDb: margenPedido(tn).margenDb };
  }
  // Completar una red que esperaba el lugar o el tamaño («en Barranca de Upía, 11.226 hectáreas», «todo el municipio»)
  if (pendiente?.tipo === "disenar") {
    const d = completarDiseno(texto, tn, api, antenas, pendiente, contexto);
    if (d) return d;
  }
  const capacidad = interpretarCapacidad(texto, tn, api);
  // «Ármame una red que cubra todo el municipio y con puntos de popularidad mira hasta dónde aguanta antes de
  // quebrarse»: primero el diseño y después las zonas de popularidad y la prueba de estrés (o la rampa)
  if ((capacidad?.tipo === "zonas" || capacidad?.tipo === "estres") && (areaEnTexto(sinTildes(texto)) || CONSTRUIR_RED.test(tn) || MUNICIPIO_ENTERO.test(tn) || TODO_LUGAR.test(tn))) {
    const despues: DespuesDiseno = capacidad.tipo === "zonas" ? { zonas: capacidad.pedido, estres: capacidad.estres } : { zonas: { n: 250 }, estres: capacidad.opciones };
    const d = interpretarDiseno(texto, tn, api, antenas, contexto);
    if (d?.tipo === "disenar") return { ...d, despues };
    if (d?.tipo === "aviso") return d;
    // Sin tamaño ni zona («arma una red en Barranca de Upía con puntos de popularidad»): pregunta el área y lo recuerda
    if (/\b(arm\w*|disen\w*|constru\w*|planific\w*|levant\w*|mont\w*|(hazme|haz|crea\w*) (una|la|otra) (red|malla))\b/.test(tn)) {
      const p = interpretarPedidoDeRed(texto, tn, api, antenas, contexto);
      if (p?.tipo === "pedir-diseno") return { ...p, despues };
    }
  }
  // «Ármame una red de 4 km a la redonda con 80 millones para 300 familias» es un diseño con su gente y su
  // presupuesto, no el dimensionamiento de Trama (que es sin mapa: «dimensiona la red para 5.000 usuarios»)
  if (capacidad?.tipo === "trama-dimensionar" && CONSTRUIR_RED.test(tn) && (areaEnTexto(sinTildes(texto)) || circuloEnTexto(tn) || rectanguloEnTexto(tn) || ladoEnTexto(tn) || MUNICIPIO_ENTERO.test(tn) || TODO_LUGAR.test(tn))) {
    const d = interpretarDiseno(texto, tn, api, antenas, contexto);
    if (d) return d;
  }
  if (capacidad) return capacidad;
  const diseno = interpretarDiseno(texto, tn, api, antenas, contexto);
  if (diseno) return diseno;
  const pedidoRed = interpretarPedidoDeRed(texto, tn, api, antenas, contexto);
  if (pedidoRed) return pedidoRed;
  const objetivo = interpretarAreaObjetivo(texto, tn, api);
  if (objetivo) return objetivo;
  const ajuste = interpretarAjuste(texto, tn, antenas);
  if (ajuste) return ajuste;
  const costo = interpretarCosto(tn, antenas);
  if (costo) return costo;
  const lote = interpretarLote(texto, tn, antenas);
  if (lote) return lote;
  const pantalla = interpretarPantalla(tn);
  if (pantalla) return pantalla;

  // Las piezas también se ponen en un lugar nombrado («pon el gateway en Cumaral»)
  // (y al mover el gateway, el municipio dicho: «mueve el gateway a Cumaral»; «lleva la red a…» es sembrar, no esto)
  const enLugar = coord
    ? null
    : VERBO_AGREGAR.test(tn) && /\b(gateway|getway|repetidor\w*|persona|gente)\b/.test(tn)
      ? ubicacionEnTexto(texto, tn, api, antenas, true)
      : movido?.pasarela || (!movido && /\b(gateway|getway|pasarela)\b/.test(tn.slice(0, iDestino >= 0 ? iDestino : tn.length).replace(/\s(?:a|al|hasta|hacia)\s+.*$/, "")))
        ? lugarDelTraslado(tn, api)
        : null;
  const malla = interpretarMalla(texto, tn, api, coord ?? enLugar, ultimo, movido);
  if (malla) return malla;

  // Órdenes sobre un nodo existente. «Inscribe una antena…» pide un nodo nuevo aunque ya exista uno solo,
  // salvo que se nombre uno existente o se diga «la antena», «este nodo»… v17.4 · El nodo nombrado en el destino
  // («pon una antena cerca del Repetidor 1», «a 2 km al norte del gateway») es la referencia, no el nodo del pedido
  const menciones = mencionesDeNodos(tn, antenas);
  const nombrado = (iDestino >= 0 ? menciones.filter((x) => x.pos < iDestino) : menciones)[0]?.a;
  const pideNuevo = VERBO_AGREGAR.test(tn) && OBJETO.test(tn) && !nombrado && !/\b(la|el|esta|este|esa|ese|su)\s+(antena|nodo|torre)\b/.test(tn);
  // El nodo del pedido es el primero que se nombra («ponle una Yagi a Ejemplo apuntando a Torre NE» → Ejemplo); al
  // moverlo, el que se nombra antes del destino («muévelo cerca del gateway» es el último que se tocó)
  // («lleva el Repetidor 1 hasta Restrepo»: al centro de ese municipio)
  const lugarTraslado = movido && !coord ? lugarDelTraslado(tn, api) : null;
  const seMueve = Boolean(movido) && (SOLO_MOVER.test(tn) || (coord !== null && iDestino >= 0) || lugarTraslado !== null);
  const nodo = pideNuevo ? null : seMueve ? movido! : (nombrado ?? buscarNodo(tn, antenas, sel) ?? (ultimo && CLITICO.test(tn) ? ultimo : null));
  if (nodo) {
    const deltaAltura = cambioDeAltura(tn, nodo.alturaM);
    if (/\b(elimina\w*|borra\w*|quita\w*|suprim\w*|saca\w*)\b/.test(tn) && !/\bpasarela\b/.test(tn) && deltaAltura === null) return { tipo: "eliminar", id: nodo.id };
    if (/\b(duplic\w*|copia\w*|clona\w*)\b/.test(tn)) return { tipo: "duplicar", id: nodo.id };
    if (/^(selecciona\w*|elige|escoge|abre|muestrame|ver|enfoca\w*)\b/.test(tn) && !/\b(perfil|informe|senal|distancia)\b/.test(tn)) return { tipo: "seleccionar", id: nodo.id };
    if (/\b(mueve|mover|muevela|muevelo|muevete|muevele|muevanlo|muevanla|traslad\w*|reubic\w*|desplaz\w*|cambia la ubicacion|cambiar la ubicacion|cambia las coordenadas|cambiar las coordenadas)\b/.test(tn))
      return { tipo: "mover", id: nodo.id, coord: coord ?? lugarDelTraslado(tn, api) ?? undefined };
    // v17.4 · «Pon el Repetidor 1 cerca de la Persona 2», «llévalo a 2 km al norte del gateway», «acerca el Repetidor 1 al
    // gateway»: un nodo que ya existe cambia de sitio (no se pone uno nuevo)
    if (seMueve && (coord ?? lugarTraslado)) return { tipo: "mover", id: nodo.id, coord: (coord ?? lugarTraslado)! };
    // v17.3 · «renómbralo a Loma Alta» (con tilde) y sin la cortesía del final («… a Loma Alta, por favor»: el nombre es «Loma Alta»)
    const sinCortesia = texto.replace(/(?:[\s,]+(?:por favor|porfa|porfavor|gracias|muchas gracias|please|thanks|thank you))+[\s.!]*$/i, "");
    const ren = sinCortesia.match(/(?:ren[oó]mbr\w*|c[aá]mbi\w* (?:el )?nombre(?: de)?|ll[aá]mal[ao])\b.*?\b(?:a|por|como)\s+["“«]?([^"”»,.;]{2,40})["”»]?\s*$/i);
    if (ren) return { tipo: "renombrar", id: nodo.id, nombre: ren[1].trim() };
    if (/\b(como pasarela|sea (la )?pasarela|es la pasarela|hazla pasarela|hazlo pasarela|marca\w* .*pasarela|pon\w* .*pasarela)\b/.test(tn) && !/\b(quita|ya no|no es)\b/.test(tn))
      return { tipo: "editar", id: nodo.id, cambios: { pasarela: true }, descripcion: tx("ahora es pasarela", "now the gateway") };
    if (/\b(quita\w* .*pasarela|ya no (es|sea) pasarela|no es pasarela|sin pasarela)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { pasarela: false }, descripcion: tx("ya no es pasarela", "no longer a gateway") };
    if (/\b(desactiv\w*|exclu\w*|apag\w*|oculta\w*|saca de la simulacion)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { activa: false }, descripcion: tx("quedó fuera de la simulación", "now excluded from the simulation") };
    if (/\b(activ\w*|inclu\w*|enciend\w*|prend\w*)\b/.test(tn) && !/\b(no )?activa la regla\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { activa: true }, descripcion: tx("volvió a la simulación", "back in the simulation") };
    if (/\b(convier\w*|cambi\w* .*tipo|vuelve\w*|hazl[ao])\b.*\b(nodo de campo|nodo|antena|nodo antena)\b/.test(tn)) {
      const t = /nodo antena|\bantena\b/.test(tn.split(/convier\w*|cambi\w*|vuelve\w*|hazl[ao]/).pop() ?? "") ? "antena" : "nodo";
      return { tipo: "editar", id: nodo.id, cambios: { tipo: t }, descripcion: t === "antena" ? tx("ahora es un nodo antena", "now an antenna node") : tx("ahora es un nodo de campo", "now a field node") };
    }
    if (!PREGUNTA.test(tn) && !/\b(informe|reporte|radioenlace|radio enlace|perfil)\b/.test(tn)) {
      // Tipo de antena: «ponle una Yagi a Ejemplo», «Ejemplo con antena sectorial de 120»
      const patron = patronEnTexto(tn);
      const apuntar = /\b(apunt\w*|orient\w*|dirig\w*|gira\w*|azimut)\b/.test(tn);
      const otro = nodosMencionados(tn, antenas).find((x) => x.id !== nodo.id);
      const azimut = otro && apuntar ? Math.round(rumbo(nodo.lat, nodo.lon, otro.lat, otro.lon) * 10) / 10 : azimutEnTexto(texto, tn);
      if (patron && patron !== (nodo.patron ?? "omni")) {
        if (patron === "omni") return { tipo: "editar", id: nodo.id, cambios: { patron: undefined, azimutDeg: undefined, elevacionDeg: undefined }, descripcion: tx("ahora tiene antena omnidireccional", "now with an omnidirectional antenna") };
        const g = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
        const ganancia = g ? num(g[1]) : patronPorId(patron).gananciaTipica;
        const az = azimut ?? nodo.azimutDeg ?? 0;
        const haz = anchosHaz(patron, ganancia);
        return {
          tipo: "editar",
          id: nodo.id,
          cambios: { patron, gananciaDbi: ganancia, equipo: "personalizado", azimutDeg: az, elevacionDeg: nodo.elevacionDeg ?? 0 },
          descripcion: tx(
            `ahora tiene antena ${patronPorId(patron).nombre.toLowerCase()} de ${fn(ganancia)} dBi apuntando a ${rumboTexto(az)}${otro && apuntar ? `, hacia ${otro.nombre}` : ""} (haz de ≈ ${Math.round(haz.h)}°)`,
            `now with a ${nombreAntenaIngles(patron)} antenna of ${fn(ganancia)} dBi pointing at ${rumboTexto(az)}${otro && apuntar ? `, toward ${otro.nombre}` : ""} (≈ ${Math.round(haz.h)}° beam)`,
          ),
        };
      }
      if (apuntar && azimut !== null) {
        if (!esDireccional(nodo)) return { tipo: "apuntar-omni", id: nodo.id, azimutDeg: azimut, destino: otro?.nombre };
        return { tipo: "editar", id: nodo.id, cambios: { azimutDeg: azimut }, descripcion: tx(`apunta a ${rumboTexto(azimut)}${otro ? `, hacia ${otro.nombre}` : ""}`, `pointing at ${rumboTexto(azimut)}${otro ? `, toward ${otro.nombre}` : ""}`) };
      }
      // Inclinación del haz: «inclina Ejemplo 5° hacia abajo»
      const incl = texto.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*(?:°|º|grados?)/i);
      if (incl && /\b(inclin\w*|tilt|elevacion del haz|baja el haz|sube el haz)\b/.test(tn)) {
        let e = num(incl[1]);
        if (/\b(abajo|baja)\b/.test(tn)) e = -Math.abs(e);
        else if (/\b(arriba|sube)\b/.test(tn)) e = Math.abs(e);
        e = Math.min(45, Math.max(-45, e));
        if (!esDireccional(nodo)) return { tipo: "apuntar-omni", id: nodo.id, azimutDeg: nodo.azimutDeg ?? 0 };
        return {
          tipo: "editar",
          id: nodo.id,
          cambios: { elevacionDeg: e },
          descripcion: tx(`el haz queda ${e === 0 ? "horizontal" : `${fn(Math.abs(e))}° hacia ${e < 0 ? "abajo" : "arriba"}`}`, `the beam is now ${e === 0 ? "horizontal" : `${fn(Math.abs(e))}° ${e < 0 ? "down" : "up"}`}`),
        };
      }
    }
    // Sin el nombre del nodo: en «sube el Repetidor 3 como a 12 m», «repetidor» es el nombre, no el rol
    const rol = rolEnTexto(tn.replace(new RegExp(String.raw`\b${escRe(n(nodo.nombre))}\b`, "g"), " ").replace(/\s+/g, " ").trim());
    if (rol)
      return {
        tipo: "editar",
        id: nodo.id,
        cambios: { rol },
        descripcion:
          rol === "REPETIDOR"
            ? tx("queda como repetidor (pasa los paquetes de los demás)", "now a repeater (relays everyone else's packets)")
            : rol === "ROOM_SERVER"
              ? tx("queda como room server (guarda mensajes; no retransmite)", "now a room server (stores messages; doesn't retransmit)")
              : tx("queda como companion (envía y recibe lo suyo; no retransmite)", "now a companion (sends and receives its own; doesn't retransmit)"),
      };
    const eq = equipoEnTexto(tn);
    if (eq) {
      const q = EQUIPOS.find((x) => x.id === eq)!;
      return { tipo: "editar", id: nodo.id, cambios: { equipo: q.id, potenciaDbm: q.potenciaDbm, gananciaDbi: q.gananciaDbi, perdidaCableDb: q.perdidaCableDb }, descripcion: tx(`ahora usa el equipo «${q.nombre}»`, `now using the “${q.nombre}” device`) };
    }
    const alturaTxt = texto.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*s\.?\s*n)/i);
    // v17.4 · «Súbelo 5 m (más)», «bájalo 3 metros», «ponlo 5 m más alto»: se le suma o se le resta a la que tiene
    if (deltaAltura !== null && !/\b(receptor|potencia|ganancia|volumen)\b/.test(tn)) {
      const h = alturaCon(nodo.alturaM, deltaAltura);
      const tope = h !== Math.round((nodo.alturaM + deltaAltura) * 10) / 10;
      return {
        tipo: "editar",
        id: nodo.id,
        cambios: { alturaM: h },
        descripcion: tx(
          `altura ${fn(h)} m (${deltaAltura > 0 ? "subió" : "bajó"} ${fn(Math.abs(h - nodo.alturaM))} m${tope ? `; ${h <= 0.5 ? "lo mínimo es 0,5 m" : "lo máximo es 300 m"}` : ""})`,
          `height ${fn(h)} m (${deltaAltura > 0 ? "up" : "down"} ${fn(Math.abs(h - nodo.alturaM))} m${tope ? `; ${h <= 0.5 ? "the minimum is 0.5 m" : "the maximum is 300 m"}` : ""})`,
        ),
      };
    }
    if (alturaTxt && /\b(altura|sube|subir|subela|subelo|subele|eleva\w*|baja|bajar|bajala|bajalo|bajale|pon\w*|cambi\w*|deja\w*)\b/.test(tn) && !/\breceptor\b/.test(tn))
      return { tipo: "editar", id: nodo.id, cambios: { alturaM: Math.min(300, Math.max(0.5, num(alturaTxt[1]))) }, descripcion: tx(`altura ${fn(num(alturaTxt[1]))} m`, `height ${fn(num(alturaTxt[1]))} m`) };
    const pot = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbm\b/i);
    if (pot && /\b(potencia|pon\w*|cambi\w*|sube|baja)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { potenciaDbm: num(pot[1]), equipo: "personalizado" }, descripcion: tx(`potencia ${f1(num(pot[1]))} dBm`, `power ${f1(num(pot[1]))} dBm`) };
    const gan = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*dbi\b/i);
    if (gan && /\b(ganancia|antena de|pon\w*|cambi\w*)\b/.test(tn)) return { tipo: "editar", id: nodo.id, cambios: { gananciaDbi: num(gan[1]), equipo: "personalizado" }, descripcion: tx(`ganancia ${f1(num(gan[1]))} dBi`, `gain ${f1(num(gan[1]))} dBi`) };
    // «Súbelo», «el Repetidor 1 está muy bajito, súbelo»: sin la altura, la pregunta (con la de ahora y un ejemplo)
    const sinNombre = tn.replace(new RegExp(`\\b${escRe(n(nodo.nombre))}\\b`, "g"), " ");
    if (/\b(sube|subelo|subela|subele|eleva\w*|baja|bajalo|bajala|bajale)\b/.test(tn) && !/\d/.test(sinNombre) && !/\b(potencia|ganancia|volumen)\b/.test(tn)) {
      const sube = /\b(sube|subelo|subela|subele|eleva\w*)\b/.test(tn);
      const sugerida = sube ? Math.min(30, Math.max(6, Math.round(nodo.alturaM) + 6)) : Math.max(2, Math.round(nodo.alturaM) - 4);
      const fem = /^(persona|antena|torre)\b/i.test(nodo.nombre);
      const el = `${fem ? "la" : "el"} ${nodo.nombre}`;
      return {
        tipo: "aviso",
        texto: tx(
          `¿A qué altura ${sube ? "subo" : "bajo"} ${el}? Hoy está a ${fn(nodo.alturaM)} m. Dígame, por ejemplo, «${sube ? "sube" : "baja"} ${el} a ${sugerida} m».`,
          `To what height should I ${sube ? "raise" : "lower"} ${nodo.nombre}? It's at ${fn(nodo.alturaM)} m now. Tell me, for example, “${sube ? "raise" : "lower"} ${nodo.nombre} to ${sugerida} m”.`,
        ),
        acciones: [
          {
            texto: tx(`${sube ? "Subir" : "Bajar"}${fem ? "la" : "lo"} a ${sugerida} m`, `${sube ? "Raise" : "Lower"} it to ${sugerida} m`),
            accion: "orden",
            orden: { tipo: "editar", id: nodo.id, cambios: { alturaM: sugerida }, descripcion: tx(`altura ${sugerida} m`, `height ${sugerida} m`) },
          },
        ],
      };
    }
  }

  // Inscribir un nodo nuevo
  if (VERBO_AGREGAR.test(tn) && OBJETO.test(tn) && !/\b(mide|medir|distancia|perfil)\b/.test(tn)) {
    return { tipo: "agregar", datos: datosNodo(texto, tn), coord: coord ?? ubicacionEnTexto(texto, tn, api, antenas, true) ?? undefined };
  }

  // Protocolo de la malla: MeshCore o Meshtastic (y en Meshtastic, si los equipos de las personas repiten)
  const proto = protocoloEnTexto(tn);
  if (proto) {
    const actual = api.parametros();
    const deAhora = presetPorId(actual.preset).protocolo;
    const cambios: Partial<Parametros> = {};
    const partes: string[] = [];
    if (proto.protocolo && proto.protocolo !== deAhora) {
      cambios.preset = presetEquivalente(actual.preset, proto.protocolo);
      cambios.limiteSaltos = Math.min(actual.limiteSaltos, PROTOCOLOS[proto.protocolo].saltosMax);
      partes.push(tx(`el protocolo a ${PROTOCOLOS[proto.protocolo].nombre} (ajuste ${presetPorId(cambios.preset).nombre})`, `the protocol to ${PROTOCOLOS[proto.protocolo].nombre} (preset ${presetPorId(cambios.preset).nombre})`));
    }
    if (proto.usuariosRepiten !== undefined && (proto.protocolo ?? deAhora) === "meshtastic" && (actual.usuariosRepiten !== false) !== proto.usuariosRepiten) {
      cambios.usuariosRepiten = proto.usuariosRepiten ? undefined : false;
      partes.push(proto.usuariosRepiten ? tx("los equipos de las personas a CLIENT (repiten)", "people's devices to CLIENT (they repeat)") : tx("los equipos de las personas a CLIENT_MUTE (no repiten)", "people's devices to CLIENT_MUTE (they don't repeat)"));
    }
    if (partes.length) return { tipo: "parametros", cambios, descripcion: partes.join(tx(" y ", " and ")) };
    if (proto.protocolo) return { tipo: "aviso", texto: tx(`La red ya está en ${PROTOCOLOS[proto.protocolo].nombre}. ${PROTOCOLOS[proto.protocolo].quienRetransmite}.`, `The network is already on ${PROTOCOLOS[proto.protocolo].nombre}. ${PROTOCOLOS[proto.protocolo].quienRetransmite}.`) };
  }

  // Parámetros de la simulación
  const presetDicho = presetEnTexto(tn);
  // «SF9» en una red Meshtastic es su preset de SF9 (MediumFast); un preset de Meshtastic por su nombre cambia el protocolo
  const preset = presetDicho && !/^MT_/.test(presetDicho) ? presetEquivalente(presetDicho, presetPorId(api.parametros().preset).protocolo) : presetDicho;
  if (preset && /\b(usa|usar|cambia\w*|pon\w*|configura\w*|preset|modo|simula con|prueba con)\b/.test(tn))
    return { tipo: "parametros", cambios: { preset }, descripcion: tx(`el preset a ${presetPorId(preset).nombre}`, `the preset to ${presetPorId(preset).nombre}`) };
  const radio = tn.match(/\bradio(?: de estudio)?\s*(?:de|a|en)?\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:km|kilometros?)\b/);
  if (radio) return { tipo: "parametros", cambios: { radioKm: Math.min(40, Math.max(1, num(radio[1]))) }, descripcion: tx(`el radio de estudio a ${f1(num(radio[1]), 0)} km`, `the study radius to ${f1(num(radio[1]), 0)} km`) };
  const resol = tn.match(/\bresolucion\s*(?:a|en)?\s*(rapida|normal|fina)\b/);
  if (resol) return { tipo: "parametros", cambios: { resolucion: resol[1] as Parametros["resolucion"] }, descripcion: tx(`la resolución a ${resol[1]}`, `the resolution to ${({ rapida: "fast", normal: "normal", fina: "fine" } as Record<string, string>)[resol[1]] ?? resol[1]}`) };
  const saltos = tn.match(/\b(?:limite de saltos|hop ?limit|flood ?max|saltos)\s*(?:a|de|en)?\s*(\d{1,2})\b/);
  if (saltos && /\b(cambia\w*|pon\w*|sube|baja|usa|configura\w*|limite)\b/.test(tn)) {
    const v = Math.min(LIMITE_SALTOS_MAXIMO, Math.max(1, Number(saltos[1])));
    return { tipo: "parametros", cambios: { limiteSaltos: v }, descripcion: tx(`el límite de saltos del diseño a ${v}`, `the design hop limit to ${v}`) };
  }
  const frec = texto.match(/(\d{3}(?:[.,]\d+)?)\s*mhz\b/i);
  if (frec && /\b(frecuencia|canal|cambia\w*|pon\w*|usa)\b/.test(tn)) return { tipo: "parametros", cambios: { frecuenciaMhz: num(frec[1]) }, descripcion: tx(`la frecuencia a ${frec[1]} MHz`, `the frequency to ${frec[1].replace(",", ".")} MHz`) };
  const rx = texto.match(/receptor.*?(\d{1,2}(?:[.,]\d+)?)\s*(?:m|metros?)\b/i);
  if (rx) return { tipo: "parametros", cambios: { alturaRxM: num(rx[1]) }, descripcion: tx(`la altura del receptor a ${rx[1]} m`, `the receiver height to ${rx[1].replace(",", ".")} m`) };
  const extra = texto.match(/p[eé]rdida (?:extra|adicional).*?(\d{1,2}(?:[.,]\d+)?)\s*db\b/i);
  if (extra) return { tipo: "parametros", cambios: { perdidaExtraDb: num(extra[1]) }, descripcion: tx(`la pérdida extra a ${extra[1]} dB`, `the extra loss to ${extra[1].replace(",", ".")} dB`) };
  const ordenRed = interpretarRed(texto, tn, api);
  if (ordenRed) return ordenRed;

  // Distancias, perfiles, señal y ubicación
  const mencionados = nodosMencionados(tn, antenas);
  const ref = (a: Antena): Referencia => ({ tipo: "nodo", id: a.id });
  if (/\b(distancia|cuanto hay|que tan lejos|a cuant\w* (?:km|kilometros|metros)|mide|medir|medi)\b/.test(tn) && !/\b(regla|herramienta)\b/.test(tn)) {
    if (mencionados.length >= 2) return { tipo: "distancia", a: ref(mencionados[0]), b: ref(mencionados[1]) };
    if (mencionados.length === 1 && coord) return { tipo: "distancia", a: ref(mencionados[0]), b: { tipo: "coord", coord } };
  }
  if (/\b(informe|reporte|radioenlace|radio enlace|radio link|calculo del enlace|balance del enlace|presupuesto del enlace)\b/.test(tn) && mencionados.length >= 1) {
    if (mencionados.length >= 2) return { tipo: "informe", a: mencionados[0].id, b: ref(mencionados[1]) };
    if (coord) return { tipo: "informe", a: mencionados[0].id, b: { tipo: "coord", coord } };
  }
  if (/\bperfil\b/.test(tn) && mencionados.length >= 1) {
    if (mencionados.length >= 2) return { tipo: "perfil", a: mencionados[0].id, b: ref(mencionados[1]) };
    if (coord) return { tipo: "perfil", a: mencionados[0].id, b: { tipo: "coord", coord } };
  }
  if (coord && /\b(senal|cobertura|llega|alcanza|margen|recibe|recepcion)\b/.test(tn)) return { tipo: "senal", coord };
  if (/\b(municipio|departamento|en que (lugar|parte|municipio|departamento)|donde (esta|queda|se encuentra))\b/.test(tn)) {
    if (mencionados[0] && !coord) return { tipo: "donde", ref: ref(mencionados[0]) };
    if (coord) return { tipo: "donde", ref: { tipo: "coord", coord } };
  }
  if (/\b(ve a|ve para|ir a|vamos a|vaya a|vaya para|llevame|lleva el mapa|muestrame|mostrar|ubicame|centra\w*|acerca(?!\s+del?\b)\w*|zoom|busca\w*|encuentra|localiza\w*)\b/.test(tn)) {
    if (coord) return { tipo: "ir", coord };
    if (mencionados[0]) return { tipo: "ir", id: mencionados[0].id };
    const consulta = tn
      .replace(/.*\b(ve a|ve para|ir a|vamos a|vaya a|vaya para|lleva el mapa a|lleva el mapa hasta|llevame hasta|llevame a|llevame|muestrame|mostrar|ubicame en|ubicame|centra el mapa en|centra en|centrar en|acercate a|acercame a|acerca el mapa (?:a|hasta|sobre|en)|acerca la vista (?:a|hasta|sobre|en)|(?:haz |hazle |dale |pon |ponle )?zoom (?:a|al|en|sobre|hasta)|busca|buscar|encuentra|localiza)\b/, "")
      .replace(/\b(el|la|los|las|municipio de|departamento de|por favor|porfa|porfavor|en el mapa|mapa)\b/g, " ")
      // v17.6 · Como se dice en el Llano: «Villavo» es Villavicencio
      .replace(/\bvillavo\b/g, "villavicencio")
      .replace(/\s+/g, " ")
      .trim();
    // v17.6 · Con solo «acércate» o «zoom» (sin «ve a», «llévame», «busca»…) tiene que ser un lugar seguro: «acércate que no
    // te oigo» o «the zoom meeting with the bank» son charla, no un lugar por preguntar
    const soloAcercar = !/\b(ve a|ve para|ir a|vamos a|vaya a|vaya para|llevame|lleva el mapa|muestrame|mostrar|ubicame|centra\w*|busca\w*|encuentra|localiza\w*)\b/.test(tn);
    if (soloAcercar && consulta.length >= 3 && !(ESE_LUGAR.test(consulta) && contexto.ultimoLugar)) {
      const dudasAntes = sesionLugares?.dudas.length ?? 0;
      const { lugar } = lugarDeConsulta(consulta, api);
      // Un lugar dudoso no se pregunta: lo dicho no era un lugar
      if (sesionLugares && sesionLugares.dudas.length > dudasAntes) {
        sesionLugares.dudas.length = dudasAntes;
        return null;
      }
      return lugar ? { tipo: "ir", lugar } : null;
    }
    if (consulta.length >= 3) {
      // «Ahí», «ese municipio»: el último lugar del que se habló
      if (ESE_LUGAR.test(consulta) && contexto.ultimoLugar) {
        usarLugar(contexto.ultimoLugar);
        return { tipo: "ir", lugar: contexto.ultimoLugar };
      }
      const { lugar, sugerencias } = lugarDeConsulta(consulta, api);
      return lugar ? { tipo: "ir", lugar } : { tipo: "pedir-lugar", dicho: consulta, original: texto, sugerencias };
    }
  }

  if (/\b(simula|simular|simulalo|simulala|calcula|calcular|recalcula\w*|corre la simulacion|ejecuta la simulacion|actualiza la simulacion|haz la simulacion|realiza la simulacion)\b/.test(tn)) return { tipo: "simular" };
  if (/\b(que|cuales|cuantos|cuantas) (antenas|nodos)\b|\blista\w* (de )?(las |los )?(antenas|nodos)\b|\b(mis|las|los) (antenas|nodos)\b.*\b(hay|tengo)\b/.test(tn)) return { tipo: "listar" };
  // v17.3 · «¿Cuántos repetidores hay?», «¿qué personas tengo?», «¿cuántos gateways hay en el mapa?» (no «¿cuántos necesito…?»)
  const cuantos = tn.match(/\b(?:cuantos|cuantas|que|cuales) (repetidores|personas|usuarios|billeteras|gateways|pasarelas)\b/);
  if (cuantos && /\b(hay|tengo|tenemos|van|quedan|quedaron|tiene la (?:red|malla)|en el mapa|en la (?:red|malla)|puse|pusiste)\b/.test(tn) && !/\b(necesito|necesitamos|necesita|hacen falta|hace falta|se necesitan|requiere\w*|aguanta\w*|soporta\w*|caben|cubrir|sobran|faltan|sin (?:senal|servicio|cobertura)|no tienen|no les)\b/.test(tn) &&
    // v17.3 · Con algo más es otra pregunta («… con señal», «… conectadas», «… en rojo», «… por repetidor», «… tengo que mover»)
    !/\b(con|sin|conectad\w*|desconectad\w*|conexion|senal|cobertura|alcance|rango|cada|rojo|roja|rojos|rojas|amarill\w*|verde\w*|naranja\w*|mover|mueva|muevo|mueve|subir|bajar|cambiar|quitar|eliminar|activ\w*|inactiv\w*|apagad\w*|encendid\w*|prendid\w*|fuera|caid\w*|fall\w*|problema\w*|atiende\w*|sirve\w*|cubre\w*|alcanza\w*|llega\w*|debo|deberia\w*|deben|tengo que|hay que|toca|conviene|recomiend\w*|sugier\w*)\b|\bpor (?!ahora\b|el momento\b|ahorita\b)|\ben (?!el mapa\b|la red\b|la malla\b|total\b|el escenario\b)/.test(tn))
    return { tipo: "listar", filtro: /repetidores/.test(cuantos[1]) ? "repetidores" : /gateways|pasarelas/.test(cuantos[1]) ? "gateways" : "personas" };
  if (/\b(regla|medir distancias?|medir areas?|tomar medidas|medidas)\b/.test(tn)) return { tipo: "herramienta", herramienta: "regla" };
  if (/\b(exporta\w*|descarga\w*|guarda\w*|genera\w*)\b/.test(tn)) {
    if (/\b(kmz|kml|google earth)\b/.test(tn)) return { tipo: "exportar", formato: "kmz" };
    if (/\b(csv|excel)\b/.test(tn)) return { tipo: "exportar", formato: "csv" };
    if (/\b(json|escenario)\b/.test(tn)) return { tipo: "exportar", formato: "json" };
    // Lo que no exporta: lo dice y ofrece lo que sí (sin descargar otra cosa por su cuenta)
    if (/\b(pdf|word|docx|imagen|imagenes|png|jpg|jpeg|foto|captura|pantallazo|powerpoint|presentacion)\b/.test(tn))
      return {
        tipo: "aviso",
        texto: tx(
          "Ese formato no lo exporto. Le puedo dar el KMZ para Google Earth (la cobertura y los nodos), la tabla en CSV para Excel o el escenario completo en JSON para volver a abrirlo. Para un PDF, abra el KMZ en Google Earth o imprima la página del navegador (Ctrl + P).",
          "I don't export that format. I can give you the KMZ for Google Earth (the coverage and the nodes), the CSV table for Excel, or the full scenario in JSON to open it again later. For a PDF, open the KMZ in Google Earth or print the browser page (Ctrl + P).",
        ),
        acciones: [
          { texto: "KMZ (Google Earth)", accion: "orden", orden: { tipo: "exportar", formato: "kmz" } },
          { texto: "CSV (Excel)", accion: "orden", orden: { tipo: "exportar", formato: "csv" } },
          { texto: tx("Escenario (JSON)", "Scenario (JSON)"), accion: "orden", orden: { tipo: "exportar", formato: "json" } },
        ],
      };
  }
  if (coord) return { tipo: "coordenada-sola", coord };
  return null;
}

/* ───────────── Modo «Sembrar la malla» (como en Trama) ───────────── */

const PALABRA_PIEZA: [Pieza, RegExp][] = [
  ["gateway", /\b(gateway|gateways|getway|geteway|internet|starlink)\b/],
  ["repetidor", /\b(repetidor|repetidores|repetidora|repetidoras)\b/],
  ["persona", /\b(persona|personas|gente|familia|familias|casa|casas|vivienda|viviendas|usuario|usuarios|vecino|vecinos|habitante|habitantes|finca)\b/],
];

/** Gateway, repetidor o persona mencionados como pieza nueva (no «Repetidor 2», que es el nombre de un nodo). */
function piezaEnTexto(tn: string, antenas: Antena[]): Pieza | null {
  const otroEquipo = /\b(antena|antenas|nodo|nodos|torre|sensor|equipo|router|pasarela)\b/.test(tn);
  // La pieza que se nombra primero es la que se pone («agrega un repetidor a 8 km al norte del gateway»)
  const orden = PALABRA_PIEZA.map(([pieza, re]) => ({ pieza, re, i: tn.search(re) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  for (const { pieza, re } of orden) {
    const m = tn.match(re);
    if (!m) continue;
    // v17.4 · La que sirve de referencia para el sitio no es la que se pone («agrega … a 2 km al norte del gateway»)
    const antesDe = tn.slice(0, m.index ?? 0);
    if (new RegExp(String.raw`\b(?:(?:al|el|hacia el|hacia)\s+(?:${RUMBOS})\s+(?:del?|de la)|(?:cerca|junto|al lado|lejos|frente|alrededor|enseguida|encima)\s+(?:del?|de la|al|a la)|desde\s+(?:el|la)|entre\s+(?:el|la))\s*$`).test(antesDe)) continue;
    // «Inscribe un nodo antena en mi casa» o «antena con internet» siguen siendo nodos del modo avanzado
    if (otroEquipo && (pieza === "persona" || m[0] === "internet")) continue;
    // «Repetidor 2» o «Persona 3» seguidos de su número son nodos que ya existen (pero en «un repetidor 2 millas al
    // norte» el número es de la medida)
    const resto = tn.slice((m.index ?? 0) + m[0].length);
    const medida = /^\s*\d+(?:[.,]\d+)?\s*(?:km|kms|kilometros?|m|mts?|metros?|millas?|mi|yardas?|yd|pies|ft|cuadras?)\b/.test(resto);
    if (/^\s*\d/.test(resto) && !medida && antenas.some((a) => n(a.nombre) === `${m[0]} ${resto.trim().split(" ")[0]}`)) continue;
    return pieza;
  }
  return null;
}

function interpretarMalla(texto: string, tn: string, api: Api, coord: Coordenada | null, ultimo?: Antena, movido?: Antena): Orden | null {
  if (PREGUNTA.test(tn) && !/\b(puedes|podrias|me ayudas)\b/.test(tn)) return null;
  const antenas = api.antenas();
  // Modo de la pantalla
  if (/\bmodo (avanzado|completo|experto)\b/.test(tn) && !/\bque es\b/.test(tn)) return { tipo: "modo", modo: "avanzado" };
  if (/\b(modo (sembrar|siembra|sencillo|facil|simple|trama)|sembrar la malla|vuelve a sembrar|volver a sembrar)\b/.test(tn) && !/\b(repetidor\w*|hacia|conecta\w*)\b/.test(tn)) return { tipo: "modo", modo: "sembrar" };
  // Animación del flujo de la información
  if (/\b(quita\w*|apaga\w*|desactiva\w*|deten\w*|para|pausa\w*|sin|no quiero)\b.*\b(animacion|animaciones|flujo|parpadeo|destellos)\b/.test(tn)) return { tipo: "vista", cambios: { animarRed: false }, descripcion: tx("quieta, sin la animación del flujo", "still, without the flow animation") };
  if (/\b(anima\w*|activa\w*|enciende|prende|muestra\w*|pon\w*)\b.*\b(animacion|animaciones|flujo|destellos)\b/.test(tn) || /\banima la (red|malla)\b/.test(tn)) return { tipo: "vista", cambios: { animarRed: true }, descripcion: tx("con el flujo animado hacia el gateway", "with the flow animated toward the gateway") };
  // Aceptar o descartar la propuesta del sembrado
  if (api.propuesta()) {
    if (/\b(descart\w*|no los pongas|no la quiero|cancela\w*|olvidalo)\b/.test(tn)) return { tipo: "descartar-siembra" };
    if (/\b(acept\w*|ponlos|ponla|ponlo|ponerlos|instalalos|pon los propuestos|confirm\w*|dale|hazlo|si,? pon\w*)\b/.test(tn) || (/\bpropuest\w*/.test(tn) && /\b(pon\w*|instal\w*|deja\w*|usa\w*)\b/.test(tn))) return { tipo: "aceptar-siembra" };
  }
  // Enviar un mensaje de prueba (un pago, un WhatsApp o una consulta a la IA) por la malla
  if (/\b(envi\w*|mand\w*|prueb\w*|simul\w*|haz|hace\w*)\b.*\b(mensaje|mensajes|sms|texto|sos|alerta|chat|whatsapp|pago|pagos|transaccion|transferencia|giro)\b/.test(tn)) {
    const desde = nodosMencionados(tn, antenas)[0] ?? piezaGenerica(tn.replace(/.*\b(desde|de)\b/, " $1 "), antenas, ultimo);
    return { tipo: "mensaje", id: desde?.id };
  }
  // Sembrado automático: «conecta a los que faltan», «siembra repetidores hacia…», «lleva la red a…»
  const sembrar = /\b(siembra|siembrame|siembre|sembrar|conecta|conectame|conectalos|conectalas|conectala|conectalo|conectar|conecte|conectelos|conectelas|conectela|conectelo|lleva\w* la (red|malla|senal|cobertura)|llevar la (red|malla|senal|cobertura)|extiend\w* la (red|malla)|ampli\w* la (red|malla))\b/.test(tn);
  if (sembrar && !/\b(internet|starlink|pc|computador|celular)\b.*\bconecta/.test(tn)) {
    if (/\b(faltan|falta|sin cobertura|sin senal|rojas?|rojos?|desconectad\w*|aislad\w*|todas? las personas|todos|toda la gente)\b/.test(tn)) return { tipo: "sembrar", destino: "faltantes" };
    if (coord) return { tipo: "sembrar", destino: { coord, nombre: tx("El punto pedido", "The requested point") } };
    const persona = nodosMencionados(tn, antenas).find((a) => !a.pasarela);
    if (persona) return { tipo: "sembrar", destino: { id: persona.id } };
    // v17.5 · «Siembra una malla alrededor del gateway»: desde el gateway, hacia los que faltan (no un lugar llamado así)
    if (/\b(gateway|gateways|pasarela)\b/.test(tn)) return { tipo: "sembrar", destino: "faltantes" };
    const consulta = tn.replace(/.*\b(hacia|hasta|a)\b\s+/, "").replace(/\b(el|la|los|las|municipio de|por favor|porfa)\b/g, " ").replace(/\s+/g, " ").trim();
    if (consulta.length >= 3) {
      const { lugar } = lugarDeConsulta(consulta, api);
      if (lugar) return { tipo: "sembrar", destino: { coord: { lat: lugar.lat, lon: lugar.lon }, nombre: lugar.nombre } };
    }
    if (/\b(siembra|siembrame|siembre|sembrar)\b/.test(tn)) return { tipo: "sembrar", destino: "faltantes" };
  }
  // «Pon a Persona 1 como repetidor» cambia el rol de un nodo que ya existe: no pone una pieza nueva
  if (/\bcomo (un |una )?(repetidor\w*|companion|room server|cliente|billetera)\b|\b(rol|retransmit\w*)\b/.test(tn) && nodosMencionados(tn, antenas).length) return null;
  // Poner una pieza: «pon el gateway en…», «agrega un repetidor en… a 20 m», «pon una persona en…»
  const pieza = piezaEnTexto(tn, antenas);
  // v17.4 · Un nodo que ya existe y se nombra antes del destino es el que se mueve («mueve/pon el Repetidor 1 cerca del
  // gateway» no mueve el gateway): el gateway solo se mueve si es él el que se nombra primero
  if (pieza && movido && piezaDe(movido) !== pieza && !movido.pasarela) return null;
  const iGateway = tn.search(/\b(gateway|getway|pasarela)\b/);
  const primero = mencionesDeNodos(tn, antenas)[0];
  const esElGateway = !primero || primero.a.pasarela || primero.pos >= iGateway;
  const moverGateway = pieza === "gateway" && /\b(mueve|mover|muevelo|traslad\w*|cambia\w* .*(sitio|lugar|ubicacion))\b/.test(tn) && esElGateway;
  // (v17.4: «llévame a Villa Nueva casa nare» es ir a un lugar, aunque traiga «nueva» y «casa»)
  const irA = /^\s*(?:llevame|ubicame|ve a|vamos a|busca|buscame|encuentra|encuentrame|localiza)\b/.test(tn);
  if (pieza && !irA && (VERBO_AGREGAR.test(tn) || moverGateway) && !/\b(mide|medir|distancia|perfil|senal en)\b/.test(tn)) {
    const datos: DatosNodo = {};
    const nombre = nombreNuevo(texto);
    if (nombre) datos.nombre = nombre;
    // La altura no es la distancia de la posición («a 800 m al este del Repetidor 1») ni un radio («500 m a la redonda»)
    const sinDistancias = texto
      .replace(new RegExp(String.raw`\d{1,4}(?:[.,]\d+)?\s*(?:m|mts?|metros?)\b\s*(?:hacia\s+)?(?:al|el|del|hacia)\s+(?:${RUMBOS})\b`, "gi"), " ")
      .replace(/\d{1,4}(?:[.,]\d+)?\s*(?:m|mts?|metros?)\s*(?:a la redonda|de radio|alrededor)/gi, " ");
    const altura = sinDistancias.match(/(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts?|metros?)\b(?!\s*s\.?\s*n)/i);
    if (altura) datos.alturaM = Math.min(300, Math.max(0.5, num(altura[1])));
    return { tipo: "pieza", pieza, coord: coord ?? undefined, datos, mover: moverGateway };
  }
  // «¿Qué hago ahora?» con la red sembrada
  if (/\b(que hago ahora|que sigue|siguiente paso|que me falta|que falta)\b/.test(tn)) return { tipo: "que-hago" };
  return null;
}

/** Texto de la propuesta del sembrado automático, con los botones para ponerla o descartarla. */
function textoSiembra(s: Siembra, destinos: DestinoSiembra[]): Respuesta {
  const n = s.puntos.length;
  const resultado = s.destinos
    .map((d, i) => {
      const saltos = s.saltos?.[i];
      return tx(
        `${destinos[i]?.nombre ?? "El punto"} ${d.llega ? `quedaría con ${f1(d.margenDb, 0)} dB desde ${d.desde}${saltos ? `, a ${saltos} ${saltos === 1 ? "salto" : "saltos"} del gateway` : ""}` : `no se alcanza: ${d.motivo}`}`,
        `${destinos[i]?.nombre ?? "The point"} ${d.llega ? `would get ${f1(d.margenDb, 0)} dB from ${d.desde}${saltos ? `, ${saltos} ${saltos === 1 ? "hop" : "hops"} from the gateway` : ""}` : `can't be reached: ${d.motivo}`}`,
      );
    })
    .join("; ");
  const subio = s.alturaM !== undefined && s.alturaPedidaM !== undefined && s.alturaM > s.alturaPedidaM;
  if (!n) {
    const algun = s.destinos.some((d) => d.llega);
    return {
      texto: algun ? tx(`No hace falta ningún repetidor: ${resultado}.`, `No repeater is needed: ${resultado}.`) : tx(`No encontré cómo llegar: ${resultado}`, `I found no way to get there: ${resultado}`),
      acciones: algun && destinos.some((d) => !d.antena) ? [{ texto: tx("Poner una persona ahí", "Place a person there"), accion: "orden", orden: { tipo: "aceptar-siembra" } }] : undefined,
    };
  }
  const lista = s.puntos.map((q, k) => tx(`Propuesto ${k + 1} a ${f1(q.distanciaKm)} km de ${q.desde} (${f1(q.margenDb, 0)} dB, suelo a ${Math.round(q.sueloM)} m)`, `Proposed ${k + 1}, ${f1(q.distanciaKm)} km from ${q.desde} (${f1(q.margenDb, 0)} dB, ground at ${Math.round(q.sueloM)} m)`)).join("; ");
  return {
    texto: tx(
      `Propongo ${n === 1 ? "un repetidor" : `${n} repetidores`}${s.alturaM ? ` en torre de ${fn(s.alturaM)} m` : ""}: ${lista}. ${resultado}.${subio ? ` Con torres de ${fn(s.alturaPedidaM!)} m la ruta pasaba del límite de saltos, así que subí a ${fn(s.alturaM!)} m para dar pasos más largos.` : ""} Los ve en el mapa como torres naranjas punteadas; busqué las lomas con enlace sólido (≥ 30 dB). Revise el sitio y el acceso en campo antes de instalar.`,
      `I propose ${n === 1 ? "one repeater" : `${n} repeaters`}${s.alturaM ? (n === 1 ? ` on ${articuloIngles(fn(s.alturaM))} ${fn(s.alturaM)} m tower` : ` on ${fn(s.alturaM)} m towers`) : ""}: ${lista}. ${resultado}.${subio ? ` With ${fn(s.alturaPedidaM!)} m towers the route went over the hop limit, so I raised them to ${fn(s.alturaM!)} m for longer hops.` : ""} You'll see them on the map as dotted orange towers; I looked for hills with a solid link (≥ 30 dB). Check the site and the access in the field before installing.`,
    ),
    acciones: [
      { texto: tx(`Poner ${n === 1 ? "el repetidor" : `los ${n} repetidores`}`, `Place ${n === 1 ? "the repeater" : `the ${n} repeaters`}`), accion: "orden", orden: { tipo: "aceptar-siembra" } },
      { texto: tx("Descartar", "Discard"), accion: "orden", orden: { tipo: "descartar-siembra" } },
    ],
  };
}

/** Resumen corto de la red sembrada: personas conectadas, sin cobertura y territorio cubierto. */
export function textoRed(r: EstadoRed, limiteSaltos: number): string {
  if (!r.gateways.length) return tx("Aún no hay gateway: es el primer paso, el sitio donde entra el internet.", "There's no gateway yet: it's the first step, the site where the internet comes in.");
  if (!r.alDia) return tx("La red se está calculando.", "The network is being calculated.");
  const partes = [tx(`${r.conectadas.length} de ${r.personas.length} ${r.personas.length === 1 ? "persona conectada" : "personas conectadas"}`, `${r.conectadas.length} of ${r.personas.length} ${r.personas.length === 1 ? "person connected" : "people connected"}`)];
  if (r.sinCobertura.length) partes.push(tx(`${r.sinCobertura.length} sin cobertura (${r.sinCobertura.map((a) => a.nombre).join(", ")})`, `${r.sinCobertura.length} without coverage (${r.sinCobertura.map((a) => a.nombre).join(", ")})`));
  if (r.lejos.length) partes.push(tx(`${r.lejos.length} con más de ${limiteSaltos} saltos`, `${r.lejos.length} more than ${limiteSaltos} hops away`));
  if (r.aislados.length)
    partes.push(
      tx(
        `${r.aislados.length === 1 ? "un repetidor" : `${r.aislados.length} repetidores`} sin red (${r.aislados.map((a) => a.nombre).join(", ")})`,
        `${r.aislados.length === 1 ? "one repeater" : `${r.aislados.length} repeaters`} cut off from the network (${r.aislados.map((a) => a.nombre).join(", ")})`,
      ),
    );
  partes.push(tx(`${f1(r.areaKm2, r.areaKm2 < 10 ? 1 : 0)} km² cubiertos`, `${f1(r.areaKm2, r.areaKm2 < 10 ? 1 : 0)} km² covered`));
  return tx(`La red: ${partes.join(", ")}.`, `The network: ${partes.join(", ")}.`);
}

/** Parámetros de red (como en Radio Mobile), entorno, modelo y vista del mapa de señal. */
function interpretarRed(texto: string, tn: string, api: Api): Orden | null {
  if (PREGUNTA.test(tn)) return null;
  const p = api.parametros();
  const verbo = /\b(usa\w*|cambia\w*|pon\w*|configura\w*|simula\w*|prueba\w*|calcula\w*|activa\w*|selecciona\w*|elige|escoge|aplica\w*|considera\w*|toma\w*|agrega\w*|suma\w*|quiero|necesito|deja\w*|con|en|a)\b/;
  // Restablecer los parámetros de Radio Mobile
  if (/\b(restablec\w*|reinici\w*|vuelve\w*|devuelve\w*|regresa\w*|resetea\w*|valores? (de|por) (defecto|referencia)|como (estaba|en las pruebas))\b/.test(tn) && /\b(parametro\w*|radio mobile|red|propagacion|referencia)\b/.test(tn))
    return {
      tipo: "parametros",
      cambios: { ...RED_REFERENCIA },
      descripcion: tx("los parámetros de red a los de Radio Mobile (ecuatorial, vertical, suelo promedio, N = 360, móvil 50 % / 70 %)", "the network parameters to Radio Mobile's (equatorial, vertical, average ground, N = 360, mobile 50% / 70%)"),
    };
  // Modelo
  if (/\b(longley\w*|itm|irregular terrain)\b/.test(tn) && verbo.test(tn) && p.modelo !== "itm") return { tipo: "parametros", cambios: { modelo: "itm" }, descripcion: tx("el modelo a Longley-Rice (ITM), como Radio Mobile", "the model to Longley-Rice (ITM), as in Radio Mobile") };
  if (/\b(modelo calibrado|calibrado)\b/.test(tn) && verbo.test(tn) && p.modelo !== "calibrado") return { tipo: "parametros", cambios: { modelo: "calibrado" }, descripcion: tx("el modelo al calibrado (recomendado)", "the model to the calibrated one (recommended)") };
  // Polarización
  if (/\bpolariz\w*/.test(tn)) {
    const pol = /\bhorizontal\w*/.test(tn) ? "horizontal" : /\bvertical\w*/.test(tn) ? "vertical" : null;
    if (pol) return { tipo: "parametros", cambios: { polarizacion: pol }, descripcion: tx(`la polarización a ${pol}`, `the polarization to ${pol}`) };
  }
  // Clima
  if (/\bclima\b/.test(tn)) {
    const c = climaEnTexto(tn);
    const datos = CLIMAS.find((x) => x.id === c);
    if (datos)
      return {
        tipo: "parametros",
        cambios: { clima: datos.id, refractividad: datos.refractividad },
        descripcion: tx(`el clima a ${datos.nombre.toLowerCase()} (refractividad N = ${datos.refractividad})`, `the climate to ${datos.nombre.toLowerCase()} (refractivity N = ${datos.refractividad})`),
      };
  }
  // Refractividad
  const nref = tn.match(/\brefractividad\b\D{0,12}(\d{3})\b/);
  if (nref) return { tipo: "parametros", cambios: { refractividad: Math.min(400, Math.max(250, Number(nref[1]))) }, descripcion: tx(`la refractividad a N = ${nref[1]}`, `the refractivity to N = ${nref[1]}`) };
  // Suelo
  if (/\b(suelo|terreno|tierra)\b/.test(tn) && /\b(suelo|conductividad|permitividad)\b|\bterreno (humedo|seco|arenoso|pobre|bueno|promedio)\b/.test(tn)) {
    const sid = sueloEnTexto(tn.replace(/.*\b(suelo|terreno|tierra)\b/, ""));
    const x = SUELOS.find((q) => q.id === sid);
    if (x)
      return {
        tipo: "parametros",
        cambios: { suelo: x.id, permitividad: x.permitividad, conductividad: x.conductividad },
        descripcion: tx(`el suelo a ${x.nombre.toLowerCase()} (εr ${x.permitividad}, σ ${String(x.conductividad).replace(".", ",")} S/m)`, `the ground to ${x.nombre.toLowerCase()} (εr ${x.permitividad}, σ ${String(x.conductividad)} S/m)`),
      };
  }
  // Modo estadístico
  const modo = tn.match(/\bmodo (?:estadistico |de variabilidad )?(movil|accidental|puntual|spot|difusion|broadcast)\b/);
  if (modo) {
    const id: VariabilidadId = modo[1] === "spot" ? "puntual" : modo[1] === "broadcast" ? "difusion" : (modo[1] as VariabilidadId);
    const nombre = VARIABILIDADES.find((v) => v.id === id)?.nombre.toLowerCase();
    return { tipo: "parametros", cambios: { variabilidad: id }, descripcion: tx(`el modo estadístico a ${nombre}`, `the statistical mode to ${nombre}`) };
  }
  // Confiabilidad: «confiabilidad alta», «confiabilidad del 90 %», «95 % del tiempo», «80 % de las situaciones»
  const pctTiempo = tn.match(/(\d{1,2}(?:[.,]\d+)?)\s*%?\s*(?:por ciento )?(?:del|de el)? ?tiempo\b/);
  const pctSit = tn.match(/(\d{1,2}(?:[.,]\d+)?)\s*%?\s*(?:por ciento )?(?:de (?:las )?)?situaciones\b/);
  const pctUbi = tn.match(/(\d{1,2}(?:[.,]\d+)?)\s*%?\s*(?:por ciento )?(?:de (?:las |los )?)?(?:ubicaciones|lugares|sitios)\b/);
  if (pctTiempo || pctSit || pctUbi) {
    const cambios: Partial<Parametros> = {};
    const partes: string[] = [];
    const lim = (x: string) => Math.min(99, Math.max(1, num(x)));
    if (pctTiempo) {
      cambios.tiempoPct = lim(pctTiempo[1]);
      partes.push(tx(`${fn(cambios.tiempoPct)} % del tiempo`, `${fn(cambios.tiempoPct)}% of the time`));
    }
    if (pctUbi) {
      cambios.ubicacionesPct = lim(pctUbi[1]);
      partes.push(tx(`${fn(cambios.ubicacionesPct)} % de las ubicaciones`, `${fn(cambios.ubicacionesPct)}% of locations`));
    }
    if (pctSit) {
      cambios.situacionesPct = lim(pctSit[1]);
      partes.push(tx(`${fn(cambios.situacionesPct)} % de las situaciones`, `${fn(cambios.situacionesPct)}% of situations`));
    }
    return { tipo: "parametros", cambios, descripcion: tx(`la confiabilidad a ${partes.join(", ")}`, `the reliability to ${listaIngles(partes)}`) };
  }
  if (/\bconfiabilidad\b|\bconfiable al\b/.test(tn)) {
    const pct = texto.match(/(\d{1,2}(?:[.,]\d+)?)\s*(?:%|por ciento)/i) ?? tn.match(/\bconfiab\w*\s+(?:del?|al?)\s+(\d{1,2}(?:[.,]\d+)?)\b/);
    const nivel = /\bmuy alta\b/.test(tn) ? CONFIABILIDADES[2] : /\balta\b/.test(tn) ? CONFIABILIDADES[1] : /\b(normal|baja|estandar|de radio mobile)\b/.test(tn) ? CONFIABILIDADES[0] : null;
    if (pct) {
      const v = Math.min(99, Math.max(1, num(pct[1])));
      return { tipo: "parametros", cambios: { tiempoPct: v, ubicacionesPct: v, situacionesPct: v }, descripcion: tx(`la confiabilidad al ${fn(v)} % (tiempo, ubicaciones y situaciones)`, `the reliability to ${fn(v)}% (time, locations and situations)`) };
    }
    if (nivel) {
      const detalle = `${nivel.descripcion.charAt(0).toLowerCase()}${nivel.descripcion.slice(1).replace(/\.$/, "")}`;
      return {
        tipo: "parametros",
        cambios: { tiempoPct: nivel.tiempoPct, ubicacionesPct: nivel.ubicacionesPct, situacionesPct: nivel.situacionesPct },
        descripcion: tx(`la confiabilidad a ${nivel.nombre.toLowerCase()}: ${detalle}`, `the reliability to ${nivel.nombre.toLowerCase()}: ${detalle}`),
      };
    }
  }
  // Entorno (vegetación o construcciones)
  const ent = entornoEnTexto(tn);
  if (ent && (/\b(entorno|zona|area|region|simula\w*|considera\w*|hay|con|pon\w*|cambia\w*|agrega\w*|suma\w*|incluye|usa\w*|esta en|estan en|dentro de|bajo|entre)\b/.test(tn)) && !/\b(ve a|ir a|llevame|busca\w*)\b/.test(tn)) {
    const e = entornoPorId(ent);
    const perdida = perdidaEntorno(ent, p.alturaRxM, p.frecuenciaMhz);
    return {
      tipo: "parametros",
      cambios: { entorno: ent },
      descripcion:
        ent === "abierto"
          ? tx("el entorno a campo abierto (sin pérdidas por vegetación ni edificios)", "the environment to open field (no losses from vegetation or buildings)")
          : tx(
              `el entorno a ${e.nombre.toLowerCase()}: ≈ ${f1(perdida)} dB menos para el receptor a ${fn(p.alturaRxM)} m y para los equipos por debajo de ${fn(e.alturaM)} m`,
              `the environment to ${e.nombre.toLowerCase()}: ≈ ${f1(perdida)} dB less for the receiver at ${fn(p.alturaRxM)} m and for equipment below ${fn(e.alturaM)} m`,
            ),
    };
  }
  // Vista del mapa de señal: unidades y escala de colores
  const mostrar = /\b(muestra\w*|mostrar|ver|veo|pinta\w*|expresa\w*|unidad\w*|cambia\w*|pon\w*|usa\w*|quiero|dame|en|colores?|escala)\b/.test(tn);
  const unidad = unidadEnTexto(texto, tn);
  const cambios: CambiosVista = {};
  const partes: string[] = [];
  if (unidad && mostrar && /\b(en|a|unidad\w*|muestra\w*|ver|pinta\w*|expresa\w*)\b/.test(tn)) {
    cambios.unidad = unidad;
    partes.push(
      {
        margen: tx("como margen en dB", "as margin in dB"),
        dbm: tx("en dBm", "in dBm"),
        uv: tx("en microvoltios (µV)", "in microvolts (µV)"),
        dbuvm: tx("como campo en dBµV/m", "as field strength in dBµV/m"),
      }[unidad],
    );
  }
  const s = presetPorId(p.preset).sensibilidadDbm;
  let escala: EscalaSenal | null = /\barco ?iris\b|\brainbow\b|\bdegradado\b/.test(tn) ? "arcoiris" : /\bumbral\b/.test(tn) && !/\bservicio\b/.test(tn) ? "umbral" : /\b(por clases|en clases|clases|colores de radio mobile|colores normales)\b/.test(tn) ? "clases" : null;
  const niveles = nivelesEnTexto(texto, s);
  if (escala === "arcoiris") {
    cambios.escala = "arcoiris";
    if (niveles.length >= 2) {
      cambios.escalaMinDbm = Math.min(niveles[0], niveles[1]);
      cambios.escalaMaxDbm = Math.max(niveles[0], niveles[1]);
    }
    partes.push(tx("con colores arcoíris", "with rainbow colors"));
  } else if (escala === "umbral") {
    cambios.escala = "umbral";
    if (niveles.length) cambios.umbralDbm = niveles[0];
    const nivel = niveles.length ? textoNivel(niveles[0], unidad ?? "dbm", { sensibilidadDbm: s, gananciaRxDbi: p.gananciaRxDbi, frecuenciaMhz: p.frecuenciaMhz }, 1) : "";
    partes.push(tx(`solo donde la señal supera el umbral${niveles.length ? ` de ${nivel}` : ""}`, `only where the signal exceeds the threshold${niveles.length ? ` of ${nivel}` : ""}`));
  } else if (escala === "clases") {
    cambios.escala = "clases";
    partes.push(tx("con las clases de Radio Mobile", "with the Radio Mobile classes"));
  } else escala = null;
  if (Object.keys(cambios).length) {
    cambios.modo = "senal";
    return { tipo: "vista", cambios, descripcion: partes.join(" ") };
  }
  return null;
}

/* ───────────── Ejecución ───────────── */

export type ResultadoOrden = Respuesta & {
  deshacer?: Escenario;
  esperar?: string;
  pendiente?: Pendiente;
  luego?: Promise<Respuesta>;
  /** Nodo que puso o cambió la orden (para «súbelo», «muévelo»… en la siguiente). */
  nodo?: string;
  /** Lugar de la orden (para «ahí», «ese municipio», «todo el municipio» en la siguiente). */
  lugar?: Lugar;
  /** Melki llega volando al sitio (en vez del punto rojo) y escribe en su nube qué hay ahí. */
  llegada?: LlegadaMelki;
};

/**
 * Melki llega volando a donde se le pidió ir: un lugar (lo saluda), una coordenada o una antena (la señala). Lo que
 * escribe en su nube, con sus datos (solo los reales: del lugar, de la antena o de la última simulación); el saludo con
 * el trato de la persona lo pone la conversación. `voz`: lo que dice en voz alta, si no es lo mismo que escribe (en una
 * coordenada no deletrea los grados). Si el robot no puede volar (el mapa no está listo), queda el punto marcado de
 * siempre (`marca`).
 */
export type LlegadaMelki = {
  lat: number;
  lon: number;
  gesto: "saludando" | "senalando";
  etiqueta: string;
  titulo: string;
  subtitulo?: string;
  parrafos: string[];
  datos?: CifraPitch[];
  voz?: string;
  marca?: { titulo: string; tarjeta: boolean };
};

/** El tono de una señal (margen en dB) en los datos de la nube: confiable, con servicio o sin él. */
const tonoMargen = (m: number): CifraPitch["tono"] => (m >= UMBRAL_CONFIABLE_DB ? "bien" : m >= UMBRAL_SERVICIO_DB ? "alerta" : "mal");

/** Los datos de una coordenada: la señal ahí con la última simulación (si la cubre) y el nodo más cercano. */
function datosCoordenada(api: Api, lat: number, lon: number): { datos: CifraPitch[]; senal: string } {
  const datos: CifraPitch[] = [];
  let senal = "";
  const r = api.resultado();
  const m = r ? margenEnPunto(r, lat, lon) : NaN;
  if (r && Number.isFinite(m)) {
    const clase = CLASES.find((c) => m >= c.minimoDb) ?? CLASES[CLASES.length - 1];
    datos.push({ etiqueta: tx("Señal aquí", "Signal here"), valor: `${Math.round(m)} dB`, detalle: `${clase.nombre} · ≈ ${Math.round(m + r.sensibilidadDbm)} dBm`, tono: tonoMargen(m) });
    senal =
      m >= UMBRAL_SERVICIO_DB
        ? tx(` Con la última simulación aquí la señal llega con ${Math.round(m)} decibeles de margen: ${clase.nombre.toLowerCase()}.`, ` With the last simulation, the signal reaches this spot with ${Math.round(m)} decibels of margin: ${clase.nombre.toLowerCase()}.`)
        : tx(" Con la última simulación aquí todavía no llega señal.", " With the last simulation, no signal reaches this spot yet.");
  }
  const antenas = api.antenas();
  if (antenas.length) {
    const cerca = antenas.map((a) => ({ a, d: distanciaM(lat, lon, a.lat, a.lon) })).sort((x, y) => x.d - y.d)[0];
    datos.push({ etiqueta: tx("Nodo más cercano", "Nearest node"), valor: cerca.a.nombre, detalle: tx(`a ${formatoDistancia(cerca.d)}`, `${formatoDistancia(cerca.d)} away`) });
  }
  return { datos, senal };
}

/** Los datos de un municipio: su área, su departamento y cuántos nodos del escenario hay dentro. */
function datosMunicipio(l: Lugar, area: number, contorno: Poligono, antenas: Antena[]): CifraPitch[] {
  const [ha, km] = (textoArea(area).match(/^(.*?)(?: \((.*)\))?$/) ?? []).slice(1);
  const dentro = antenas.filter((a) => dentroPoligono(a.lon, a.lat, contorno)).length;
  return [
    { etiqueta: tx("Área", "Area"), valor: ha || textoArea(area), detalle: km },
    { etiqueta: tx("Departamento", "Department"), valor: l.detalle },
    {
      etiqueta: tx("Nodos en el municipio", "Nodes in the municipality"),
      valor: String(dentro),
      detalle: dentro ? tx("del escenario, dentro de su contorno", "from the scenario, inside its boundary") : tx("todavía no hay red aquí", "no network here yet"),
      tono: dentro ? undefined : "alerta",
    },
  ];
}

/** Los datos de una antena: su altura y su potencia y, con la última simulación, su alcance, sus enlaces y su ruta. */
function datosAntena(api: Api, a: Antena): CifraPitch[] {
  const r = api.resultado();
  const res = r?.antenas.find((x) => x.id === a.id);
  const datos: CifraPitch[] = [
    { etiqueta: tx("Altura de la antena", "Antenna height"), valor: `${fn(a.alturaM)} m`, detalle: res ? tx(`sobre un terreno a ${Math.round(res.elevacionM)} m s. n. m.`, `on terrain at ${Math.round(res.elevacionM)} m above sea level`) : undefined },
  ];
  if (!r || !res) {
    datos.push({ etiqueta: tx("Potencia", "Power"), valor: `${fn(a.potenciaDbm)} dBm`, detalle: tx(`antena de ${fn(a.gananciaDbi)} dBi`, `${fn(a.gananciaDbi)} dBi antenna`) });
    return datos;
  }
  datos.push({ etiqueta: tx("Alcance con servicio", "Range with service"), valor: `${f1(res.alcanceKm)} km`, detalle: tx(`confiable hasta ${f1(res.alcanceConfiableKm)} km`, `reliable up to ${f1(res.alcanceConfiableKm)} km`) });
  const enlaces = r.enlaces.filter((e) => (e.a === a.id || e.b === a.id) && e.margen >= UMBRAL_SERVICIO_DB);
  const mejor = enlaces.length ? Math.max(...enlaces.map((e) => e.margen)) : NaN;
  // (un enlace es sólido desde 30 dB, como en el mapa de la malla)
  datos.push({
    etiqueta: tx("Enlaces", "Links"),
    valor: String(enlaces.length),
    detalle: enlaces.length ? tx(`el mejor con ${Math.round(mejor)} dB de margen`, `the best one with ${Math.round(mejor)} dB of margin`) : tx("sin enlace con la malla", "no link to the mesh"),
    tono: !enlaces.length ? "mal" : mejor >= ENLACES.solido.minimoDb ? "bien" : "alerta",
  });
  const nodo = r.nodos.find((x) => x.id === a.id);
  if (a.pasarela) datos.push({ etiqueta: tx("Área con servicio", "Area with service"), valor: `${f1(res.areaServicioKm2)} km²`, detalle: tx("la entrada de la red a internet", "the network's way into the internet") });
  else if (nodo)
    datos.push({
      etiqueta: tx("Saltos al gateway", "Hops to the gateway"),
      valor: nodo.saltos === null ? tx("Sin ruta", "No route") : String(nodo.saltos),
      detalle: nodo.saltos === null ? tx("no llega al gateway", "doesn't reach the gateway") : nodo.critico ? tx("punto único de falla", "single point of failure") : undefined,
      tono: nodo.saltos === null ? "mal" : nodo.critico ? "alerta" : "bien",
    });
  return datos;
}

function textoCoord(c: { lat: number; lon: number }) {
  return `${aGMS(c.lat, "lat")}, ${aGMS(c.lon, "lon")} (${aDecimal(c.lat)}, ${aDecimal(c.lon)})`;
}
/** El municipio del punto («, en Cumaral (Meta)»), salvo que la referencia ya lo diga («en Cumaral (Meta)»). */
const sufijoLugar = (c: Coordenada, lugar: string | null) => (lugar && !(c.desde && /^(?:en|in) /.test(c.desde)) ? tx(`, en ${lugar}`, `, in ${lugar}`) : "");
/** v17.4 · «a 200 m al noreste de Gateway (4.2008, -73.3984)» o, sin referencia, «a 4° 12′ … (4.2, -73.4)». */
function textoDestino(c: Coordenada, moviendo = false): string {
  if (c.desde) {
    // Al mover a un municipio: «a Restrepo (Meta)», «to Restrepo (Meta)»
    const desde = moviendo ? c.desde.replace(/^en /, "a ").replace(/^in /, "to ") : c.desde;
    return tx(`${desde.startsWith("a ") || desde.startsWith("en ") ? desde : `a ${desde}`} (${aDecimal(c.lat)}, ${aDecimal(c.lon)})`, `${desde} (${aDecimal(c.lat)}, ${aDecimal(c.lon)})`);
  }
  return tx(`a ${textoCoord(c)}`, `to ${textoCoord(c)}`);
}

/** Cómo se escribe una coordenada (el ejemplo que da Melki). */
const ejemploCoord = () => tx("4.5123, -73.1234 o 4°30'44\" N, 73°07'24\" O", "4.5123, -73.1234 or 4°30'44\" N, 73°07'24\" W");

/** Ejecuta la orden; si entendió un lugar mal dicho, lo dice primero («Entendí «Barranca de Upía (Meta)».»). */
export function ejecutarOrden(o: Orden, api: Api): ResultadoOrden {
  const r = ejecutarOrdenBase(o, api);
  // Al ir a un lugar la respuesta ya dice su nombre: no hace falta «Entendí…»
  const nota = o.nota && o.tipo !== "ir" ? o.nota : "";
  return { ...r, ...(nota ? { texto: `${nota} ${r.texto}` } : {}), ...(o.lugarUsado && !r.lugar ? { lugar: o.lugarUsado } : {}) };
}

function ejecutarOrdenBase(o: Orden, api: Api): ResultadoOrden {
  const antenas = api.antenas();
  const porId = new Map(antenas.map((a) => [a.id, a]));
  const antes = api.instantanea();
  const puntoDe = (r: Referencia) => (r.tipo === "nodo" ? porId.get(r.id) : r.coord);
  const nombreDe = (r: Referencia) => (r.tipo === "nodo" ? (porId.get(r.id)?.nombre ?? tx("el nodo", "the node")) : `${aGMS(r.coord.lat, "lat")} ${aGMS(r.coord.lon, "lon")}`);
  const noEncontreNodo = () => tx("No encontré ese nodo.", "I couldn't find that node.");
  const deshacer = (): AccionRespuesta => ({ texto: tx("Deshacer", "Undo"), accion: "deshacer", escenario: antes });

  switch (o.tipo) {
    case "agregar": {
      const clase = o.datos.tipo === "nodo" ? "nodo" : "nodo antena";
      if (!o.coord) {
        const datos = o.datos;
        return {
          texto: tx(
            `Con gusto. Escríbame la coordenada del ${clase}, por ejemplo ${ejemploCoord()}. También puede ubicarlo con un clic en el mapa.`,
            `Gladly. Type the ${o.datos.tipo === "nodo" ? "node" : "antenna node"}'s coordinate, for example ${ejemploCoord()}. You can also place it with a click on the map.`,
          ),
          acciones: [{ texto: tx("Ubicar en el mapa", "Place on the map"), accion: "agregar" }],
          pendiente: { tipo: "agregar", datos },
        };
      }
      const { lat, lon } = o.coord;
      const nueva = api.agregar({ ...o.datos, lat, lon });
      const lugar = api.ubicacion(lat, lon);
      const tipoTxt = (nueva.tipo ?? "antena") === "nodo" ? "el nodo" : "el nodo antena";
      const extras = [`${fn(nueva.alturaM)} m de altura`, `${fn(nueva.gananciaDbi)} dBi`, `${fn(nueva.potenciaDbm)} dBm`].join(", ");
      return {
        texto: tx(
          `Listo: inscribí ${tipoTxt} «${nueva.nombre}» en ${textoCoord({ lat, lon })}${lugar ? `, en ${lugar}` : ""}, con ${extras}${nueva.pasarela ? "; es la pasarela" : ""}.${o.coord.corregido ? " Tomé la longitud como oeste (negativa), como corresponde en Colombia." : ""} Ya estoy simulando su alcance; en un momento le cuento el resultado.`,
          `Done: I added the ${(nueva.tipo ?? "antena") === "nodo" ? "node" : "antenna node"} “${nueva.nombre}” at ${textoCoord({ lat, lon })}${lugar ? `, in ${lugar}` : ""}, with a height of ${fn(nueva.alturaM)} m, ${fn(nueva.gananciaDbi)} dBi and ${fn(nueva.potenciaDbm)} dBm${nueva.pasarela ? "; it's the gateway" : ""}.${o.coord.corregido ? " I took the longitude as west (negative), as is correct in Colombia." : ""} I'm already simulating its range; I'll tell you the result in a moment.`,
        ),
        acciones: [deshacer()],
        deshacer: antes,
        esperar: nueva.id,
        nodo: nueva.id,
      };
    }
    case "mover": {
      const a = porId.get(o.id);
      if (!a) return { texto: noEncontreNodo() };
      if (!o.coord) return { texto: tx(`¿A qué coordenada muevo «${a.nombre}»? Por ejemplo ${ejemploCoord()}.`, `To what coordinate should I move “${a.nombre}”? For example ${ejemploCoord()}.`), pendiente: { tipo: "mover", id: a.id } };
      api.editar(a.id, { lat: Number(o.coord.lat.toFixed(6)), lon: Number(o.coord.lon.toFixed(6)) });
      api.centrar(o.coord.lat, o.coord.lon);
      const lugar = api.ubicacion(o.coord.lat, o.coord.lon);
      return {
        texto: tx(`Moví «${a.nombre}» ${textoDestino(o.coord, true)}${sufijoLugar(o.coord, lugar)}. Recalculo la simulación.`, `I moved “${a.nombre}” ${textoDestino(o.coord, true)}${sufijoLugar(o.coord, lugar)}. Recalculating the simulation.`),
        acciones: [deshacer()],
        deshacer: antes,
        esperar: a.id,
        nodo: a.id,
      };
    }
    case "eliminar": {
      const a = porId.get(o.id);
      if (!a) return { texto: noEncontreNodo() };
      api.eliminar(a.id);
      return { texto: tx(`Eliminé «${a.nombre}».`, `I deleted “${a.nombre}”.`), acciones: [deshacer()], deshacer: antes };
    }
    case "renombrar": {
      const a = porId.get(o.id);
      if (!a) return { texto: noEncontreNodo() };
      api.editar(a.id, { nombre: o.nombre.slice(0, 60) });
      return { texto: tx(`Ahora «${a.nombre}» se llama «${o.nombre}».`, `“${a.nombre}” is now called “${o.nombre}”.`), acciones: [deshacer()], deshacer: antes, nodo: a.id };
    }
    case "editar": {
      const a = porId.get(o.id);
      if (!a) return { texto: noEncontreNodo() };
      api.editar(a.id, o.cambios);
      return { texto: tx(`Hecho: «${a.nombre}», ${o.descripcion}. Recalculo la simulación.`, `Done: “${a.nombre}”, ${o.descripcion}. Recalculating the simulation.`), acciones: [deshacer()], deshacer: antes, esperar: a.id, nodo: a.id };
    }
    case "parametros": {
      api.parametrosCambiar(o.cambios);
      return { texto: tx(`Cambié ${o.descripcion}. Recalculo la simulación.`, `I changed ${o.descripcion}. Recalculating the simulation.`), acciones: [deshacer()], deshacer: antes, esperar: "*" };
    }
    case "vista":
      api.vista(o.cambios);
      if (o.cambios.animarRed !== undefined)
        return {
          texto: o.cambios.animarRed
            ? tx(
                "Listo: la malla se ve con el flujo animado. Las líneas turquesa avanzan hacia el gateway, los pulsos saltan de nodo en nodo, cada pieza destella al retransmitir y la nube «IA» del gateway se enciende cuando le llega algo.",
                "Done: the mesh now shows the animated flow. The turquoise lines move toward the gateway, the pulses hop from node to node, each piece flashes when it retransmits, and the gateway's “AI” cloud lights up when something reaches it.",
              )
            : tx(
                "Listo: la malla queda quieta, sin la animación del flujo. Para volver a verla, dígame «anima la red» o use el interruptor del panel.",
                "Done: the mesh is now still, without the flow animation. To see it again, tell me “animate the network” or use the switch on the panel.",
              ),
        };
      if (o.cambios.unidad || o.cambios.escala) return { texto: tx(`Listo: el mapa de señal se ve ${o.descripcion}. Lo puede ajustar en Capas → Escala de la señal.`, `Done: the signal map is now shown ${o.descripcion}. You can adjust it in Layers → Signal scale.`) };
      // v17.6 · La leyenda y el relieve en 3D, por voz
      if (o.cambios.leyenda !== undefined && o.cambios.leyenda !== null)
        return {
          texto: !o.cambios.leyenda
            ? tx("Listo, plegué la leyenda. Para volver a verla, dígame «muestra la leyenda» o toque «Leyenda», abajo a la izquierda del mapa.", "Done, I collapsed the legend. To see it again, tell me “show the legend” or tap “Legend” at the bottom left of the map.")
            : api.resultado()
              ? tx("Listo, abrí la leyenda: está abajo a la izquierda del mapa y dice qué significa cada color.", "Done, I opened the legend: it's at the bottom left of the map and shows what each color means.")
              : tx("Listo, la leyenda queda abierta: aparece abajo a la izquierda del mapa en cuanto haya una simulación.", "Done, the legend stays open: it shows up at the bottom left of the map as soon as there's a simulation."),
        };
      if (o.cambios.relieve3d !== undefined && Object.keys(o.cambios).length === 1)
        return {
          texto: o.cambios.relieve3d
            ? tx("Listo, el mapa muestra el relieve en 3D, inclinado para ver las lomas y los valles. Para girarlo o inclinarlo más, Ctrl + arrastrar (en el celular, con dos dedos).", "Done, the map shows the terrain in 3D, tilted so you can see the hills and valleys. To rotate or tilt it more, Ctrl + drag (on a phone, with two fingers).")
            : tx("Listo, el mapa vuelve a verse plano, desde arriba. La simulación no cambia; para simular sin lomas, dígame «simula con terreno plano».", "Done, the map is flat again, seen from above. The simulation doesn't change; to simulate without hills, tell me “simulate with flat terrain”."),
        };
      return { texto: tx(`Listo: el mapa ${o.descripcion}. Todo esto también está en «Capas».`, `Done: the map ${o.descripcion}. All of this is also under “Layers”.`) };
    case "informe": {
      const a = porId.get(o.a);
      const b = puntoDe(o.b);
      if (!a || !b) return { texto: tx("No encontré alguno de los dos extremos.", "I couldn't find one of the two endpoints.") };
      api.perfil(a, o.b.tipo === "nodo" ? (b as Antena) : { lat: b.lat, lon: b.lon }, true);
      const r = api.resultado();
      const idB = o.b.tipo === "nodo" ? o.b.id : null;
      const e = idB ? r?.enlaces.find((x) => (x.a === a.id && x.b === idB) || (x.b === a.id && x.a === idB)) : undefined;
      const s = presetPorId(api.parametros().preset).sensibilidadDbm;
      const resumen = e
        ? tx(
            ` En la última simulación el enlace tiene ${f1(e.margen)} dB de margen (≈ ${f1(e.margen + s)} dBm recibidos) a ${f1(e.distanciaKm, 2)} km${e.lineaVista ? ", con línea de vista despejada" : ""}.`,
            ` In the last simulation the link has ${f1(e.margen)} dB of margin (≈ ${f1(e.margen + s)} dBm received) over ${f1(e.distanciaKm, 2)} km${e.lineaVista ? ", with a clear line of sight" : ""}.`,
          )
        : "";
      return {
        texto: tx(
          `Abrí el informe del radioenlace de ${a.nombre} a ${nombreDe(o.b)}, como «Radio Link» de Radio Mobile: distancia, azimut y ángulo de elevación, peor despeje de Fresnel, PIRE, pérdidas desglosadas y el nivel recibido en dBm, µV y dBµV/m.${resumen} Desde ahí puede copiarlo o descargarlo.`,
          `I opened the radio link report from ${a.nombre} to ${nombreDe(o.b)}, like Radio Mobile's “Radio Link”: distance, azimuth and elevation angle, worst Fresnel clearance, EIRP, itemized losses and the received level in dBm, µV and dBµV/m.${resumen} From there you can copy or download it.`,
        ),
      };
    }
    case "apuntar-omni": {
      const a = porId.get(o.id);
      if (!a) return { texto: noEncontreNodo() };
      return {
        texto: tx(
          `«${a.nombre}» tiene antena omnidireccional: irradia igual hacia todos lados y no se puede apuntar. Si quiere concentrar la señal ${o.destino ? `hacia ${o.destino}` : `hacia el ${puntoCardinal(o.azimutDeg)}`}, le pongo una antena direccional:`,
          `“${a.nombre}” has an omnidirectional antenna: it radiates equally in every direction and can't be aimed. If you want to concentrate the signal ${o.destino ? `toward ${o.destino}` : `toward the ${puntoCardinal(o.azimutDeg)}`}, I can fit it with a directional antenna:`,
        ),
        acciones: (["yagi", "sectorial-90", "panel"] as const).map((pt) => ({
          texto: tx(`${patronPorId(pt).nombre} a ${Math.round(o.azimutDeg)}°`, `${patronPorId(pt).nombre} at ${Math.round(o.azimutDeg)}°`),
          accion: "orden" as const,
          orden: {
            tipo: "editar" as const,
            id: a.id,
            cambios: { patron: pt, gananciaDbi: patronPorId(pt).gananciaTipica, equipo: "personalizado" as const, azimutDeg: o.azimutDeg, elevacionDeg: 0 },
            descripcion: tx(
              `ahora tiene antena ${patronPorId(pt).nombre.toLowerCase()} de ${fn(patronPorId(pt).gananciaTipica)} dBi apuntando a ${rumboTexto(o.azimutDeg)}`,
              `now with a ${nombreAntenaIngles(pt)} antenna of ${fn(patronPorId(pt).gananciaTipica)} dBi pointing at ${rumboTexto(o.azimutDeg)}`,
            ),
          },
        })),
      };
    }
    case "simular":
      if (!antenas.some((a) => a.activa))
        return {
          texto: tx("No hay nodos activos. Inscriba uno con una coordenada o cargue el ejemplo.", "There are no active nodes. Add one with a coordinate or load the example."),
          acciones: [{ texto: tx("Cargar el ejemplo", "Load the example"), accion: "ejemplo" }],
        };
      api.simular();
      return { texto: tx("Simulando… en un momento le cuento el resultado.", "Simulating… I'll tell you the result in a moment."), esperar: "*" };
    case "ir": {
      // En vez del punto rojo, Melki vuela hasta el sitio (la conversación lo muestra con `llegada`): saluda en un
      // lugar y señala una coordenada o una antena
      if (o.coord) {
        api.centrar(o.coord.lat, o.coord.lon, 13);
        const lugar = api.ubicacion(o.coord.lat, o.coord.lon);
        const { datos, senal } = datosCoordenada(api, o.coord.lat, o.coord.lon);
        return {
          texto: tx(`Lo llevé a ${textoCoord(o.coord)}${lugar ? `, en ${lugar}` : ""}. ¿Le inscribo un nodo antena ahí?`, `I took you to ${textoCoord(o.coord)}${lugar ? `, in ${lugar}` : ""}. Shall I add an antenna node there?`),
          acciones: [{ texto: tx("Inscribir un nodo antena ahí", "Add an antenna node there"), accion: "orden", orden: { tipo: "agregar", coord: o.coord, datos: { tipo: "antena" } } }],
          llegada: {
            lat: o.coord.lat,
            lon: o.coord.lon,
            gesto: "senalando",
            etiqueta: tx("Melki llegó · Coordenada", "Melki arrived · Coordinate"),
            titulo: lugar ?? tx("La coordenada", "The coordinate"),
            subtitulo: `${aDecimal(o.coord.lat)}, ${aDecimal(o.coord.lon)}`,
            parrafos: [
              tx(`Aquí es: ${aGMS(o.coord.lat, "lat")}, ${aGMS(o.coord.lon, "lon")}${lugar ? `, en ${lugar}` : ""}. Le señalo el punto exacto.`, `Here it is: ${aGMS(o.coord.lat, "lat")}, ${aGMS(o.coord.lon, "lon")}${lugar ? `, in ${lugar}` : ""}. I'm pointing at the exact spot.`),
              tx("¿Le inscribo un nodo antena justo aquí? Con el nodo puesto, el simulador calcula qué cubre desde ahí.", "Shall I add an antenna node right here? With the node in place, the simulator works out what it covers from there."),
            ],
            datos,
            // En voz alta, sin deletrear los grados
            voz: tx(`Aquí es, le señalo el punto exacto${lugar ? `, en ${lugar}` : ""}.${senal} ¿Le inscribo un nodo antena justo aquí?`, `Here it is, I'm pointing at the exact spot${lugar ? `, in ${lugar}` : ""}.${senal} Shall I add an antenna node right here?`),
            marca: { titulo: tx("Coordenada", "Coordinate"), tarjeta: true },
          },
        };
      }
      if (o.id) {
        const a = porId.get(o.id);
        if (a) {
          api.centrar(a.lat, a.lon, 13);
          const infra = (a.tipo ?? "antena") === "antena";
          const lugar = api.ubicacion(a.lat, a.lon);
          const que = a.pasarela
            ? tx("el gateway, la entrada de la red a internet", "the gateway, the network's way into the internet")
            : infra
              ? tx("un repetidor de la malla", "a repeater in the mesh")
              : tx("un nodo de campo", "a field node");
          return {
            texto: tx(`Aquí está «${a.nombre}».${infra ? " ¿Le explico por qué quedó aquí y qué papel cumple?" : ""}`, `Here is “${a.nombre}”.${infra ? " Shall I explain why it ended up here and what role it plays?" : ""}`),
            acciones: infra ? [{ texto: tx("¿Por qué quedó aquí?", "Why is it here?"), accion: "recorrido-red", parada: a.nombre }] : undefined,
            llegada: {
              lat: a.lat,
              lon: a.lon,
              gesto: "senalando",
              etiqueta: tx(`Melki llegó · ${a.pasarela ? "Gateway" : infra ? "Repetidor" : "Nodo de campo"}`, `Melki arrived · ${a.pasarela ? "Gateway" : infra ? "Repeater" : "Field node"}`),
              titulo: a.nombre,
              subtitulo: [lugar, `${aDecimal(a.lat)}, ${aDecimal(a.lon)}`].filter(Boolean).join(" · "),
              parrafos: [
                tx(`Aquí está «${a.nombre}»: ${que}, con la antena a ${fn(a.alturaM)} m de altura.`, `Here is “${a.nombre}”: ${que}, with the antenna ${fn(a.alturaM)} m high.`),
                ...(infra ? [tx("¿Le explico por qué quedó aquí y qué papel cumple en la red? Se lo cuento en el recorrido, punto por punto.", "Shall I explain why it ended up here and what role it plays in the network? I'll walk you through it, point by point.")] : []),
              ],
              datos: datosAntena(api, a),
            },
          };
        }
      }
      if (o.lugar) {
        const l = o.lugar;
        if (l.caja) api.encuadrarCaja(l.caja);
        else api.centrar(l.lat, l.lon, 8);
        // Con el contorno del municipio: su tamaño y la red para cubrirlo entero, a un toque (o con «sí»)
        const contorno = l.tipo === "municipio" ? api.contornoLugar?.(l) : null;
        const area = contorno ? areaM2(contorno) : 0;
        const zona = contorno && area <= 3e9 ? ({ puntos: contorno, nombre: tx(`en todo el municipio de ${l.nombre} (${l.detalle})`, `in the whole municipality of ${l.nombre} (${l.detalle})`), etiqueta: `${l.nombre} (${l.detalle})`, lugar: l } as const) : null;
        const segundo =
          l.tipo === "municipio"
            ? zona
              ? tx("¿Le armo una red sostenible que cubra todo el municipio, con su viabilidad y su costo? Toque el botón o dígame «sí».", "Shall I build a sustainable network covering the whole municipality, with its feasibility and its cost? Tap the button or tell me “yes”.")
              : tx(`Dígame qué hacemos aquí, por ejemplo «hazme una red sostenible en ${l.nombre} de 11.226 hectáreas».`, `Tell me what we'll do here, for example “build me a sustainable network in ${l.nombre} of 11,226 hectares”.`)
            : tx("Dígame en qué municipio trabajamos («ubícame en» y su nombre) o qué red armamos aquí.", "Tell me which municipality we're working in (“take me to” and its name) or what network we'll build here.");
        return {
          texto: tx(
            `Lo llevé a ${nombreLugar(l)}${area ? `, un municipio de ${textoArea(area)}` : ""}.${zona ? " ¿Le armo una red sostenible que cubra todo el municipio, con su viabilidad y su costo?" : ""}`,
            `I took you to ${nombreLugar(l)}${area ? `, a municipality of ${textoArea(area)}` : ""}.${zona ? " Shall I build a sustainable network covering the whole municipality, with its feasibility and its cost?" : ""}`,
          ),
          acciones: zona
            ? [
                { texto: tx("Sí, la red de todo el municipio", "Yes, the network for the whole municipality"), accion: "orden", orden: disenoDeZona(zona) },
                { texto: tx("Y probar hasta dónde aguanta", "And test how much it can take"), accion: "orden", orden: { ...disenoDeZona(zona), despues: { zonas: { n: 250 }, estres: { rampa: true } } } as Orden },
              ]
            : undefined,
          lugar: l,
          llegada: {
            lat: l.lat,
            lon: l.lon,
            gesto: "saludando",
            etiqueta: tx(
              `Melki llegó · ${l.tipo === "municipio" ? "Municipio" : l.tipo === "departamento" ? "Departamento" : "País"}`,
              `Melki arrived · ${l.tipo === "municipio" ? "Municipality" : l.tipo === "departamento" ? "Department" : "Country"}`,
            ),
            titulo: l.nombre,
            subtitulo: [l.tipo === "municipio" ? l.detalle : null, area ? tx(`municipio de ${textoArea(area)}`, `municipality of ${textoArea(area)}`) : null].filter(Boolean).join(" · ") || undefined,
            parrafos: [
              tx(
                `Esto es ${nombreLugar(l)}${area ? `: un municipio de ${textoArea(area)}` : ""}${l.caja ? `${area ? ", y" : ";"} lo dejé encuadrado en el mapa` : ""}.`,
                `This is ${nombreLugar(l)}${area ? `: a municipality of ${textoArea(area)}` : ""}${l.caja ? `${area ? ", and" : ";"} I've framed it on the map` : ""}.`,
              ),
              segundo,
            ],
            datos: contorno && area ? datosMunicipio(l, area, contorno, antenas) : undefined,
            marca: l.tipo === "municipio" ? { titulo: `${l.nombre}, ${l.detalle}`, tarjeta: false } : undefined,
          },
        };
      }
      return {
        texto: tx(
          `No encontré «${o.consulta}». Pruebe con el nombre de un municipio o departamento de Colombia, o con coordenadas como ${ejemploCoord()}.`,
          `I couldn't find “${o.consulta}”. Try the name of a municipality or department of Colombia, or coordinates such as ${ejemploCoord()}.`,
        ),
      };
    }
    case "distancia": {
      const a = puntoDe(o.a);
      const b = puntoDe(o.b);
      if (!a || !b) return { texto: tx("No encontré alguno de los dos puntos.", "I couldn't find one of the two points.") };
      const d = distanciaM(a.lat, a.lon, b.lat, b.lon);
      const r = rumbo(a.lat, a.lon, b.lat, b.lon);
      api.medir({ id: `m${Date.now().toString(36)}`, nombre: `${nombreDe(o.a)} – ${nombreDe(o.b)}`.slice(0, 60), tipo: "linea", puntos: [[a.lon, a.lat], [b.lon, b.lat]], visible: true });
      return {
        texto: tx(
          `De ${nombreDe(o.a)} a ${nombreDe(o.b)} hay ${formatoDistancia(d)} en línea recta, con rumbo ${rumboTexto(r)}. La dejé dibujada como medición en la regla.`,
          `From ${nombreDe(o.a)} to ${nombreDe(o.b)} it's ${formatoDistancia(d)} in a straight line, bearing ${rumboTexto(r)}. I left it drawn as a ruler measurement.`,
        ),
        acciones: [deshacer()],
        deshacer: antes,
      };
    }
    case "perfil": {
      const a = porId.get(o.a);
      const b = puntoDe(o.b);
      if (!a || !b) return { texto: tx("No encontré alguno de los dos extremos.", "I couldn't find one of the two endpoints.") };
      api.perfil(a, o.b.tipo === "nodo" ? (b as Antena) : { lat: b.lat, lon: b.lon });
      return { texto: tx(`Abrí el perfil del terreno de ${a.nombre} a ${nombreDe(o.b)}: muestra la línea de vista, la zona de Fresnel y el margen.`, `I opened the terrain profile from ${a.nombre} to ${nombreDe(o.b)}: it shows the line of sight, the Fresnel zone and the margin.`) };
    }
    case "senal":
      if (!antenas.some((a) => a.activa)) return { texto: tx("Primero inscriba al menos un nodo antena para calcular la señal.", "First add at least one antenna node so I can calculate the signal.") };
      api.senal(o.coord.lat, o.coord.lon);
      api.centrar(o.coord.lat, o.coord.lon);
      return { texto: tx(`Calculé la señal en ${textoCoord(o.coord)}: está en la tarjeta «Señal en este punto», con el margen desde cada nodo.`, `I calculated the signal at ${textoCoord(o.coord)}: it's on the “Signal at this point” card, with the margin from each node.`) };
    case "donde": {
      const p = puntoDe(o.ref);
      if (!p) return { texto: tx("No encontré ese punto.", "I couldn't find that point.") };
      const lugar = api.ubicacion(p.lat, p.lon);
      const quien = tx(o.ref.tipo === "nodo" ? `«${nombreDe(o.ref)}»` : "Ese punto", o.ref.tipo === "nodo" ? `“${nombreDe(o.ref)}”` : "That point");
      return { texto: lugar ? tx(`${quien} queda en ${lugar}.`, `${quien} is in ${lugar}.`) : tx(`${quien} queda fuera de los municipios de Colombia que tengo cargados.`, `${quien} is outside the Colombian municipalities I have loaded.`) };
    }
    case "listar":
      if (!antenas.length)
        return {
          texto: tx("Aún no hay nodos. Escríbame, por ejemplo: «inscribe un nodo antena en 4.5123, -73.1234».", "There are no nodes yet. Tell me, for example: “add an antenna node at 4.5123, -73.1234”."),
          acciones: [{ texto: tx("Cargar el ejemplo", "Load the example"), accion: "ejemplo" }],
        };
      // v17.3 · Solo los repetidores, las personas o los gateways
      if (o.filtro) {
        const cuales = antenas.filter((a) =>
          o.filtro === "gateways" ? a.pasarela : o.filtro === "repetidores" ? !a.pasarela && (a.tipo ?? "antena") !== "nodo" && a.rol === "REPETIDOR" : (a.tipo ?? "antena") === "nodo",
        );
        const [uno, varios, unoEn, variosEn] =
          o.filtro === "gateways" ? ["gateway", "gateways", "gateway", "gateways"] : o.filtro === "repetidores" ? ["repetidor", "repetidores", "repeater", "repeaters"] : ["persona", "personas", "person", "people"];
        if (!cuales.length) return { texto: tx(`No hay ${varios} en el mapa (hay ${antenas.length} ${antenas.length === 1 ? "nodo" : "nodos"} en total).`, `There are no ${variosEn} on the map (there ${antenas.length === 1 ? "is 1 node" : `are ${antenas.length} nodes`} in total).`) };
        const lista = listaCorta(cuales.map((a) => `${a.nombre} (${fn(a.alturaM)} m)`), ", ");
        return {
          texto: tx(
            `Hay ${cuales.length} ${cuales.length === 1 ? uno : varios}: ${lista}.`,
            `There ${cuales.length === 1 ? `is 1 ${unoEn}` : `are ${cuales.length} ${variosEn}`}: ${lista}.`,
          ),
        };
      }
      return {
        texto: tx(
          `Hay ${antenas.length} ${antenas.length === 1 ? "nodo" : "nodos"}: ${listaCorta(
            antenas.map((a) => `${a.nombre} (${(a.tipo ?? "antena") === "nodo" ? "nodo" : "nodo antena"}, ${fn(a.alturaM)} m, ${aDecimal(a.lat)}, ${aDecimal(a.lon)}${a.pasarela ? ", pasarela" : ""}${a.activa ? "" : ", excluido"})`),
            "; ",
          )}.`,
          `There ${antenas.length === 1 ? "is 1 node" : `are ${antenas.length} nodes`}: ${listaCorta(
            antenas.map((a) => `${a.nombre} (${(a.tipo ?? "antena") === "nodo" ? "node" : "antenna node"}, ${fn(a.alturaM)} m, ${aDecimal(a.lat)}, ${aDecimal(a.lon)}${a.pasarela ? ", gateway" : ""}${a.activa ? "" : ", excluded"})`),
            "; ",
          )}.`,
        ),
      };
    case "herramienta":
      api.herramienta(o.herramienta);
      return {
        texto:
          o.herramienta === "regla"
            ? tx(
                "Activé la regla. Elija Línea, Trayecto o Área y haga clic en el mapa; doble clic o Enter para terminar. Cada medición queda guardada y se puede editar o borrar.",
                "I turned on the ruler. Choose Line, Path or Area and click on the map; double-click or press Enter to finish. Each measurement is saved and can be edited or deleted.",
              )
            : o.herramienta === "inspeccionar"
              ? tx("Activé «Medir señal»: haga clic en el mapa para ver el margen desde cada nodo.", "I turned on “Measure signal”: click on the map to see the margin from each node.")
              : o.herramienta === "lapiz"
                ? TEXTO_LAPIZ()
                : o.herramienta === "mover"
                  ? tx("Listo, solté el lápiz: el mapa vuelve a moverse con el ratón.", "Done, I put the pencil down: the map moves with the mouse again.")
                  : tx("Haga clic en el mapa donde va el nodo.", "Click on the map where the node goes."),
      };
    case "ejemplo":
      api.ejemplo();
      return {
        texto: tx("Cargué la demostración: un nodo antena llamado «Ejemplo». En un momento le cuento su alcance.", "I loaded the demo: an antenna node called “Example”. I'll tell you its range in a moment."),
        acciones: [deshacer()],
        deshacer: antes,
        esperar: "*",
      };
    case "nuevo":
      if (!o.confirmado)
        return {
          texto: tx("¿Seguro? Se quitarán todos los nodos y mediciones del escenario actual (puede deshacerlo).", "Are you sure? All the nodes and measurements of the current scenario will be removed (you can undo it)."),
          acciones: [{ texto: tx("Sí, empezar de cero", "Yes, start from scratch"), accion: "orden", orden: { tipo: "nuevo", confirmado: true } }],
        };
      api.nuevo();
      return { texto: tx("Listo, escenario en blanco. Escríbame una coordenada para inscribir el primer nodo antena.", "Done, a blank scenario. Give me a coordinate to add the first antenna node."), acciones: [deshacer()], deshacer: antes };
    case "exportar":
      return api.exportar(o.formato)
        ? { texto: tx(`Descargué el archivo ${o.formato.toUpperCase()}.`, `I downloaded the ${o.formato.toUpperCase()} file.`) }
        : { texto: tx("Para exportar a Google Earth primero necesito una simulación al día.", "To export to Google Earth I first need an up-to-date simulation."), acciones: [{ texto: tx("Simular ahora", "Simulate now"), accion: "simular" }] };
    case "borrar-mediciones":
      api.borrarMediciones();
      return { texto: tx("Borré todas las mediciones de la regla.", "I deleted all the ruler measurements."), acciones: [deshacer()], deshacer: antes };
    case "pieza": {
      const nombrePieza = { gateway: tx("el gateway", "the gateway"), repetidor: tx("el repetidor", "the repeater"), persona: tx("la persona", "the person") }[o.pieza];
      if (!o.coord) {
        api.armarPieza(o.pieza);
        return {
          texto: tx(
            `Con gusto. Toque el mapa donde va ${nombrePieza}, o escríbame la coordenada, por ejemplo ${ejemploCoord()}.${o.pieza === "repetidor" ? " Busque una loma o una torre que alcance al gateway o a otro repetidor conectado." : ""}`,
            `Gladly. Tap the map where ${nombrePieza} goes, or give me the coordinate, for example ${ejemploCoord()}.${o.pieza === "repetidor" ? " Look for a hill or a tower that reaches the gateway or another connected repeater." : ""}`,
          ),
          pendiente: { tipo: "pieza", pieza: o.pieza, datos: o.datos },
        };
      }
      const { lat, lon } = o.coord;
      const lugar = api.ubicacion(lat, lon);
      const gw = antenas.find((a) => a.pasarela);
      if (o.pieza === "gateway" && gw && (o.mover || api.modo() === "sembrar")) {
        api.editar(gw.id, { lat: Number(lat.toFixed(6)), lon: Number(lon.toFixed(6)), activa: true });
        api.centrar(lat, lon);
        return {
          texto: tx(
            `Moví el gateway «${gw.nombre}» ${textoDestino(o.coord, true)}${sufijoLugar(o.coord, lugar)}: ahí entra el internet. Calculo de nuevo quién queda conectado.`,
            `I moved the gateway “${gw.nombre}” ${textoDestino(o.coord, true)}${sufijoLugar(o.coord, lugar)}: that's where the internet comes in. I'm recalculating who stays connected.`,
          ),
          acciones: [deshacer()],
          deshacer: antes,
          esperar: gw.id,
          nodo: gw.id,
        };
      }
      const nueva = api.ponerPieza(o.pieza, lat, lon, o.datos);
      const que = { gateway: tx("el gateway (Gateway + Internet)", "the gateway (Gateway + Internet)"), repetidor: tx("el repetidor", "the repeater"), persona: tx("la persona", "the person") }[o.pieza];
      return {
        texto: tx(
          `Listo: puse ${que} «${nueva.nombre}» ${o.coord.desde ? textoDestino(o.coord) : `en ${textoCoord({ lat, lon })}`}${sufijoLugar(o.coord, lugar)}, a ${fn(nueva.alturaM)} m.${o.coord.corregido ? " Tomé la longitud como oeste (negativa), como corresponde en Colombia." : ""} Ya calculo con el relieve real si queda conectad${o.pieza === "persona" ? "a" : "o"} al gateway.`,
          `Done: I placed ${que} “${nueva.nombre}” ${o.coord.desde ? textoDestino(o.coord) : `at ${textoCoord({ lat, lon })}`}${sufijoLugar(o.coord, lugar)}, ${fn(nueva.alturaM)} m high.${o.coord.corregido ? " I took the longitude as west (negative), as is correct in Colombia." : ""} I'm now checking with the real terrain whether it connects to the gateway.`,
        ),
        acciones: [deshacer()],
        deshacer: antes,
        esperar: nueva.id,
        nodo: nueva.id,
      };
    }
    case "sembrar": {
      const r = api.red();
      if (!r.gateways.length)
        return {
          texto: tx(
            "Primero hace falta el Gateway + Internet: es el punto de partida de la malla. Dígame dónde va, por ejemplo «pon el gateway en 4.2, -73.37».",
            "First we need the Gateway + Internet: it's the starting point of the mesh. Tell me where it goes, for example “put the gateway at 4.2, -73.37”.",
          ),
          acciones: [],
        };
      if (!r.alDia) {
        api.simular();
        return { texto: tx("Primero termino de calcular la red con el relieve real; pídamelo de nuevo en un momento.", "First I'll finish calculating the network with the real terrain; please ask me again in a moment."), esperar: "*" };
      }
      let destinos: DestinoSiembra[];
      if (o.destino === "faltantes") {
        if (!r.sinCobertura.length)
          return {
            texto: r.personas.length
              ? tx(
                  "Todas las personas ya están conectadas al gateway. 🙂 Si quiere llevar la red más lejos, dígame «lleva la red a» y una coordenada o un municipio.",
                  "Everyone is already connected to the gateway. 🙂 If you'd like to take the network further, tell me “extend the network to” and a coordinate or a municipality.",
                )
              : tx("Todavía no hay personas en el mapa. Póngalas primero, por ejemplo «pon una persona en 4.25, -73.30».", "There are no people on the map yet. Place them first, for example “put a person at 4.25, -73.30”."),
          };
        destinos = r.sinCobertura.map((a) => ({ lat: a.lat, lon: a.lon, nombre: a.nombre, antena: a }));
      } else if ("id" in o.destino) {
        const a = porId.get(o.destino.id);
        if (!a) return { texto: noEncontreNodo() };
        destinos = [{ lat: a.lat, lon: a.lon, nombre: a.nombre, antena: a }];
      } else destinos = [{ lat: o.destino.coord.lat, lon: o.destino.coord.lon, nombre: o.destino.nombre }];
      api.cambiarModo("sembrar");
      const luego = api.sembrar(destinos).then((s) => (s ? textoSiembra(s, destinos) : { texto: tx("No pude calcular la propuesta. Revise que el gateway esté puesto y la red calculada.", "I couldn't calculate the proposal. Check that the gateway is placed and the network calculated.") }));
      return {
        texto: tx(
          `Busco lomas con buen enlace desde la red conectada hacia ${destinos.length === 1 ? (destinos[0].nombre ?? "ese punto") : `${destinos.length} personas`}. En un momento le muestro la propuesta en el mapa.`,
          `I'm looking for hills with a good link from the connected network toward ${destinos.length === 1 ? (destinos[0].nombre ?? "that point") : `${destinos.length} people`}. I'll show you the proposal on the map in a moment.`,
        ),
        luego,
      };
    }
    case "aceptar-siembra": {
      const puestos = api.aceptarSiembra();
      if (!puestos) return { texto: tx("No tengo una propuesta pendiente. Pídame, por ejemplo, «conecta a los que faltan».", "I don't have a pending proposal. Ask me, for example, “connect the missing ones”.") };
      return {
        texto: tx(`Listo: puse ${puestos === 1 ? "1 nodo" : `${puestos} nodos`}. Calculo la red de nuevo y le cuento quién queda conectado.`, `Done: I placed ${puestos === 1 ? "1 node" : `${puestos} nodes`}. I'll recalculate the network and tell you who is connected.`),
        acciones: [deshacer()],
        deshacer: antes,
        esperar: "*",
      };
    }
    case "descartar-siembra":
      api.descartarSiembra();
      return { texto: tx("Descarté la propuesta. Puede poner los repetidores a mano con la pieza «Repetidor».", "I discarded the proposal. You can place the repeaters by hand with the “Repeater” piece.") };
    case "mensaje": {
      const r = api.red();
      if (!r.alDia) {
        api.simular();
        return { texto: tx("Primero calculo la red; pídame el mensaje otra vez en un momento.", "First I'll calculate the network; ask me for the message again in a moment."), esperar: "*" };
      }
      const desde =
        (o.id ? porId.get(o.id) : undefined) ??
        [...r.conectadas, ...r.lejos].sort((a, b) => (r.porNodo.get(b.id)?.saltos ?? 0) - (r.porNodo.get(a.id)?.saltos ?? 0))[0] ??
        r.personas[0] ??
        r.repetidores[0];
      if (!desde) return { texto: tx("Ponga al menos una persona para enviar un mensaje al gateway.", "Place at least one person to send a message to the gateway.") };
      if (desde.pasarela) return { texto: tx(`«${desde.nombre}» es el gateway: lo que mande ya está en internet. Elija una persona o un repetidor.`, `“${desde.nombre}” is the gateway: whatever it sends is already on the internet. Choose a person or a repeater.`) };
      api.cambiarModo("sembrar");
      const v = api.enviarMensaje(desde.id);
      if (!v) return { texto: tx("Primero calculo la red; pídame el mensaje otra vez en un momento.", "First I'll calculate the network; ask me for the message again in a moment.") };
      const nombres = new Map(antenas.map((a) => [a.id, a.nombre]));
      const ruta = v.ruta.map((id) => nombres.get(id) ?? id).join(" → ");
      const tiempoTxt = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${f1(ms / 1000)} s`);
      const sinCobertura = r.porNodo.get(desde.id)?.estado === "sin-cobertura";
      if (!v.llega)
        return {
          texto: tx(
            `Envié un mensaje de prueba desde «${desde.nombre}» y no llega: ${v.motivo ?? "no tiene ruta"}${v.ruta.length > 1 ? ` (ruta: ${ruta})` : ""}.${sinCobertura ? " ¿Quiere que siembre un repetidor hacia esa persona?" : ""}`,
            `I sent a test message from “${desde.nombre}” and it doesn't get through: ${v.motivo ?? "it has no route"}${v.ruta.length > 1 ? ` (route: ${ruta})` : ""}.${sinCobertura ? " Would you like me to seed a repeater toward that person?" : ""}`,
          ),
          acciones: sinCobertura ? [{ texto: tx(`Conectar a ${desde.nombre}`, `Connect ${desde.nombre}`), accion: "orden", orden: { tipo: "sembrar", destino: { id: desde.id } } }] : undefined,
        };
      const pct = (p: number) => (p >= 0.999 ? tx("más de 99,9 %", "over 99.9%") : tx(`${f1(p * 100, 0)} %`, `${f1(p * 100, 0)}%`));
      const meshtastic = presetPorId(api.parametros().preset).protocolo === "meshtastic";
      const entre = v.totalMs.max - v.totalMs.min >= 1;
      return {
        texto: tx(
          `Envié un mensaje de prueba desde «${desde.nombre}» del tamaño de un pago (la orden firmada, ${v.bytes} bytes): llega al gateway en ${v.saltos} ${v.saltos === 1 ? "salto" : "saltos"} (${ruta}), en ≈ ${tiempoTxt(v.totalMs.tipica)}${entre ? ` (entre ${tiempoTxt(v.totalMs.min)} y ${tiempoTxt(v.totalMs.max)})` : ""}. Llega al primer intento ${pct(v.probabilidad)} de las veces y ${pct(v.probabilidadReintentos)} ${meshtastic ? "con los 3 envíos de Meshtastic (el último por inundación)" : `con los ${INTENTOS} intentos de MeshCore (3 por la ruta y el último por inundación)`}. Con ${v.preset} cada salto ocupa ${tiempoTxt(v.aireMs)} en el aire; va directo por la ruta aprendida${meshtastic ? " (el siguiente salto)" : " y solo los repetidores la pasan"}, cada uno después de un turno al azar. El gateway lo pasa por Starlink (el pago se verifica con el banco, el WhatsApp sale a internet y la consulta va a la IA) y la respuesta vuelve por la misma ruta —en un pago, el comprobante—: ≈ ${tiempoTxt(v.totalMs.tipica)} de radio más lo que tarde el banco o la IA. Lo puede ver en el mapa. Para ver muchos a la vez: «envía 15 pagos al tiempo» o «manda 15 mensajes de WhatsApp al tiempo».`,
          `I sent a test message the size of a payment (the signed order, ${v.bytes} bytes) from “${desde.nombre}”: it reaches the gateway in ${v.saltos} ${v.saltos === 1 ? "hop" : "hops"} (${ruta}), in ≈ ${tiempoTxt(v.totalMs.tipica)}${entre ? ` (between ${tiempoTxt(v.totalMs.min)} and ${tiempoTxt(v.totalMs.max)})` : ""}. It gets through on the first attempt ${pct(v.probabilidad)} of the time and ${pct(v.probabilidadReintentos)} ${meshtastic ? "with Meshtastic's 3 transmissions (the last one by flooding)" : `with MeshCore's ${INTENTOS} attempts (3 along the route and the last one by flooding)`}. With ${v.preset} each hop takes ${tiempoTxt(v.aireMs)} on air; it goes straight along the learned route${meshtastic ? " (the next hop)" : " and only the repeaters relay it"}, each one after a random wait. The gateway passes it through Starlink (the payment is verified with the bank, the WhatsApp message goes out to the internet and the query goes to the AI) and the reply comes back along the same route —for a payment, the receipt—: ≈ ${tiempoTxt(v.totalMs.tipica)} of radio time plus whatever the bank or the AI takes. You can watch it on the map. To see many at once: “send 15 payments at once” or “send 15 WhatsApp messages at once”.`,
        ),
        acciones: [{ texto: tx("15 pagos al tiempo", "15 payments at once"), accion: "orden", orden: { tipo: "carga", opciones: { mensajes: 15 }, curva: false } }],
      };
    }
    case "modo":
      api.cambiarModo(o.modo);
      return {
        texto:
          o.modo === "sembrar"
            ? tx(
                "Listo, modo «Sembrar la malla»: primero el Gateway + Internet, luego los repetidores y al final la gente. Le voy guiando paso a paso en el panel de la izquierda.",
                "Done, “Seed the mesh” mode: first the Gateway + Internet, then the repeaters and finally the people. I'll guide you step by step in the left panel.",
              )
            : tx(
                "Listo, modo avanzado: tiene la lista de nodos, todos los parámetros y las herramientas del simulador. Para volver, toque «Sembrar la malla» arriba del panel.",
                "Done, advanced mode: you have the node list, all the parameters and the simulator's tools. To go back, tap “Seed the mesh” at the top of the panel.",
              ),
      };
    case "ejemplo-malla":
      api.ejemploMalla();
      return {
        texto: tx(
          "Cargué el ejemplo de malla: el gateway donde entra el internet, un repetidor en torre hacia el oriente y tres personas; la más lejana queda sin cobertura para que practique «Conectar a los que faltan». En un momento le cuento cómo quedó.",
          "I loaded the mesh example: the gateway where the internet comes in, a repeater on a tower to the east and three people; the farthest one has no coverage so you can practice “Connect the missing ones”. I'll tell you how it turned out in a moment.",
        ),
        acciones: [deshacer()],
        deshacer: antes,
        esperar: "*",
      };
    case "que-hago": {
      const r = api.red();
      const c = consejoRed(r, api.parametros().limiteSaltos);
      const acciones: Respuesta["acciones"] = [];
      if (r.alDia && r.sinCobertura.length) acciones.push({ texto: tx("Conectar a los que faltan", "Connect the missing ones"), accion: "orden", orden: { tipo: "sembrar", destino: "faltantes" } });
      if (r.alDia && r.conectadas.length) acciones.push({ texto: tx("Enviar un mensaje de prueba", "Send a test message"), accion: "orden", orden: { tipo: "mensaje" } });
      return { texto: `${c.paso ? tx(`Paso ${c.paso}: `, `Step ${c.paso}: `) : ""}${c.titulo}. ${c.texto}`, acciones: acciones.length ? acciones : undefined };
    }
    case "coordenada-sola": {
      const lugar = api.ubicacion(o.coord.lat, o.coord.lon);
      return {
        texto: tx(
          `Entendí la coordenada ${textoCoord(o.coord)}${lugar ? `, en ${lugar}` : ""}${o.coord.corregido ? " (tomé la longitud como oeste)" : ""}. ¿Qué hago con ella?`,
          `I got the coordinate ${textoCoord(o.coord)}${lugar ? `, in ${lugar}` : ""}${o.coord.corregido ? " (I took the longitude as west)" : ""}. What shall I do with it?`,
        ),
        acciones: [
          { texto: tx("Inscribir un nodo antena", "Add an antenna node"), accion: "orden", orden: { tipo: "agregar", coord: o.coord, datos: { tipo: "antena" } } },
          { texto: tx("Inscribir un nodo de campo", "Add a field node"), accion: "orden", orden: { tipo: "agregar", coord: o.coord, datos: { tipo: "nodo" } } },
          { texto: tx("Ir a ese punto", "Go to that point"), accion: "orden", orden: { tipo: "ir", coord: o.coord } },
          { texto: tx("Señal en ese punto", "Signal at that point"), accion: "orden", orden: { tipo: "senal", coord: o.coord } },
        ],
      };
    }
    case "elegir":
      return {
        texto: o.pregunta,
        acciones: [
          ...o.opciones.map((x): AccionRespuesta => ({ texto: x.texto, accion: "orden", orden: x.orden })),
          { texto: tx("Ninguno de esos", "None of those"), accion: "orden", orden: { tipo: "pedir-lugar", dicho: o.dicho, original: o.original, sugerencias: [], rechazo: true } },
        ],
        pendiente: { tipo: "elegir", opciones: o.opciones, dicho: o.dicho, original: o.original },
      };
    case "pedir-lugar": {
      const opciones = o.sugerencias.length ? opcionesDeLugar(o.original, api, null, {}, o.dicho, o.sugerencias.slice(0, 3)) : [];
      const lista = opciones.map((x) => x.texto);
      const ejemplo = tx("Por ejemplo: «Barranca de Upía, Meta».", "For example: “Barranca de Upía, Meta”.");
      if (opciones.length)
        return {
          texto: tx(
            `Discúlpeme, no reconocí «${o.dicho}». ¿Se refiere a ${lista.length > 1 ? `${lista.slice(0, -1).join(", ")} o ${lista[lista.length - 1]}` : lista[0]}? Si no, dígame el municipio y el departamento. ${ejemplo}`,
            `I'm sorry, I didn't recognize “${o.dicho}”. Do you mean ${lista.length > 1 ? `${lista.slice(0, -1).join(", ")} or ${lista[lista.length - 1]}` : lista[0]}? If not, tell me the municipality and the department. ${ejemplo}`,
          ),
          acciones: opciones.map((x): AccionRespuesta => ({ texto: x.texto, accion: "orden", orden: x.orden })),
          pendiente: { tipo: "elegir", opciones, dicho: o.dicho, original: o.original },
        };
      return {
        texto: o.rechazo
          ? tx(`Entendido. ¿Me dice entonces el municipio y el departamento, por favor? ${ejemplo}`, `Understood. Could you tell me the municipality and the department, then? ${ejemplo}`)
          : tx(`Discúlpeme, no reconocí el lugar «${o.dicho}». ¿Me repite el municipio y el departamento, por favor? ${ejemplo}`, `I'm sorry, I didn't recognize the place “${o.dicho}”. Could you repeat the municipality and the department, please? ${ejemplo}`),
        pendiente: { tipo: "lugar", dicho: o.dicho, original: o.original },
      };
    }
    case "aviso":
      return { texto: o.texto, acciones: o.acciones };
    case "red-municipio": {
      const z = zonaDeDiseno("todo el municipio", api, {});
      if (!z) return { texto: tx("¿Qué municipio cubro? Dígame el nombre y el departamento, por ejemplo «todo el municipio de Barranca de Upía, Meta».", "Which municipality should I cover? Tell me its name and department, for example “the whole municipality of Barranca de Upía, Meta”.") };
      if ("aviso" in z) return { texto: z.aviso };
      return { ...ejecutarOrdenBase(disenoDeZona(z, o.sostenible), api), ...(z.lugar ? { lugar: z.lugar } : {}) };
    }
    case "pedir-diseno": {
      const pendiente: Pendiente = { tipo: "disenar", lugar: o.lugar, sostenible: o.sostenible, despues: o.despues };
      const ejemplo: Orden = {
        tipo: "disenar",
        area: { forma: "circulo", areaM2: 11226 * 10000, centro: { tipo: "coord", coord: { lat: 4.5149, lon: -73.0024 }, nombre: tx("en Barranca de Upía (Meta)", "in Barranca de Upía (Meta)") } },
        margenDb: 30,
        clases: clasesMedia(),
        porcentaje: 95,
        respaldo: false,
        alturaM: ALTURA_REPETIDOR_DEFECTO,
        gateway: null,
        maxRepetidores: 60,
        sostenible: o.sostenible,
      };
      if (o.lugar) {
        // El municipio del lugar pedido (o donde caen sus coordenadas): se ofrece cubrirlo entero
        const l = o.lugar.lugar?.tipo === "municipio" ? o.lugar.lugar : lugarDePunto(api, o.lugar.lat, o.lugar.lon);
        const contorno = l ? api.contornoLugar?.(l) : null;
        const zona = l && contorno && areaM2(contorno) <= 3e9 ? ({ puntos: contorno, nombre: tx(`en todo el municipio de ${l.nombre} (${l.detalle})`, `in the whole municipality of ${l.nombre} (${l.detalle})`), etiqueta: `${l.nombre} (${l.detalle})`, lugar: l } as const) : null;
        const conDespues = (x: Orden): Orden => (o.despues && x.tipo === "disenar" ? { ...x, despues: o.despues } : x);
        const alrededor = (ha: number): Orden =>
          conDespues({
            tipo: "disenar",
            area: { forma: "circulo", areaM2: ha * 1e4, centro: { tipo: "coord", coord: { lat: o.lugar!.lat, lon: o.lugar!.lon }, nombre: o.lugar!.nombre } },
            margenDb: 30,
            clases: clasesMedia(),
            porcentaje: 95,
            respaldo: false,
            alturaM: ALTURA_REPETIDOR_DEFECTO,
            gateway: null,
            maxRepetidores: 60,
            ...(o.sostenible ? { sostenible: true } : {}),
          });
        const acciones: AccionRespuesta[] = [];
        if (zona) acciones.push({ texto: tx(`Todo el municipio de ${l!.nombre}`, `The whole municipality of ${l!.nombre}`), accion: "orden", orden: conDespues(disenoDeZona(zona, o.sostenible)) });
        acciones.push({ texto: tx("1.000 ha alrededor", "1,000 ha around it"), accion: "orden", orden: alrededor(1000) }, { texto: tx("5.000 ha alrededor", "5,000 ha around it"), accion: "orden", orden: alrededor(5000) });
        return {
          texto: tx(
            `Con gusto: armo la red ${o.lugar.nombre}${o.sostenible ? ", sostenible y viable" : ""}. ¿Qué área cubro? Dígame, por ejemplo, «11.226 hectáreas», «un radio de 6 km»${zona ? ` o «todo el municipio»` : ""}.`,
            `Gladly: I'll build the network ${o.lugar.nombre}${o.sostenible ? ", sustainable and viable" : ""}. What area should I cover? Tell me, for example, “11,226 hectares”, “a radius of 6 km”${zona ? ` or “the whole municipality”` : ""}.`,
          ),
          acciones,
          pendiente,
        };
      }
      const acciones: AccionRespuesta[] = [{ texto: tx("Barranca de Upía, 11.226 ha", "Barranca de Upía, 11,226 ha"), accion: "orden", orden: ejemplo }];
      if (antenas.some((a) => a.activa)) acciones.push({ texto: tx("Mejorar la red del mapa (costo y cobertura)", "Improve the network on the map (cost and coverage)"), accion: "orden", orden: { tipo: "ajustar", aplicar: false, opcion: "recomendada", opciones: {}, avisos: [] } });
      return {
        texto: tx(
          `Con gusto armo una red ${o.sostenible ? "sostenible, económica y técnicamente viable" : "MeshCore"}: busco con el relieve real dónde va el gateway y cada repetidor solar, con enlaces firmes, y le digo cuánto cuesta con los precios de Trama. ¿Dónde y de qué tamaño? Por ejemplo: «en Barranca de Upía, 11.226 hectáreas».`,
          `Gladly, I'll build a ${o.sostenible ? "sustainable, economically and technically viable" : "MeshCore"} network: using the real terrain I'll find where the gateway and each solar repeater go, with solid links, and tell you what it costs at Trama's prices. Where, and how large? For example: “in Barranca de Upía, 11,226 hectares”.`,
        ),
        acciones,
        pendiente,
      };
    }
    case "costo-red": {
      const activas = antenas.filter((a) => a.activa);
      const gateways = activas.filter((a) => a.pasarela).length;
      const repetidores = activas.filter((a) => !a.pasarela && (a.tipo ?? "antena") === "antena").length;
      const personas = activas.filter((a) => a.tipo === "nodo" && !a.poblada).length;
      const centro = activas.find((a) => a.pasarela) ?? activas[0];
      const { logistica, departamento } = logisticaEn(api, centro.lat, centro.lon);
      const c = costoRedTrama(gateways, repetidores, personas, "xiao", logistica);
      const que = [gateways ? `${gateways} ${gateways === 1 ? "gateway" : "gateways"}` : "", repetidores ? `${repetidores} ${repetidores === 1 ? "repetidor" : "repetidores"}` : "", personas ? `${personas} ${personas === 1 ? "persona" : "personas"}` : ""].filter(Boolean);
      const queEn = [gateways ? `${gateways} ${gateways === 1 ? "gateway" : "gateways"}` : "", repetidores ? `${repetidores} ${repetidores === 1 ? "repeater" : "repeaters"}` : "", personas ? `${personas} ${personas === 1 ? "person" : "people"}` : ""].filter(Boolean);
      return {
        texto: [
          tx(
            `La red del mapa (${que.join(", ").replace(/, ([^,]*)$/, " y $1") || "sin nodos activos"}) con los precios del documento de Trama:`,
            `The network on the map (${queEn.join(", ").replace(/, ([^,]*)$/, " and $1") || "no active nodes"}) at the prices in Trama's document:`,
          ),
          ...lineasCosto(c, departamento),
          gateways ? "" : tx("• Ojo: no hay gateway; sin él la red no sale a internet. Sume uno (el sitio con Starlink) antes de presupuestar.", "• Note: there's no gateway; without it the network can't reach the internet. Add one (the site with Starlink) before budgeting."),
        ]
          .filter(Boolean)
          .join("\n"),
        acciones: [{ texto: tx("Optimizar el costo (misma cobertura)", "Optimize the cost (same coverage)"), accion: "orden", orden: { tipo: "ajustar", aplicar: false, opcion: "recomendada", opciones: {}, avisos: [] } }],
      };
    }
    case "optimo": {
      if (!antenas.some((a) => a.activa && (a.tipo ?? "antena") === "antena"))
        return {
          texto: tx(
            "Todavía no hay red que revisar. Ponga el gateway y sus repetidores, o pídame que la diseñe («ármame la malla en todo el municipio de …», o dibújela con el lápiz de malla), y le digo si le falta o le sobra algo.",
            "There's no network to review yet. Place the gateway and its repeaters, or ask me to design it (“build me the mesh in the whole municipality of …”, or draw it with the mesh pencil), and I'll tell you whether something is missing or extra.",
          ),
          acciones: [{ texto: tx("Activar el lápiz", "Turn on the pencil"), accion: "orden", orden: { tipo: "herramienta", herramienta: "lapiz" } }],
        };
      return {
        texto: tx("Reviso cuánto aporta cada nodo con la simulación de la red…", "I'm checking how much each node contributes with the network simulation…"),
        luego: api.esperarResultado().then((r) => respuestaOptimo(r, api)),
      };
    }
    case "dejar-nodo": {
      const cuales = listaNombres(o.nombres);
      return {
        texto: tx(
          `Listo, ${o.nombres.length === 1 ? `${cuales} se queda: sirve de refuerzo donde ya hay señal` : `${cuales} se quedan: sirven de refuerzo donde ya hay señal`}.${o.ultima ? " No le vuelvo a preguntar por las antenas que ponga; si quiere que revise si falta o sobra algo, pregúnteme «¿sobran antenas?»." : ""}`,
          `Done, ${cuales} ${o.nombres.length === 1 ? "stays: it reinforces where there's already signal" : "stay: they reinforce where there's already signal"}.${o.ultima ? " I won't ask about the antennas you place again; if you want me to check whether something is missing or extra, ask me “are there too many antennas?”." : ""}`,
        ),
      };
    }
    case "disenar":
      return ejecutarDiseno(o, api, antes);
    case "poblar":
    case "quitar-pobladas":
    case "carga":
    case "zonas":
    case "quitar-zonas":
    case "estres":
    case "limite":
    case "optimizar":
    case "aplicar-optimizacion":
    case "usuarios-estres":
    case "trama-departamento":
    case "trama-dimensionar":
      return ejecutarCapacidad(o, api);
    case "ajustar":
      return ejecutarAjuste(o, api, antes);
    case "aplicar-ajuste": {
      const op = o.ajuste.opciones[o.indice];
      if (!op) return { texto: tx("Esa opción ya no está disponible. Pídame el ajuste de nuevo.", "That option is no longer available. Ask me for the adjustment again.") };
      api.aplicarAjuste(o.ajuste, o.indice, o.base);
      return {
        texto: tx(`Aplico la opción «${op.titulo}» y simulo…`, `Applying the “${op.titulo}” option and simulating…`),
        deshacer: o.base,
        luego: api.esperarResultado().then((r) => textoAjusteAplicado(o.ajuste, o.indice, r, o.base)),
      };
    }
    case "descartar-ajuste":
      api.descartarAjuste();
      return { texto: tx("Listo, descarté la propuesta de ajuste. La red quedó como estaba.", "Done, I discarded the adjustment proposal. The network is as it was.") };
    case "area-objetivo": {
      if (o.quitar) {
        if (!api.areaObjetivo()) return { texto: tx("No hay área objetivo: la factibilidad ya se mide en el área de estudio (los círculos alrededor de los nodos antena).", "There's no target area: feasibility is already measured in the study area (the circles around the antenna nodes).") };
        api.fijarAreaObjetivo(null);
        return {
          texto: tx("Listo: quité el área objetivo. La factibilidad vuelve a medirse en el área de estudio (60 % con señal media o mejor).", "Done: I removed the target area. Feasibility is measured in the study area again (60% with fair or better signal)."),
          esperar: antenas.some((a) => a.activa) ? "*" : undefined,
        };
      }
      const m = o.id ? api.mediciones().find((x) => x.id === o.id) : undefined;
      if (!m)
        return {
          texto: tx(
            "No encuentro un área medida. Dibújela con la regla (Área) y pídamelo de nuevo: «usa el área que medí como área objetivo con el 95 %».",
            "I can't find a measured area. Draw it with the ruler (Area) and ask me again: “use the area I measured as the target area with 95%”.",
          ),
          acciones: [{ texto: tx("Activar la regla", "Turn on the ruler"), accion: "orden", orden: { tipo: "herramienta", herramienta: "regla" } }],
        };
      const meta = o.metaPct ?? 90;
      const margen = o.margenDb ?? 30;
      api.fijarAreaObjetivo(m.id, { metaPct: meta, margenDb: margen });
      return {
        texto: tx(
          `Listo: «${m.nombre}» es el área objetivo. La factibilidad ahora pide el ${fp(meta)} % de esa área con ${margen >= 45 ? "señal buena" : margen >= 37 ? "señal estable o mejor" : "señal media o mejor"} (≥ ${margen} dB)${o.metaPct === undefined ? " (meta por defecto; dígame otra: «con el 99 %»)" : ""}.`,
          `Done: “${m.nombre}” is the target area. Feasibility now requires ${fp(meta)}% of that area with ${margen >= 45 ? "good signal" : margen >= 37 ? "stable or better signal" : "fair or better signal"} (≥ ${margen} dB)${o.metaPct === undefined ? " (default target; tell me another one: “with 99%”)" : ""}.`,
        ),
        esperar: antenas.some((a) => a.activa) ? "*" : undefined,
      };
    }
    case "relieve":
      api.fijarRelieve(o.valor);
      return {
        texto:
          o.valor === "plano"
            ? tx(
                "Listo: simulo sobre terreno plano (sin lomas ni valles). Sirve para comparar; para planear en serio vuelva al relieve real con «usa el relieve real».",
                "Done: I'm simulating on flat terrain (no hills or valleys). It's useful for comparison; for serious planning, go back to the real terrain with “use the real terrain”.",
              )
            : tx("Listo: simulo con el relieve real (teselas de elevación abiertas, sin costo).", "Done: I'm simulating with the real terrain (open elevation tiles, free of charge)."),
        esperar: antenas.some((a) => a.activa) ? "*" : undefined,
      };
    case "nombre-escenario":
      api.renombrarEscenario(o.nombre.slice(0, 80));
      return {
        texto: tx(`Listo: el escenario se llama «${o.nombre.slice(0, 80)}». Así sale en los archivos que exporte.`, `Done: the scenario is called “${o.nombre.slice(0, 80)}”. That's how it will appear in the files you export.`),
        acciones: [deshacer()],
        deshacer: antes,
      };
    case "duplicar": {
      const a = porId.get(o.id);
      if (!a) return { texto: noEncontreNodo() };
      api.duplicar(a.id);
      return {
        texto: tx(`Dupliqué «${a.nombre}»: la copia quedó al lado, con los mismos datos. Arrástrela o dígame a dónde la muevo.`, `I duplicated “${a.nombre}”: the copy is right beside it, with the same data. Drag it or tell me where to move it.`),
        acciones: [deshacer()],
        deshacer: antes,
        esperar: "*",
      };
    }
    case "seleccionar": {
      const a = porId.get(o.id);
      if (!a) return { texto: noEncontreNodo() };
      api.seleccionar(a.id);
      api.centrar(a.lat, a.lon, 13);
      return { texto: tx(`Aquí está «${a.nombre}»: lo dejé seleccionado para editarlo.`, `Here is “${a.nombre}”: I've selected it so you can edit it.`), nodo: a.id };
    }
    case "usar-economica": {
      const quitar = antenas.filter((a) => o.ids.includes(a.id));
      if (!quitar.length) return { texto: tx("Esos repetidores ya no están en el mapa: la opción económica era para el diseño anterior.", "Those repeaters are no longer on the map: the economical option was for the previous design.") };
      api.eliminarVarias(quitar.map((a) => a.id));
      const nombres = quitar.map((a) => a.nombre).join(", ");
      const cuantos = () => tx(quitar.length === 1 ? "1 repetidor" : `${quitar.length} repetidores`, quitar.length === 1 ? "1 repeater" : `${quitar.length} repeaters`);
      const luego = (async (): Promise<Respuesta> => {
        const r = await api.esperarResultado();
        const real = r ? coberturaEnArea(r, o.area, o.respaldo ? "segundo" : "mejor") : null;
        const pct = real ? porcentajeSobre(real, o.margenDb) : null;
        const ahorro = o.ahorroCop > 0 ? tx(` y ahorra unos ${pesosTrama(o.ahorroCop)}`, `, saving about ${pesosTrama(o.ahorroCop)}`) : "";
        return {
          texto:
            pct === null
              ? tx(`Quité ${cuantos()} (${nombres})${ahorro}. Simule para ver la cobertura del área.`, `I removed ${cuantos()} (${nombres})${ahorro}. Simulate to see the area's coverage.`)
              : tx(
                  `Opción económica lista: la malla cubre el ${fp(pct)} % del área con ${o.clases} (la meta era ${fp(o.metaPct)} %). Quité ${cuantos()} (${nombres})${ahorro}.${real ? ` Dentro del área: ${resumenClases(real)}.` : ""}`,
                  `Economical option ready: the mesh covers ${fp(pct)}% of the area with ${o.clases} (the target was ${fp(o.metaPct)}%). I removed ${cuantos()} (${nombres})${ahorro}.${real ? ` Inside the area: ${resumenClases(real)}.` : ""}`,
                ),
          acciones: [deshacer()],
        };
      })();
      return {
        texto: tx(`Quito ${cuantos()} (${nombres}) para la opción económica y mido de nuevo la cobertura del área.`, `Removing ${cuantos()} (${nombres}) for the economical option and measuring the area's coverage again.`),
        acciones: [deshacer()],
        deshacer: antes,
        luego,
      };
    }
    case "eliminar-varios": {
      const quitar = antenas.filter((a) => o.ids.includes(a.id));
      if (!quitar.length) return { texto: tx(`No hay ${o.descripcion.replace(/^tod[oa]s (l[oa]s )?/, "")} para borrar.`, `There are no ${o.descripcion.replace(/^(?:tod[oa]s (?:l[oa]s )?|all (?:the )?)/, "")} to delete.`) };
      api.eliminarVarias(quitar.map((a) => a.id));
      return {
        texto: tx(
          `Borré ${quitar.length === 1 ? "1 nodo" : `${quitar.length} nodos`} (${o.descripcion}): ${quitar.map((a) => a.nombre).join(", ")}.${antenas.length > quitar.length ? " Recalculo la red." : ""}`,
          `I deleted ${quitar.length === 1 ? "1 node" : `${quitar.length} nodes`} (${o.descripcion}): ${quitar.map((a) => a.nombre).join(", ")}.${antenas.length > quitar.length ? " Recalculating the network." : ""}`,
        ),
        acciones: [deshacer()],
        deshacer: antes,
        esperar: antenas.length > quitar.length ? "*" : undefined,
      };
    }
    case "editar-varios": {
      const cambiar = antenas.filter((a) => o.ids.includes(a.id));
      if (!cambiar.length) return { texto: tx("No encontré nodos de ese tipo.", "I couldn't find nodes of that type.") };
      for (const a of cambiar) api.editar(a.id, o.deltaAlturaM !== undefined ? { ...o.cambios, alturaM: alturaCon(a.alturaM, o.deltaAlturaM) } : o.cambios);
      return {
        texto: tx(`Hecho: ${o.descripcion} (${cambiar.map((a) => a.nombre).join(", ")}). Recalculo la simulación.`, `Done: ${o.descripcion} (${cambiar.map((a) => a.nombre).join(", ")}). Recalculating the simulation.`),
        acciones: [deshacer()],
        deshacer: antes,
        esperar: "*",
      };
    }
    case "auto":
      api.fijarAutoSimular(o.valor);
      if (o.valor) api.simular();
      return {
        texto: o.valor
          ? tx("Listo: «Simular al cambiar» quedó encendido. Cada vez que cambie algo, recalculo la cobertura solo.", "Done: “Simulate on change” is on. Every time something changes, I'll recalculate the coverage on my own.")
          : tx("Listo: «Simular al cambiar» quedó apagado. Cuando quiera ver el resultado, dígame «simula» o toque «Simular».", "Done: “Simulate on change” is off. When you want to see the result, tell me “simulate” or tap “Simulate”."),
      };
    case "paneles": {
      if (o.barra !== undefined)
        return {
          texto: o.barra
            ? tx(
                "La barra de herramientas de arriba se despliega solo con la flechita de la esquina superior derecha del mapa: tóquela para verla y otra vez para ocultarla.",
                "The toolbar at the top only opens with the little arrow in the top right corner of the map: tap it to see it, and again to hide it.",
              )
            : tx(
                "La barra de arriba se oculta con la misma flechita de la esquina superior derecha del mapa; al abrir el simulador siempre empieza oculta.",
                "The top bar hides with the same little arrow in the top right corner of the map; it always starts hidden when you open the simulator.",
              ),
        };
      const donde = api.paneles({ izquierdo: o.izquierdo, derecho: o.derecho });
      const ocultos = o.izquierdo === false || o.derecho === false;
      if (donde === "celular")
        return {
          texto: ocultos
            ? tx(
                "Listo, dejé solo el mapa. En el celular los paneles se abren con los botones de abajo («Sembrar», «Nodos», «Parámetros», «Resultado»).",
                "Done, I left just the map. On the phone, the panels open with the buttons at the bottom (“Seed”, “Nodes”, “Parameters”, “Result”).",
              )
            : tx("En el celular los paneles se abren con los botones de abajo: toque «Sembrar», «Nodos», «Parámetros» o «Resultado».", "On the phone, the panels open with the buttons at the bottom: tap “Seed”, “Nodes”, “Parameters” or “Result”."),
        };
      const ambos = o.izquierdo !== undefined && o.derecho !== undefined;
      const cual = ambos ? tx("los paneles", "the panels") : o.izquierdo !== undefined ? tx("el panel izquierdo", "the left panel") : tx("el panel de resultados", "the results panel");
      if (o.izquierdo === false && o.derecho === false)
        return {
          texto: tx(
            "Listo: pantalla limpia, solo el mapa. Sigo trabajando igual; cuando quiera verlos, diga «muestra los paneles» o use los botones de la barra de arriba (la despliega la flechita de la esquina).",
            "Done: a clean screen, just the map. I keep working the same way; when you want to see them, say “show the panels” or use the buttons in the top bar (the little arrow in the corner shows it).",
          ),
        };
      return {
        texto: ocultos
          ? tx(`Listo, oculté ${cual}. Para volver a verlo, dígamelo o use el botón de la barra de arriba (la despliega la flechita de la esquina).`, `Done, I hid ${cual}. To see ${ambos ? "them" : "it"} again, tell me or use the button in the top bar (the little arrow in the corner shows it).`)
          : tx(`Listo, ${ambos ? "ya están los paneles" : `ya está ${cual}`} a la vista.`, `Done, ${ambos ? "the panels are" : `${cual} is`} in view.`),
      };
    }
    case "zoom": {
      if (!api.zoom) return { texto: tx("Acerque o aleje el mapa con la rueda del ratón (en el celular, con dos dedos).", "Zoom the map in or out with the mouse wheel (on a phone, with two fingers).") };
      api.zoom(o.pasos);
      const k = Math.abs(o.pasos);
      const cuanto = k < 1 ? tx(" un poco", " a little") : k >= 5 ? tx(" al máximo", " all the way") : k > 2 ? tx(` ${k} niveles`, ` ${k} levels`) : k === 2 ? tx(" bastante", " a lot") : "";
      return { texto: o.pasos > 0 ? tx(`Listo, acerqué el mapa${cuanto}.`, `Done, I zoomed the map in${cuanto}.`) : tx(`Listo, alejé el mapa${cuanto}.`, `Done, I zoomed the map out${cuanto}.`) };
    }
    case "encuadrar":
      if (!antenas.length) return { texto: tx("Aún no hay nodos en el mapa.", "There are no nodes on the map yet.") };
      api.encuadrarTodo();
      return { texto: tx(`Le muestro toda la red: ${antenas.length} ${antenas.length === 1 ? "nodo" : "nodos"}.`, `Here is the whole network: ${antenas.length} ${antenas.length === 1 ? "node" : "nodes"}.`) };
    case "cobertura-area": {
      const m = api.mediciones().find((x) => x.id === o.id);
      if (!m) return { texto: tx("No encuentro esa área medida.", "I can't find that measured area.") };
      const r = api.resultado();
      if (!r || !api.red().alDia) {
        if (!antenas.some((a) => a.activa)) return { texto: tx("Todavía no hay nodos que den cobertura en esa área.", "There are no nodes providing coverage in that area yet.") };
        return {
          texto: tx(`Calculo la cobertura dentro de «${m.nombre}»…`, `Calculating the coverage inside “${m.nombre}”…`),
          luego: api.esperarResultado().then((x) => (x ? textoCoberturaArea(x, m, o.margenDb) : { texto: tx("No pude terminar la simulación.", "I couldn't finish the simulation.") })),
        };
      }
      return textoCoberturaArea(r, m, o.margenDb);
    }
  }
}

/* ───────────── Diseño por área: ejecución y respuesta ───────────── */

/** «99,9», «95», «100» (en inglés «99.9»). */
const fp = (v: number) => (v >= 99.95 && v < 100 ? tx("99,9", "99.9") : Number.isInteger(Math.round(v * 10) / 10) ? String(Math.round(v)) : f1(Math.floor(v * 10) / 10));

const resumenClases = (c: { porClase: Record<string, number> }) =>
  tx(
    `buena ${fp(c.porClase.buena)} %, estable ${fp(c.porClase.estable)} %, media ${fp(c.porClase.media)} %, baja ${fp(c.porClase.baja)} % y sin servicio ${fp(c.porClase.sin)} %`,
    `good ${fp(c.porClase.buena)}%, stable ${fp(c.porClase.estable)}%, fair ${fp(c.porClase.media)}%, weak ${fp(c.porClase.baja)}% and no service ${fp(c.porClase.sin)}%`,
  );

function textoCoberturaArea(r: ResultadoSimulacion, m: Medicion, margenDb: number): Respuesta {
  const c = coberturaEnArea(r, m.puntos);
  const pct = porcentajeSobre(c, margenDb);
  return {
    texto: tx(
      `En «${m.nombre}» (${textoArea(c.areaKm2 * 1e6)}) el ${fp(pct)} % tiene margen de al menos ${margenDb} dB${margenDb === 30 ? " (señal media o mejor)" : ""}. Por clase: ${resumenClases(c)}.${c.fueraKm2 > 0.01 ? ` Una parte (${f1(c.fueraKm2, 2)} km²) queda fuera del radio de estudio: súbalo para verla.` : ""}`,
      `In “${m.nombre}” (${textoArea(c.areaKm2 * 1e6)}), ${fp(pct)}% has a margin of at least ${margenDb} dB${margenDb === 30 ? " (fair or better signal)" : ""}. By class: ${resumenClases(c)}.${c.fueraKm2 > 0.01 ? ` Part of it (${f1(c.fueraKm2, 2)} km²) lies outside the study radius: increase it to see that part.` : ""}`,
    ),
  };
}

/* ───────────── Ajuste inteligente ───────────── */

/** «62 % del área de estudio con señal útil (media o mejor)» o, con área objetivo, «88 % de «Lote 3» con señal media o mejor (meta 95 %)». */
export function textoCoberturaUtil(r: ResultadoSimulacion): string {
  const o = r.areaObjetivo;
  if (o) {
    const senal = o.margenDb >= 45 ? "señal buena" : o.margenDb >= 37 ? "señal estable o mejor" : "señal media o mejor";
    const senalEn = o.margenDb >= 45 ? "good signal" : o.margenDb >= 37 ? "stable or better signal" : "fair or better signal";
    return tx(`${fp(o.utilPct)} % de «${o.nombre}» con ${senal} (meta ${fp(o.metaPct)} %)`, `${fp(o.utilPct)}% of “${o.nombre}” with ${senalEn} (target ${fp(o.metaPct)}%)`);
  }
  return tx(`${fp(r.porcentajeUtil)} % del área de estudio con cobertura útil, señal media o mejor (meta ${META_UTIL_ESTUDIO_PCT} %)`, `${fp(r.porcentajeUtil)}% of the study area with useful coverage, fair or better signal (target ${META_UTIL_ESTUDIO_PCT}%)`);
}

/** El botón «Ajústamelo automáticamente» (u «Optimizar la red») para las respuestas de Melki. */
export function accionAjuste(r: ResultadoSimulacion | null): AccionRespuesta | null {
  if (!r) return null;
  const orden: Orden = { tipo: "ajustar", aplicar: false, opcion: "recomendada", opciones: {}, avisos: [] };
  return { texto: r.factibilidad.nivel === "factible" ? tx("Optimizar el costo", "Optimize the cost") : tx("Ajústamelo automáticamente", "Adjust it for me"), accion: "orden", orden };
}

const indiceOpcion = (a: Ajuste, id: OpcionAjusteId) => {
  const i = a.opciones.findIndex((x) => x.id === id);
  return i >= 0 ? i : a.recomendada;
};

function ejecutarAjuste(o: Extract<Orden, { tipo: "ajustar" }>, api: Api, antes: Escenario): ResultadoOrden {
  const activas = api.antenas().filter((a) => a.activa);
  if (!activas.length)
    return {
      texto: tx(
        "Todavía no hay red que ajustar. Ponga el gateway y los nodos, o pídame una red completa para un área: «ármame una malla que cubra 500 hectáreas alrededor de Cumaral con señal media en el 99 %».",
        "There's no network to adjust yet. Place the gateway and the nodes, or ask me for a complete network for an area: “build me a mesh covering 500 hectares around Cumaral with fair signal in 99%”.",
      ),
    };
  if (!activas.some((a) => a.pasarela))
    return {
      texto: tx(
        "Primero ponga el Gateway + Internet (la pasarela): el ajuste parte de él. Dígame dónde entra el internet: «pon el gateway en 4.2, -73.37».",
        "First place the Gateway + Internet: the adjustment starts from it. Tell me where the internet comes in: “put the gateway at 4.2, -73.37”.",
      ),
      acciones: [{ texto: tx("Poner el gateway", "Place the gateway"), accion: "orden", orden: { tipo: "pieza", pieza: "gateway", datos: {} } }],
    };
  const area = api.areaObjetivo();
  const limites: string[] = [];
  if (o.opciones.alturaMaxM !== undefined && o.opciones.alturaMaxM < 30) limites.push(tx(`torres de hasta ${fn(o.opciones.alturaMaxM)} m`, `towers up to ${fn(o.opciones.alturaMaxM)} m`));
  if (o.opciones.maxApoyos !== undefined)
    limites.push(
      o.opciones.maxApoyos === 0
        ? tx("sin antenas de apoyo", "no support antennas")
        : tx(`máximo ${o.opciones.maxApoyos} ${o.opciones.maxApoyos === 1 ? "antena" : "antenas"} de apoyo`, `at most ${o.opciones.maxApoyos} support ${o.opciones.maxApoyos === 1 ? "antenna" : "antennas"}`),
    );
  if (o.opciones.permisos?.mover === false) limites.push(tx("sin mover nodos", "without moving nodes"));
  if (o.opciones.permisos?.apoyos === false && o.opciones.maxApoyos === undefined) limites.push(tx("sin antenas de apoyo", "no support antennas"));
  if (o.opciones.permisos?.antenas === false) limites.push(tx("sin cambiar antenas", "without changing antennas"));
  if (o.opciones.permisos?.alturas === false) limites.push(tx("sin cambiar alturas", "without changing heights"));
  if (o.opciones.sitios?.length)
    limites.push(
      tx(
        `apoyos solo en ${o.opciones.sitios.length === 1 ? "el sitio que me dio" : `los ${o.opciones.sitios.length} sitios que me dio`}`,
        `support antennas only at ${o.opciones.sitios.length === 1 ? "the site you gave me" : `the ${o.opciones.sitios.length} sites you gave me`}`,
      ),
    );
  const luego = (async (): Promise<Respuesta> => {
    const a = await api.ajustarRed(o.opciones);
    if (!a) return { texto: tx("No pude calcular el ajuste (el relieve no cargó o el motor se detuvo). Intente de nuevo en un momento.", "I couldn't calculate the adjustment (the terrain didn't load or the engine stopped). Please try again in a moment.") };
    const i = indiceOpcion(a, o.opcion);
    const op = a.opciones[i];
    if (o.aplicar && op && op.cambios.length) {
      api.aplicarAjuste(a, i, antes);
      const r = await api.esperarResultado();
      return textoAjusteAplicado(a, i, r, antes);
    }
    api.mostrarAjuste(a, i);
    return textoAjustePropuesta(a, i, antes);
  })();
  return {
    texto: tx(
      `${o.avisos.length ? `${o.avisos.join(" ")} ` : ""}Analizo la red como lo haría un planeador, con el relieve real: pruebo subir o bajar cada torre (hasta ${fn(o.opciones.alturaMaxM ?? 30)} m), correr nodos a lomas cercanas, cambiar el tipo de antena y sugerir antenas de apoyo, y comparo cuánto cubre cada opción contra lo que cuesta${area ? ` en «${area.nombre}»` : ""}${limites.length ? ` (${limites.join(", ")})` : ""}. Tardo unos segundos.`,
      `${o.avisos.length ? `${o.avisos.join(" ")} ` : ""}I'm analyzing the network as a planner would, with the real terrain: I try raising or lowering each tower (up to ${fn(o.opciones.alturaMaxM ?? 30)} m), moving nodes to nearby hills, changing the antenna type and suggesting support antennas, and I compare how much each option covers against what it costs${area ? ` in “${area.nombre}”` : ""}${limites.length ? ` (${limites.join(", ")})` : ""}. This takes a few seconds.`,
    ),
    luego,
  };
}

/** Cómo quedó la red después de aplicar una opción del ajuste (con la simulación real). */
function textoAjusteAplicado(a: Ajuste, i: number, r: ResultadoSimulacion | null, base: Escenario): Respuesta {
  const op = a.opciones[i];
  const partes: string[] = [];
  const f = r?.factibilidad;
  const util = r ? (r.areaObjetivo ? r.areaObjetivo.utilPct : r.porcentajeUtil) : op.resumen.utilPct;
  const zona = r?.areaObjetivo ? tx(`de «${r.areaObjetivo.nombre}»`, `of “${r.areaObjetivo.nombre}”`) : tx("del área de estudio", "of the study area");
  partes.push(
    tx(
      `Listo: apliqué la opción «${op.titulo}»${f ? ` y la red quedó ${f.nivel === "factible" ? "factible" : f.titulo.toLowerCase()} (${f.puntaje}/100)` : ""}: cobertura útil del ${fp(util)} % ${zona}, antes ${fp(a.inicial.utilPct)} %.`,
      `Done: I applied the “${op.titulo}” option${f ? ` and the network is now ${f.nivel === "factible" ? "feasible" : f.titulo.toLowerCase()} (${f.puntaje}/100)` : ""}: useful coverage of ${fp(util)}% ${zona}, up from ${fp(a.inicial.utilPct)}%.`,
    ),
  );
  const cambios = op.cambios.map(textoCambio);
  partes.push(
    tx(
      `Lo que cambié: ${cambios.slice(0, 6).join("; ")}${cambios.length > 6 ? `; y ${cambios.length - 6} cambios más (los ve en el mapa y en la lista de nodos)` : ""}.`,
      `What I changed: ${cambios.slice(0, 6).join("; ")}${cambios.length > 6 ? `; and ${cambios.length - 6} more changes (you can see them on the map and in the node list)` : ""}.`,
    ),
  );
  if (a.area.tipo === "zona") partes.push(tx("Como no había un área pedida, dejé la zona de la red como área objetivo: así la factibilidad se mide siempre en la misma zona.", "Since no area was requested, I set the network's zone as the target area: that way feasibility is always measured in the same zone."));
  // El análisis llega del motor en el idioma de la pantalla: se reconoce por su texto en español (mismo orden)
  const analisisEs = retraducir(a, "es").analisis;
  const otras = a.analisis.filter((_t, k) => /^(La de máxima|Si quiere más|Si basta)/.test(analisisEs[k] ?? ""));
  if (otras.length) partes.push(otras.join(" "));
  if (f && f.nivel !== "factible" && f.recomendaciones[0]) partes.push(tx(`Todavía: ${f.recomendaciones[0]}`, `Still pending: ${f.recomendaciones[0]}`));
  if (a.motivo) partes.push(a.motivo);
  partes.push(tx("Las antenas de apoyo son puntos sugeridos: antes de instalar, revise en campo el acceso, la energía y que nada tape las antenas.", "The support antennas are suggested points: before installing, check the access and the power in the field, and that nothing blocks the antennas."));
  const acciones: Respuesta["acciones"] = [{ texto: tx("Deshacer", "Undo"), accion: "deshacer", escenario: base }];
  a.opciones.forEach((x, k) => {
    if (k !== i && x.cambios.length) acciones.push({ texto: tx(`Usar «${x.titulo}»`, `Use “${x.titulo}”`), accion: "orden", orden: { tipo: "aplicar-ajuste", ajuste: a, indice: k, base } });
  });
  return { texto: partes.join("\n"), acciones };
}

/** La propuesta del ajuste, sin aplicar: diagnóstico, opciones y recomendación. */
function textoAjustePropuesta(a: Ajuste, i: number, base: Escenario): Respuesta {
  const partes = [...a.analisis];
  const op = a.opciones[i];
  if (!a.opciones.length || !op?.cambios.length) {
    partes.push(a.modo === "optimizar" ? tx("No hay nada que cambiar: la red ya está bien dimensionada para su meta.", "There's nothing to change: the network is already well sized for its target.") : tx("No encontré cambios que mejoren la red con esos límites.", "I found no changes that improve the network within those limits."));
    return { texto: partes.join("\n") };
  }
  const cambios = op.cambios.map(textoCambio);
  partes.push(
    tx(
      `«${op.titulo}» necesita ${resumenCambios(op)}:\n${cambios.slice(0, 8).map((t) => `• ${t}`).join("\n")}${cambios.length > 8 ? `\n• y ${cambios.length - 8} cambios más (en el panel)` : ""}`,
      `“${op.titulo}” needs ${resumenCambios(op)}:\n${cambios.slice(0, 8).map((t) => `• ${t}`).join("\n")}${cambios.length > 8 ? `\n• and ${cambios.length - 8} more changes (in the panel)` : ""}`,
    ),
  );
  partes.push(tx("Le dejé la propuesta en el panel Resultado y en el mapa (las antenas de apoyo se ven como torres punteadas). ¿La aplico?", "I left the proposal in the Result panel and on the map (the support antennas appear as dotted towers). Shall I apply it?"));
  const acciones: Respuesta["acciones"] = a.opciones
    .map((x, k) => ({ x, k }))
    .filter(({ x }) => x.cambios.length)
    .map(({ x, k }) => ({ texto: tx(`Aplicar «${x.titulo}»${k === a.recomendada ? " (recomendada)" : ""}`, `Apply “${x.titulo}”${k === a.recomendada ? " (recommended)" : ""}`), accion: "orden" as const, orden: { tipo: "aplicar-ajuste" as const, ajuste: a, indice: k, base } }));
  acciones.push({ texto: tx("Descartar", "Discard"), accion: "orden", orden: { tipo: "descartar-ajuste" } });
  return { texto: partes.join("\n"), acciones };
}

function ejecutarDiseno(o: Extract<Orden, { tipo: "disenar" }>, api: Api, antes: Escenario): ResultadoOrden {
  if (o.reemplazar) api.restaurar(o.reemplazar);
  const base = o.reemplazar ?? antes;
  const antenas = o.reemplazar ? o.reemplazar.antenas : api.antenas();
  let poligono: Poligono;
  let donde = "";
  let dibujar = true;
  let nombreArea = "";
  let idArea: string | null = null;
  if (o.area.forma === "medicion") {
    const id = o.area.id;
    const m = api.mediciones().find((x) => x.id === id) ?? [...api.mediciones()].reverse().find((x) => x.tipo === "area");
    if (!m)
      return {
        texto: tx(
          "No encuentro un área medida. Dibújela con la regla (Área) y pídamelo de nuevo, o dígame el tamaño: «cubre 500 hectáreas alrededor del gateway con señal media en el 99 %».",
          "I can't find a measured area. Draw it with the ruler (Area) and ask me again, or tell me the size: “cover 500 hectares around the gateway with fair signal in 99%”.",
        ),
        acciones: [{ texto: tx("Activar la regla", "Turn on the ruler"), accion: "orden", orden: { tipo: "herramienta", herramienta: "regla" } }],
      };
    poligono = m.puntos;
    dibujar = false;
    nombreArea = m.nombre;
    idArea = m.id;
    donde = tx(`en el área «${m.nombre}»`, `in the area “${m.nombre}”`);
  } else if (o.area.forma === "poligono") {
    const puntos = o.area.puntos;
    poligono = puntos;
    dibujar = o.area.dibujar;
    donde = o.area.nombre;
    // Rehacer sobre la misma área: se sigue usando su medición
    const m = api.mediciones().find((x) => x.tipo === "area" && x.puntos.length === puntos.length && x.puntos.every((p, i) => p[0] === puntos[i][0] && p[1] === puntos[i][1]));
    if (m && !dibujar) {
      idArea = m.id;
      nombreArea = m.nombre;
    }
  } else {
    const a = o.area;
    let centro: { lat: number; lon: number } | null = null;
    if (a.centro.tipo === "coord") {
      centro = a.centro.coord;
      const lugar = api.ubicacion(centro.lat, centro.lon);
      const nombre = a.centro.nombre;
      // «a 10 km al norte de…», «en Cumaral (Meta)», «alrededor del gateway» ya traen su preposición (en inglés: «10 km
      // north of…», «in…», «at…», «around…»)
      const conPreposicion = nombre ? nombre.startsWith("a ") || nombre.startsWith("en ") || nombre.startsWith("alrededor") : false;
      donde = nombre
        ? tx(`${conPreposicion ? "" : "en "}${nombre}`, `${conPreposicion || /^(?:in|at|around|near)\b|^\d/.test(nombre) ? "" : "in "}${nombre}`)
        : tx(`alrededor de ${aDecimal(centro.lat)}, ${aDecimal(centro.lon)}${lugar ? ` (${lugar})` : ""}`, `around ${aDecimal(centro.lat)}, ${aDecimal(centro.lon)}${lugar ? ` (${lugar})` : ""}`);
    } else if (a.centro.tipo === "gateway") {
      const g = antenas.find((x) => x.pasarela && x.activa);
      if (g) {
        centro = { lat: g.lat, lon: g.lon };
        donde = tx(`alrededor del gateway «${g.nombre}»`, `around the gateway “${g.nombre}”`);
      }
    }
    if (!centro) {
      centro = api.centroMapa();
      const lugar = centro ? api.ubicacion(centro.lat, centro.lon) : null;
      donde = tx(`en el centro del mapa que está viendo${lugar ? `, en ${lugar}` : ""}`, `at the center of the map you're viewing${lugar ? `, in ${lugar}` : ""}`);
    }
    if (!centro) return { texto: tx("¿Dónde armo la malla? Dígame un municipio, una coordenada o dibuje el área con la regla.", "Where should I build the mesh? Tell me a municipality or a coordinate, or draw the area with the ruler.") };
    if (a.areaM2 < 5000)
      return {
        texto: tx(
          "Esa área es muy pequeña (menos de media hectárea): con un solo nodo basta. Dígame un área más grande o ponga el gateway directamente.",
          "That area is very small (less than half a hectare): a single node is enough. Tell me a larger area or place the gateway directly.",
        ),
      };
    if (a.areaM2 > 3e9)
      return {
        texto: tx(
          "Esa área es muy grande para diseñarla de una vez (más de 300.000 ha). Divídala en zonas y pídamelas por partes, por ejemplo por municipio.",
          "That area is too large to design at once (more than 300,000 ha). Split it into zones and ask me for them in parts, for example by municipality.",
        ),
      };
    poligono =
      a.forma === "circulo"
        ? conArea(poligonoCirculo(centro.lat, centro.lon, radioDeArea(a.areaM2)), a.areaM2)
        : conArea(poligonoRectangulo(centro.lat, centro.lon, a.anchoM ?? Math.sqrt(a.areaM2), a.altoM ?? Math.sqrt(a.areaM2)), a.areaM2);
  }
  const area = areaM2(poligono);
  if (area > 3e9) return { texto: tx("Esa área es muy grande para diseñarla de una vez (más de 300.000 ha). Divídala en zonas y pídamelas por partes.", "That area is too large to design at once (more than 300,000 ha). Split it into zones and ask me for them in parts.") };
  // El gateway que ya hay solo cuenta si alcanza el área; en otro municipio la malla lleva su propio gateway
  const gw = antenas.find((x) => x.pasarela && x.activa && sirveAlArea(poligono, x.lat, x.lon));
  // Presupuesto: cuántos repetidores caben (con el sitio del gateway si hay que ponerlo y las radios que pida la gente)
  const b0 = cajaPoligono(poligono);
  const enCentro = gw ?? { lat: (b0.sur + b0.norte) / 2, lon: (b0.oeste + b0.este) / 2 };
  const { logistica } = logisticaEn(api, enCentro.lat, enCentro.lon);
  let maxRepetidores = o.maxRepetidores;
  let conPresupuesto = "";
  if (o.presupuesto) {
    const sf = sfTrama(presetPorId(api.parametros().preset).sf);
    const radios = o.usuarios ? Math.min(4, capacidadPara(o.usuarios.n, sf).radios) - 1 : 0;
    const caben = repetidoresEnPresupuesto(o.presupuesto.cop, !gw, logistica, Math.max(0, radios));
    const plata = o.presupuesto.dolares ? `USD ${numeroLocal(Math.round(o.presupuesto.dolares))} (${pesosTrama(o.presupuesto.cop)})` : pesosTrama(o.presupuesto.cop);
    if (caben === null)
      return {
        texto: tx(
          `Con ${plata} no alcanza ni para el sitio del gateway: con su torre de 12 m, la radio, el Starlink, la energía solar, la instalación y el transporte cuesta unos ${pesosTrama(costoGatewayInstalado(logistica))}. Dígame un presupuesto mayor o use un gateway que ya exista en la zona.`,
          `${plata} isn't enough even for the gateway site: with its 12 m tower, the radio, the Starlink, the solar power, the installation and the transport, it costs about ${pesosTrama(costoGatewayInstalado(logistica))}. Tell me a larger budget or use a gateway that already exists in the area.`,
        ),
      };
    maxRepetidores = Math.min(maxRepetidores, caben);
    conPresupuesto = tx(
      ` Con ${plata} de presupuesto caben ${caben === 0 ? "solo el gateway (ningún repetidor)" : `hasta ${caben === 1 ? "1 repetidor" : `${caben} repetidores`}`}${gw ? "" : " además del gateway"}.`,
      ` A budget of ${plata} covers ${caben === 0 ? "only the gateway (no repeaters)" : `up to ${caben === 1 ? "1 repeater" : `${caben} repeaters`}`}${gw ? "" : " plus the gateway"}.`,
    );
  }
  if (o.gateway && gw) api.editar(gw.id, { lat: Number(o.gateway.lat.toFixed(6)), lon: Number(o.gateway.lon.toFixed(6)), activa: true });
  const forma = o.area.forma === "cuadrado" ? "cuadrada" : o.area.forma === "rectangulo" ? "rectangular" : "";
  const formaEn = o.area.forma === "cuadrado" ? "square" : o.area.forma === "rectangulo" ? "rectangular" : "";
  const medidaDicha = "medida" in o.area ? o.area.medida : undefined;
  if (dibujar) {
    // El nombre del área no repite su tamaño (la regla lo escribe al lado): el municipio, el radio pedido o el área dicha
    const cual = ("etiqueta" in o.area && o.area.etiqueta) || textoArea(area);
    nombreArea = tx(`Área objetivo · ${cual}`, `Target area · ${cual}`);
    idArea = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    api.medir({ id: idArea, nombre: nombreArea, tipo: "area", puntos: poligono, visible: true }, false);
  } else {
    const b = cajaPoligono(poligono);
    api.encuadrarCaja([b.oeste, b.sur, b.este, b.norte]);
  }
  const meta = tx(`${o.clases} en el ${fp(o.porcentaje)} % del área${o.respaldo ? ", con respaldo (cada punto con dos nodos)" : ""}`, `${o.clases} in ${fp(o.porcentaje)}% of the area${o.respaldo ? ", with backup (each point covered by two nodes)" : ""}`);
  // Freno de rendimiento: un repetidor debe cubrir al menos ese % del área (menos exigente si se pidió una meta muy alta)
  const eficiencia = o.aCualquierCosto ? null : { minPct: o.porcentaje >= 99.5 ? 0.05 : o.porcentaje >= 98 ? 0.1 : 0.3 };
  const pedido = { area: poligono, margenDb: o.margenDb, porcentaje: o.porcentaje, respaldo: o.respaldo, alturaRepetidorM: o.alturaM, gateway: o.gateway, maxRepetidores, eficiencia };
  const luego = (async (): Promise<Respuesta> => {
    const d = await api.disenarArea(pedido);
    if (!d)
      return {
        texto: tx("No pude calcular el diseño (el relieve no cargó o el motor se detuvo). Intente de nuevo en un momento.", "I couldn't calculate the design (the terrain didn't load or the engine stopped). Please try again in a moment."),
        acciones: [{ texto: tx("Deshacer", "Undo"), accion: "deshacer", escenario: base }],
      };
    const puestas = api.aplicarDiseno(d, o.alturaM);
    // El área del diseño queda como área objetivo: la factibilidad se mide ahí y con la meta pedida
    if (idArea) api.fijarAreaObjetivo(idArea, { metaPct: o.porcentaje, margenDb: o.margenDb, respaldo: o.respaldo || undefined });
    const r = await api.esperarResultado();
    const hecho = textoDiseno(o, d, puestas, r, poligono, nombreArea || donde, base, api);
    if (!o.despues) return hecho;
    // Y luego las zonas de popularidad (y la prueba de estrés) sobre la red recién diseñada
    const sigue = await seguirConZonas(o.despues.zonas, o.despues.estres, api);
    return { texto: `${hecho.texto}\n\n${sigue.texto}`, acciones: [...(sigue.acciones ?? []), ...(hecho.acciones ?? [])].slice(0, 5) };
  })();
  return {
    texto: tx(
      `Diseño la malla para ${textoArea(area)}${medidaDicha ? `, ${medidaDicha},` : forma ? ` (área ${forma})` : ""} ${donde}: ${meta}.${o.usuarios ? ` Para ${numeroLocal(o.usuarios.n)} ${o.usuarios.quienes}.` : ""}${conPresupuesto} ${dibujar ? "Dibujé el área en el mapa. " : ""}Busco con el relieve real dónde va ${gw || o.gateway ? "cada repetidor" : "el gateway y cada repetidor"} (torres de ${fn(o.alturaM)} m), siempre enlazados a la red.${o.despues ? ` Después pongo ${o.despues.zonas.n ?? 250} personas alrededor de cada gateway y repetidor (zonas de popularidad)${o.despues.estres ? (o.despues.estres.rampa ? " y hago la prueba de estrés de la hora pico, subiendo la carga hasta ver dónde se quiebra cada uno" : " y hago la prueba de estrés de la hora pico para ver si la red se revienta") : ""}.` : ""} ${area > 2e8 ? "Es un área grande: tardo un poco más." : "Tardo unos segundos."}`,
      `I'm designing the mesh for ${textoArea(area)}${medidaDicha ? `, ${medidaDicha},` : formaEn ? ` (${formaEn} area)` : ""} ${donde}: ${meta}.${o.usuarios ? ` For ${numeroLocal(o.usuarios.n)} ${GENTE_INGLES[o.usuarios.quienes] ?? o.usuarios.quienes}.` : ""}${conPresupuesto} ${dibujar ? "I drew the area on the map. " : ""}With the real terrain, I'm finding where ${gw || o.gateway ? "each repeater goes" : "the gateway and each repeater go"} (${fn(o.alturaM)} m towers), always linked to the network.${o.despues ? ` Then I'll place ${o.despues.zonas.n ?? 250} people around each gateway and repeater (popularity zones)${o.despues.estres ? (o.despues.estres.rampa ? " and run the peak-hour stress test, raising the load until I see where each one breaks" : " and run the peak-hour stress test to see whether the network gets overloaded") : ""}.` : ""} ${area > 2e8 ? "It's a large area: this will take a little longer." : "This takes a few seconds."}`,
    ),
    acciones: [{ texto: tx("Deshacer", "Undo"), accion: "deshacer", escenario: base }],
    deshacer: base,
    luego,
  };
}

/** La gente a atender («familias», «usuarios»…) en inglés, para mostrarla. */
const GENTE_INGLES: Record<string, string> = {
  usuario: "user",
  usuarios: "users",
  personas: "people",
  familias: "families",
  hogares: "households",
  billeteras: "wallets",
  clientes: "customers",
  habitantes: "residents",
  suscriptores: "subscribers",
  dispositivos: "devices",
  sensores: "sensors",
  abonados: "subscribers",
};

const PRUEBA_HORA_PICO = "pon 250 personas alrededor de cada gateway y repetidor y haz la prueba de estrés";

/** Recargo de logística del departamento donde queda el punto (según el documento de Trama; 1 si no se sabe). */
function logisticaEn(api: Api, lat: number, lon: number): { logistica: number; departamento: string | null } {
  const u = api.ubicacion(lat, lon);
  const dep = u?.match(/\(([^)]+)\)\s*$/)?.[1] ?? u;
  const d = dep ? DEPARTAMENTOS_TRAMA.find((x) => n(x.nombre) === n(dep)) : undefined;
  return { logistica: d?.logistica ?? 1, departamento: d?.nombre ?? null };
}

/** La inversión y la operación de una red, en viñetas. */
function lineasCosto(c: CostoRed, departamento: string | null): string[] {
  const partes = [
    c.gateways
      ? tx(
          `${c.gateways === 1 ? "el sitio del gateway" : `${c.gateways} sitios de gateway`} (torre de 12 m, mini PC, radio, Starlink y energía solar) ${pesosTrama(c.inversion.sitios)}`,
          `${c.gateways === 1 ? "the gateway site" : `${c.gateways} gateway sites`} (12 m tower, mini PC, radio, Starlink and solar power) ${pesosTrama(c.inversion.sitios)}`,
        )
      : "",
    c.repetidores
      ? tx(
          `${c.repetidores === 1 ? "1 repetidor solar" : `${c.repetidores} repetidores solares`} (P1 con antena de 8 dBi en tubo de 6 m) ${pesosTrama(c.inversion.repetidores)}`,
          `${c.repetidores === 1 ? "1 solar repeater" : `${c.repetidores} solar repeaters`} (P1 with an 8 dBi antenna on a 6 m pole) ${pesosTrama(c.inversion.repetidores)}`,
        )
      : "",
    c.personas ? tx(`${c.personas === 1 ? "1 billetera" : `${c.personas} billeteras`} ${pesosTrama(c.inversion.personas)}`, `${c.personas === 1 ? "1 wallet" : `${c.personas} wallets`} ${pesosTrama(c.inversion.personas)}`) : "",
    tx(
      `instalación y transporte ${pesosTrama(c.inversion.instalacion + c.inversion.transporte)}${departamento && c.logistica !== 1 ? ` (con la logística de ${departamento})` : ""}`,
      `installation and transport ${pesosTrama(c.inversion.instalacion + c.inversion.transporte)}${departamento && c.logistica !== 1 ? ` (with the logistics for ${departamento})` : ""}`,
    ),
  ].filter(Boolean);
  return [
    tx(`• Inversión: unos ${pesosTrama(c.inversion.total)}: ${partes.join("; ")}.`, `• Investment: about ${pesosTrama(c.inversion.total)}: ${partes.join("; ")}.`),
    tx(
      `• Operación: unos ${pesosTrama(c.mensual.total)} al mes (internet${c.gateways ? " del Starlink" : ""}, mantenimiento${c.repetidores ? ", baterías y visitas a los repetidores" : ""}${c.personas ? " y soporte" : ""}). Con la inversión repartida en 5 años, la red cuesta unos ${pesosTrama(c.totalMes)} al mes.`,
      `• Operation: about ${pesosTrama(c.mensual.total)} a month (${c.gateways ? "Starlink " : ""}internet, maintenance${c.repetidores ? ", batteries and visits to the repeaters" : ""}${c.personas ? " and support" : ""}). With the investment spread over 5 years, the network costs about ${pesosTrama(c.totalMes)} a month.`,
    ),
  ];
}

/** Viabilidad técnica y económica de la red recién diseñada («sostenible»). */
function viabilidadDiseno(o: Extract<Orden, { tipo: "disenar" }>, puestas: Antena[], r: ResultadoSimulacion | null, pct: number, enlaces: number[], maxSaltos: number, poligono: Poligono, api: Api): string[] {
  // Se presupuesta la red de esta área (la de otro municipio que ya esté en el mapa no entra)
  const todas = api.antenas().filter((a) => a.activa && sirveAlArea(poligono, a.lat, a.lon));
  const gateways = todas.filter((a) => a.pasarela).length;
  const repetidores = todas.filter((a) => !a.pasarela && (a.tipo ?? "antena") === "antena").length;
  const centro = puestas.find((a) => a.pasarela) ?? todas.find((a) => a.pasarela) ?? puestas[0];
  const { logistica, departamento } = centro ? logisticaEn(api, centro.lat, centro.lon) : { logistica: 1, departamento: null };
  const c = costoRedTrama(gateways, repetidores, 0, "xiao", logistica);
  const limite = api.parametros().limiteSaltos;
  const firme = enlaces.length ? Math.min(...enlaces) : null;
  const tecnica = [
    r ? `${r.factibilidad.titulo.toLowerCase()} (${r.factibilidad.puntaje}/100)` : "",
    tx(`${fp(pct)} % del área con ${o.clases.replace(/ \(.*\)$/, "")}`, `${fp(pct)}% of the area with ${o.clases.replace(/ \(.*\)$/, "")}`),
    firme !== null ? tx(`enlaces de al menos ${f1(firme, 0)} dB${firme >= 30 ? " (firmes)" : " (alguno débil: conviene un apoyo)"}`, `links of at least ${f1(firme, 0)} dB${firme >= 30 ? " (solid)" : " (one is weak: a support antenna would help)"}`) : "",
    tx(`máximo ${maxSaltos} ${maxSaltos === 1 ? "salto" : "saltos"} al gateway (límite ${limite})`, `at most ${maxSaltos} ${maxSaltos === 1 ? "hop" : "hops"} to the gateway (limit ${limite})`),
  ].filter(Boolean);
  return [
    "",
    tx("Viabilidad de la red:", "Network viability:"),
    tx(`• Técnica: ${tecnica.join(", ")}.`, `• Technical: ${tecnica.join(", ")}.`),
    ...lineasCosto(c, departamento),
    tx(
      "• Sostenible: todo funciona con energía solar (los repetidores P1 traen su panel y el gateway su kit solar), sin depender de la red eléctrica, y con la menor cantidad de repetidores que cumple la meta.",
      "• Sustainable: everything runs on solar power (the P1 repeaters come with their own panel and the gateway with its solar kit), without depending on the power grid, and with the fewest repeaters that meet the target.",
    ),
  ];
}

function textoDiseno(o: Extract<Orden, { tipo: "disenar" }>, d: Diseno, puestas: Antena[], r: ResultadoSimulacion | null, poligono: Poligono, nombreArea: string, base: Escenario, api: Api): Respuesta {
  const area = areaM2(poligono);
  const gw = puestas.find((a) => a.pasarela);
  const reps = puestas.filter((a) => !a.pasarela);
  const real = r ? coberturaEnArea(r, poligono, o.respaldo ? "segundo" : "mejor") : null;
  const pct = real ? porcentajeSobre(real, o.margenDb) : d.coberturaPct;
  const ok = pct >= o.porcentaje - 1e-6;
  const partes: string[] = [];
  partes.push(
    ok
      ? tx(
          `Listo: la malla cubre el ${fp(pct)} % de las ${textoArea(area)} con ${o.clases}${o.respaldo ? " desde al menos dos nodos (respaldo)" : ""}. Meta cumplida (${fp(o.porcentaje)} %).`,
          `Done: the mesh covers ${fp(pct)}% of the ${textoArea(area)} with ${o.clases}${o.respaldo ? " from at least two nodes (backup)" : ""}. Target met (${fp(o.porcentaje)}%).`,
        )
      : tx(`Llegué al ${fp(pct)} % de las ${textoArea(area)} con ${o.clases}; la meta era ${fp(o.porcentaje)} %.`, `I reached ${fp(pct)}% of the ${textoArea(area)} with ${o.clases}; the target was ${fp(o.porcentaje)}%.`),
  );
  const lugarGw = gw ? api.ubicacion(gw.lat, gw.lon) : null;
  const nodosR = r ? new Map(r.nodos.map((x) => [x.id, x])) : null;
  const saltos = reps.map((a) => nodosR?.get(a.id)?.saltos ?? null);
  const sinRuta = reps.filter((_, i) => saltos[i] === null).length;
  const maxSaltos = Math.max(0, ...saltos.filter((x): x is number => x !== null));
  const enlaces = d.nodos.filter((x) => x.pieza === "repetidor" && x.enlaceDb !== null).map((x) => x.enlaceDb!);
  const gwTxt = gw
    ? tx(
        `Puse el gateway «${gw.nombre}» en ${aDecimal(gw.lat)}, ${aDecimal(gw.lon)}${lugarGw ? `, en ${lugarGw},` : ""} donde más área cubre; si el internet entra en otro sitio, dígame dónde y lo rehago.`,
        `I placed the gateway “${gw.nombre}” at ${aDecimal(gw.lat)}, ${aDecimal(gw.lon)}${lugarGw ? `, in ${lugarGw},` : ""} where it covers the most area; if the internet comes in at another site, tell me where and I'll redo it.`,
      )
    : "";
  if (!reps.length) partes.push(tx(`${gwTxt ? `${gwTxt} ` : ""}${gw ? "Con el gateway" : "Con la red que ya había"} basta: no hizo falta ningún repetidor.`, `${gwTxt ? `${gwTxt} ` : ""}${gw ? "The gateway" : "The existing network"} is enough: no repeater was needed.`));
  else {
    const lista = reps.length <= 4 ? reps.map((a) => a.nombre).join(", ") : tx(`${reps[0].nombre} a ${reps[reps.length - 1].nombre}`, `${reps[0].nombre} to ${reps[reps.length - 1].nombre}`);
    const uno = reps.length === 1;
    const saltosTxt = tx(`${maxSaltos} ${maxSaltos === 1 ? "salto" : "saltos"}`, `${maxSaltos} ${maxSaltos === 1 ? "hop" : "hops"}`);
    const limite = api.parametros().limiteSaltos;
    partes.push(
      tx(
        `${gwTxt ? `${gwTxt} ` : ""}Sembré ${uno ? "1 repetidor" : `${reps.length} repetidores`} de ${fn(o.alturaM)} m (${lista}), ${uno ? "en el sitio que más área nueva cubría, enlazado" : "cada uno en el sitio que más área nueva cubría y enlazado"} a la red${enlaces.length ? (uno ? ` con ${f1(enlaces[0], 0)} dB` : ` con al menos ${f1(Math.min(...enlaces), 0)} dB`) : ""}${nodosR ? (uno ? `; llega al gateway en ${saltosTxt}` : `; llegan al gateway en máximo ${saltosTxt}`) : ""}.${sinRuta ? ` Ojo: ${sinRuta} no ${sinRuta === 1 ? "quedó" : "quedaron"} con ruta al gateway en la simulación.` : ""}${maxSaltos > limite ? ` ${uno ? "Pasa" : "Algunos pasan"} del límite de ${limite} saltos: súbalo o use torres más altas.` : ""}`,
        `${gwTxt ? `${gwTxt} ` : ""}I seeded ${uno ? "1 repeater" : `${reps.length} repeaters`} of ${fn(o.alturaM)} m (${lista}), ${uno ? "at the site that covered the most new area, linked" : "each at the site that covered the most new area and linked"} to the network${enlaces.length ? (uno ? ` with ${f1(enlaces[0], 0)} dB` : ` with at least ${f1(Math.min(...enlaces), 0)} dB`) : ""}${nodosR ? (uno ? `; it reaches the gateway in ${saltosTxt}` : `; they reach the gateway in at most ${saltosTxt}`) : ""}.${sinRuta ? ` Note: ${sinRuta} ${sinRuta === 1 ? "was" : "were"} left without a route to the gateway in the simulation.` : ""}${maxSaltos > limite ? ` ${uno ? "It goes" : "Some go"} over the limit of ${limite} hops: raise it or use taller towers.` : ""}`,
      ),
    );
  }
  if (real) partes.push(o.respaldo ? tx(`Respaldo dentro del área (señal del segundo mejor nodo): ${resumenClases(real)}.`, `Backup inside the area (signal from the second-best node): ${resumenClases(real)}.`) : tx(`Dentro del área: ${resumenClases(real)}.`, `Inside the area: ${resumenClases(real)}.`));
  // Cuántos repetidores hicieron falta para cada nivel (el último tramo suele ser el más caro)
  const curva = d.nodos.filter((x) => x.pieza === "repetidor").map((x) => x.coberturaPct);
  if (curva.length >= 4 && o.porcentaje > 97) {
    const a95 = curva.findIndex((v) => v >= 95);
    const a99 = curva.findIndex((v) => v >= 99);
    if (a95 >= 0 && a99 > a95 + 1)
      partes.push(
        tx(
          `Con ${a95 + 1} ${a95 === 0 ? "repetidor" : "repetidores"} ya se llegaba al 95 % y con ${a99 + 1} al 99 %; los demás tapan huecos pequeños detrás de lomas y en hondonadas.`,
          `${a95 + 1} ${a95 === 0 ? "repeater" : "repeaters"} already reached 95% and ${a99 + 1} reached 99%; the rest fill small gaps behind hills and in hollows.`,
        ),
      );
  }
  if (!ok && d.motivo) partes.push(d.motivo);
  if (o.sostenible) partes.push(...viabilidadDiseno(o, puestas, r, pct, enlaces, maxSaltos, poligono, api));
  // El análisis de ingeniería: veredicto, costo, capacidad, presupuesto y recomendaciones acotadas (todo calculado)
  // Sin simulación, los saltos son los del diseño (nadie queda «sin ruta» por no haber simulado)
  const analisis = analisisDiseno(o, d, puestas, r, pct, enlaces, r ? maxSaltos : Math.max(0, ...d.nodos.map((x) => x.saltos)), r ? sinRuta : 0, poligono, api);
  partes.push("", ...textoAnalisis(analisis.a, !o.sostenible));
  partes.push(
    ok
      ? tx("Antes de instalar, revise en campo el acceso, la energía y que nada tape las antenas.", "Before installing, check the access and the power in the field, and that nothing blocks the antennas.")
      : tx("Puedo probar con torres más altas, o puede aceptar este resultado.", "I can try with taller towers, or you can accept this result."),
  );
  // Al rehacer sobre la misma área se conserva su nombre («radio de 5 millas (8,05 km)», «Barranca de Upía (Meta)»);
  // el nombre pudo ponerse en cualquiera de los dos idiomas
  const prefijo = ["Área objetivo · ", "Target area · "].find((p) => nombreArea.startsWith(p));
  const etiqueta = prefijo ? nombreArea.slice(prefijo.length) : undefined;
  const conPoligono = (cambios: Partial<Extract<Orden, { tipo: "disenar" }>>): Orden => ({
    ...o,
    area: { forma: "poligono", puntos: poligono, nombre: tx(`en el área «${nombreArea}»`, `in the area “${nombreArea}”`), dibujar: Boolean(cambios.reemplazar), ...(etiqueta ? { etiqueta } : {}) },
    ...cambios,
  });
  const acciones: Respuesta["acciones"] = [{ texto: tx("Deshacer", "Undo"), accion: "deshacer", escenario: base }];
  // La opción económica (menos repetidores por unos puntos de cobertura) y, si frenó, seguir hasta la meta
  if (analisis.economica)
    acciones.push({
      texto: tx(
        `Usar la opción económica (${analisis.economica.repetidores} ${analisis.economica.repetidores === 1 ? "repetidor" : "repetidores"}, ≈ ${fp(analisis.economica.coberturaPct)} %)`,
        `Use the economical option (${analisis.economica.repetidores} ${analisis.economica.repetidores === 1 ? "repeater" : "repeaters"}, ≈ ${fp(analisis.economica.coberturaPct)}%)`,
      ),
      accion: "orden",
      orden: analisis.economica.orden,
    });
  if (d.frenado && !ok) acciones.push({ texto: tx("Seguir hasta la meta aunque cueste más", "Keep going to the target even if it costs more"), accion: "orden", orden: conPoligono({ aCualquierCosto: true, reemplazar: base }) });
  if (!ok) {
    // El motivo llega del motor en el idioma de la pantalla: se reconoce por su texto en español
    if (retraducir(d, "es").motivo?.startsWith("Llegué al máximo") && o.maxRepetidores < 200) {
      const mas = Math.min(200, Math.max(60, o.maxRepetidores * 3));
      acciones.push({ texto: tx(`Rehacer con hasta ${mas} repetidores`, `Redo with up to ${mas} repeaters`), accion: "orden", orden: conPoligono({ maxRepetidores: mas, reemplazar: base }) });
    }
    for (const h of [12, 20, 30].filter((x) => x > o.alturaM).slice(0, 2)) acciones.push({ texto: tx(`Rehacer con torres de ${h} m`, `Redo with ${h} m towers`), accion: "orden", orden: conPoligono({ alturaM: h, reemplazar: base }) });
    if (d.huecos[0]) acciones.push({ texto: tx("Ver un punto sin cobertura", "View a point without coverage"), accion: "orden", orden: { tipo: "ir", coord: { lat: d.huecos[0][1], lon: d.huecos[0][0] } } });
    acciones.push({ texto: tx("Ajústamelo (alturas, lomas y apoyos)", "Adjust it for me (heights, hills and support antennas)"), accion: "orden", orden: { tipo: "ajustar", aplicar: false, opcion: "recomendada", opciones: {}, avisos: [] } });
  } else {
    // Una red sostenible también tiene que aguantar a la gente: la hora pico con 250 personas por punto
    const hora = o.sostenible ? interpretarCapacidad(PRUEBA_HORA_PICO, n(PRUEBA_HORA_PICO), api) : null;
    if (hora) acciones.push({ texto: tx("Probar la hora pico (250 personas por punto)", "Test the peak hour (250 people per point)"), accion: "orden", orden: hora });
    acciones.push({ texto: tx("Optimizar el costo (misma cobertura)", "Optimize the cost (same coverage)"), accion: "orden", orden: { tipo: "ajustar", aplicar: false, opcion: "recomendada", opciones: {}, avisos: [] } });
    if (!o.respaldo) acciones.push({ texto: tx("Agregar respaldo (dos nodos por punto)", "Add backup (two nodes per point)"), accion: "orden", orden: conPoligono({ respaldo: true }) });
    if (o.porcentaje < 99.9) acciones.push({ texto: tx("Subir la meta a 99,9 %", "Raise the target to 99.9%"), accion: "orden", orden: conPoligono({ porcentaje: 99.9 }) });
  }
  // Recién desplegada: Melki la puede explicar punto por punto (por qué cada antena quedó ahí y qué refuerzos necesita)
  acciones.push({ texto: tx("Explícame la red punto por punto", "Explain the network point by point"), accion: "recorrido-red" });
  return { texto: partes.join("\n"), acciones };
}

/**
 * El análisis de la red recién diseñada (la de esta área: la de otro municipio que ya esté en el mapa no entra) y la
 * orden para usar la opción económica, con los repetidores puestos que se quitarían.
 */
function analisisDiseno(
  o: Extract<Orden, { tipo: "disenar" }>,
  d: Diseno,
  puestas: Antena[],
  r: ResultadoSimulacion | null,
  pct: number,
  enlaces: number[],
  maxSaltos: number,
  sinRuta: number,
  poligono: Poligono,
  api: Api,
) {
  const todas = api.antenas().filter((a) => a.activa && sirveAlArea(poligono, a.lat, a.lon));
  const gateways = todas.filter((a) => a.pasarela).length;
  const repetidores = todas.filter((a) => !a.pasarela && (a.tipo ?? "antena") === "antena").length;
  const gw = puestas.find((a) => a.pasarela);
  const reps = puestas.filter((a) => !a.pasarela);
  const centro = gw ?? todas.find((a) => a.pasarela) ?? puestas[0];
  const { logistica, departamento } = centro ? logisticaEn(api, centro.lat, centro.lon) : { logistica: 1, departamento: null };
  const terreno = departamento ? (DEPARTAMENTOS_TRAMA.find((x) => x.nombre === departamento)?.terreno ?? null) : null;
  const nodosR = r ? new Map(r.nodos.map((x) => [x.id, x])) : null;
  // El nodo puesto que corresponde a cada nodo del diseño (aplicarDiseno los pone en el mismo orden)
  const puesta = new Map(d.nodos.map((x, i) => [x.id, puestas[i]]));
  let menor: { nombre: string; pct: number } | null = null;
  for (const x of d.nodos) {
    const a = puesta.get(x.id);
    if (x.pieza === "repetidor" && a && x.aportePct !== undefined && (!menor || x.aportePct < menor.pct)) menor = { nombre: a.nombre, pct: x.aportePct };
  }
  const quitar = (d.economica?.quitar ?? []).map((id) => puesta.get(id)).filter((a): a is Antena => Boolean(a));
  const econ = d.economica && quitar.length === d.economica.quitar.length ? { repetidores: reps.length - quitar.length, coberturaPct: d.economica.coberturaPct } : null;
  const a = analizarRed({
    areaKm2: areaM2(poligono) / 1e6,
    metaPct: o.porcentaje,
    coberturaPct: pct,
    clases: o.clases,
    respaldo: o.respaldo,
    gateways,
    repetidores,
    nuevos: { gateways: gw ? 1 : 0, repetidores: reps.length },
    alturaM: o.alturaM,
    enlacesDb: enlaces,
    maxSaltos,
    limiteSaltos: api.parametros().limiteSaltos,
    sinRuta,
    criticos: reps.filter((x) => nodosR?.get(x.id)?.critico).length,
    podados: d.podados ?? 0,
    frenado: d.frenado ?? null,
    economica: econ,
    aporteMin: menor,
    usuarios: o.usuarios ?? null,
    presupuestoCop: o.presupuesto?.cop ?? null,
    sf: sfTrama(presetPorId(api.parametros().preset).sf),
    logistica,
    departamento,
    terreno,
  });
  const ahorro = -(a.recomendaciones.find((x) => x.id === "economica")?.costoCop ?? 0);
  return {
    a,
    economica: econ
      ? {
          ...econ,
          orden: { tipo: "usar-economica" as const, ids: quitar.map((x) => x.id), nombres: quitar.map((x) => x.nombre), area: poligono, margenDb: o.margenDb, respaldo: o.respaldo, clases: o.clases, metaPct: o.porcentaje, ahorroCop: ahorro },
        }
      : null,
  };
}
