# Simulador de cobertura · Red MeshCore o Meshtastic de Trama: pagos, WhatsApp e IA (LoRa 915–928 MHz)

Herramienta web para planear la red por radio de **Trama** sobre **MeshCore** o **Meshtastic**, que lleva la comunicación a donde
normalmente no llega: por ella viajan **pagos, mensajes de WhatsApp por texto y consultas a la inteligencia
artificial** en los lugares sin señal, y todo ese tráfico comparte el mismo canal. Se ubican el gateway, los
repetidores y la gente por coordenadas (o en el mapa) y el simulador calcula la cobertura y el alcance sobre el relieve,
los enlaces de la malla, los saltos hasta el gateway y la factibilidad de la red, con la paleta de colores de Radio
Mobile. Con **«Poblar personas»** se llena la zona de billeteras al azar, con las **«Zonas de popularidad»** se pone
gente alrededor de cada repetidor (la cantidad que se quiera) y se busca el límite de cada punto, la **«Prueba de
estrés»** mide la hora pico zona por zona hasta que cada repetidor se revienta y la **«Prueba de carga»** dice cuántos
pagos o mensajes al tiempo aguanta cada frecuencia. Abre en el modo **«Sembrar la malla»**: primero el Gateway +
Internet, luego los repetidores según la distancia y al final la gente, con guía paso a paso, sembrado automático de
repetidores y mensajes de prueba que viajan por la malla. Usa los equipos, precios, capacidad y supuestos del documento de
Trama del Inge. Incluye a **Melki**, un asistente local que ejecuta pedidos en español («pon el gateway en 4.2,
-73.37», «puebla la zona con 250 personas», «por cada antena 250 personas y mira qué tan colapsada queda la red»,
«¿cuántas personas aguanta el Repetidor 1?», «llena el gateway hasta su límite», «envía 25 pagos al tiempo», «¿cuánto
cuesta la red para el Chocó?», «conecta a los que faltan»), responde preguntas (cómo viaja un mensaje, por qué una persona
está en rojo, qué hacer ahora) y da tours guiados. Con una clave gratuita de Google AI Studio, Melki también **conversa
como un modelo de inteligencia artificial** (Gemini Live: oye la voz directamente y responde por escrito), presenta
el **pitch del modelo de negocio** con su robot volando por el mapa (cada antena, la inversión, la operación y el punto
de equilibrio) y hace el **recorrido de la red**: va punto por punto y en una nube que sale de cada antena escribe qué se
instaló, por qué ahí, qué papel cumple y, al final, por qué la red quedó así.

> **© 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.**
> Creado por Giancarlo González Guerrero para el Ingeniero Pablo Felipe Acevedo y la empresa Melki, con ayuda de
> inteligencia artificial. Uso, copia, modificación o distribución sin licencia escrita de los titulares: prohibidos.
> Ver [Autoría y licencia](#autoría-y-licencia) y [LICENSE](LICENSE).

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
  - Enviar un mensaje de prueba (del tamaño de la orden firmada de un pago, 118 B; un WhatsApp o una consulta a la IA
    viajan igual): se anima salto a salto hasta el gateway, con el tiempo en el aire de LoRa, la espera al azar de cada
    repetidor de MeshCore, el límite de saltos del diseño y la probabilidad de entrega con los 4 intentos; en cada
    transmisión destellan los vecinos que la oyen y la respuesta (el comprobante, la confirmación o lo que contesta la
    IA) vuelve por la misma ruta
  - Malla animada: piezas redondas (el gateway con la nube «IA») que laten si están conectadas, parpadean en rojo sin
    cobertura y destellan al retransmitir; líneas turquesa que avanzan hacia el gateway con pulsos; alcance de cada
    nodo en turquesa siguiendo el relieve. Se apaga con «Animar el flujo de la información»
  - «Cómo funciona» (la guía corta del modo) y alcance de referencia en terreno plano (gateway → gente, repetidor → gente según la torre,
    repetidor ↔ repetidor) junto al que supone Trama por terreno (10 km en plano, 8 en sabana, 5 en montaña o ríos, 3
    en selva)
- **Poblar personas** (en el Resultado, o pidiéndoselo a Melki): reparte N personas (o la densidad de Trama: 0,2, 1 o 5
  por km²) al azar y uniformes sobre el terreno, en el área objetivo, en otra área de la regla, alrededor de la red o en
  toda el área de estudio; opcionalmente solo donde la última simulación da servicio. Las pobladas se marcan aparte
  (puntos pequeños en el mapa, un renglón en la lista, resumen en «Nodos de campo», sin etiquetas de enlace) y no entran
  en el ajuste automático
- **Zonas de popularidad** (al tocar un repetidor o el gateway —en su tarjeta del mapa o en la lista—, en el Resultado o
  pidiéndoselo a Melki): la cantidad de personas que se quiera (hasta 2.000 por punto) a la redonda de un nodo (1, 2, 3
  o 5 km) o de cada gateway y repetidor, solo donde hay señal. Cada persona queda marcada con su zona; volver a poner
  una zona la reparte de nuevo y «Quitar las zonas» las borra (hasta 4.000 personas pobladas en total). En cada punto:
  - «Poner y probar»: pone esa gente y simula de una vez la hora pico con todos enviando información; dice cómo
    queda el punto y toda la red (estable, lenta o se revienta)
  - «¿Cuántas aguanta?»: sube solo la gente de ese punto (su ritmo de mensajes), con el resto de la red como está, y
    busca hasta cuántas personas aguantan sin demora el punto y la red, desde cuántas va lento, desde cuántas se
    revienta y qué falla primero (el propio punto —canal lleno, ciclo de trabajo, cola, choques, alcance, energía— u
    otra zona, como el gateway). Si el punto está vacío pone antes una muestra. Hace tres búsquedas independientes y
    da la del medio con su rango, y dibuja la curva (personas en el punto frente a % con respuesta, del punto y de la
    red). «¿Cuántas aguanta cada punto?» lo hace con todos, uno a la vez
  - «Llenar hasta el límite»: pone exactamente esa cantidad y lo confirma simulando la hora pico con la gente puesta
    (si no queda estable, prueba con un poco menos)
- **Prueba de estrés de la hora pico**: cada persona manda sus mensajes del día —pagos, WhatsApp y consultas a la IA—
  (2,4 por persona, el ritmo que supone Trama: 55 por hora con 150 usuarios; se sube con «Mensajes por persona al día»
  o el multiplicador ×1 a ×10 si la gente escribe o consulta más) y el 15 % cae en la hora pico (25 % un día de
  mercado). Se simula el canal paquete por paquete y se mide en cada gateway y repetidor: las personas que entran a la
  malla por él (su primer salto) y las que pasan de otras zonas, mensajes por hora, % con respuesta, espera típica y del 95 %, % del
  tiempo con el canal ocupado, cuánto transmite frente al tope del 50 %, paquetes descartados por cola llena, hasta
  dónde completa el 90 % con esa carga frente a la persona más lejana que atiende, la energía del repetidor solar P1
  (consumo al día frente a lo que repone el panel de 5 W) y el aire que gasta cada persona. Para toda la red: mensajes
  por hora pedidos y entregados, ancho de banda útil (bps de mensajes frente a la velocidad del canal) y el canal del gateway.
  En el mapa cada zona se pinta verde (aguanta), naranja (lenta) o roja (se revienta). «¿Hasta dónde aguanta cada
  repetidor?» sube y baja la carga (×0,03 a ×32) y da cuántas personas aguanta cada zona sin demora, desde dónde se
  revienta y la curva de rendimiento (mensajes entregados frente a pedidos: sube hasta el máximo del canal y después cae
  por los choques). «Comparar ajustes de radio» repite la hora pico con los 7 ajustes (250 y 62,5 kHz), recalculando
  las rutas con la sensibilidad de cada uno
- **Prueba de carga**: N pagos (orden, comprobante y aviso, con sus acuses) o mensajes de texto (un WhatsApp o una
  consulta a la IA y su respuesta) saliendo al tiempo en 1 s, 10 s o 1 min, o un flujo por hora, simulados paquete por
  paquete como MeshCore. Da el porcentaje que recibió su respuesta,
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
  estrés en día de mercado», «¿cuántas personas aguanta el Repetidor 1?», «llena el gateway hasta su límite», «pon 700
  personas en el Repetidor 2 y mira la estabilidad», «el límite de cada punto», «envía 25 pagos al tiempo», «manda 15
  mensajes de WhatsApp al tiempo», «¿hasta cuántos pagos aguanta?»; y todo junto: «vuélveme a
  hacer las 11.226 hectáreas de manera estable y por cada antena 250 personas para ver si se colapsa»), el
  dimensionamiento de Trama, capas y fondo del mapa, modos de cobertura, «simular al cambiar», relieve plano o real, nombre del
  escenario, duplicar y seleccionar nodos, los paneles («pantalla limpia», «muestra los paneles»), y su propia voz. Si no
  entiende un pedido de acción, lo dice y da ejemplos. A «¿cómo dejo la mayor cobertura posible?» responde con
  recomendaciones para el escenario (sitios altos, línea de vista, malla con respaldo, gateway al centro, SF y antena) y
  el botón para proponer la opción de máxima cobertura; «dame la mayor cobertura posible» la calcula de una vez
