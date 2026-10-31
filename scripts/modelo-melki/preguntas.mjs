// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Las preguntas que contesta el cerebro de Melki (cada tema: de qué se habla y cómo se pregunta), lo que está fuera del
// simulador (el clima, el fútbol, una receta…) y el ruido del dictado (muletillas y pedazos sin sentido).

/** Formas de preguntar por algo ({S} es el tema). */
const FORMAS = [
  "¿(qué|que) (es|son) {S}?",
  "¿(qué|que) (significa|significan|quiere decir|quieren decir) {S}?",
  "¿para qué (sirve|sirven) {S}?",
  "(explícame|explíqueme|explica|me explicas|me puedes explicar|me podrías explicar) {S}",
  "¿(cómo|como) (funciona|funcionan|trabaja|opera) {S}?",
  "(háblame|cuéntame|hábleme|cuénteme) (de|sobre|acerca de) {S}",
  "(quiero|quisiera|necesito) (saber|entender|aprender) (de|sobre|qué es|cómo funciona) {S}",
  "(no entiendo|no me queda claro|no comprendo) {S}",
  "(tengo una duda|una pregunta|una duda) (con|sobre|de) {S}",
  "¿(qué|que) (onda|pasa|hay) con {S}?",
  "{S}, ¿eso qué es?",
  "¿y {S}?",
  "¿en qué consiste {S}?",
  "(info|información|datos) (de|sobre) {S}",
  "¿me (aclaras|explicas|cuentas) {S}?",
  "(ayúdame|ayúdeme) a entender {S}",
];

