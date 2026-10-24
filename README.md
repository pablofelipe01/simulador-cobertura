# Simulador de cobertura · Red de pagos MeshCore (LoRa 915–928 MHz)

Herramienta web para planear la red de pagos por radio de **Trama** sobre **MeshCore**: se ubican el gateway, los
repetidores y la gente por coordenadas (o en el mapa) y el simulador calcula la cobertura y el alcance sobre el relieve,
los enlaces de la malla, los saltos hasta el gateway y la factibilidad de la red, con la paleta de colores de Radio
Mobile. Con **«Poblar personas»** se llena la zona de billeteras al azar, con las **«Zonas de popularidad»** se pone
gente alrededor de cada repetidor, la **«Prueba de estrés»** mide la hora pico zona por zona hasta que cada repetidor
se revienta y la **«Prueba de carga»** dice cuántos pagos al tiempo aguanta cada frecuencia. Abre en el modo **«Sembrar la malla»**: primero el Gateway +
Internet, luego los repetidores según la distancia y al final la gente, con guía paso a paso, sembrado automático de
repetidores y pagos de prueba que viajan por la malla. Usa los equipos, precios, capacidad y supuestos del documento de
Trama del Inge. Incluye a **Melki**, un asistente local que ejecuta pedidos en español («pon el gateway en 4.2,
-73.37», «puebla la zona con 250 personas», «por cada antena 250 personas y mira qué tan colapsada queda la red»,
«¿hasta cuántos usuarios aguanta cada repetidor?», «envía 25 pagos al tiempo», «¿cuánto cuesta la red para el
Chocó?», «conecta a los que faltan»), responde preguntas (cómo viaja un pago, por qué una persona
está en rojo, qué hacer ahora) y da tours guiados.

- **Sembrar la malla** (modo con que abre; «Modo avanzado» muestra todos los paneles):
  - Tres piezas, con los equipos de Trama: *Gateway + Internet* (torre arriostrada de 12 m con mini PC N100 y radios
    Heltec T114 de 8 dBi, companion), *Repetidor* (SenseCAP Solar Node P1 con antena RF Explorer de 8 dBi, rol
    Repetidor; en tubo de 6 m o en torres de 9 a 30 m) y *Persona* (billetera XIAO ESP32S3 + Wio-SX1262 a 1,5 m,
    companion). Se ponen con un clic en el mapa y se arrastran; el gateway es uno solo (ponerlo otra vez lo mueve)
  - Guía paso a paso y estado de la red: personas conectadas, sin cobertura o con más saltos que el límite,
    repetidores sin red, km² cubiertos por la red conectada y saltos máximos. En el mapa cada pieza se pinta verde,
    roja o naranja, con los saltos hasta el gateway
  - Sembrado automático: «Conectar a los que faltan» o «Llevar la red a un punto» propone, con el relieve real, una
    cadena de repetidores en las lomas con enlace sólido (≥ 30 dB); se revisa en el mapa y se pone o se descarta
  - Enviar un pago de prueba: la orden firmada (118 B) se anima salto a salto hasta el gateway, con el tiempo en el
    aire de LoRa, la espera al azar de cada repetidor de MeshCore, el límite de saltos del diseño y la probabilidad de
    entrega con los 4 intentos; en cada transmisión destellan los vecinos que la oyen y el comprobante vuelve por la
    misma ruta
  - Malla animada: piezas redondas (el gateway con la nube «IA») que laten si están conectadas, parpadean en rojo sin
    cobertura y destellan al retransmitir; líneas turquesa que avanzan hacia el gateway con pulsos; alcance de cada
    nodo en turquesa siguiendo el relieve. Se apaga con «Animar el flujo de la información»
  - «Cómo se juega» y alcance de referencia en terreno plano (gateway → gente, repetidor → gente según la torre,
    repetidor ↔ repetidor) junto al que supone Trama por terreno (10 km en plano, 8 en sabana, 5 en montaña o ríos, 3
    en selva)