- **Pitch del modelo de negocio** (v13; botón «Pitch» de la barra de arriba, o «Melki, preséntame el modelo de
  negocio»): el robot de Melki, en vectores, vuela por el mapa de capítulo en capítulo (la cámara lo sigue), señala cada
  antena con un anillo que late y muestra el guion y las cifras en una tarjeta (lo narra en voz alta solo con la voz
  encendida); en el computador,
  lo que cuenta de cada antena sale escrito en una nube desde la antena (v13.1). Todo sale de la red que esté en el mapa
  y de los precios del documento de Trama; no inventa ingresos:
  - Portada, el problema (adultos rurales sin canal digital en el departamento de la red y en el país) y la solución
  - Antena por antena (hasta 8): dónde está (coordenadas y municipio), a qué altura va y por qué: el enlace con su
    margen y si tiene línea de vista, la altura recomendada (6 m como mínimo; 9 o 12 m, o una loma más alta, si el
    enlace queda inestable), el área que cubre, la gente que entra por ella y si es un punto crítico
  - La cobertura con el relieve real y la capacidad real (la prueba de estrés, persona por persona, o el diseño de
    Trama: 150 usuarios por frecuencia en SF11)
  - La inversión (CAPEX: sitios gateway, repetidores, billeteras, instalación y transporte, con la logística del
    departamento), la operación (OPEX: Starlink, mantenimiento de sitios, baterías y visitas, soporte) y la red completa
    al mes, con la inversión repartida en 5 años
  - El punto de equilibrio: el costo por usuario al mes y la comisión por pago que cubre toda la red. Con la comisión
    que se quiera probar («prueba una comisión de 300 pesos» o el campo de la tarjeta) da los ingresos al mes, lo que
    queda tras la operación, en cuántos meses se recupera la inversión y desde cuántos usuarios se paga sola. Con pocas
    personas en el mapa (una muestra), cuenta la red llena
  - Cómo escala al departamento y al país (con el 30 % de adopción) y el cierre: del simulador al piloto
  - Se maneja con los botones, el teclado (← → espacio Esc) o la voz: «siguiente», «anterior», «pausa», «sigue»,
    «repite», «ve a la inversión», «termina la presentación». Avanza solo al terminar cada capítulo (o a mano). Con la
    IA conectada lo narra la IA con sus palabras y responde preguntas en medio; si le hablan encima, pausa
