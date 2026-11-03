// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Las preguntas que contesta el cerebro de Melki, EN INGLÉS (los mismos temas de preguntas.mjs: de qué se habla y cómo
// se pregunta), lo que está fuera del simulador (el clima, el fútbol, una receta…) y el ruido del dictado en inglés
// (muletillas y pedazos sin sentido).

/** Formas de preguntar por algo ({S} es el tema). */
const FORMAS = [
  "what (is|are) {S}?",
  "what's {S}?",
  "what (does|do) {S} mean?",
  "what (is|are) {S} for?",
  "(explain|explain to me|can you explain|could you explain|please explain|explain me) {S}",
  "how (does|do) {S} work?",
  "(tell me|talk to me) about {S}",
  "(I want|I'd like|I need) to (know|understand|learn) (about|more about) {S}",
  "(I don't understand|I don't get|I'm confused about) {S}",
  "(I have a question|a question|quick question) (about|on|regarding) {S}",
  "what's (the deal|up) with {S}?",
  "{S}, what's that?",
  "and {S}?",
  "what does {S} consist of?",
  "(info|information|details) (on|about) {S}",
  "can you (clarify|explain|tell me about) {S}?",
  "help me understand {S}",
  "what about {S}?",
  "(I'm curious about|curious about) {S}",
  "why (is|are) {S} (needed|necessary|important)?",
  "when should I use {S}?",
  "when (does|do) {S} make sense?",
  "where (does|do) {S} come from?",
  "what's the purpose of {S}?",
  "how (is|are) {S} (calculated|defined|used)?",
];

