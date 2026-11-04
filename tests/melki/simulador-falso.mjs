// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El simulador de mentira de las pruebas de Melki (el mismo de ordenes.mjs e ingles.mjs): registra lo que Melki pide.
// `m`: el paquete de pruebas (para el estado de la red).

export function simuladorFalso(m) {
  const PARAMETROS = {
    preset: "LONG_FAST",
    frecuenciaMhz: 915,
    alturaRxM: 2.5,
    gananciaRxDbi: 2,
    perdidaExtraDb: 0,
    radioKm: 10,
    resolucion: "normal",
    limiteSaltos: 3,
    modelo: "calibrado",
    polarizacion: "vertical",
    clima: 1,
    refractividad: 360,
    suelo: "promedio",
    permitividad: 15,
    conductividad: 0.005,
    variabilidad: "movil",
    tiempoPct: 50,
    ubicacionesPct: 50,
    situacionesPct: 70,
    entorno: "abierto",
  };
  const base = (id, nombre, lat, lon, extra = {}) => ({ id, nombre, tipo: "antena", lat, lon, alturaM: 15, potenciaDbm: 22, gananciaDbi: 5.8, perdidaCableDb: 1, equipo: "nodo-solar-58", rol: "ROUTER", pasarela: false, activa: true, ...extra });

  /** Simulador de mentira: registra lo que Melki pide. */

  function crearApi(antenas) {
    const llamadas = [];
    let n = 0;
    const api = {
      llamadas,
      antenas: () => antenas,
      parametros: () => PARAMETROS,
      seleccion: () => null,
      resultado: () => null,
      instantanea: () => ({ version: 1, nombre: "x", antenas: [...antenas], parametros: PARAMETROS, mediciones: [] }),
      agregar: (d) => {
        const a = base(`n${++n}`, d.nombre ?? (d.tipo === "nodo" ? `Nodo ${n}` : `Antena ${n}`), d.lat, d.lon, { ...d, alturaM: d.alturaM ?? (d.tipo === "nodo" ? 1.5 : 10) });
        antenas.push(a);
        llamadas.push(["agregar", d]);
        return a;
      },
      editar: (id, c) => llamadas.push(["editar", id, c]),
      eliminar: (id) => llamadas.push(["eliminar", id]),
      parametrosCambiar: (c) => llamadas.push(["parametros", c]),
      simular: () => llamadas.push(["simular"]),
      centrar: (lat, lon) => llamadas.push(["centrar", lat, lon]),
      encuadrarCaja: (c) => llamadas.push(["caja", c]),
      marcar: (lat, lon) => llamadas.push(["marcar", lat, lon]),
      medir: (med) => llamadas.push(["medir", med]),
      perfil: (a, b, informe) => llamadas.push(["perfil", a.id, b, Boolean(informe)]),
      vista: (c) => llamadas.push(["vista", c]),
      senal: (lat, lon) => llamadas.push(["senal", lat, lon]),
      herramienta: (h) => llamadas.push(["herramienta", h]),
      ejemplo: () => llamadas.push(["ejemplo"]),
      nuevo: () => llamadas.push(["nuevo"]),
      exportar: (f) => (llamadas.push(["exportar", f]), true),
      borrarMediciones: () => llamadas.push(["borrar-mediciones"]),
      ubicacion: () => "Cumaral (Meta)",
      buscarLugar: (t) =>
        /villavicencio/.test(t)
          ? [{ tipo: "municipio", nombre: "Villavicencio", detalle: "Meta", lat: 4.14, lon: -73.63, caja: [-73.8, 3.9, -73.3, 4.3] }]
          : /paratebueno/.test(t)
            ? [{ tipo: "municipio", nombre: "Paratebueno", detalle: "Cundinamarca", lat: 4.37, lon: -73.21 }]
            : [],
      // Modo «Sembrar la malla»
      modoActual: "sembrar",
      propuestaActual: null,
      redActual: null,
      modo: () => api.modoActual,
      cambiarModo: (v) => {
        api.modoActual = v;
        llamadas.push(["modo", v]);
      },
      ponerPieza: (pieza, lat, lon, datos = {}) => {
        const nombre = { gateway: "Gateway", repetidor: `Repetidor ${++n}`, persona: `Persona ${++n}` }[pieza];
        const a = base(`p${++n}`, nombre, lat, lon, { tipo: pieza === "persona" ? "nodo" : "antena", alturaM: pieza === "persona" ? 1.5 : pieza === "gateway" ? 8 : 15, pasarela: pieza === "gateway", ...datos });
        antenas.push(a);
        llamadas.push(["pieza", pieza, lat, lon, datos]);
        return a;
      },
      armarPieza: (p) => llamadas.push(["armar", p]),
      red: () => api.redActual ?? m.estadoRed(antenas, null, 3, false),
      sembrar: (d) => {
        llamadas.push(["sembrar", d]);
        api.propuestaActual = { puntos: [{ id: "propuesto-1", desdeId: "g", lat: 4.25, lon: -73.2, sueloM: 300, margenDb: 34, distanciaKm: 12, desde: "Gateway", destino: 0 }], destinos: d.map(() => ({ llega: true, margenDb: 27, desde: "Propuesto 1", desdeId: "propuesto-1", motivo: null })), margenObjetivoDb: 30 };
        return Promise.resolve(api.propuestaActual);
      },
      propuesta: () => api.propuestaActual,
      aceptarSiembra: () => {
        if (!api.propuestaActual) return 0;
        llamadas.push(["aceptar"]);
        api.propuestaActual = null;
        return 1;
      },
      descartarSiembra: () => {
        api.propuestaActual = null;
        llamadas.push(["descartar"]);
      },
      enviarMensaje: (id) => {
        llamadas.push(["mensaje", id]);
        return { llega: true, motivo: null, ruta: [id, "g"], saltos: 1, limiteSaltos: 3, tramos: [], bytes: 62, aireMs: 722.9, totalMs: { min: 722.9, tipica: 722.9, max: 722.9 }, probabilidad: 0.95, probabilidadReintentos: 0.9999, preset: "Long Fast" };
      },
      ejemploMalla: () => llamadas.push(["ejemplo-malla"]),
      // Agente (v10)
      medicionesActuales: [],
      centro: { lat: 4.15, lon: -73.6 },
      mediciones: () => api.medicionesActuales,
      centroMapa: () => api.centro,
      seleccionar: (id) => llamadas.push(["seleccionar", id]),
      eliminarVarias: (ids) => llamadas.push(["eliminar-varias", ids]),
      restaurar: (e) => llamadas.push(["restaurar", e]),
      encuadrarTodo: () => llamadas.push(["encuadrar"]),
      autoSimular: () => true,
      fijarAutoSimular: (v) => llamadas.push(["auto", v]),
      fijarRelieve: (v) => llamadas.push(["relieve", v]),
      renombrarEscenario: (nombre) => llamadas.push(["nombre", nombre]),
      duplicar: (id) => llamadas.push(["duplicar", id]),
      pantalla: "escritorio",
      paneles: (c) => (llamadas.push(["paneles", c]), api.pantalla),
      disenoFalso: null,
      disenarArea: (o) => {
        llamadas.push(["disenar", o]);
        return Promise.resolve(api.disenoFalso);
      },
      aplicarDiseno: (d, h) => {
        llamadas.push(["aplicar", d, h]);
        return d.nodos.map((q, k) => {
          const a = base(`d${k}`, q.pieza === "gateway" ? "Gateway" : `Repetidor ${k}`, q.lat, q.lon, { pasarela: q.pieza === "gateway", alturaM: q.pieza === "gateway" ? 8 : h });
          antenas.push(a);
          return a;
        });
      },
      resultadoFalso: null,
      esperarResultado: () => Promise.resolve(api.resultadoFalso),
      // Ajuste inteligente (v11)
      objetivo: null,
      areaObjetivo: () => api.objetivo,
      fijarAreaObjetivo: (id, o) => {
        llamadas.push(["area-objetivo", id, o]);
        const med = api.medicionesActuales.find((x) => x.id === id);
        api.objetivo = id && med ? { ...o, nombre: med.nombre, puntos: med.puntos } : null;
      },
      ajusteFalso: null,
      ajustarRed: (o) => {
        llamadas.push(["ajustar", o]);
        return Promise.resolve(api.ajusteFalso);
      },
      aplicarAjuste: (a, i, b) => {
        llamadas.push(["aplicar-ajuste", i, b]);
        return [];
      },
      mostrarAjuste: (a, i) => llamadas.push(["mostrar-ajuste", i]),
      descartarAjuste: () => llamadas.push(["descartar-ajuste"]),
      // Gente y capacidad (v12)
      areasPoblar: () => [
        ...api.medicionesActuales.filter((x) => x.tipo === "area").map((x) => ({ id: x.id, nombre: x.objetivo ? `Área objetivo «${x.nombre}»` : `Área «${x.nombre}»`, km2: 40, poligono: x.puntos, objetivo: Boolean(x.objetivo) })),
        { id: "zona-red", nombre: "Alrededor de la red (3 km)", km2: 56.5, poligono: [], objetivo: false },
        { id: "zona-estudio", nombre: "Área de estudio (10 km)", km2: 314, poligono: [], objetivo: false },
      ],
      poblar: (o) => {
        llamadas.push(["poblar", o]);
        const n = Math.round(o.densidadKm2 !== undefined ? 56.5 * o.densidadKm2 : (o.n ?? 250));
        return { puestas: n, pedidas: n, area: "Alrededor de la red (3 km)", km2: 56.5, conSenal: Boolean(o.soloConSenal), quitadas: 0 };
      },
      quitarPobladas: () => (llamadas.push(["quitar-pobladas"]), 3),
      cargaFalsa: null,
      probarCarga: (o, curva) => {
        llamadas.push(["carga", o, Boolean(curva)]);
        return Promise.resolve(api.cargaFalsa);
      },
      // Zonas de popularidad y prueba de estrés (v12.1)
      centrosZona: () => antenas.filter((a) => a.activa && !a.poblada && (a.rol === "REPETIDOR" || a.pasarela)).map((a) => ({ id: a.id, nombre: a.nombre, pieza: a.pasarela ? "gateway" : "repetidor", personas: 0 })),
      poblarZonas: (o) => {
        llamadas.push(["zonas", o]);
        const centros = api.centrosZona().filter((c) => !o.centros?.length || o.centros.includes(c.id));
        const n = o.n ?? 250;
        return { zonas: centros.map((c) => ({ id: c.id, nombre: c.nombre, puestas: n, pedidas: n })), puestas: n * centros.length, pedidas: n * centros.length, radioKm: o.radioKm ?? 2, conSenal: true, recortado: false, quitadas: 0 };
      },
      quitarZonas: (c) => (llamadas.push(["quitar-zonas", c]), 500),
      estresFalso: null,
      probarEstres: (o) => {
        llamadas.push(["estres", o]);
        return Promise.resolve(api.estresFalso);
      },
      // Límite de un punto (v12.2)
      limiteFalso: null,
      evaluarPunto: (o) => {
        llamadas.push(["punto", o]);
        const c = api.centrosZona().find((x) => x.id === o.centro);
        return Promise.resolve({ nombre: c?.nombre ?? o.centro, zonas: null, estres: api.estresFalso, limite: api.limiteFalso ? { ...api.limiteFalso, id: o.centro, nombre: c?.nombre ?? o.centro, llenado: o.accion === "llenar" ? { personas: 320, estadoPunto: "aguanta", estadoRed: "aguanta", intentos: 1 } : null } : null, error: null });
      },
      evaluarPuntos: (o) => {
        llamadas.push(["puntos", o]);
        const lista = api.centrosZona().filter((c) => !o.centros?.length || o.centros.includes(c.id));
        return Promise.resolve({ limites: api.limiteFalso ? lista.map((c) => ({ ...api.limiteFalso, id: c.id, nombre: c.nombre })) : [], zonas: null, error: null });
      },
    };
    return api;
  }


  const nodos = () => [
    base("g", "Gateway", 4.2, -73.4, { pasarela: true, rol: "COMPANION" }),
    base("r1", "Repetidor 1", 4.25, -73.3, { rol: "REPETIDOR" }),
    base("r2", "Repetidor 2", 4.3, -73.25, { rol: "REPETIDOR" }),
    base("p1", "Persona 1", 4.22, -73.35, { tipo: "nodo", rol: "COMPANION" }),
    base("p2", "Persona 2", 4.21, -73.33, { tipo: "nodo", rol: "COMPANION" }),
    base("e", "Ejemplo", 4.2, -73.37),
    base("t2", "Torre 2", 4.3, -73.3),
  ];
  return { PARAMETROS, base, crearApi, nodos };
}