/** Cada tema: lo que se nombra al preguntar y preguntas propias. */
export const TEMAS = {
  "q-que-es": {
    s: ["el simulador", "este programa", "esta herramienta", "esta aplicación", "el simulador de cobertura", "esta página"],
    p: ["¿para qué sirve esto?", "¿qué hace este programa?", "¿cómo se usa esto?", "¿cómo empiezo?", "¿por dónde empiezo?", "¿qué es esto?", "¿cómo funciona el simulador?", "¿qué puedo hacer aquí?", "soy nuevo, ¿qué es esto?", "¿cómo arranco?", "¿de qué se trata esto?"],
  },
  "q-agregar": {
    s: ["agregar una antena", "poner una antena", "inscribir un nodo", "añadir repetidores", "agregar nodos"],
    p: ["¿cómo agrego una antena?", "¿cómo pongo un repetidor?", "¿cómo inscribo un nodo?", "¿cómo añado una persona?", "¿dónde le doy para agregar?", "¿con qué botón pongo antenas?", "¿cómo meto un gateway?", "¿cómo se pone una antena?"],
  },
  "q-diseno": {
    s: ["el diseño por área", "diseñar una red", "el diseño automático", "planificar la red"],
    p: ["¿cómo diseño una red para un área?", "¿cómo hago una red para cubrir hectáreas?", "¿cómo se planea una red?", "¿cómo armo la red de una finca?", "¿cómo se diseña la malla?"],
  },
  "q-nodos": {
    s: ["un nodo", "los nodos", "el nodo antena", "el nodo de campo", "los tipos de nodo"],
    p: ["¿qué diferencia hay entre nodo y antena?", "¿qué tipos de nodo hay?", "¿qué es un nodo de campo?", "¿nodo y antena es lo mismo?"],
  },
  "q-regla": {
    s: ["la regla", "la herramienta de medir", "medir distancias", "medir áreas"],
    p: ["¿cómo mido una distancia?", "¿cómo mido un área?", "¿cómo uso la regla?", "¿con qué mido el lote?", "¿cómo saco el perímetro?", "¿cómo se mide en el mapa?"],
  },
  "q-referencia": {
    s: ["el mapa de referencia", "las capas de referencia", "los límites municipales", "las vías del mapa", "los ríos del mapa"],
    p: ["¿de dónde salen los límites de los municipios?", "¿qué muestran las líneas del mapa?", "¿el mapa trae los ríos?", "¿qué son las líneas grises?"],
  },
  "q-buscar": {
    s: ["el buscador", "buscar un lugar", "buscar coordenadas"],
    p: ["¿cómo busco un municipio?", "¿cómo encuentro un lugar?", "¿cómo voy a unas coordenadas?", "¿dónde escribo el lugar?", "¿cómo busco una vereda?", "¿(cómo|como) (encuentro|ubico|busco|hallo|localizo) (un pueblo|una vereda|un municipio|una finca|un sitio|un lugar) en el mapa?", "¿(dónde|donde) (busco|escribo|pongo) (el nombre del lugar|el municipio|las coordenadas)?"],
  },
  "q-alcance": {
    s: ["el alcance", "el rango de alcance", "los anillos", "el contorno de alcance"],
    p: ["¿hasta dónde llega una antena?", "¿cuánto alcance tiene un repetidor?", "¿a cuántos kilómetros llega la señal?", "¿qué tan lejos llega un nodo?", "¿cuál es el rango de un repetidor?", "¿cuántos km cubre una antena?"],
  },
  "q-coordenadas": {
    s: ["las coordenadas", "el formato de las coordenadas", "los grados minutos y segundos", "la latitud y longitud"],
    p: ["¿cómo escribo las coordenadas?", "¿en qué formato van las coordenadas?", "¿acepta grados minutos segundos?", "¿la longitud va con menos?", "¿cómo pongo las coordenadas del GPS?"],
  },
  "q-mover": {
    s: ["mover una antena", "arrastrar nodos", "reubicar un nodo"],
    p: ["¿cómo muevo una antena?", "¿cómo cambio de sitio un repetidor?", "¿se pueden arrastrar los nodos?", "¿cómo edito la posición?"],
  },
  "q-eliminar": {
    s: ["borrar una antena", "eliminar nodos"],
    p: ["¿cómo borro una antena?", "¿cómo elimino un repetidor?", "¿cómo quito un nodo?", "¿dónde está el botón de borrar?"],
  },
  "q-simular": {
    s: ["el botón simular", "simular", "la simulación"],
    p: ["¿qué hace el botón simular?", "¿para qué es simular?", "¿qué calcula la simulación?", "¿cada cuánto hay que simular?", "¿qué pasa cuando simulo?"],
  },
  "q-colores": {
    s: ["los colores", "los colores del mapa", "la leyenda", "el verde", "el amarillo", "el naranja", "el rojo", "lo morado", "las manchas de colores", "los tonos del mapa"],
    p: ["¿por qué hay partes verdes y amarillas?", "¿qué quiere decir el color naranja?", "¿qué significa que esté en amarillo?", "¿qué es cada color?", "¿el verde es bueno?", "¿qué quieren decir las manchitas de colores?"],
  },
  "q-margen": {
    s: ["el margen", "el margen del enlace", "los dB", "los decibeles", "el RSSI", "el SNR", "la sensibilidad", "el margen de desvanecimiento"],
    p: ["¿cuántos dB se necesitan?", "¿qué es un buen margen?", "¿qué significa 20 dB de margen?", "¿por qué piden 20 dB?"],
  },
  "q-presupuesto": {
    s: ["el presupuesto del enlace", "el link budget", "la potencia", "la ganancia de la antena", "la pérdida del cable", "los dBi"],
    p: ["¿cómo se calcula la potencia que llega?", "¿cuánta ganancia tiene la antena?", "¿qué pierde el cable?", "¿qué potencia transmite el radio?"],
  },
  "q-presets": {
    s: ["los presets", "el ajuste de radio", "el spreading factor", "el SF11", "el ancho de banda", "la velocidad del módem", "el preset de MeshCore"],
    p: ["¿qué preset uso?", "¿SF11 o SF10?", "¿qué ancho de banda conviene?", "¿cuál ajuste de radio llega más lejos?"],
  },
  "q-frecuencia": {
    s: ["la frecuencia", "la banda de 915", "los 915 MHz", "el espectro", "los canales", "la regulación de la ANE"],
    p: ["¿qué frecuencia usa la red?", "¿es legal usar 915 MHz?", "¿se necesita licencia?", "¿en qué banda trabaja?", "¿hay que pedir permiso para transmitir?"],
  },
  "q-altura": {
    s: ["la altura de la antena", "la altura de las torres", "el mástil", "la torre"],
    p: ["¿qué tan alta debe ir la antena?", "¿a qué altura pongo el repetidor?", "¿sirve subir la antena?", "¿cuántos metros de torre necesito?", "¿más alto es mejor?"],
  },
  "q-malla": {
    s: ["la malla", "la red mesh", "los enlaces entre antenas", "la retransmisión", "una red en malla"],
    p: ["¿cómo se comunican las antenas entre sí?", "¿cómo pasa la señal de un repetidor a otro?", "¿qué es una red mesh?", "¿cómo se arma la malla?", "¿(cómo|como) se (pasan|mandan|comparten|transmiten) (la señal|los mensajes|los datos) (las antenas|los repetidores|los nodos)( entre sí| entre ellos)?", "¿(cómo|como) se (hablan|conectan|enlazan|ven) (las antenas|los repetidores|los nodos) entre (sí|ellos|ellas)?", "¿(cómo|como) (salta|brinca|va) la señal de (una antena|un repetidor|un nodo) a otro?"],
  },
  "q-saltos": {
    s: ["los saltos", "el límite de saltos", "el hop limit", "los brincos del mensaje"],
    p: ["¿cuántos saltos puede dar un mensaje?", "¿por cuántos repetidores pasa un pago?", "¿cuántas veces se retransmite?", "¿qué pasa si hay muchos saltos?", "¿cuántos brincos da un mensaje?"],
  },
  "q-gateway": {
    s: ["el gateway", "la pasarela", "el nodo principal", "el Starlink", "la conexión a internet de la red", "el punto de internet"],
    p: ["¿para qué sirve el gateway?", "¿cómo sale la red a internet?", "¿qué lleva el sitio del gateway?", "¿qué hace el Starlink en la red?", "¿por qué hace falta un gateway?"],
  },
  "q-protocolos": {
    s: ["Meshtastic", "MeshCore", "los protocolos", "la diferencia entre MeshCore y Meshtastic", "la inundación administrada"],
    p: ["¿MeshCore o Meshtastic?", "¿cuál protocolo es mejor?", "¿qué diferencia hay entre Meshtastic y MeshCore?", "¿por qué MeshCore?"],
  },
  "q-gateway-medido": {
    s: ["lo que se midió del gateway", "el gateway medido", "la ficha técnica del gateway", "los datos medidos", "el router solar"],
    p: ["¿qué se midió en el gateway real?", "¿de dónde salen los datos del gateway?", "¿los valores son medidos o teóricos?"],
  },
  "q-usuarios-prueba": {
    s: ["los colores de las personas", "el resultado por usuario", "las personas a medias", "la capacidad real"],
    p: ["¿por qué unas personas salen en amarillo en la prueba?", "¿qué quiere decir que le funciona a medias?", "¿cómo evalúas persona por persona?"],
  },
  "q-optimizar-carga": {
    s: ["el botón de optimización", "los gateways de apoyo", "la optimización de la carga"],
    p: ["¿qué hace el botón de optimizar?", "¿para qué es un gateway de apoyo?", "¿cómo se arregla una red sobrecargada?"],
  },
  "q-pitch": {
    s: ["el pitch", "el modelo de negocio", "el punto de equilibrio", "el capex y el opex", "la comisión por pago"],
    p: ["¿cómo se paga la red sola?", "¿cómo gana plata Trama?", "¿cuándo se recupera la inversión?", "¿qué es el pitch?", "¿cuál es el negocio?"],
  },
  "q-recorrido-red": {
    s: ["el recorrido de la red", "las nubes del robot", "los letreros del recorrido"],
    p: ["¿qué es el recorrido?", "¿qué hace el robot en el recorrido?", "¿qué dicen las nubecitas?"],
  },
  "q-analista": {
    s: ["cómo diseñas", "el freno de rendimiento", "la opción económica", "el veredicto", "el análisis de la red", "la red óptima"],
    p: ["¿cómo decides cuántos repetidores poner?", "¿por qué pusiste tantos repetidores?", "¿cómo sabes que la red es óptima?", "¿qué es el freno de rendimiento?", "¿en qué medidas entiendes?", "¿la red está sobredimensionada?"],
  },
  "q-ia-local": {
    s: ["la IA local", "la inteligencia artificial local", "el modelo local", "Qwen", "WebGPU", "DeepSeek", "el modo sin internet"],
    p: ["¿puedes funcionar sin internet?", "¿qué modelo de IA local usas?", "¿puedo usar DeepSeek?", "¿qué es la IA local?", "¿necesito tarjeta gráfica?", "¿por qué se bloqueó la tarjeta gráfica?"],
  },
  "q-ia-voz": {
    s: ["Gemini", "Gemini Live", "la clave de API", "conectar una IA", "ChatGPT"],
    p: ["¿puedo conectarte a Gemini?", "¿hablas como ChatGPT?", "¿cómo pongo la clave de Gemini?", "¿te puedo conectar a una inteligencia artificial de verdad?"],
  },
  "q-roles": {
    s: ["los roles", "el rol de cada nodo", "el companion", "el room server", "el modo repetidor", "los nodos silenciosos"],
    p: ["¿qué es un companion?", "¿qué diferencia hay entre repeater y companion?", "¿qué hace un room server?", "¿qué nodos retransmiten?"],
  },
  "q-factibilidad": {
    s: ["la factibilidad", "la viabilidad", "el puntaje de la red", "los criterios"],
    p: ["¿cómo sé si la red es factible?", "¿qué significa que la red sea viable?", "¿qué criterios usas para decir que sirve?", "¿(cuándo|cuando) (es|se considera|queda) (factible|viable) (una|la) red?", "¿(qué|que) (hace|necesita) (una|la) red para ser (factible|viable)?"],
  },
  "q-respaldo": {
    s: ["el respaldo", "la redundancia", "la doble cobertura", "un punto único de falla"],
    p: ["¿qué pasa si se cae un repetidor?", "¿para qué sirve el respaldo?", "¿qué es la redundancia?", "¿(qué|que) pasa si (se daña|se cae|falla|se apaga|se roban|se quema|deja de funcionar) (un|el) (repetidor|gateway|nodo|equipo|antena)?", "¿(y )?si se (daña|cae|apaga) (un|el) repetidor (qué pasa|la red sigue)?"],
  },
  "q-modos": {
    s: ["la mejor antena", "el modo mejor servidor", "qué antena cubre cada punto"],
    p: ["¿qué antena cubre cada punto?", "¿quién da la mejor señal aquí?", "¿qué es el modo mejor antena?"],
  },
  "q-medir": {
    s: ["consultar un punto", "medir la señal en un punto", "la señal en mi finca"],
    p: ["¿cómo sé si llega señal a mi finca?", "¿cómo consulto la señal de un punto?", "¿cómo sé si a mi casa le llega?"],
  },
  "q-perfil": {
    s: ["el perfil", "la zona de Fresnel", "la línea de vista", "los obstáculos", "el perfil del enlace"],
    p: ["¿qué es la zona de Fresnel?", "¿por qué importa la línea de vista?", "¿una loma tapa la señal?", "¿qué es el perfil del terreno?"],
  },
  "q-modelo-propagacion": {
    s: ["el modelo de propagación", "Longley-Rice", "el ITM", "la difracción", "Deygout", "la calibración", "la precisión del modelo"],
    p: ["¿qué tan exacto es el cálculo?", "¿qué modelo usas para calcular la señal?", "¿se parece a Radio Mobile?", "¿qué tanto se equivoca el simulador?"],
  },
  "q-relieve": {
    s: ["el relieve", "el terreno", "la elevación", "el SRTM", "los datos de elevación", "la topografía"],
    p: ["¿de dónde sacas las montañas?", "¿tienes en cuenta las lomas?", "¿qué datos de elevación usas?", "¿funciona sin internet el relieve?"],
  },
  "q-privacidad": {
    s: ["la privacidad", "mis datos", "la información que pongo", "lo que guardo"],
    p: ["¿a dónde se envían mis datos?", "¿es seguro?", "¿esto se sube a Google?", "¿dónde se guarda lo que hago?", "¿alguien más ve mis diseños?", "¿(mis datos|mi información|lo que hago|mis diseños|mis redes) se (suben|envían|mandan|guardan|comparten) (a internet|en la nube|a un servidor|a Google|con alguien)?", "¿(esto|el simulador) (manda|sube|envía) (algo|mis datos) a internet?"],
  },
  "q-capas": {
    s: ["las capas", "el mapa base", "la opacidad", "la transparencia de la cobertura"],
    p: ["¿qué capas tiene el mapa?", "¿cómo cambio el mapa base?", "¿cómo hago la cobertura más transparente?"],
  },
  "q-exportar": {
    s: ["exportar", "guardar el escenario", "el KMZ", "abrir un escenario", "importar"],
    p: ["¿cómo guardo lo que hice?", "¿cómo lo paso a Google Earth?", "¿cómo abro un escenario guardado?", "¿puedo exportar a Excel?", "¿cómo comparto el diseño?"],
  },
  "q-receptor": {
    s: ["el receptor", "el radio portátil", "la pérdida del cuerpo", "el receptor en vehículo"],
    p: ["¿qué altura tiene el receptor?", "¿cómo afecta llevar el radio en el bolsillo?", "¿qué es el receptor?"],
  },
  "q-confiabilidad": {
    s: ["la confiabilidad", "el porcentaje de tiempo", "el porcentaje de ubicaciones", "el modo estadístico", "la variabilidad"],
    p: ["¿qué es el 90 % de confiabilidad?", "¿qué significa porcentaje de situaciones?", "¿qué modo estadístico uso?"],
  },
  "q-red-radio-mobile": {
    s: ["los parámetros de red", "el clima de radio", "la polarización", "la conductividad del suelo", "la refractividad", "la permitividad"],
    p: ["¿qué clima pongo en los parámetros?", "¿polarización vertical u horizontal?", "¿qué suelo uso?"],
  },
  "q-direccionales": {
    s: ["las antenas direccionales", "una Yagi", "una sectorial", "un panel", "una parabólica", "el patrón de radiación", "el azimut"],
    p: ["¿cuándo uso una antena direccional?", "¿omni o Yagi?", "¿cómo apunto una antena?", "¿qué es el tilt?"],
  },
  "q-entorno": {
    s: ["el entorno", "la vegetación", "los árboles", "las plantaciones de palma", "los edificios", "el clutter"],
    p: ["¿los árboles tapan la señal?", "¿cómo afecta la palma?", "¿la ciudad atenúa?", "¿qué pasa con la selva?"],
  },
  "q-unidades": {
    s: ["las unidades", "los dBm", "los microvoltios", "el campo eléctrico", "la escala de colores", "el umbral"],
    p: ["¿en qué unidades muestras la señal?", "¿qué son los dBµV?", "¿cómo cambio la escala de colores?"],
  },
  "q-informe": {
    s: ["el informe de radioenlace", "el radio link", "el PIRE", "el ángulo de elevación", "el balance del enlace"],
    p: ["¿qué trae el informe?", "¿qué es el PIRE?", "¿para qué sirve el informe de radioenlace?"],
  },
  "q-dictado": {
    s: ["el dictado", "el micrófono", "dictar", "la voz a texto"],
    p: ["¿puedo dictarte?", "¿cómo te hablo?", "¿me escuchas?", "¿cómo uso el micrófono?"],
  },
  "q-autoria": {
    s: ["la autoría", "los derechos", "la licencia"],
    p: ["¿quién hizo el simulador?", "¿quién te creó?", "¿quién te programó?", "¿de quién es esto?", "¿quién es el autor?"],
  },
  "q-manos-libres": {
    s: ["el Asistente Melki", "el modo manos libres", "hey Melki", "el modo Jarvis"],
    p: ["¿cómo funciona el asistente?", "¿cómo te activo por voz?", "¿qué es el modo manos libres?", "¿(cómo|como) te (activo|despierto|llamo|prendo) (con la voz|hablando|por voz|sin tocar nada)?", "¿(puedo|se puede) (hablarte|usarte) sin tocar (la pantalla|nada|el botón)?"],
  },
  "q-cobertura-maxima": {
    s: ["la cobertura máxima", "el máximo de cobertura", "hasta dónde se puede cubrir"],
    p: ["¿cuánto es lo máximo que cubre la red?", "¿se puede cubrir todo el departamento?", "¿cuál es el límite de cobertura?"],
  },
  "q-rendimiento": {
    s: ["el rendimiento", "la velocidad del simulador", "la resolución", "el radio de estudio"],
    p: ["¿por qué se demora tanto?", "¿por qué está lento?", "¿cómo hago que calcule más rápido?"],
  },
  "q-mejorar": {
    s: ["mejorar la cobertura", "las recomendaciones", "aumentar la cobertura"],
    p: ["¿cómo mejoro la cobertura?", "¿qué hago para tener más cobertura?", "¿qué me recomiendas para la red?", "¿cómo arreglo las zonas sin señal?", "¿(cómo|como) (hago|logro|consigo) (para )?que (la señal|la red|la antena|el repetidor) (llegue|alcance|vaya) más lejos?", "¿(qué|que) hago para (tener|que haya|ganar) más (alcance|cobertura|señal)?", "¿(cómo|como) (llego|alcanzo|cubro) más lejos?", "¿(cómo|como) le saco más alcance a la red?"],
  },
  "q-ajuste": {
    s: ["el ajuste automático", "ajústamelo", "el costo beneficio", "las antenas de apoyo"],
    p: ["¿qué hace ajústamelo?", "¿cómo funciona el ajuste automático?", "¿qué son las antenas de apoyo?"],
  },
  "q-area-objetivo": {
    s: ["el área objetivo", "la cobertura útil", "la meta de cobertura", "el área de estudio"],
    p: ["¿qué es el área objetivo?", "¿para qué marco un área objetivo?", "¿qué significa la meta del 60 %?"],
  },
  "q-equipos": {
    s: ["los equipos", "el SenseCAP", "el Heltec", "el T114", "el XIAO", "el nodo solar", "el hardware"],
    p: ["¿qué equipos usa Trama?", "¿qué radio lleva cada persona?", "¿qué hardware necesito?", "¿(qué|que|cuál) (equipo|radio|hardware|antena|aparato) (usa|lleva|tiene) (el gateway|un repetidor|cada repetidor|la persona|cada persona|el nodo)?", "¿(qué|que) (marca|modelo) (de radio|de antena|de equipo) (usan|se usa)?"],
  },
  "q-trama": {
    s: ["Trama", "la red de pagos", "los pagos por radio", "lo que pasa por la red", "la mensajería"],
    p: ["¿qué es Trama?", "¿qué se manda por la red?", "¿para qué sirve la red de pagos?", "¿la red sirve para WhatsApp?"],
  },
  "q-animacion": {
    s: ["las animaciones", "las luces que se mueven", "los puntos que parpadean", "el flujo turquesa"],
    p: ["¿por qué parpadean los puntos?", "¿qué son las líneas que se mueven?", "¿qué significa el destello?"],
  },
  "q-repetidor": {
    s: ["un repetidor", "los repetidores", "la distancia entre repetidores"],
    p: ["¿dónde pongo el repetidor?", "¿cada cuántos km va un repetidor?", "¿qué hace un repetidor?", "¿conviene ponerlo en una loma?"],
  },
  "q-persona": {
    s: ["las personas", "lo que lleva cada persona", "la billetera", "el radio de mano", "la app"],
    p: ["¿qué lleva cada persona?", "¿la gente necesita celular?", "¿cómo se conecta una persona?", "¿(la gente|las personas|cada persona|los usuarios) (necesita|necesitan|tiene que tener|deben tener) (celular|un teléfono|un radio|internet|un equipo) (para pagar|para usar la red|para conectarse)?", "¿con (qué|que) (paga|se conecta) la gente?"],
  },
  "q-mensaje": {
    s: ["cómo viaja un mensaje", "cómo viaja un pago", "el comprobante", "el acuse de recibo"],
    p: ["¿cómo viaja un pago?", "¿cómo llega un mensaje al gateway?", "¿qué es el acuse?", "¿cómo sabe la persona que el pago llegó?"],
  },
  "q-capacidad": {
    s: ["la capacidad", "la capacidad de la red", "el tráfico", "la saturación"],
    p: ["¿cuánta gente puede usar la red a la vez?", "¿cuándo se satura?", "¿cuánto tráfico soporta en general?", "¿qué tanta capacidad tiene una red así?"],
  },
  "q-estres": {
    s: ["la prueba de estrés", "las zonas de popularidad", "la hora pico", "el límite de cada punto"],
    p: ["¿qué es una zona de popularidad?", "¿qué mide la prueba de estrés?", "¿qué es la hora pico?"],
  },
  "q-poblar": {
    s: ["poblar personas", "la densidad", "la población"],
    p: ["¿qué hace poblar personas?", "¿cómo se reparte la gente?", "¿qué densidad uso?"],
  },
  "q-precios": {
    s: ["los precios", "el catálogo", "el precio de un repetidor", "el precio del gateway", "la cotización"],
    p: ["¿cuánto cuesta un repetidor?", "¿cuánto vale el gateway?", "¿qué precio tiene una billetera?", "¿de dónde salen los precios?"],
  },
  "q-dimensionamiento": {
    s: ["el dimensionamiento", "la escala por departamento", "cuántos sitios", "la adopción"],
    p: ["¿cómo se calcula la red de un departamento?", "¿qué es la adopción?", "¿cuántos Starlink se necesitan en el país?"],
  },
  "q-letra-pequena": {
    s: ["la letra pequeña", "los supuestos", "las limitaciones", "los riesgos"],
    p: ["¿qué tan confiables son los números?", "¿son exactas las cifras?", "¿qué supuestos usas?"],
  },
  "q-sin-cobertura": {
    s: ["las zonas sin cobertura", "lo rojo", "las zonas rojas"],
    p: ["¿por qué está en rojo?", "¿por qué no llega la señal allá?", "¿por qué hay partes sin señal?", "¿por qué se ve todo rojo?", "¿por qué no se conecta esa persona?"],
  },
};

