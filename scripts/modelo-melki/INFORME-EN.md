# Modelo Melki en inglés · informe del entrenamiento

Versión 1.0-en. Generado con `npm run modelo:entrenar -- --idioma en` (semilla 20261031; con la misma semilla sale el mismo modelo). Lo usa Melki con la pantalla en inglés: entiende QUÉ se pide (las mismas 150 intenciones del modelo en español); los datos del pedido y la orden que se hace siguen en español.

## Lo que es

La misma red del tipo fastText del modelo en español, con la misma normalización (src/components/melki/modelo/rasgos.ts): 150 intenciones, rasgos de palabras, pares de palabras y pedazos de 3 a 5 letras en 131.072 casillas, vectores de 32 dimensiones y una capa de salida con softmax. Pesa 1,09 MB (enteros de 8 bits en base64) y corre en el procesador del navegador.

## Datos

- 98.012 frases distintas en inglés generadas con plantillas (scripts/modelo-melki/plantillas-en.mjs, preguntas-en.mjs y gramatica-en.mjs): imperativos, «please», «can you…», «would you mind…», «I want…», preguntas, contracciones con y sin apóstrofo, errores de tecleo y de dictado, números en cifras y en palabras, nodos en inglés («Repeater 3», «Person 2», «the gateway») y en español («Repetidor 3»), y lugares de Colombia.
- 93.111 para aprender y 4.901 para validar; 4 frases que salían igual en dos intenciones no se usaron.
- La prueba aparte: 483 frases escritas a mano (scripts/modelo-melki/prueba-en.mjs), que el modelo nunca vio; fija los umbrales.
- La prueba ciega: 272 frases escritas a mano (scripts/modelo-melki/prueba-ciega-en.mjs) que no se usaron para nada más.

## Resultados (con el modelo cuantizado, el mismo del navegador)

- Validación (frases generadas que no vio): 99,2 % de aciertos.
- Prueba aparte: 99,4 % de aciertos; la correcta está entre las 3 primeras en 99,8 %.
- Prueba ciega: 97,8 % de aciertos, top 3 100,0 %; lo que haría sin preguntar acierta 98,8 %.
- Prueba ciega sin las 41 frases que las plantillas también generan tal cual (frases cortas y naturales): 97,4 % de aciertos en 231, top 3 100,0 %.
- Hacer sin preguntar (probabilidad ≥ 0.55 y 0.25 por encima de la segunda): en la prueba aparte acierta 99,7 % de las veces y cubre 99,7 % de las órdenes.
- Umbrales: hacer 0.55, margen 0.25, aclarar 0.2, tema 0.6, fuera 0.6.

## Aciertos por grupo

Prueba ciega:

| Grupo | Frases | Aciertos | Top 3 |
|---|---|---|---|
| diseno | 10 | 100,0 % | 100,0 % |
| piezas | 42 | 100,0 % | 100,0 % |
| red | 28 | 100,0 % | 100,0 % |
| gente | 17 | 94,1 % | 100,0 % |
| ajustes | 17 | 100,0 % | 100,0 % |
| mapa | 32 | 100,0 % | 100,0 % |
| escenario | 9 | 100,0 % | 100,0 % |
| melki | 26 | 96,2 % | 100,0 % |
| pregunta | 69 | 95,7 % | 100,0 % |
| fuera | 22 | 95,5 % | 100,0 % |

Prueba aparte:

| Grupo | Frases | Aciertos | Top 3 |
|---|---|---|---|
| diseno | 22 | 100,0 % | 100,0 % |
| piezas | 78 | 98,7 % | 100,0 % |
| red | 49 | 100,0 % | 100,0 % |
| gente | 32 | 100,0 % | 100,0 % |
| ajustes | 32 | 100,0 % | 100,0 % |
| mapa | 49 | 100,0 % | 100,0 % |
| escenario | 15 | 100,0 % | 100,0 % |
| melki | 41 | 100,0 % | 100,0 % |
| pregunta | 105 | 100,0 % | 100,0 % |
| fuera | 60 | 96,7 % | 98,3 % |

## Errores en la prueba ciega

- “who's the network failing for?”: era usuarios-estres, dijo q-diseno (50,4 %)
- “what's going on under the hood when you understand me?”: era modelo-melki, dijo fuera (41,0 %)
- “is it possible to drag a repeater to a new spot?”: era q-mover, dijo poner-repetidor (89,3 %)
- “does thick forest kill the signal?”: era q-entorno, dijo senal-punto (83,3 %)
- “how does the voice activation work?”: era q-manos-libres, dijo q-modelo-propagacion (78,1 %)
- “my laptop is frozen, what do I do?”: era fuera, dijo que-hago (60,4 %)

## Errores en la prueba aparte

- “put the gateway antenna at 25 m”: era altura, dijo poner-gateway (50,2 %)
- “how's the traffic?”: era fuera, dijo q-capacidad (100,0 %)
- “no no no”: era ruido, dijo borrar-nodo (100,0 %)

## Confusiones más comunes (las dos pruebas)

- altura → poner-gateway: 1
- fuera → q-capacidad: 1
- ruido → borrar-nodo: 1
- usuarios-estres → q-diseno: 1
- modelo-melki → fuera: 1
- q-mover → poner-repetidor: 1
- q-entorno → senal-punto: 1
- q-manos-libres → q-modelo-propagacion: 1
- fuera → que-hago: 1