- **Recorrido de la red** (v13.1; botón «Recorrido» de la barra de arriba, o «Melki, explícame la red», «hazme un
  recorrido por la red», «recorre la red punto por punto»): el robot de Melki va por el mapa un punto a la vez, siguiendo
  el camino de la señal (el gateway y sus repetidores rama por rama, en el sentido del reloj), y de cada punto sale una
  nube de vidrio translúcido, con una línea que lo señala, que escribe su explicación como una máquina de escribir (el
  texto oscuro sobre el vidrio claro se lee sobre cualquier color del mapa). La voz dice solo lo breve; el detalle va
  escrito. Todo sale de la red del mapa y de la simulación al día:
  - La red de un vistazo: piezas, lugar, protocolo y cobertura
  - El gateway: qué se instaló (radio, antena y altura, mini PC con UPS, Starlink y energía solar), por qué ahí (en la
    red, en el terreno y por sus enlaces directos, con distancia, margen y línea de vista) y su papel: cuántas personas
    salen por él a internet y qué pasa si se apaga
  - Cada repetidor: su equipo, antena y mástil; el suelo frente al promedio de las antenas (en lo alto, en lo bajo o en
    el promedio); el enlace con el que se une (distancia, línea de vista o difracción, margen y qué tan firme es); dónde
    está su gente; si es troncal (por él pasa el tráfico de otros repetidores), de acceso o un punto crítico, y si tiene
    respaldo; la altura recomendada. Recorre hasta 10 antenas y cuenta las demás al final
  - Las personas: cuántas llegan, en cuántos saltos y por cuál punto entran; la prueba de estrés, si la hay
  - Lo que falta (gente sin cobertura, repetidores sin camino, enlaces débiles, puntos críticos), con un botón que se lo
    pide a Melki: «Conecta a los que faltan», «Ajústamelo» o «Sugiéreme antenas de apoyo»
  - Por qué la red quedó así: la estructura y la distancia entre repetidores, el reparto de la carga, la solidez de los
    enlaces (línea de vista, el más débil, los de sobra), la cobertura y la calificación, y el costo de la
    infraestructura (sitios y repetidores, con instalación y transporte; el negocio completo está en el pitch)
  - Se maneja con los botones, el teclado (← → espacio Esc) o pidiéndoselo a Melki: «siguiente», «anterior», «pausa»,
    «sigue», «repite», «ve al gateway», «ve al Repetidor 2», «el tercer repetidor», «ve a lo que falta», «¿por qué la
    red quedó así?», «¿por qué pusiste el Repetidor 2 ahí?», «explícame el repetidor dos», «termina el recorrido».
    Avanza solo cuando hay tiempo de leer cada nube (o a mano). Al terminar o al salir, deja todo escrito en la
    conversación. Con la IA conectada, la IA dice lo breve con su voz y usa la herramienta del recorrido
  - En el celular la nube va abajo, como una hoja, y el punto queda arriba. Si el texto no cabe (en el celular o en una
    pantalla baja), la nube baja sola con lo que va escribiendo. Un toque en la nube la termina de escribir
- **Conversar con IA: Gemini Live, gratis** (v13; Ajustes de voz → «Conversar con IA (Gemini Live)»): con la opción
  encendida, el Asistente Melki conversa con un modelo de voz en vivo de Google. Oye el audio del micrófono directamente
  (no un texto), responde por escrito (con voz natural solo si se enciende «Hablar en voz alta»: entonces, con audífonos
  se le puede hablar encima y con parlantes se le calla con ■) y
  hace en el simulador lo que se le pida con las mismas órdenes de Melki. Sus herramientas: ejecutar una orden, leer el
  estado de la red y sus costos, consultar el conocimiento del proyecto, manejar el pitch y el recorrido de la red y
  despedirse. No inventa cifras: las toma del simulador.
  - La clave gratuita de Google AI Studio (aistudio.google.com/apikey) se pega una vez y queda solo en ese navegador,
    nunca en el código ni en el repositorio. «Probar conexión» la verifica; se elige el modelo (Gemini 3.8 Live o
    3.1 Flash Live) y la voz
  - «Hola Melki» abre la conversación; con «adiós» o tras un minuto sin hablar la cierra y vuelve a esperar su nombre
  - Google corta cada conexión a los 10 minutos (y la red se puede caer): Melki la reanuda sola en otra, con la misma
    conversación; si narraba un capítulo del pitch, se lo pide otra vez
  - Sin clave, sin internet, con la clave mala o sin cupo, sigue con su cerebro local y lo avisa
  - Costo: la capa gratuita no cobra (tiene límites por día); en la de pago, unos US$0,005 por minuto de audio que
    entra y US$0,018 por minuto de voz del modelo. Otras opciones que se miraron: GPT-Live-1 de OpenAI (unos
    US$0,05 por minuto, sin capa gratuita), Vapi (US$0,05 por minuto más cada servicio) y Whisper (solo pasa la voz
    a texto; ya lo usa el dictado privado)
- **Asistente Melki** por voz (tipo Jarvis; botón «Asistente Melki» de la barra de arriba, ícono de ondas del chat o
  «activa el asistente»): Melki escucha todo el tiempo y se activa con su nombre: «Hola Melki», «Oye Melki», «Hey
  Melki» o «Hello Melki» y el pedido de corrido; reconoce el nombre como lo escribe el reconocimiento («Melky»,
  «Melqui», «Melkis», «Mel ki»…). Responde con el trato cortés de un mayordomo: al activarse saluda «Hola, señor.
  Bienvenido…» y, si solo lo llaman por su nombre, contesta «Hola, mi señor. Le escucho; estoy atento y presto a seguir
  sus órdenes». Al activarse oculta el panel de herramientas y el de resultados para dejar el mapa libre; cuando un
  resultado se ve mejor en un panel, pregunta si lo muestra («sí» lo abre) y su barra trae los botones «Mostrar
  resultados», «Mostrar herramientas», «¿Qué hago ahora?» y «¿Qué puedo decir?»; al apagarlo, los paneles vuelven. Entiende lo mismo que por escrito, con los números y las coordenadas dichos en
  palabras («doscientas cincuenta personas», «cuatro punto dos, menos setenta y tres punto tres siete»); ejecuta,
  deja la respuesta escrita (lo principal en su barra y todo en la conversación; en voz alta solo si se lo piden) y se
  queda atento unos segundos para seguir sin repetir
  el nombre. Controles por voz: «para», «repite», «más detalle», «sí, hazlo» / «la segunda» (los botones de su
  respuesta; «sí» nunca es «Deshacer»), «deshaz», «gracias», «deja de escuchar». Sin su nombre no hace nada; no toma
  como pedido su propia voz cuando entra por el micrófono (lo que empieza a oírse mientras habla, o el eco de sus
  últimas palabras). Una barra de vidrio sobre el mapa, con un orbe animado según lo que hace, muestra lo que entiende y
  lo que dice (subtítulos). En Ajustes de voz: el trato (señor, señora o sin tratamiento), la voz (elige sola la más
  natural del equipo, como las neuronales de Edge, y se puede escoger y probar otra), dejar el mapa libre, activarse
  al abrir el simulador (con el micrófono permitido, saluda solo; si el navegador no deja hablar hasta el primer toque,
  lo avisa), seguir la conversación, leer las respuestas completas y el sonido al activarse, y el permiso del micrófono
  («Dar acceso» para que el navegador no vuelva a preguntar). Usa el mismo modo del dictado («navegador» o «privado»);
  si el navegador corta la escucha, se vuelve a encender sola