/** Cada tema: lo que se nombra al preguntar y preguntas propias. */
export const TEMAS = {
  "q-que-es": {
    s: ["the simulator", "this program", "this tool", "this app", "this application", "the coverage simulator", "this page", "this website"],
    p: ["what is this for?", "what does this program do?", "how do I use this?", "how do I get started?", "where do I start?", "what is this?", "how does the simulator work?", "what can I do here?", "I'm new, what is this?", "how do I begin?", "what's this all about?", "what's the point of this app?", "what is this tool for?", "what does this app do?"],
  },
  "q-agregar": {
    s: ["adding an antenna", "placing an antenna", "registering a node", "adding repeaters", "adding nodes"],
    p: ["how do I add an antenna?", "how do I put a repeater?", "how do I register a node?", "how do I add a person?", "where do I click to add?", "which button adds antennas?", "how do I put in a gateway?", "how do you place an antenna?", "how can I add a node?", "how do I add a new repeater?", "how do I place a node on the map?"],
  },
  "q-diseno": {
    s: ["area design", "designing a network", "the automatic design", "network planning"],
    p: ["how do I design a network for an area?", "how do I make a network to cover hectares?", "how do you plan a network?", "how do I build the network for a farm?", "how is the mesh designed?", "how do I design coverage for my land?", "how would I plan coverage for a big property?"],
  },
  "q-nodos": {
    s: ["a node", "the nodes", "the antenna node", "the field node", "the node types", "the kinds of nodes"],
    p: ["what's the difference between a node and an antenna?", "what types of nodes are there?", "what is a field node?", "is a node the same as an antenna?", "what kinds of nodes can I add?", "are node and antenna the same?"],
  },
  "q-regla": {
    s: ["the ruler", "the measuring tool", "measuring distances", "measuring areas"],
    p: ["how do I measure a distance?", "how do I measure an area?", "how do I use the ruler?", "what do I measure the lot with?", "how do I get the perimeter?", "how do you measure on the map?", "how do I calculate the area of a plot?"],
  },
  "q-referencia": {
    s: ["the reference map", "the reference layers", "the municipal boundaries", "the roads on the map", "the rivers on the map"],
    p: ["where do the municipal boundaries come from?", "what do the lines on the map show?", "does the map include rivers?", "what are the gray lines?", "where does the reference data come from?", "where do the town borders come from?"],
  },
  "q-buscar": {
    s: ["the search box", "searching for a place", "searching coordinates", "the search bar"],
    p: ["how do I search for a municipality?", "how do I find a place?", "how do I go to some coordinates?", "where do I type the place?", "how do I search for a village?", "how (do I|can I) (find|locate|search for|look up) (a town|a village|a municipality|a farm|a site|a place) on the map?", "where (do I|can I) (search|type|enter) (the place name|the municipality|the coordinates)?"],
  },
  "q-alcance": {
    s: ["the range", "the coverage range", "the rings", "the range contour", "the reach of an antenna"],
    p: ["how far does an antenna reach?", "how much range does a repeater have?", "how many kilometers does the signal reach?", "how far does a node reach?", "what's the range of a repeater?", "how many km does an antenna cover?", "what's the maximum range of a node?", "how far can a repeater go?", "how far does the signal of an antenna go?"],
  },
  "q-coordenadas": {
    s: ["the coordinates", "the coordinate format", "degrees minutes and seconds", "latitude and longitude"],
    p: ["how do I write the coordinates?", "what format do the coordinates use?", "does it accept degrees minutes seconds?", "does the longitude go with a minus?", "how do I enter GPS coordinates?", "do coordinates go in decimal?"],
  },
  "q-mover": {
    s: ["moving an antenna", "dragging nodes", "relocating a node"],
    p: ["how do I move an antenna?", "how do I change a repeater's location?", "can I drag the nodes?", "how do I edit the position?", "how can I move a node?", "how can I (move|relocate|shift|drag) (an antenna|a node|a repeater) (somewhere else|to another place|to a different spot|elsewhere)?"],
  },
  "q-eliminar": {
    s: ["deleting an antenna", "removing nodes"],
    p: ["how do I delete an antenna?", "how do I remove a repeater?", "how do I get rid of a node?", "where's the delete button?", "how can I delete a node?"],
  },
  "q-simular": {
    s: ["the simulate button", "simulating", "the simulation"],
    p: ["what does the simulate button do?", "what is simulate for?", "what does the simulation calculate?", "how often do I have to simulate?", "what happens when I simulate?", "why do I have to press simulate?"],
  },
  "q-colores": {
    s: ["the colors", "the map colors", "the legend", "the green", "the yellow", "the orange", "the red color", "the purple", "the colored patches", "the colors on the map", "the color shades"],
    p: ["why are some parts green and yellow?", "what does the orange color mean?", "what does it mean if it's yellow?", "what is each color?", "is green good?", "what do the little colored patches mean?", "what do the colors mean?", "what does the green mean?", "what does (red|green|yellow|orange|purple) mean (on the map|here)?", "what does the (red|green|yellow|orange) (color|area|patch) mean?", "what do (red|green|yellow) areas mean?"],
  },
  "q-margen": {
    s: ["the margin", "the link margin", "the dB", "the decibels", "the RSSI", "the SNR", "the sensitivity", "the fade margin"],
    p: ["how many dB do I need?", "what is a good margin?", "what does 20 dB of margin mean?", "why do you ask for 20 dB?", "how much margin does a link need?"],
  },
  "q-presupuesto": {
    s: ["the link budget", "the power budget", "the transmit power", "the antenna gain", "the cable loss", "the dBi"],
    p: ["how is the received power calculated?", "how much gain does the antenna have?", "how much does the cable lose?", "what power does the radio transmit?", "how much power reaches the receiver?"],
  },
  "q-presets": {
    s: ["the presets", "the radio setting", "the spreading factor", "SF11", "the bandwidth", "the modem speed", "the MeshCore preset"],
    p: ["which preset should I use?", "SF11 or SF10?", "what bandwidth is best?", "which radio setting reaches the farthest?", "what spreading factor do you recommend?"],
  },
  "q-frecuencia": {
    s: ["the frequency", "the 915 band", "915 MHz", "the spectrum", "the channels", "the ANE regulation"],
    p: ["what frequency does the network use?", "is it legal to use 915 MHz?", "do I need a license?", "what band does it work on?", "do I need permission to transmit?", "what frequency do the radios use?"],
  },
  "q-altura": {
    s: ["the antenna height", "the tower height", "the mast", "the tower"],
    p: ["how high should the antenna be?", "at what height do I put the repeater?", "does raising the antenna help?", "how many meters of tower do I need?", "is higher better?", "what height should the tower be?", "what height is (best|ideal|good|recommended) for (the antenna|an antenna|a repeater|the tower)?", "what's the (best|ideal|right) height for (an antenna|the antenna|a repeater|the tower)?"],
  },
  "q-malla": {
    s: ["the mesh", "the mesh network", "the links between antennas", "the relaying", "a mesh network"],
    p: ["how do the antennas talk to each other?", "how does the signal pass from one repeater to another?", "what is a mesh network?", "how is the mesh built?", "how do (the antennas|the repeaters|the nodes) (pass|relay|share|send) (the signal|the messages|the data) (between them|to each other|along)?", "how do (the antennas|the repeaters|the nodes) (talk|connect|link) (to each other|with each other)?", "how does the signal (hop|jump|go) from (one antenna|one repeater|one node) to another?"],
  },
  "q-saltos": {
    s: ["the hops", "the hop limit", "the max hops", "the hop count"],
    p: ["how many hops can a message make?", "how many repeaters does a payment go through?", "how many times is it relayed?", "what happens if there are many hops?", "how many jumps does a message take?", "how many times does a message bounce?"],
  },
  "q-gateway": {
    s: ["the gateway", "the main node", "the Starlink", "the network's internet connection", "the internet point", "the uplink"],
    p: ["what's the gateway for?", "how does the network get to the internet?", "what goes at the gateway site?", "what does the Starlink do in the network?", "why do we need a gateway?", "why is (a|the) gateway (needed|necessary)?", "do I need a gateway?", "what does the gateway do?"],
  },
  "q-protocolos": {
    s: ["Meshtastic", "MeshCore", "the protocols", "the difference between MeshCore and Meshtastic", "managed flooding"],
    p: ["MeshCore or Meshtastic?", "which protocol is better?", "what's the difference between Meshtastic and MeshCore?", "why MeshCore?", "why not Meshtastic?", "which is better, MeshCore or Meshtastic?"],
  },
  "q-gateway-medido": {
    s: ["what was measured on the gateway", "the measured gateway", "the gateway spec sheet", "the measured data", "the solar router"],
    p: ["what was measured on the real gateway?", "where does the gateway data come from?", "are the values measured or theoretical?", "were the gateway numbers really measured?"],
  },
  "q-usuarios-prueba": {
    s: ["the people's colors", "the per-user result", "the half-working people", "the real capacity"],
    p: ["why do some people show up yellow in the test?", "what does it mean that it half works for them?", "how do you evaluate person by person?", "why are some people yellow after the stress test?"],
  },
  "q-optimizar-carga": {
    s: ["the optimization button", "the support gateways", "the load optimization"],
    p: ["what does the optimize button do?", "what's a support gateway for?", "how do you fix an overloaded network?", "why add support gateways?"],
  },
  "q-pitch": {
    s: ["the pitch", "the business model", "the break-even point", "capex and opex", "the fee per payment"],
    p: ["how does the network pay for itself?", "how does Trama make money?", "when is the investment recovered?", "what is the pitch?", "what's the business?", "how does Trama (make|earn) money (from|with|off) the network?", "what's Trama's business model?", "how does the business work?", "how does Trama earn money?"],
  },
  "q-recorrido-red": {
    s: ["the network walkthrough", "the robot's bubbles", "the walkthrough labels"],
    p: ["what is the walkthrough?", "what does the robot do in the walkthrough?", "what do the little bubbles say?", "what are the robot's bubbles?"],
  },
  "q-analista": {
    s: ["how you design", "the performance brake", "the economical option", "the verdict", "the network analysis", "the optimal network"],
    p: ["how do you decide how many repeaters to put?", "why did you put so many repeaters?", "how do you know the network is optimal?", "what is the performance brake?", "what units do you understand?", "is the network oversized?", "why are there so many repeaters?"],
  },
  "q-ia-local": {
    s: ["the local AI", "the local artificial intelligence", "the local model", "Qwen", "WebGPU", "DeepSeek", "offline mode"],
    p: ["can you work without internet?", "which local AI model do you use?", "can I use DeepSeek?", "what is the local AI?", "do I need a graphics card?", "why did the graphics card get blocked?", "do you work offline?"],
  },
  "q-ia-voz": {
    s: ["Gemini", "Gemini Live", "the API key", "connecting an AI", "ChatGPT"],
    p: ["can I connect you to Gemini?", "do you talk like ChatGPT?", "how do I enter the Gemini key?", "can I connect you to a real AI?", "can you use Gemini?"],
  },
  "q-roles": {
    s: ["the roles", "each node's role", "the companion", "the room server", "repeater mode", "the silent nodes"],
    p: ["what is a companion?", "what's the difference between repeater and companion?", "what does a room server do?", "which nodes relay?", "what roles can a node have?"],
  },
  "q-factibilidad": {
    s: ["feasibility", "viability", "the network score", "the criteria"],
    p: ["how do I know if the network is feasible?", "what does it mean for the network to be viable?", "what criteria do you use to say it works?", "(when|when is) (a|the) network (feasible|viable|considered feasible)?", "what does (a|the) network need to be (feasible|viable)?"],
  },
  "q-respaldo": {
    s: ["the backup", "redundancy", "double coverage", "a single point of failure"],
    p: ["what happens if a repeater goes down?", "what is backup for?", "what is redundancy?", "what happens if (a|the) (repeater|gateway|node|device|antenna) (breaks|goes down|fails|is turned off|gets stolen|burns out|stops working)?", "(and )?if (a|the) repeater (breaks|goes down|fails), (what happens|does the network keep working)?"],
  },
  "q-modos": {
    s: ["the best antenna", "best server mode", "which antenna covers each point"],
    p: ["which antenna covers each point?", "who gives the best signal here?", "what is best antenna mode?", "which antenna serves each spot?"],
  },
  "q-medir": {
    s: ["checking a point", "measuring the signal at a point", "the signal at my farm"],
    p: ["how do I know if signal reaches my farm?", "how do I check the signal at a point?", "how do I know if my house gets coverage?", "how can I tell if my farm has signal?"],
  },
  "q-perfil": {
    s: ["the profile", "the Fresnel zone", "the line of sight", "the obstacles", "the link profile"],
    p: ["what is the Fresnel zone?", "why does line of sight matter?", "does a hill block the signal?", "what is the terrain profile?", "what are Fresnel zones?"],
  },
  "q-modelo-propagacion": {
    s: ["the propagation model", "Longley-Rice", "the ITM", "diffraction", "Deygout", "the calibration", "the model's accuracy"],
    p: ["how accurate is the calculation?", "what model do you use to calculate the signal?", "is it similar to Radio Mobile?", "how wrong can the simulator be?", "what propagation model do you use?"],
  },
  "q-relieve": {
    s: ["the terrain", "the relief", "the elevation", "SRTM", "the elevation data", "the topography"],
    p: ["where do you get the mountains from?", "do you take the hills into account?", "what elevation data do you use?", "does the terrain work offline?", "where does the (terrain|elevation|relief) (data )?come from?", "where do the (mountains|hills) (on the map )?come from?", "where does the terrain data come from?"],
  },
  "q-privacidad": {
    s: ["privacy", "my data", "the information I enter", "what I save"],
    p: ["where is my data sent?", "is it safe?", "does this get uploaded to Google?", "where is my work saved?", "can anyone else see my designs?", "can (someone|anyone|other people|others) see (what I do|my work|my designs) (here|in the simulator|in this app)?", "who can see my work?", "is my work private?", "(is my data|is my information|are my designs|are my networks) (uploaded|sent|stored|shared) (to the internet|in the cloud|to a server|to Google|with anyone)?", "does (this|the simulator) (send|upload) (anything|my data) to the internet?"],
  },
  "q-capas": {
    s: ["the layers", "the base map", "the opacity", "the coverage transparency"],
    p: ["what layers does the map have?", "how do I change the base map?", "how do I make the coverage more transparent?", "how do I switch the map background?"],
  },
  "q-exportar": {
    s: ["exporting", "saving the scenario", "the KMZ", "opening a scenario", "importing"],
    p: ["how do I save what I did?", "how do I get it into Google Earth?", "how do I open a saved scenario?", "can I export to Excel?", "how do I share the design?", "how do I save my work?"],
  },
  "q-receptor": {
    s: ["the receiver", "the handheld radio", "body loss", "the in-vehicle receiver"],
    p: ["how high is the receiver?", "how does carrying the radio in a pocket affect it?", "what is the receiver?", "does the radio in my pocket lose signal?"],
  },
  "q-confiabilidad": {
    s: ["reliability", "the time percentage", "the location percentage", "the statistical mode", "variability"],
    p: ["what is 90% reliability?", "what does percentage of situations mean?", "which statistical mode should I use?", "what does percentage of locations mean?"],
  },
  "q-red-radio-mobile": {
    s: ["the network parameters", "the radio climate", "polarization", "ground conductivity", "refractivity", "permittivity"],
    p: ["what climate do I set in the parameters?", "vertical or horizontal polarization?", "what ground type should I use?", "which polarization is best?"],
  },
  "q-direccionales": {
    s: ["directional antennas", "a Yagi", "a sector antenna", "a panel antenna", "a dish", "the radiation pattern", "the azimuth"],
    p: ["when do I use a directional antenna?", "omni or Yagi?", "how do I aim an antenna?", "what is tilt?", "when should I use a (directional|Yagi|sector|panel) antenna?", "when (is|does) a (directional antenna|sector antenna) (worth it|make sense)?", "when is a Yagi worth it?"],
  },
  "q-entorno": {
    s: ["the environment", "the vegetation", "the trees", "the palm plantations", "the buildings", "the clutter"],
    p: ["do trees block the signal?", "how do palm trees affect it?", "does the city attenuate it?", "what about the jungle?", "do (palms|palm trees|oil palms|plantations|forests|buildings|houses) (block|weaken|affect|attenuate) the signal?", "does vegetation weaken the signal?"],
  },
  "q-unidades": {
    s: ["the units", "dBm", "microvolts", "the electric field", "the color scale", "the threshold"],
    p: ["what units do you show the signal in?", "what are dBµV?", "how do I change the color scale?", "what does dBm mean?"],
  },
  "q-informe": {
    s: ["the radio link report", "the radio link", "the EIRP", "the elevation angle", "the link balance"],
    p: ["what's in the report?", "what is EIRP?", "what is the radio link report for?", "what does the link report include?"],
  },
  "q-dictado": {
    s: ["dictation", "the microphone", "dictating", "speech to text"],
    p: ["can I dictate to you?", "how do I talk to you?", "can you hear me?", "how do I use the microphone?", "can I speak instead of typing?"],
  },
  "q-autoria": {
    s: ["the authorship", "the rights", "the license", "the copyright"],
    p: ["who made the simulator?", "who created you?", "who programmed you?", "who owns this?", "who is the author?", "who (built|made|created|developed|designed|wrote) (this|this thing|the app|this tool|the simulator|this program)?", "who developed this?"],
  },
  "q-manos-libres": {
    s: ["the Melki Assistant", "hands-free mode", "hey Melki", "Jarvis mode"],
    p: ["how does the assistant work?", "how do I activate you by voice?", "what is hands-free mode?", "how do I (wake you up|activate you|call you|turn you on) (by voice|with my voice|without touching anything)?", "(can I|is it possible to) (talk to you|use you) without touching (the screen|anything|the button)?"],
  },
  "q-cobertura-maxima": {
    s: ["the maximum coverage", "the coverage limit", "how far coverage can go"],
    p: ["what's the most the network can cover?", "can you cover the whole department?", "what's the coverage limit?", "how big an area can the network cover?"],
  },
  "q-rendimiento": {
    s: ["the performance", "the simulator's speed", "the resolution", "the study radius"],
    p: ["why does it take so long?", "why is it slow?", "how do I make it calculate faster?", "why is the simulation so slow?"],
  },
  "q-mejorar": {
    s: ["improving coverage", "the recommendations", "increasing coverage"],
    p: ["how do I improve coverage?", "what do I do to get more coverage?", "what do you recommend for the network?", "how do I fix the areas without signal?", "how do I (make|get) (the signal|the network|the antenna|the repeater) (reach|go) farther?", "what do I do to (get|have) more (range|coverage|signal)?", "how do I (reach|cover) farther?", "how do I get more range out of the network?"],
  },
  "q-ajuste": {
    s: ["the automatic adjustment", "adjust it for me", "the cost benefit", "the support antennas"],
    p: ["what does adjust it for me do?", "how does the automatic adjustment work?", "what are support antennas?", "what does the auto adjust button do?"],
  },
  "q-area-objetivo": {
    s: ["the target area", "the useful coverage", "the coverage goal", "the study area"],
    p: ["what is the target area?", "why would I mark a target area?", "what does the 60% goal mean?", "what's a target area for?"],
  },
  "q-equipos": {
    s: ["the equipment", "the SenseCAP", "the Heltec", "the T114", "the XIAO", "the solar node", "the hardware"],
    p: ["what equipment does Trama use?", "what radio does each person carry?", "what hardware do I need?", "(what|which) (equipment|radio|hardware|antenna|device) (does the gateway use|does a repeater use|does each repeater have|does each person carry|does the node use)?", "what (brand|model) (of radio|of antenna|of device) (do you use|is used)?"],
  },
  "q-trama": {
    s: ["Trama", "the payment network", "radio payments", "what goes through the network", "the messaging"],
    p: ["what is Trama?", "what is sent over the network?", "what's the payment network for?", "does the network work for WhatsApp?", "what is Trama for?"],
  },
  "q-animacion": {
    s: ["the animations", "the moving lights", "the blinking dots", "the turquoise flow"],
    p: ["why do the dots blink?", "what are the moving lines?", "what does the flash mean?", "why are the lights moving?"],
  },
  "q-repetidor": {
    s: ["a repeater", "the repeaters", "the distance between repeaters", "repeater spacing"],
    p: ["where do I put the repeater?", "how many km apart should repeaters be?", "what does a repeater do?", "is it better to put it on a hill?", "how often should I place a repeater?", "every how many km do I put a repeater?", "how many kilometers between repeaters?", "how much distance should there be between repeaters?", "how far apart do repeaters need to be?"],
  },
  "q-persona": {
    s: ["the people", "what each person carries", "the wallet", "the radio people carry", "the app"],
    p: ["what does each person carry?", "do people need a cell phone?", "how does a person connect?", "(do people|do the users|does each person) (need|have to have) (a cell phone|a phone|a radio|internet|a device) (to pay|to use the network|to connect)?", "what do people (pay|connect) with?"],
  },
  "q-mensaje": {
    s: ["how a message travels", "how a payment travels", "the receipt", "the acknowledgment"],
    p: ["how does a payment travel?", "how does a message get to the gateway?", "what is the ack?", "how does the person know the payment arrived?", "how does a payment get to the bank?"],
  },
  "q-capacidad": {
    s: ["the capacity", "the network capacity", "the traffic", "saturation"],
    p: ["how many people can use the network at once?", "when does it saturate?", "how much traffic does it support in general?", "how much capacity does a network like this have?", "how many users can the network hold at the same time?", "how many (people|users) can the (whole )?network (hold|take|handle|serve) (at once|at the same time|simultaneously)?", "what's the (total|overall) capacity of (the|a) network?", "how much traffic can a network like this (carry|take)?"],
  },
  "q-estres": {
    s: ["the stress test", "the popularity zones", "the peak hour", "the limit of each point"],
    p: ["what is a popularity zone?", "what does the stress test measure?", "what is the peak hour?", "what is the stress test for?"],
  },
  "q-poblar": {
    s: ["populate people", "the density", "the population"],
    p: ["what does populate people do?", "how are people distributed?", "what density should I use?", "how does populate spread people out?", "how are people placed when populating?", "how does populating work?", "how does populating spread the people?"],
  },
  "q-precios": {
    s: ["the prices", "the catalog", "the price of a repeater", "the price of the gateway", "the quote"],
    p: ["how much does a repeater cost?", "how much is the gateway?", "how much is a wallet?", "where do the prices come from?", "how much does a solar node cost?"],
  },
  "q-dimensionamiento": {
    s: ["the sizing", "the department-level scale", "how many sites", "the adoption"],
    p: ["how is a department's network calculated?", "what is adoption?", "how many Starlinks are needed in the country?", "how do you size a whole department?"],
  },
  "q-letra-pequena": {
    s: ["the fine print", "the assumptions", "the limitations", "the risks"],
    p: ["how reliable are the numbers?", "are the figures exact?", "what assumptions do you use?", "can I trust these numbers?"],
  },
  "q-sin-cobertura": {
    s: ["the areas without coverage", "the red areas", "the red zones", "the dead zones", "the areas with no signal"],
    p: ["why is it red?", "why doesn't the signal get there?", "why are there parts with no signal?", "why is everything red?", "why doesn't that person connect?", "why is there no signal over there?", "why did (that part|this area|that zone|that spot) (end up|turn|come out) red?", "why is (that part|this area|that zone|that spot) red?"],
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
  equipo: ["Nacional", "Millonarios", "América de Cali", "Junior", "Santa Fe", "Real Madrid", "Barcelona", "the Colombian national team", "Manchester United", "the Lakers", "the Yankees", "Liverpool"],
  comida: ["arepas", "bandeja paisa", "ajiaco", "sancocho", "tamales", "empanadas", "pizza", "chicken and rice", "lasagna", "a chocolate cake", "pancakes", "chili", "lentil soup"],
  materia: ["math", "English", "chemistry", "history", "biology", "physics", "social studies", "geography"],
  persona: ["Simón Bolívar", "Gabriel García Márquez", "Einstein", "Shakira", "Christopher Columbus", "Messi", "Napoleon", "Frida Kahlo", "Abraham Lincoln", "Taylor Swift"],
  pais: ["France", "Japan", "Peru", "Brazil", "Canada", "Australia", "Egypt", "Mexico", "Germany"],
  cifra: ["2", "7", "12", "25", "100", "144", "two", "seven", "twelve", "a hundred"],
  cosa: ["photosynthesis", "the big bang", "democracy", "DNA", "inflation", "a black hole", "gravity", "global warming", "mitosis", "the coronavirus", "bitcoin", "the stock market", "feudalism", "the Renaissance", "the Constitution", "VAT", "cholesterol", "evolution", "a volcano", "the greenhouse effect", "the cell", "the atom", "electricity", "an eclipse", "the moon", "the solar system", "World War II", "capitalism", "socialism", "philosophy", "a poem", "grammar", "algebra", "diabetes", "a vaccine", "recycling", "a hurricane", "an earthquake", "the economy", "soccer", "chess", "classical music", "tango", "salsa", "a horoscope", "tarot", "cryptocurrencies", "the metaverse", "the internet of things", "5G phones", "the mitochondria", "quantum physics", "the immune system", "the Roman Empire"],
};

/** Lo que no es del simulador: con lugares y palabras de radio también, para que no basten para ser una orden. */
export const FUERA = [
  "(how's|what's) the weather (today|tomorrow|in {lugar}|over there|like)?",
  "is it going to rain (today|tomorrow|this afternoon|in {lugar})?",
  "what's the temperature in {lugar}?",
  "what time is it?", "what day is it today?", "what year is it?", "what's the date?", "what's today's date?",
  "who won the {equipo} game?", "how is {equipo} doing?", "who's the best player in the world?", "(give me|tell me) the soccer scores", "when does {equipo} play?", "who won the match last night?",
  "(give me|tell me|send me) a recipe for {comida}", "how do you make {comida}?", "what should I have for lunch?", "(make me|get me|bring me) a coffee", "I'm hungry", "where can I buy {comida}?",
  "what's {cifra} times {cifra}?", "what's {cifra} plus {cifra}?", "solve this equation", "(do|help me with) my {materia} homework", "what's the square root of {cifra}?", "explain the {cifra} times table",
  "who was {persona}?", "what's the capital of {pais}?", "how many people live in {pais}?", "tell me about the history of Colombia", "what is photosynthesis?", "explain the theory of relativity", "why is the sky blue?", "how many planets are there?", "how tall is the tallest mountain?",
  "tell me a joke", "(play|put on) (music|a song|some vallenato|some reggaeton|some salsa)", "(recommend|suggest) a (movie|series|song|book)", "what show should I watch?", "sing me a song", "say a poem", "let's play a game", "tell me a story",
  "do you have a girlfriend?", "how old are you?", "do you love me?", "I'm bored", "I'm tired", "what do you think about love?", "do you believe in God?", "what's your favorite color?", "what do you eat?", "are you married?",
  "how do I fix my computer?", "my phone won't turn on", "(install|download) WhatsApp", "how do I write a resume?", "write an email to my boss", "translate this into Spanish", "how do I make a table in Excel?", "help me write a letter", "my laptop keeps freezing",
  "what's the dollar exchange rate?", "where can I buy a cheap phone?", "how much does a car cost?", "lend me some money", "how do I invest in the stock market?", "how much does an engineer make?", "how much is a new phone?",
  "who is the president?", "what's in the news?", "what do you think about politics?", "who's going to win the election?",
  "how do I get to Bogotá by bus?", "recommend a hotel in {lugar}", "how much is a flight to {lugar}?", "what is there to do in {lugar}?", "where can I eat in {lugar}?", "what's the history of {lugar}?", "how many people live in {lugar}?", "what festivals are there in {lugar}?", "book me a hotel in {lugar}",
  "I have a headache", "what should I take for the flu?", "how do I lose weight?", "is coffee good for you?", "my stomach hurts",
  "turn off the lights", "call a taxi", "call my mom", "set an alarm for six", "send an email to John", "open YouTube", "search Google", "book a table", "order a pizza", "set a reminder", "order a delivery",
  "(send|text) (a message|a whatsapp|an email|a voice note) to (my wife|my husband|my mom|my dad|my boss|John|my brother|my girlfriend|my son|a friend)",
  "(message|text|whatsapp) (my wife|my mom|my boss|my brother|John) (that I'm late|that I'm coming|hello)",
  "send (my wife|my mom|my boss|my friend) a (message|text|whatsapp)",
  "how do I (fix|repair|clean|turn on) (the fridge|the car|the motorcycle|the washing machine|the TV|the shower|the computer)?",
  "where is (the Eiffel Tower|the Amazon in the world|Paris|Disney World|the White House|the Colosseum)?",
  "my wifi isn't working", "how do I improve my phone signal?", "what TV antenna should I buy?", "my cell signal is terrible", "which carrier has the best coverage?", "how much is a data plan?", "my internet is slow", "how do I set up my home router?", "what's the best social network?", "I'm not getting WhatsApp messages on my phone", "which phone company has the best signal in {lugar}?",
  "write me an essay about the environment", "summarize a book for me", "how do I take care of a plant?", "what dog breed do you recommend?", "how do you tie a tie?", "what's the biggest animal?",
  "(write me|make me) some Python code", "what is artificial intelligence in general?", "how do I make a website?", "which computer should I buy?",
  "what's the best (restaurant|bakery|bar|coffee shop|burger place) (in town|around here|in {lugar})?", "where can I get (good coffee|a haircut|gas|a pizza) (near here|around here|in {lugar})?", "how far is the moon?", "how do you say (hello|thank you|good morning|cat|house) in (French|Spanish|Portuguese)?", "how's the traffic (today|in Bogotá|on the highway|in {lugar})?", "is there traffic on the road to {lugar}?", "what (should|can) I (cook|eat|watch|read) (tonight|today)?", "who (sings|wrote) (this song|that song|Despacito)?", "what's the score of the game?", "who's the richest person in the world?", "how many (calories|grams of sugar) (are|is) in (a banana|a soda|an arepa)?",
  "what is {cosa}?", "what are {cosa}?", "(explain|tell me about|talk to me about) {cosa}", "how does {cosa} work?", "what is {cosa} for?", "(I want to know|I have a question) about {cosa}", "who (invented|discovered) {cosa}?",
];

/** Muletillas, pedazos y ruido del dictado: no piden nada (Melki pide que se lo repitan). */
export const RUIDO = [
  "(uh|um|umm|hmm|er|erm|ah|oh|eh|mhm|uh huh|like|you know|I mean|so|well|okay okay|yeah yeah|no no|ok ok|right right|wait wait|uhh|hmmm)",
  "(of the|and the|to the|in the|on the|for the|that the|with the|is the|and a|of a|the|and|so the|but the|it's the|at the|from the)",
  "(asdf|lol|haha|hahaha|lmao|xd|qwerty|blah blah|la la la|testing|test test|testing testing|one two three testing|hello hello hello|123|k|x|z|zzz|hehe|jk|brb)",
  "(Melki Melki|hey hey|is it recording|is this thing on|yes sir|no sir|go go|so what then|or not|right|isn't it|look look|wait|hold on|one moment|be right back|just a sec|hang on|one sec)",
  "(la la la|tum tum|ta ta ta|blah blah|eeeh|aaah|ehhh|mmmm|ummm)",
  "(and|or|but|so|well|then|that) (and|or|but|so|well|then|that) (the|a|it|this)",
  "(I don't know|nothing|never mind|forget it|nothing nothing|leave it|not anymore|doesn't matter|whatever|no idea)",
  "(uh|um|so|well|yeah|ok|hmm|lol) (uh|um|so|well|yeah|ok|hmm|the|and)",
  "(let me see|let's see|let me think|hmm let me see|let me check|wait let me see|uh let me think|hold on let me see)",
];
