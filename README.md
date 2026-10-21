# Simulador de cobertura · Red mesh LoRa 915 MHz

Herramienta web para planear redes Meshtastic: se ubican nodos por coordenadas (o en el mapa) y el simulador calcula la
cobertura y el rango de alcance sobre el relieve, los enlaces de la malla, los saltos hasta la pasarela y la
factibilidad de la red, con la paleta de colores de Radio Mobile. Incluye a **Melki**, un asistente local que ejecuta
pedidos en español («inscribe un nodo antena en 4.5, -73.1», «distancia entre Ejemplo y Torre 2»), responde preguntas
y da tours guiados. También maneja las funciones de Radio Mobile («confiabilidad del 90 %», «ponle una Yagi a
Ejemplo apuntando a Torre 2», «simula con vegetación densa», «muestra la señal en dBm», «informe del enlace…»).

- **Nodos**: *nodo antena* (infraestructura en mástil; genera la cobertura) y *nodo* de campo (portátil, sensor;
  participa en la malla)
- **Funciones de Radio Mobile**: parámetros de red (clima, polarización, suelo, refractividad, modo estadístico y
  confiabilidad), modelo Longley-Rice (ITM 1.2.2) opcional, antenas direccionales (Yagi, panel, sectorial,
  parabólica) con azimut y elevación, pérdidas por entorno (vegetación y edificios), señal en margen, dBm, µV o
  dBµV/m con colores por clases, arcoíris o umbral, e informe de radioenlace como «Radio Link»
- **Tours guiados** de Melki (botón «Tours» o «hazme un tour»): tutorial básico práctico de 7 pasos, «Conocer la
  pantalla», «Red mesh completa», «Como Radio Mobile», «Medir y exportar» y «Hablar con Melki». En los pasos prácticos
  Melki detecta cuando quedó hecho y ofrece «Hágalo por mí» y «Omitir paso»; todo ocurre en un escenario de práctica y
  al salir el del usuario vuelve tal cual (también si se cierra la página a mitad del tour)
- **Dictado por voz** para Melki: micrófono junto al botón de enviar; el texto aparece en la caja para revisarlo y
  corregirlo antes de enviarlo. Modo «navegador» (Web Speech de Edge o Chrome, con internet) o «privado» (el audio no
  sale del equipo: reconocimiento en el dispositivo del navegador o Whisper dentro de la página)
- **Regla** tipo Google Earth: línea, trayecto y área, editables, con perfil del terreno; se guardan con el escenario
- **Mapa de referencia** local: departamentos y municipios (DANE), ríos y lagos principales y países (Natural Earth),
  buscador de lugares y coordenadas, menú del clic derecho y coordenadas bajo el cursor
- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS 4
- Mapa: MapLibre GL con fuentes abiertas y sin costo (Esri World Imagery, Esri Topo, OpenTopoMap, OpenStreetMap)
- Relieve: teselas Terrarium (SRTM), archivos `.hgt` locales o terreno plano
- El cálculo corre en un Web Worker: la interfaz no se bloquea

## Uso local

```bash
npm install
npm run dev          # http://localhost:3000
```

| Comando                | Qué hace                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo                                                                        |
| `npm run build`        | Compilación de producción                                                                     |
| `npm run check`        | Lint + tipos + pruebas del motor y de Melki + compilación                                     |
| `npm run prueba:motor` | Pruebas del modelo de propagación (sin navegador)                                             |
| `npm run prueba:melki` | Pruebas de las órdenes de Melki (sin navegador)                                               |
| `npm run e2e`          | Pruebas de extremo a extremo con Playwright (Edge, o `CHROME_PATH`); teselas sintéticas       |
| `npm run html`         | Versión HTML que se abre con doble clic (`dist/html/SIMULADOR-HTML/SIMULADOR.html`)           |
| `npm run paquete`      | Paquetes de avance para probar sin instalar (`-- --destino "<carpeta>"`)                      |

## Estructura

```
src/
  app/                      layout, página y estilos globales
  components/simulador/     pantalla principal, mapa, paneles, regla, buscador, capas de referencia, exportación
  components/melki/         asistente: avatar, cerebro local, órdenes, tours guiados (tours.ts + recorrido.tsx), voz y dictado
  datos/geo/                límites, nombres y ríos de referencia (ver LEEME.md: fuentes y licencias)
  lib/geo/                  consultas locales: municipio de un punto, búsqueda de lugares
  lib/radio/                motor: modelo, relieve, perfil, cobertura, malla, factibilidad, worker
  lib/config.ts             fuentes de mapas y relieve (reemplazables con variables de entorno)
scripts/                    versión HTML, paquetes de avance y compresor ZIP
tests/                      pruebas del motor y de extremo a extremo
```

## Modelo de propagación

Pérdida en espacio libre + difracción del obstáculo principal del perfil (filo de cuchillo, Deygout) sobre tierra de
radio efectivo 4/3, más una pérdida adicional calibrada contra simulaciones de Radio Mobile:

```
margen = presupuesto − FSPL − (C0 + C1·log10(d_km) + C2·J(v) − C3·log10(h_tx / 10))
```