/** Las plantillas de cada tema: sus preguntas propias y las formas de preguntar con cada cosa que se nombra. */
export function plantillasDeTemas() {
  const salida = {};
  for (const [id, t] of Object.entries(TEMAS)) {
    const s = `(${t.s.join("|")})`;
    salida[id] = [...t.p, ...t.p, ...FORMAS.map((f) => f.replace("{S}", s))];
  }
  return salida;
}

export const RANURAS_FUERA = {
  equipo: ["Nacional", "Millonarios", "el América", "el Junior", "Santa Fe", "el Real Madrid", "el Barcelona", "la Selección Colombia", "el Cali", "el Medellín"],
  comida: ["arepas", "bandeja paisa", "ajiaco", "sancocho", "tamales", "empanadas", "pizza", "arroz con pollo", "lentejas", "un pastel de chocolate"],
  materia: ["matemáticas", "inglés", "química", "historia", "biología", "física", "sociales"],
  persona: ["Simón Bolívar", "Gabriel García Márquez", "Einstein", "Shakira", "Cristóbal Colón", "Messi", "Napoleón", "Frida Kahlo"],
  pais: ["Francia", "Japón", "Perú", "Brasil", "Canadá", "Australia", "Egipto", "México"],
  cifra: ["2", "7", "12", "25", "100", "144", "dos", "siete", "doce", "cien"],
  cosa: ["la fotosíntesis", "el big bang", "la democracia", "el ADN", "la inflación", "un agujero negro", "la gravedad", "el calentamiento global", "la mitosis", "el coronavirus", "el bitcoin", "la bolsa de valores", "el feudalismo", "el Renacimiento", "la Constitución", "el IVA", "el colesterol", "la evolución", "un volcán", "el efecto invernadero", "la célula", "el átomo", "la electricidad", "un eclipse", "la luna", "el sistema solar", "la Segunda Guerra Mundial", "el capitalismo", "el socialismo", "la filosofía", "un poema", "la gramática", "el álgebra", "la diabetes", "una vacuna", "el reciclaje", "un huracán", "un terremoto", "la economía", "el fútbol", "el ajedrez", "la música clásica", "el tango", "la salsa", "un horóscopo", "el tarot", "las criptomonedas", "el metaverso", "el internet de las cosas", "el 5G de los celulares"],
};