- **Poblar personas** (en el Resultado, o pidiéndoselo a Melki): reparte N personas (o la densidad de Trama: 0,2, 1 o 5
  por km²) al azar y uniformes sobre el terreno, en el área objetivo, en otra área de la regla, alrededor de la red o en
  toda el área de estudio; opcionalmente solo donde la última simulación da servicio. Las pobladas se marcan aparte
  (puntos pequeños en el mapa, un renglón en la lista, resumen en «Nodos de campo», sin etiquetas de enlace) y no entran
  en el ajuste automático
- **Zonas de popularidad** (al tocar un repetidor o el gateway —en su tarjeta del mapa o en la lista—, en el Resultado o
  pidiéndoselo a Melki): N personas (50 a 1.000) a la redonda de un nodo (1, 2, 3 o 5 km) o de cada gateway y
  repetidor, solo donde hay señal. Cada persona queda marcada con su zona; volver a poner una zona la reparte de nuevo y
  «Quitar las zonas» las borra (hasta 4.000 personas pobladas en total)
- **Prueba de estrés de la hora pico**: cada persona hace sus pagos del día (2,4 por persona, lo que supone Trama: 55
  pagos/h con 150 usuarios) y el 15 % cae en la hora pico (25 % un día de mercado), con multiplicador ×1 a ×10. Se
  simula el canal paquete por paquete y se mide en cada gateway y repetidor: las personas que entran a la malla por él
  (su primer salto) y las que pasan de otras zonas, pagos por hora, % con comprobante, espera típica y del 95 %, % del
  tiempo con el canal ocupado, cuánto transmite frente al tope del 50 %, paquetes descartados por cola llena, hasta
  dónde completa el 90 % con esa carga frente a la persona más lejana que atiende, la energía del repetidor solar P1
  (consumo al día frente a lo que repone el panel de 5 W) y el aire que gasta cada persona. Para toda la red: pagos por
  hora pedidos y entregados, ancho de banda útil (bps de pagos frente a la velocidad del canal) y el canal del gateway.
  En el mapa cada zona se pinta verde (aguanta), naranja (lenta) o roja (se revienta). «¿Hasta dónde aguanta cada
  repetidor?» sube y baja la carga (×0,03 a ×32) y da cuántas personas aguanta cada zona sin demora, desde dónde se
  revienta y la curva de rendimiento (pagos entregados frente a pedidos: sube hasta el máximo del canal y después cae
  por los choques). «Comparar ajustes de radio» repite la hora pico con los 7 ajustes (250 y 62,5 kHz), recalculando
  las rutas con la sensibilidad de cada uno
- **Prueba de carga**: N pagos (orden, comprobante y aviso, con sus acuses) o mensajes saliendo al tiempo en 1 s, 10 s o
  1 min, o un flujo por hora, simulados paquete por paquete como MeshCore. Da el porcentaje que recibió su comprobante,
  la espera típica y la del 95 %, el canal ocupado del gateway, los choques, los reintentos y los nodos más ocupados, y
  lo compara con Trama. «¿Hasta cuántos aguanta?» dibuja la curva: verde aguanta, naranja aguanta pero lento (el 95 %
  tarda más de un minuto) y rojo se revienta (menos del 90 % completa)
- **Conocimiento de Trama**: catálogo con precios puestos en Colombia, capacidad por frecuencia (SF11 / SF10 / SF9),
  alcance por terreno, costos de instalación y operación y el dimensionamiento por departamento (33 departamentos con
  los adultos rurales sin canal digital): «¿cuánto cuesta la red para el Chocó?» da 35.880 usuarios, 240 repetidores,
  60 sitios y $6,4 mil M, como el documento