- **En reposo, como Siri o el asistente de Google** (v12.6): con el micrófono permitido una vez, mientras la página
  está abierta Melki queda en reposo (sin barra; un oído verde en su botón) y se activa solo al oír «Hola Melki», «Hey
  Melki», «Hello Melki» u «Oye Melki», con el pedido de corrido o solo el llamado; sin su nombre no hace nada. «Melki,
  deja de escuchar» (o la X de la barra) lo devuelve al reposo y los paneles vuelven; «Melki, apaga el micrófono» lo
  apaga del todo hasta volver a tocar «Asistente Melki». Se puede quitar en Ajustes de voz («Escucharme siempre en
  esta página»). Mientras dicta en el chat, el reposo se pausa y vuelve después
- **Barra del asistente que no estorba**: se arrastra a cualquier lugar del mapa (queda guardado; doble clic la
  devuelve a su sitio), se achica a una píldora con el botón de achicar y, cuando está esperando sin nada que mostrar,
  se achica sola a los 5 s y vuelve a crecer al hablarle
- **Mayordomo dentro de su oficio**: a lo que no es del simulador («cuéntame un chiste», «¿quién ganó el partido?»,
  «hazme el café») responde con respeto «Mi señor, fui diseñado y creado para cumplir órdenes y procesos dentro de este
  simulador…», con ejemplos y los botones «¿Qué hago ahora?» y «Ver los tours guiados»; a «¿cómo estás?» contesta con
  cortesía y queda a sus órdenes
- **Mejor oído**: pide al reconocimiento varias alternativas de cada frase y elige la que tiene el nombre de Melki,
  palabras del simulador o números; corrige lo que suele escribir mal («red mes» → red mesh, «geitwey» → gateway,
  «hectarias» → hectáreas, «estar link» → Starlink, «guasap» → WhatsApp) y encuentra los municipios aunque se digan
  pegados o con una letra cambiada («barrancaupía», «Barranca de Opia», «villavicensio»)
- **Entiende los lugares aunque se oigan mal** (v12.7): compara cómo suenan los nombres (b y v, s, z y c, ll y y, h
  muda, vocales que se confunden al hablar rápido) y usa el departamento dicho al final o el que se ve en el mapa:
  «ubícame en barranca de UPA meta», «barranco vía meta» o «arranca de upyía meta» lo llevan a Barranca de Upía (Meta),
  con su tamaño, y le ofrece la red de todo el municipio. Si duda entre varios («barranco vía»: Barranca de Upía,
  Barranquilla, Barranco Mina…) o el nombre está repetido («Granada»), pregunta «¿Se refiere a…?» con un botón por
  lugar («sí», «la segunda», «el del Meta» o «ninguno de esos»); si no reconoce el lugar, pide con cortesía el
  municipio y el departamento y completa la orden con la respuesta. Al diseñar en un lugar mal dicho, dice lo que
  entendió («Entendí «Barranca de Upía (Meta)».»)
- **Conversa** (v12.7): por voz, lo que no entiende lo pide de nuevo («Discúlpeme, señor, no le entendí bien. ¿Me lo
  repite, por favor? Escuché: «…»»); contesta «¿me escuchas?», «¿dónde estamos?» (el municipio que se ve, con la red
  de todo el municipio a un «sí») y los elogios. Recuerda el lugar del que se habló: «ármame una red que cubra todo el
  municipio», «la zona norte del municipio», «3.000 hectáreas ahí» o «lo que estoy viendo». Al hablar rápido: de las
  versiones que propone el reconocimiento elige la que el simulador entiende como orden, espera más si la frase quedó
  a medias («ubícame en…») o si se sigue hablando, corrige «red mechen» → red mesh en, separa «heymelki» y quita las
  muletillas («o sea», «eh»)
- **MeshCore o Meshtastic, persona por persona y optimizar la red para la carga** (v12.9):
  - En Parámetros → Radio LoRa se escoge el protocolo de la malla. MeshCore: solo los repetidores retransmiten, la
    ruta se aprende, hasta 64 saltos y sus 7 ajustes de radio. Meshtastic: inundación administrada (repiten todos,
    salvo los mudos), hasta 7 saltos y sus presets (LongFast de fábrica, LongModerate, LongSlow, MediumSlow,
    MediumFast y ShortFast); los equipos de las personas repiten (CLIENT) o no (CLIENT_MUTE). Melki: «cambia a
    Meshtastic», «usa MeshCore», «que los clientes no repitan», «usa LongFast».
  - La prueba de estrés evalúa a cada persona: qué parte de sus mensajes vuelve, cuánto espera y por qué no le
    funciona (sin cobertura, más saltos que el límite, señal débil, canal ocupado, choques, cola llena, la fila del
    gateway o espera larga). En el mapa el contorno de cada persona toma el color de su estado, con la paleta de los
    rangos de señal: le funciona bien, le funciona, a medias, con dificultades y no le funciona; la leyenda dice
    cuántas hay de cada una y la lista del panel muestra las que peor la pasan. La rampa da la capacidad real: el
    máximo de personas atendidas. Melki: «¿qué usuarios no funcionan?», «¿a quiénes no les funciona?».
  - Tráfico «Medido en el gateway», con la ficha técnica de un gateway real (Meshtastic, Raspberry Pi 5 con un Heltec
    V3, semana del 19 al 26 de octubre de 2026): comandos de 15 a 56 caracteres (mediana 40), respuestas de hasta 200 B
    por parte (las de la IA, en varias), 5,8 mensajes por equipo al día con el 24 % en la hora pico, y el gateway que
    atiende de a uno (~1 s por mensaje; hasta 15 s si la base de datos no responde). Enlaces «medidos en campo»: la
    curva de entrega calibrada con la SNR y la respuesta a los sondeos de las cinco antenas de la ficha: cerca de la
    mitad de los paquetes pasa con SNR de −12 dB y el 3,6 % llega con error aun con buena señal. En el repositorio el
    gateway y sus antenas van con nombres genéricos (Antena A a E, sin IDs de nodo ni distancias). Melki: «prueba la
    hora pico con lo medido en el gateway», «¿qué se midió en el gateway?».
  - «Optimizar» (en el resultado de la prueba, o «optimiza la red para la carga», «recomiéndame gateways de apoyo»):
    mira qué falla y prueba, con la misma carga, gateways de apoyo (convertir el repetidor de una zona cargada en
    gateway, un segundo gateway cerca de la gente que más sufre, o uno en otra frecuencia que se lleva a la gente de
    esa zona), antenas de apoyo para la gente sin cobertura (la cadena la busca el sembrado automático con el
    relieve), un ajuste de radio más rápido, en Meshtastic los equipos en CLIENT_MUTE y sin telemetría a la malla, y
    atender en paralelo en el gateway. Cada propuesta trae el antes y el después (personas atendidas, mensajes
    completos, canal); «Todo junto» suma las que ayudan. Se aplica al mapa con un botón (y se deshace) o queda marcada
    «se hace en campo» (otra frecuencia, el servicio del gateway, la telemetría).
