# Modelo Melki · informe del entrenamiento

Versión 1.0. Generado con `npm run modelo:entrenar` (semilla 20261031; con la misma semilla sale el mismo modelo).

## Lo que es

Una red neuronal del tipo fastText hecha solo para este simulador: 150 intenciones (órdenes, preguntas, «fuera del simulador» y «ruido del dictado»), rasgos de palabras, pares de palabras y pedazos de 3 a 5 letras en 131.072 casillas, vectores de 32 dimensiones y una capa de salida con softmax. Pesa 1,09 MB (enteros de 8 bits en base64) y corre en el procesador del navegador.

## Datos

- 97.981 frases distintas generadas con plantillas (scripts/modelo-melki/plantillas.mjs y preguntas.mjs), con saludos, «por favor», errores de tecleo y de dictado, sin tildes y con números en palabras.
- 93.082 para aprender y 4.899 para validar; 7 frases que salían igual en dos intenciones no se usaron.
- La prueba aparte: 466 frases escritas a mano (scripts/modelo-melki/prueba.mjs), que el modelo nunca vio.

## Resultados (con el modelo cuantizado, el mismo del navegador)

- Validación (frases generadas que no vio): 99,3 % de aciertos.
- Prueba aparte (escritas a mano): 98,5 % de aciertos; la correcta está entre las 3 primeras en 99,4 %.
- Hacer sin preguntar (probabilidad ≥ 0.57 y 0.25 por encima de la segunda): acierta 99,0 % de las veces y cubre 99,0 % de las órdenes; el resto se pregunta con botones («¿quiso decir…?») o se deja a Melki.
- Umbrales: hacer 0.57, margen 0.25, aclarar 0.2, tema 0.6, fuera 0.6.

- Prueba ciega (otras 136 frases a mano que no se usaron para nada más): 97,1 % de aciertos, top 3 99,3 %; lo que haría sin preguntar acierta 97,9 %.

## Errores en la prueba ciega

- «una casa más a 800 m al este del repetidor 3»: era poner-persona, dijo poner-repetidor (57,0 %)
- «¿a quién le falla la red?»: era usuarios-estres, dijo que-hago (48,6 %)
- «muéstrame los límites de los municipios»: era capa-mostrar, dijo q-referencia (58,1 %)
- «¿cuántos pagos soporta la red en general?»: era q-capacidad, dijo carga (99,7 %)

## Errores en la prueba aparte

- «necesito comunicar a 600 personas de la zona rural de Mapiripán»: era disenar, dijo poblar (84,6 %)
- «¿cuánta gente aguanta la red al mismo tiempo?»: era q-capacidad, dijo estres (98,5 %)
- «¿qué es el big bang?»: era fuera, dijo q-presets (83,5 %)
- «¿qué es la mitocondria?»: era fuera, dijo q-autoria (45,4 %)
- «¿dónde queda la torre Eiffel?»: era fuera, dijo donde-nodo (86,9 %)
- «¿cómo está el tráfico?»: era fuera, dijo q-capacidad (99,1 %)
- «y el»: era ruido, dijo q-margen (64,1 %)

## Confusiones más comunes

- disenar → poblar: 1
- q-capacidad → estres: 1
- fuera → q-presets: 1
- fuera → q-autoria: 1
- fuera → donde-nodo: 1
- fuera → q-capacidad: 1
- ruido → q-margen: 1