Error típico frente a Radio Mobile: ≈ 3 dB en los enlaces de prueba y ≈ 5 dB en el mapa de cobertura. Niveles de señal (margen sobre la sensibilidad): Buena ≥ 45 dB, Estable ≥ 37,
Media ≥ 30, Baja ≥ 20, Sin servicio < 20. Enlaces entre nodos: sólido ≥ 30 dB, inestable 20–30 dB. El rango de alcance de
cada nodo antena es, en cada uno de 72 sectores de 5°, la celda más lejana con servicio (≥ 20 dB) y con servicio
confiable (≥ 37 dB).

### Funciones de Radio Mobile

- **Parámetros de red** (`src/lib/radio/red.ts`): clima de radio, polarización, suelo (εr, σ), refractividad N, modo
  estadístico (puntual, accidental, móvil, difusión) y % de tiempo, ubicaciones y situaciones. Los valores por defecto
  son los de las pruebas de Radio Mobile que calibraron el modelo (ecuatorial, vertical, suelo promedio 15 / 0,005 S/m,
  N = 360, móvil 50 % / 70 %); con ellos el resultado es idéntico al modelo calibrado. Si se cambian, a cada trayecto
  se le suma `Δ = L_ITM(parámetros) − L_ITM(referencia)`.
- **Longley-Rice** (`src/lib/radio/itm.ts`): traducción del ITM 1.2.2 de la NTIA en modo punto a punto. Coincide con la
  implementación de referencia en menos de 0,001 dB (prueba en `tests/motor`). Se puede elegir como modelo principal.
- **Antenas direccionales** (`src/lib/radio/patron.ts`): patrón paramétrico, `A = min(12·(φ/θh)² + 12·(θ/θv)², FB)`,
  con el ancho del haz deducido de la ganancia (`G ≈ 27 000 / (θh·θv)`); la omnidireccional no atenúa.
- **Entorno** (`src/lib/radio/entorno.ts`): follaje según UIT-R P.833 y construcciones o bosque según UIT-R P.2108
  (§3.1), en cada extremo que quede por debajo de la vegetación o de los techos.
- **Unidades** (`src/lib/radio/unidades.ts`): dBm = margen + sensibilidad; dBµV = dBm + 107 (50 Ω);
  E (dBµV/m) = dBm − G + 20·log10 f(MHz) + 77,2.
- **Informe de radioenlace** (`src/lib/radio/informe.ts`): distancia, azimuts, ángulos de elevación, peor despeje de
  Fresnel, PIRE, pérdidas desglosadas, Longley-Rice de referencia y nivel recibido; se copia o descarga en texto.

Es una herramienta de planeación: confirme en campo con la prueba de alcance de Meshtastic antes de instalar.

## Variables de entorno

Ninguna es obligatoria: sin ellas se usan las fuentes abiertas por defecto. Los valores **no se suben al repositorio**
(`.env*` está en `.gitignore`); se entregan por un canal aparte.

| Variable                           | Uso                                                        |
| ---------------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_MAPA_SATELITE_URL`    | Teselas del mapa satelital (`{z}`, `{x}`, `{y}`)           |
| `NEXT_PUBLIC_MAPA_ETIQUETAS_URL`   | Capa de nombres de poblados y lugares                      |
| `NEXT_PUBLIC_MAPA_VIAS_URL`        | Capa de vías                                               |
| `NEXT_PUBLIC_MAPA_TOPOGRAFICO_URL` | Mapa topográfico                                           |
| `NEXT_PUBLIC_MAPA_OPENTOPOMAP_URL` | Mapa OpenTopoMap (`{s}` admite los servidores a, b y c)    |
| `NEXT_PUBLIC_MAPA_CALLES_URL`      | Mapa de calles                                             |
| `NEXT_PUBLIC_RELIEVE_URL`          | Teselas de elevación en formato Terrarium                  |
| `NEXT_PUBLIC_DICTADO_LIBRERIA_URL` | Biblioteca transformers.js del dictado privado (ESM)       |
| `NEXT_PUBLIC_DICTADO_MOTOR_URL`    | Carpeta del motor ONNX Runtime (`*.asyncify.mjs/.wasm`)    |
| `NEXT_PUBLIC_DICTADO_MODELOS_URL`  | Servidor de modelos (por defecto Hugging Face)             |
| `NEXT_PUBLIC_DICTADO_MODELO`       | Modelo Whisper del dictado privado (`Xenova/whisper-base`) |

## Privacidad

Los escenarios se guardan en el navegador (almacenamiento local) y en los archivos que se exporten. Los servicios de
mapas y de relieve solo reciben las teselas de la zona visible; no se envían nodos, mediciones ni resultados. Melki
entiende y ejecuta los pedidos con un cerebro local, sin servicios externos; los límites, nombres y ríos de referencia
vienen empaquetados con la aplicación. Dictado por voz: en el modo «navegador», Edge o Chrome procesan el audio en sus
servidores; en el modo «privado» el audio no sale del equipo (solo se descargan una vez la biblioteca, el motor y el
modelo, que quedan guardados en el navegador).