- **Voz sin eco, sin bucles y sin cortes** (v12.8):
  - Con parlantes Melki se oye a sí mismo. Lo que empieza a oírse mientras habla, o hasta 0,8 s después, es su voz.
    Lo que repite lo que acaba de decir también: una frase corta, si llega hasta 1,2 s después; una de cuatro o cinco
    palabras, hasta 2,5 s; una de seis o más, hasta 12 s. Nada de eso lo toma como pedido; solo «Melki, para» lo
    interrumpe.
  - No entra en bucles: no repite en voz la misma respuesta a un pedido que llegó sin su nombre, justo después de que
    habló y con sus mismas palabras. Tampoco se disculpa dos veces seguidas si no lo llaman por su nombre: deja la
    respuesta escrita y vuelve a esperar «Hola Melki».
  - La disculpa dice en voz solo «Discúlpeme, señor, no le entendí bien. ¿Me lo repite, por favor?». Lo que oyó queda
    escrito, para que el micrófono no lo vuelva a oír.
  - Sin duplicados:
    - Cada frase llega una sola vez, aunque el navegador la mande dos veces.
    - En el celular no se repite lo dicho antes: Chrome en Android y Safari mandan «uno», «uno dos», «uno dos tres».
    - Al hablar rápido se quita lo que quedó repetido («ubícame en ubícame en Barranca»).
    - El mismo pedido dos veces en 4 s se hace una sola vez.
  - Sin prender y apagar el micrófono: Edge deja de escuchar a los pocos segundos de silencio y Chrome al minuto.
    - La escucha se vuelve a encender sola en 60 ms, sin que la barra cambie ni avise.
    - En el computador, con el micrófono ya permitido, lo deja abierto entre una escucha y otra, así el aviso del
      navegador y el de Windows no parpadean.
    - Si falla seguido (sin internet), espera cada vez más: 0,25 s, 0,5 s, 1 s… Tras seis fallos avisa una sola vez y
      sigue intentando cada 8 s; no se rinde (v13.1): al volver el internet, la pestaña o el foco, vuelve a escuchar
      enseguida y la barra vuelve a «escuchando». Si el micrófono se ocupa un momento (otra app, el celular cambiando de
      audio), reintenta sin dar error.
    - El dictado de la caja tampoco se corta solo: sigue escuchando hasta que se toque el micrófono o tras 15 s de
      silencio.
  - Oído atento: en el computador mide el nivel de la voz. Las barritas del orbe siguen la voz que oye, y si la
    persona sigue hablando espera hasta 1,5 s más antes de hacer el pedido, para no cortarle la frase.
- **Melki no habla: escucha y cumple órdenes** (v13.2): lo normal es que Melki no hable en voz alta. Escucha todo el
  tiempo, sin pausas, hace lo que se le pide y deja la respuesta escrita en su barra («Le respondo por escrito») y en la
  conversación. El pitch y el recorrido van escritos (la tarjeta y la nube). Con la IA (Gemini Live) su audio no suena:
  la respuesta queda escrita el tiempo de leerla, el micrófono nunca se calla y se le puede hablar encima (la IA sabe que
  no la oyen y va al grano). Para oírlo: «háblame», el parlante de la conversación, el de la presentación o el del
  recorrido, o «Hablar en voz alta» en Ajustes de voz (ahí aparecen la voz, «Probar», «Uso audífonos» y «Leer las
  respuestas completas»); «no hables» lo vuelve a callar (ni la confirmación suena). La voz encendida dura hasta cerrar
  o recargar la página: no se guarda.
- **Audio estable con parlantes o con audífonos** (v13.1; con la voz encendida):
  - Con parlantes (lo normal, «Uso audífonos» apagado en Ajustes de voz) Melki no escucha mientras habla: la escucha
    queda en pausa desde antes de que empiece su voz (la suya, la de un tour, el pitch o el recorrido) y vuelve 0,45 s
    después de que calla. Así no se oye a sí mismo, no se responde ni se interrumpe, y en el celular el reconocimiento
    no le corta la voz. Para callarlo, el cuadrito ■ de su barra (su ayuda lo dice). Con «Uso audífonos» escucha
    mientras habla y se le puede hablar encima («Melki, silencio»); el eco que se cuele lo filtran las reglas de
    siempre.
  - La voz va en trozos cortos (hasta 150 letras, por frases, comas o palabras): las voces en línea de Chrome y Edge se
    cortan solas en textos largos. Un trozo a la vez, cada uno con su tiempo de guardia por si el navegador no avisa
    que terminó; si la voz en línea falla por la red, sigue con una voz del equipo y repite ese trozo.
  - Con la IA y parlantes: mientras suena su voz (y 0,45 s después) el micrófono le manda silencio, y la sesión le pide
    al modelo que no se deje interrumpir por lo que oye y que le cueste más «oír» que alguien empezó a hablar. Su voz
    sale con un colchón de 0,22 s (0,12 s tras un corte) para que no se entrecorte, y si el navegador suspende el
    audio, vuelve al tocar la página o al volver a la pestaña. Si el micrófono se desconecta, lo vuelve a abrir solo.