- **Melki agente** (cerebro local, sin servicios externos): diseña la malla para un área («ármame una malla que cubra
  11.226 hectáreas con señal media o mejor en el 99,9 %», «cubre 5 km a la redonda de Cumaral», «cubre el área que
  medí con respaldo», «con repetidores de 20 m», «máximo 15 repetidores»), entiende varias órdenes en un mensaje
  («pon el gateway en 4.2, -73.37, luego un repetidor a 10 km al este y envía un mensaje desde la persona»),
  posiciones relativas («a 8 km al norte del gateway»), municipios («en Villavicencio»), referencias («súbelo a
  25 m», «la persona»), órdenes en lote («sube todos los repetidores a 20 m», «borra todas las personas»), rol y
  equipo de un nodo, la gente y la capacidad («puebla con 250 personas», «por cada punto una popularidad de 250
  personas y verifica qué tan colapsada estaría la red», «¿hasta cuántos usuarios aguanta cada repetidor?», «prueba de
  estrés en día de mercado», «envía 25 pagos al tiempo», «¿hasta cuántos pagos aguanta?»; y todo junto: «vuélveme a
  hacer las 11.226 hectáreas de manera estable y por cada antena 250 personas para ver si se colapsa»), el
  dimensionamiento de Trama, capas y fondo del mapa, modos de cobertura, «simular al cambiar», relieve plano o real, nombre del
  escenario, duplicar y seleccionar nodos, y su propia voz. Si no entiende un pedido de acción, lo dice y da ejemplos
- **Ajuste inteligente** («Ajústamelo automáticamente» en el Resultado, o pidiéndoselo a Melki): cuando la red sale
  «No factible» o «Factible con ajustes», analiza con el relieve real cómo dejarla factible con la mejor relación
  cobertura–costo: subir o bajar torres en tramos de 3 m (nunca más de 30 m), correr nodos a lomas cercanas, cambiar a
  antena sectorial y sugerir repetidores de apoyo (puntos con coordenadas, o solo en los sitios que dé el usuario). Propone
  hasta tres opciones (económica, recomendada y máxima cobertura) con lo que necesita cada una, las muestra en el mapa
  y las aplica o descarta; si la red ya es factible, la optimiza («misma cobertura, menos costo»). Melki lo entiende con
  límites: «hazla factible sin pasar de 20 m», «máximo 2 antenas de apoyo», «no muevas los nodos», «solo alturas»,
  «la más económica», «¿qué necesito para que sea factible?»
- **Área objetivo y cobertura útil**: la factibilidad pide que la cobertura útil (señal media o mejor, ≥ 30 dB) llegue
  al 60 % del área de estudio, o a la meta del área objetivo (un área de la regla: «usa el área que medí como área
  objetivo con el 95 %»; el diseño por área la deja marcada)
- **Nodos** (modo avanzado): *nodo antena* (repetidor o gateway; genera la cobertura) y *nodo* de campo (la billetera
  de la persona; participa en la malla), con los roles de MeshCore: Repetidor (retransmite), Companion (envía y recibe
  lo suyo) y Room server; equipos P1, T114, XIAO, T1000-E o personalizado. Los escenarios viejos se convierten solos
- **Funciones de Radio Mobile**: parámetros de red (clima, polarización, suelo, refractividad, modo estadístico y
  confiabilidad), modelo Longley-Rice (ITM 1.2.2) opcional, antenas direccionales (Yagi, panel, sectorial,
  parabólica) con azimut y elevación, pérdidas por entorno (vegetación y edificios), señal en margen, dBm, µV o
  dBµV/m con colores por clases, arcoíris o umbral, e informe de radioenlace como «Radio Link»