/** Lo que no es del simulador: con lugares y palabras de radio también, para que no basten para ser una orden. */
export const FUERA = [
  "¿(cómo está|qué tal está|qué tal) (el clima|el tiempo) (hoy|mañana|en {lugar}|por allá)?",
  "¿va a llover (hoy|mañana|esta tarde|en {lugar})?",
  "¿qué temperatura hace en {lugar}?",
  "¿qué hora es?", "¿qué día es hoy?", "¿en qué año estamos?", "¿qué fecha es?",
  "¿quién ganó el partido (de|del) {equipo}?", "¿cómo va {equipo}?", "¿quién es el mejor jugador del mundo?", "(dame|dime) los resultados del fútbol", "¿cuándo juega {equipo}?",
  "(dame|dime|pásame) una receta de {comida}", "¿cómo se prepara {comida}?", "¿qué almuerzo hoy?", "(hazme|prepárame|tráeme) un café", "tengo hambre", "¿dónde venden {comida}?",
  "¿cuánto es {cifra} por {cifra}?", "¿cuánto es {cifra} más {cifra}?", "resuelve esta ecuación", "(hazme|ayúdame con) la tarea de {materia}", "¿cuál es la raíz cuadrada de {cifra}?", "explícame la tabla del {cifra}",
  "¿quién fue {persona}?", "¿cuál es la capital de {pais}?", "¿cuántos habitantes tiene {pais}?", "háblame de la historia de Colombia", "¿qué es la fotosíntesis?", "explícame la teoría de la relatividad", "¿por qué el cielo es azul?", "¿cuántos planetas hay?",
  "cuéntame un chiste", "(pon|ponme) (música|una canción|vallenato|reguetón)", "(recomiéndame|recomienda) una (película|serie|canción|novela)", "¿qué serie veo?", "cántame una canción", "dime un poema", "juguemos algo",
  "¿tienes novia?", "¿cuántos años tienes?", "¿me quieres?", "estoy aburrido", "estoy cansado", "¿qué opinas del amor?", "¿crees en Dios?", "¿cuál es tu color favorito?", "¿qué comes?",
  "¿cómo arreglo mi computador?", "mi celular no prende", "(instálame|descarga) WhatsApp", "¿cómo hago una hoja de vida?", "escríbeme un correo para mi jefe", "traduce esto al inglés", "¿cómo hago una tabla en Excel?", "ayúdame con una carta",
  "¿cuánto está el dólar?", "¿dónde compro un celular barato?", "¿cuánto vale un carro?", "préstame plata", "¿cómo invierto en la bolsa?", "¿cuánto gana un ingeniero?",
  "¿quién es el presidente?", "¿qué pasó en las noticias?", "¿qué opinas de la política?", "¿quién va a ganar las elecciones?",
  "¿cómo llego a Bogotá en bus?", "recomiéndame un hotel en {lugar}", "¿cuánto cuesta un vuelo a {lugar}?", "¿qué hay para hacer en {lugar}?", "¿dónde puedo comer en {lugar}?", "¿cuál es la historia de {lugar}?", "¿cuántos habitantes tiene {lugar}?", "¿qué fiestas hay en {lugar}?",
  "me duele la cabeza", "¿qué tomo para la gripa?", "¿cómo bajo de peso?", "¿es bueno tomar café?",
  "apaga la luz", "pide un taxi", "llama a mi mamá", "pon una alarma a las seis", "manda un correo a Juan", "abre YouTube", "busca en Google", "reserva una mesa", "pide una pizza", "ponme un recordatorio",
  "(manda|envía|mándale|escríbele) (un mensaje|un whatsapp|un correo|un audio) a (mi esposa|mi esposo|mi mamá|mi papá|mi jefe|Juan|mi hermano|mi novia|mi hijo|un amigo)",
  "¿(cómo|como) (arreglo|reparo|limpio|prendo) (la nevera|el carro|la moto|la lavadora|el televisor|la ducha|el computador)?",
  "¿(dónde|donde) (queda|está) (la torre Eiffel|el Amazonas en el mundo|París|Disney|la casa de Nariño|el Coliseo)?",
  "mi red de wifi no funciona", "¿cómo mejoro la señal de mi celular?", "¿qué antena de televisión compro?", "la señal de Claro es malísima", "¿qué operador tiene mejor cobertura?", "¿cuánto cuesta un plan de datos?", "mi internet está lento", "¿cómo configuro el router de mi casa?", "¿cuál es la mejor red social?", "no me llegan los mensajes de WhatsApp en el celular",
  "escríbeme un ensayo sobre el medio ambiente", "hazme un resumen de un libro", "¿cómo se cuida una planta?", "¿qué raza de perro me recomiendas?", "¿cómo se hace un nudo de corbata?", "¿cuál es el animal más grande?",
  "(hazme|escríbeme) un código en Python", "¿qué es la inteligencia artificial en general?", "¿cómo hago una página web?", "¿qué computador compro?",
  "¿(qué|que) (es|son|significa) {cosa}?", "(explícame|cuéntame de|háblame de|háblame sobre) {cosa}", "¿(cómo|como) funciona {cosa}?", "¿para qué sirve {cosa}?", "(quiero saber|tengo una duda) sobre {cosa}", "¿(quién|quien) (inventó|descubrió) {cosa}?",
];

/** Muletillas, pedazos y ruido del dictado: no piden nada (Melki pide que se lo repitan). */
export const RUIDO = [
  "(eh|em|mmm|este|o sea|pues|ajá|ah|uh|bueno bueno|sí sí|no no|ok ok|ya ya|a ver a ver|eh eh|hmm|aja)",
  "(de la|y el|que el|con la|en el|por la|para el|lo que|es que|y la|y los|a la|del|de los|que la)",
  "(asdf|jajaja|jeje|xd|qwerty|blablabla|ñaña|lalala|hmm hmm|testing|prueba prueba|probando probando|uno dos tres probando|hola hola hola|123|k|q|x|zzz|ajajá|jaja|ups)",
  "(melki melki|oye oye|está grabando|se escucha|sí señor|no señor|dale dale|y entonces qué|o no|verdad|cierto|mira mira|espera|espérate|un momento|ya vengo|ahorita)",
  "(la la la|tin tin|ta ta ta|bla bla|eeeh|aaah|ehhh|mmmm|ummm)",
  "(y|o|pero|entonces|bueno|pues|que) (y|o|pero|entonces|bueno|pues|que) (el|la|lo|los)",
  "(no sé|nada|olvídalo|nada nada|déjalo así|ya no|no importa)",
];