- **Red sostenible y viable** (v12.6): «hazme una red sostenible económica y técnicamente viable en Barranca de Upía
  de 11.226 hectáreas» diseña la malla en el municipio (señal media o mejor en el 95 % del área) y la presenta con su
  viabilidad técnica (factibilidad, cobertura, enlaces y saltos), la inversión y la operación mensual con los precios
  del documento de Trama y la logística del departamento, y que todo funciona con energía solar; ofrece probar la hora
  pico con 250 personas por punto. Si falta el lugar o el tamaño, lo pregunta con un ejemplo listo. «¿Cuánto cuesta la
  red?» da el presupuesto de la red que esté en el mapa
- **Panel izquierdo plegable**: el botón junto a «Modo avanzado» lo oculta y el de la barra de arriba lo devuelve (como
  el de Resultados); con los dos ocultos queda solo el mapa, ideal para trabajar por voz
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
  malla», «¿Cuánto tráfico aguanta?» (poblar, probar la carga, zonas de popularidad y la hora pico por repetidor), «Conocer la pantalla», «Red mesh completa», «Como Radio Mobile», «Medir y exportar», «Hablar con Melki» y «Asistente
  Melki por voz», que enseña a llamarlo, conversar, trabajar con el mapa libre y sus sugerencias y pedir la mayor cobertura posible. En los pasos prácticos
  Melki detecta cuando quedó hecho y ofrece «Hágalo por mí» y «Omitir paso»; todo ocurre en un escenario de práctica y
  al salir el del usuario vuelve tal cual (también si se cierra la página a mitad del tour)
- **Dictado por voz** para Melki: micrófono junto al botón de enviar; el texto aparece en la caja para revisarlo y
  corregirlo antes de enviarlo (los números dichos en palabras quedan en cifras). Modo «navegador» (Web Speech de Edge o
  Chrome, con internet) o «privado» (el audio no sale del equipo: reconocimiento en el dispositivo del navegador o
  Whisper dentro de la página). Si el navegador deja de escuchar tras un silencio, sigue escuchando sin repetir lo
  dicho, y se detiene sola tras 15 s sin oír nada (v12.8)
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
                            (dictado.ts: escucha seguida que se vuelve a encender sola, frases sin duplicados y con su
                            hora, micrófono abierto y nivel de la voz);
                            Asistente Melki (manos-libres.ts: llamado, controles, frases de mayordomo, resumen para la
                            voz y eco; numeros.ts: números en palabras → cifras; hud-voz.tsx: la barra del asistente);
                            conversar con IA (ia-live.ts: la conexión con Gemini Live y su reanudación; audio-ia.ts: el
                            micrófono a PCM de 16 kHz y la voz del modelo; herramientas-ia.ts: lo que la IA puede hacer
                            y quién es Melki para ella); el pitch (robot.tsx: el robot en vectores; presentacion.tsx:
                            la presentación que recorre el mapa); el recorrido de la red (recorrido-red.tsx: el robot
                            punto por punto; nube-mapa.tsx: la nube de vidrio que sale de un punto y escribe)
  datos/geo/                límites, nombres y ríos de referencia (ver LEEME.md: fuentes y licencias)
  lib/autoria.ts            autoría, titulares y licencia (los usan «Acerca del simulador», Melki y la versión HTML)
  lib/geo/                  consultas locales: municipio de un punto, búsqueda de lugares, contorno de un municipio
                            y reconocimiento de lugares dichos (fonetica.ts: cómo suena el español y cuánto se parecen)
  lib/radio/                motor: modelo, relieve, perfil, cobertura, malla, factibilidad, worker;
                            estado-red (piezas y guía), siembra (repetidores automáticos), mensaje (viaje de un paquete
                            MeshCore o Meshtastic), protocolos (MeshCore, Meshtastic y la ficha del gateway
                            medido; los nombres, en ficha-gateway), carga (prueba de carga por eventos, con la
                            inundación administrada de Meshtastic), estres (hora pico por zona, persona por persona
                            y rampa), optimizar (gateways y antenas de apoyo y ajustes para la carga),
                            poblar (personas al azar), trama (equipos,
                            precios, capacidad y dimensionamiento del documento de Trama),
                            alcance-plano (alcance de referencia), area (áreas objetivo y cobertura dentro de ellas),
                            diseno (diseño de la malla por área), ajuste (ajuste inteligente cobertura–costo),
                            costos (costo interno para comparar, con los precios de Trama);
                            components/simulador/animacion-malla.ts (flujo animado), panel-ajuste.tsx (propuesta),
                            panel-capacidad.tsx (Poblar personas y Prueba de carga), panel-estres.tsx (Zonas de
                            popularidad y Prueba de estrés); components/melki/capacidad.ts (órdenes de gente,
                            zonas, estrés, carga y Trama)
  lib/negocio/pitch.ts      el pitch del modelo de negocio: capítulos con la red del mapa, CAPEX, OPEX y punto de
                            equilibrio, y los pedidos de la presentación por voz o por escrito
  lib/negocio/recorrido-red.ts  el recorrido de la red: las paradas (qué se instaló, por qué ahí, su papel, lo que
                            falta y por qué quedó así), su resumen escrito y los pedidos por voz o por escrito
  lib/config.ts             fuentes de mapas y relieve (reemplazables con variables de entorno)
scripts/                    versión HTML, paquetes de avance y compresor ZIP
tests/                      pruebas del motor, de Melki y de extremo a extremo (con un servidor de voz en vivo de
                            mentira que habla el protocolo de Gemini Live: tests/e2e/ia-de-mentira.mjs)
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
  los mensajes de la hora pico (personas × mensajes al día × % de la hora pico × multiplicador, 30 minutos, dos
  sorteos; cada mensaje con el tamaño de un pago del documento: 118 B de ida, 126 B de vuelta y un aviso de 126 B —un
  WhatsApp largo o una respuesta larga de la IA ocupan más aire—) y la reparte por zona (el nodo del primer salto de
  cada persona). Alcance con carga: los mensajes de la zona se ordenan por
  distancia en tramos de al menos 6 y se busca hasta dónde completa el 90 %; si los cercanos tampoco completan, es el
  canal y no la distancia. Energía del P1: 0,45 W al transmitir y 0,03 W escuchando; el panel de 5 W rinde ~4 horas de
  sol con 70 % de eficiencia (~14 Wh al día) y la batería útil es ~35 Wh; la transmisión del día es la de la hora pico
  dividida por la parte del día que es la hora pico. En el laboratorio (gateway y 3 repetidores, 250 personas por nodo,
  una frecuencia SF11) la red se revienta (~56 % completos, canal del gateway ~97 %) y aguanta sin demora ~500
  personas; con 40 por nodo aguanta y llega a ~320 sin demora. Con SF9 la misma hora pico completa todos. El sitio de
  Trama lleva 4 radios (4 frecuencias): repartiendo los repetidores entre ellas la capacidad sube hasta 4 veces.