- **Tours guiados** de Melki (botón «Tours» o «hazme un tour»): tutorial básico práctico de 7 pasos, «Sembrar la
  malla», «¿Cuántos pagos aguanta?» (poblar, probar la carga, zonas de popularidad y la hora pico por repetidor), «Conocer la pantalla», «Red mesh completa», «Como Radio Mobile», «Medir y exportar» y «Hablar con Melki». En los pasos prácticos
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
  lib/radio/                motor: modelo, relieve, perfil, cobertura, malla, factibilidad, worker;
                            estado-red (piezas y guía), siembra (repetidores automáticos), mensaje (viaje de un paquete
                            MeshCore), carga (prueba de carga por eventos), estres (hora pico por zona y rampa),
                            poblar (personas al azar), trama (equipos,
                            precios, capacidad y dimensionamiento del documento de Trama),
                            alcance-plano (alcance de referencia), area (áreas objetivo y cobertura dentro de ellas),
                            diseno (diseño de la malla por área), ajuste (ajuste inteligente cobertura–costo),
                            costos (costo interno para comparar, con los precios de Trama);
                            components/simulador/animacion-malla.ts (flujo animado), panel-ajuste.tsx (propuesta),
                            panel-capacidad.tsx (Poblar personas y Prueba de carga), panel-estres.tsx (Zonas de
                            popularidad y Prueba de estrés); components/melki/capacidad.ts (órdenes de gente,
                            zonas, estrés, carga y Trama)
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

**Factibilidad**: todos los nodos llegan a la pasarela dentro del límite de saltos, por enlaces sólidos, y la cobertura
útil (señal media o mejor, ≥ 30 dB) alcanza el 60 % del área de estudio o la meta del área objetivo. El panel muestra
la cobertura útil, la confiable (≥ 37 dB), la que tiene servicio (≥ 20 dB) y el respaldo.

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

### Mensajes y sembrado de la malla

- **Paquete MeshCore** (`src/lib/radio/mensaje.ts`, valores del firmware MeshCore): tiempo en el aire LoRa según
  Semtech (cabecera explícita, CRC, tasa 4/5, optimización para tasas bajas cuando el símbolo pasa de 16 ms) con el
  preámbulo de MeshCore (32 símbolos con SF ≤ 8 y 16 con SF ≥ 9). Paquete de datos = 2 B de cabecera + 1 B por
  repetidor que falta en la ruta + 9 B (destino, origen, MAC, marca de tiempo) + la carga; acuse de 4 B. Solo los
  repetidores retransmiten. El primer paquete hacia un destino se inunda; el destino devuelve la ruta y desde ahí va
  directo: solo el siguiente repetidor de la ruta lo pasa, después de una espera al azar entre 0 y 5 × 0,3 × el
  tiempo en el aire (0,5 si va inundado). El remitente espera el acuse 500 + (6·aire + 250)·(saltos + 1) ms (o 500 +
  16·aire inundado) y reintenta 3 veces por la ruta y la última por inundación. Probabilidad por salto = logística del
  margen (20 dB ≈ 70 %, 30 dB ≈ 98 %); con los 4 intentos, 1 − (1 − P)⁴. Un pago de Trama (orden 118 B, comprobante
  126 B y aviso 126 B, con sus acuses, a 2 saltos) da 9,4 s con SF11, 5,0 s con SF10 y 2,7 s con SF9 (el documento:
  9,5 / 5 / 3 s), de ahí que el ancho de banda de Trama sea 250 kHz.
- **Prueba de carga** (`src/lib/radio/carga.ts`, en el Web Worker): simulación por eventos del canal, nodo por nodo,
  con lo que hace el firmware: escuchar antes de transmitir (si está recibiendo espera 120–360 ms; a los 4 s transmite
  igual), espera al azar de los repetidores, presupuesto de aire del 50 % por hora, colas de 32 paquetes en el
  repetidor y 16 en la billetera, deduplicación, acuses, reintentos con el retraso variable del celular y ruta
  aprendida o inundación. En el aire: un radio que transmite no oye; dos señales que se pisan se pierden salvo que una
  le saque 6 dB a la otra (captura LoRa); cada enlace pasa con la probabilidad de su margen. Entre billeteras (que el
  análisis de la malla no calcula) se estima quién oye a quién con el margen sobre terreno plano. Cada pago: la orden
  sube, el banco contesta en 1,5 s, el comprobante baja y quien recibe el pago (otra persona al azar) recibe su aviso.
  En el laboratorio, 55 pagos por hora (el diseño de Trama con SF11) completan todos con el canal del gateway cerca del
  15 %; una ráfaga de más de 5 a 10 pagos en 10 s con SF11 ya hace fila de un minuto o más. Los márgenes entre
  billeteras se calculan solo cuando hacen falta y cada transmisión se evalúa solo en los receptores a los que les sirve
  (el siguiente de la ruta, el destino o los repetidores que la inundarían): con 1.750 personas una hora pico tarda
  ~0,1 s.
