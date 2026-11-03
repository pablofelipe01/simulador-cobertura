# Datos geográficos de referencia

Archivos simplificados para dibujar límites y nombres sin servicios externos (se cargan solo cuando se activan).

| Archivo | Contenido | Fuente y licencia |
| --- | --- | --- |
| `departamentos.json` | 33 departamentos (incluye Bogotá, D. C.) | DANE, Marco Geoestadístico Nacional, vía geoBoundaries (gbOpen COL ADM1) · CC BY 4.0 |
| `municipios.json` | 1.122 municipios con su departamento | DANE, Marco Geoestadístico Nacional, vía geoBoundaries (gbOpen COL ADM2) · CC BY 4.0 |
| `lugares.json` | Puntos de etiqueta y cajas para el buscador | Derivado de los anteriores y de Natural Earth |
| `hidrografia.json` | Ríos y lagos principales de la región | Natural Earth 1:10m · dominio público |
| `paises.json` | Límites de países de la región | Natural Earth 1:10m · dominio público |
| `src/lib/geo/rotulos.ts` | Ciudades principales (capitales de país y de departamento y otras grandes), océanos, mares y golfos, y los nombres en inglés que cambian | Coordenadas de las ciudades: GeoNames (geonames.org) · CC BY 4.0, redondeadas; las de Colombia verificadas dentro de su municipio |

Simplificación con mapshaper (municipios al 10 %, departamentos al 12 %, precisión 0,0001°). Son de referencia
visual: para límites oficiales consulte el Marco Geoestadístico Nacional del DANE.

Nombres ajustados a la forma usual del DANE: conectores en minúscula («San José del Guaviare», «Cartagena de Indias»),
«Barranquilla» en lugar del nombre largo del distrito, «Bogotá, D. C.», «Barranca de Upía», «María la Baja» y
«San Andrés y Providencia».