- **Límite de un punto** (`estresMalla` con `foco`): la gente del punto es su zona de popularidad (o, si no tiene, la
  que entra a la malla por él). La prueba de carga recibe un peso por persona (`pesos`: cada mensaje sale de una
  persona al azar en proporción a su peso), así que se multiplica el ritmo de la gente del punto sin mover a nadie y
  el resto de la red sigue igual. Se sube ×2, ×4, ×8… hasta que el punto o alguna zona deja de aguantar sin demora (el
  90 % con respuesta y el 95 % en menos de un minuto), se afina tres veces entre lo que aguanta y lo que no, y se sigue
  hasta ver dónde se revienta; tope 2.000 personas. Cerca del límite la espera cambia mucho de un sorteo a otro: cada
  búsqueda usa una hora pico de 60 minutos y tres sorteos por paso, y se hacen tres búsquedas independientes; se da la
  del medio y el rango (en el laboratorio, ±10 % para un repetidor). Si con muy poca gente en el punto la red ya no
  aguanta, lo dice: la llenan las otras zonas. En el laboratorio (40 por nodo, SF11) un repetidor aguanta ~340
  personas sin demora, va lento desde ~380 y se revienta desde ~640; con SF9, ~1.600. «Llenar hasta el límite» pone
  esa gente y repite la hora pico con las personas puestas (si no queda estable, baja un 15 % y prueba de nuevo, hasta
  tres veces).
- **Protocolos** (`src/lib/radio/protocolos.ts`, `constantes.ts`): el protocolo lo da el ajuste de radio
  (`preset.protocolo`); cambiarlo pasa al ajuste equivalente (mismo SF y ancho de banda; si no hay, el de fábrica) y al
  límite de saltos que admite (7 en Meshtastic). Meshtastic: preámbulo de 16 símbolos, cabecera de 16 B, mensaje
  directo = 16 + 18 B (Data y cifrado de clave pública) + la carga, acuse de ~24 B; las difusiones van con la clave del
  canal. La ficha del gateway medido y su tráfico están en `FICHA_GATEWAY` y `TRAFICO_MEDIDO`; los nombres del gateway
  y de sus antenas, en `ficha-gateway.ts` (genéricos en el repositorio).
- **Inundación administrada** (`carga.ts`, constantes del firmware en `mensaje.ts`): cada nodo que repite espera según
  la SNR con que oyó el paquete (ventana de 2³ a 2⁸ ranuras de 2,5 símbolos + 7,6 ms; el que oyó más débil sale
  primero; los ROUTER y el siguiente salto, en la ventana corta) y, si oye que otro ya lo repitió, cancela el suyo (los
  ROUTER no cancelan). Límite de saltos en cada paquete, siguiente salto aprendido, acuse del destino y hasta 3 envíos
  con la espera del firmware (2 × aire + ranuras + 4,5 s), con el mismo identificador (los que ya lo pasaron no lo
  repiten, salvo el siguiente salto que oye el reenvío del remitente, y el destino vuelve a acusar) y el último por
  inundación. Antes de transmitir escucha el canal con la ventana según su ocupación. Sin tope de ciclo en 915 MHz y
  cola de 16 paquetes. Tráfico de fondo (opcional): telemetría cada 30 min y NodeInfo cada 3 h por equipo, inundadas y
  recortadas con el canal sobre el 25 %. La ruta de cada persona es la del análisis de la malla si cabe en el límite;
  si no, la de menos saltos por los nodos que repiten (personas incluidas). Entre billeteras (a 1,5 m) el margen se
  calcula con Longley-Rice sobre terreno plano (se oyen hasta ~8 km): el modelo calibrado es para antenas en torre.
  Cada transmisión inundada se evalúa solo en quienes la oyen (guardados al empezar); con 1.000 clientes que repiten,
  una hora pico tarda ~15 s.
- **Gateway que atiende de a uno** (`atencion` en la prueba de carga): fila en orden de llegada con el tiempo de proceso
  (y a veces la demora de la base de datos); las consultas a la IA van en paralelo; las respuestas largas salen en
  partes [i/n] y el mensaje completa cuando llegan todas.
- **Persona por persona** (`evaluarUsuarios` en `estres.ts`): para cada enlace de la ruta, ida y vuelta, la
  probabilidad de que el paquete pase con su margen (curva del diseño o medida en campo) × lo que se perdió en el
  receptor (choques o mientras transmitía, contado sobre los paquetes dirigidos a él) × lo que botó el transmisor por
  cola llena; con los envíos del protocolo, la probabilidad de que el mensaje llegue y la respuesta vuelva. Se calibra
  por zona (un mismo corrimiento logístico para todas las de la zona, hasta que sus mensajes simulados completen lo que
  completó la zona) y se ajusta con los mensajes propios (4 mensajes de peso). La espera es la de sus mensajes o la de
  su zona. Estados: le funciona bien (≥ 95 % en ≤ 30 s), le funciona (≥ 90 % en ≤ 60 s), a medias (≥ 75 %, o más
  lento), con dificultades (≥ 40 %) y no le funciona (< 40 % o sin ruta).
- **Optimizar** (`src/lib/radio/optimizar.ts`, en el Web Worker con el relieve de la zona): diagnóstico, candidatas y
  la prueba de cada una con la misma carga y semilla. Se comparan las personas atendidas (la suma de la parte de los
  mensajes de cada persona que vuelve, rebajada si tarda: completa hasta 30 s, 80 % a los 60 s, 30 % pasados 5 min),
  que cambia poco a poco aunque una zona entera salte de estado por unos segundos de espera. La otra frecuencia se mide
  como dos canales que no se estorban. En el laboratorio (gateway y 3 repetidores con 250 personas cada uno, SF11,
  una frecuencia) SF10 atiende a casi todas, un gateway de apoyo en otra frecuencia suma ~370–480 personas atendidas y
  convertir un repetidor en gateway ~140–280; en una red que aguanta, lo dice y no inventa arreglos.