- **Prueba de estrés** (`src/lib/radio/estres.ts`, en el Web Worker): corre la prueba de carga en modo continuo con
  los pagos de la hora pico (personas × pagos al día × % de la hora pico × multiplicador, 30 minutos, dos sorteos) y la
  reparte por zona (el nodo del primer salto de cada persona). Alcance con carga: los pagos de la zona se ordenan por
  distancia en tramos de al menos 6 y se busca hasta dónde completa el 90 %; si los cercanos tampoco completan, es el
  canal y no la distancia. Energía del P1: 0,45 W al transmitir y 0,03 W escuchando; el panel de 5 W rinde ~4 horas de
  sol con 70 % de eficiencia (~14 Wh al día) y la batería útil es ~35 Wh; la transmisión del día es la de la hora pico
  dividida por la parte del día que es la hora pico. En el laboratorio (gateway y 3 repetidores, 250 personas por nodo,
  una frecuencia SF11) la red se revienta (~56 % completos, canal del gateway ~97 %) y aguanta sin demora ~500
  personas; con 40 por nodo aguanta y llega a ~320 sin demora. Con SF9 la misma hora pico completa todos. El sitio de
  Trama lleva 4 radios (4 frecuencias): repartiendo los repetidores entre ellas la capacidad sube hasta 4 veces.
- **Poblar** (`src/lib/radio/poblar.ts`): puntos uniformes en área (la latitud se sortea en seno), dentro del polígono,
  con separación mínima y repetibles con la misma semilla (mulberry32).
- **Trama** (`src/lib/radio/trama.ts`): catálogo del cotizador (TRM 3.158 con 3 % de colchón; lo importado suma 12 %
  de envío, 10 % de arancel y 19 % de IVA), conjuntos (repetidor ≈ $1.035.000, sitio gateway con 4 radios ≈ $9,4 M,
  Starlink con solar ≈ $6,1 M y $160.000 al mes), capacidad (SF11 / SF10 / SF9: 150 / 280 / 500 usuarios y 55 / 105 /
  185 pagos por hora por frecuencia con el canal al 15 %), alcance por terreno, operación y regiones, y el
  dimensionamiento del documento (`dimensionarTrama`): hexágonos de 2,598·r², una radio cada 150 usuarios con SF11,
  sitios de hasta 4 radios y 19 celdas, un Starlink cada 4, 2 o 1 sitios según el terreno, inversión y operación.
  Validado contra el documento: Chocó, Vichada y el total nacional (950.655 usuarios, 7.017 repetidores, 1.602 sitios,
  734 Starlink, $154,5 mil M).
- **Alcance de referencia** (`src/lib/radio/alcance-plano.ts`): distancia máxima con margen ≥ 20 dB (o ≥ 30 dB entre
  repetidores) sobre terreno plano, por búsqueda binaria con el mismo cálculo de enlaces.
- **Sembrado** (`src/lib/radio/siembra.ts`): desde la red conectada al gateway, avanza hacia cada destino buscando en
  un abanico de ±45° (hasta 14 km por paso) el punto con enlace ≥ 30 dB (o ≥ 22 dB si no hay) que más avanza; entre
  los que avanzan al menos el 80 % de lo máximo, elige el de suelo más alto. Para cuando una persona en el destino
  queda con ≥ 20 dB; máximo 10 repetidores. Usa el mismo cálculo de enlaces y el mismo relieve que la simulación.

### Diseño de la malla por área

- **Área** (`src/lib/radio/area.ts`): círculo, cuadrado o rectángulo alrededor de un punto, del gateway o del centro
  del mapa, escalado para medir exactamente lo pedido (igual que la regla), o el área dibujada con la regla. La
  cobertura dentro del área se cuenta celda por celda del mapa (ponderada por su área), por clase de señal.