- **Poblar** (`src/lib/radio/poblar.ts`): puntos uniformes en área (la latitud se sortea en seno), dentro del polígono,
  con separación mínima y repetibles con la misma semilla (mulberry32).
- **Trama** (`src/lib/radio/trama.ts`): catálogo del cotizador (TRM 3.158 con 3 % de colchón; lo importado suma 12 %
  de envío, 10 % de arancel y 19 % de IVA), conjuntos (repetidor ≈ $1.035.000, sitio gateway con 4 radios ≈ $9,4 M,
  Starlink con solar ≈ $6,1 M y $160.000 al mes), capacidad (SF11 / SF10 / SF9: 150 / 280 / 500 usuarios y 55 / 105 /
  185 pagos por hora por frecuencia con el canal al 15 %; esa capacidad la comparten con los WhatsApp y las consultas
  a la IA), alcance por terreno, operación y regiones, y el
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
- **Todo un municipio** (v12.7): «ármame una red media estable que cubra todo el municipio de Barranca de Upía, Meta»
  diseña sobre el contorno del municipio (de los límites del DANE empaquetados; Barranca de Upía: 40.919 ha); también
  «la zona norte, sur, oriental u occidental del municipio» (la mitad desde el centro de su caja; o un cuarto, como
  «la zona nororiental») y «lo que estoy viendo» (el rectángulo del mapa). El área queda dibujada como «Área objetivo ·
  Barranca de Upía (Meta)». Un departamento entero pasa del tope (300.000 ha) y se pide por partes. Con «puntos de
  popularidad… hasta qué punto aguanta antes de quebrarse», después del diseño pone 250 personas por punto y hace la
  prueba de estrés subiendo la carga (la rampa).
- **Red de otro municipio:** al diseño solo entran los nodos que alcanzan el área (dentro de ella o a menos de 20 km
  de su borde, unos dos saltos de repetidor; `sirveAlArea`). Una malla pedida lejos de la red del mapa lleva su propio
  gateway, sin encadenar repetidores por el campo ni bajar el relieve de todo el camino, y su presupuesto cuenta solo
  esa red.

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
- La mezcla del tráfico: la prueba de estrés usa 2,4 mensajes por persona al día con el tamaño de un pago; cuántos
  WhatsApp y consultas a la IA manda cada persona, y su tamaño, cambian la capacidad (se ajusta con «Mensajes por
  persona al día» o el multiplicador).
- Los supuestos del pitch: 2,4 pagos por persona al día, el 30 % de adopción para escalar, la inversión repartida en
  5 años y la comisión real por pago.
- Del gateway medido: el preset de módem (la ficha lo deja pendiente; se supone LongFast), qué parte de los
  mensajes son consultas a la IA (se supone el 5 %, con respuestas de ~640 B en 4 partes y 4 a 12 s de la IA) y si los
  equipos mandan su telemetría a la malla (depende de la versión del firmware; en la prueba se puede apagar).

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
modelo, que quedan guardados en el navegador). El Asistente Melki usa el mismo modo: con «navegador», mientras está activo o en reposo el
audio del micrófono va de forma continua al servicio de Edge o Chrome; con «privado», no sale del equipo. El reposo
solo arranca si el micrófono ya está permitido (nunca pide permiso por sorpresa). En el computador, mientras escucha,
deja el micrófono abierto para medir el nivel de la voz dentro de la página (ese audio no se guarda ni se envía) y se ve con el oído verde en el botón
de Melki; «Melki, apaga el micrófono» lo apaga del todo y en Ajustes de voz se quita («Escucharme siempre en esta
página»). «Melki, deja de escuchar» o la X de la barra lo devuelven al reposo.

**Conversar con IA (opcional, v13):** solo con la opción encendida y una clave puesta. Mientras la conversación está
abierta, el audio del micrófono, un resumen del escenario (piezas, posiciones, cobertura y costos) y los resultados de
lo que se pide van a Google (Gemini Live) por una conexión cifrada; en la capa gratuita Google puede usar ese contenido
para mejorar sus productos. La clave queda solo en el almacenamiento local del navegador (se borra con «Borrar la
clave»); no va en el código, en el repositorio ni en los escenarios exportados. Sin la opción o sin clave no sale nada.

## Autoría y licencia

- **Autor:** Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y la empresa Melki, con ayuda de
  herramientas de inteligencia artificial bajo su dirección y revisión. El autor conserva sus derechos morales.
- **Titulares de los derechos patrimoniales:** el Ingeniero Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero,
  según el contrato entre las partes.
- **Licencia de uso restringido** ([LICENSE](LICENSE)): todos los derechos reservados. Se prohíbe usar, copiar,
  reproducir, modificar, adaptar, traducir, distribuir, comunicar públicamente, vender, arrendar, sublicenciar o
  descompilar el programa, en todo o en parte, sin licencia o autorización previa, expresa y escrita de sus titulares.
  Que el código pueda verse en este repositorio no concede ninguna licencia.
- **Fundamento legal en Colombia:** Constitución Política, art. 61; Decisión Andina 351 de 1993 (arts. 3, 11, 13 y 23 a
  27: los programas de ordenador se protegen como obras literarias); Ley 23 de 1982 (arts. 12, 20 y 30) y sus
  modificaciones (Ley 1450 de 2011, art. 28; Ley 1915 de 2018); Decreto 1360 de 1989, compilado en el Decreto 1066 de
  2015; Ley 44 de 1993; Código Penal, arts. 270 a 272 (Ley 1032 de 2006). Texto vigente en el Gestor Normativo de
  Función Pública.
- **Dónde está el aviso:** en la cabecera de cada archivo de código, en `LICENSE`, en `src/lib/autoria.ts` (la fuente
  única que usan la pantalla y Melki), en «Archivo → Acerca del simulador y licencia», en los metadatos de la página
  (autor y copyright), en la consola del navegador, en la versión HTML (`SIMULADOR.html`, `archivos/simulador.js` y
  `LICENCIA.txt`) y en el instructivo del paquete. Melki responde «¿quién creó el simulador?» o «¿cuál es la licencia
  de uso?».
- Las bibliotecas de código abierto, las tipografías, los mapas base y los datos geográficos conservan sus propias
  licencias y no hacen parte de esta reserva.