- **Diseño** (`src/lib/radio/diseno.ts`, en el Web Worker): si no hay gateway, lo pone donde más área cubre cerca del
  centro. Luego siembra repetidores uno a uno: entre ~300 sitios candidatos (una cuadrícula sobre el área y sus
  alrededores) elige el que más área nueva deja con el margen pedido (30 dB = señal media o mejor), siempre que
  enlace a la red con ≥ 30 dB (o ≥ 22 dB si no hay otro) dentro del límite de saltos; si un sitio útil no alcanza la
  red, pone un relevo hacia él; si nada cubre lo que falta, prueba sitios en los huecos. Trabaja primero con ~3.000
  puntos del área y después con las mismas celdas que pintará la simulación (hasta 40.000), con el mismo cálculo
  del mapa, así que la meta estimada coincide con la simulada. «Respaldo» exige dos nodos con ese margen en cada
  punto. Al terminar Melki pone los nodos, simula y cuenta la cobertura real por clase; si no llega, ofrece más
  repetidores, torres más altas o ver un punto sin cobertura.

### Ajuste inteligente (cobertura–costo)

- **Qué mide** (`src/lib/radio/ajuste.ts`, en el Web Worker): la cobertura útil en una zona fija, el área objetivo o,
  sin ella, la «zona de la red» (el contorno de los círculos de estudio de los nodos antena), para comparar opciones
  sobre la misma superficie. Al aplicar una opción sin área objetivo, esa zona queda guardada como área objetivo.
- **Cómo decide**: primero repara la conectividad (nodos sin ruta, con más saltos que el límite o con enlaces débiles)
  y luego crece la cobertura eligiendo en cada paso el cambio con más cobertura nueva por unidad de costo, sin
  empeorar la red. Los candidatos son: alturas de torre de 6 a 30 m, las 5 lomas más altas a 150, 300 y 500 m de
  cada nodo (nunca el gateway ni los nodos fijos), antenas sectoriales de 90° y 120° hacia donde falta cobertura, y
  sitios de apoyo en una cuadrícula de ~220 puntos llevados a la loma más alta de su celda (o solo los sitios que dé
  el usuario), con relevos cuando un buen sitio no alcanza la red. Después poda lo que sobra verificando con las
  celdas del mapa y elige: la económica (el codo donde cada antena más rinde la mitad que las primeras), la
  recomendada (la que cumple la meta, o la más cercana) y la de máxima cobertura; descarta las que cuestan más sin
  cubrir más.
- **Costo** (`src/lib/radio/costos.ts`): los precios de Trama, solo para comparar opciones. El repetidor P1 completo
  con su instalación y tres años de operación; el tubo de 6 m ($390.000 con herrajes y base) y la torre arriostrada de
  12 m ($3,2 M) del documento, y las demás alturas extrapoladas en tramos de 3 m; el gateway suma su sitio, una radio,
  el Starlink, la instalación y tres años de mantenimiento y plan comercial. Por encima de 30 m hace falta una torre
  autosoportada, que nunca se propone. Al optimizar, una opción que no ahorra no se ofrece.

Es una herramienta de planeación: confirme en campo antes de instalar (un ping o un trace de MeshCore entre los equipos
y el SNR que reporta la app). Las cifras de Trama son estimaciones del documento; la capacidad real se mide en una red
piloto.

### Pendientes de confirmar con el Inge

- La banda: el documento dice 902–928 MHz y ~8 canales; la ANE reconoce el uso libre de 915 a 928 MHz (el simulador
  avisa fuera de esa banda).
- El ancho de banda de 250 kHz, deducido de los tiempos de un pago (9,5 / 5 / 3 s).
- El tamaño del aviso a quien recibe (126 B, como el comprobante) y lo que tarda el banco (1,5 s) en la prueba de carga.
- La ganancia de la antena de la billetera XIAO (2 dBi) y de la T1000-E (0 dBi), estimadas.

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
