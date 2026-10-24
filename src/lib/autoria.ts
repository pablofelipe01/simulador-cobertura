// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Autoría, titularidad y licencia del simulador. Lo muestran «Acerca del simulador», Melki, los metadatos de la
// página y la versión HTML. El texto completo está en LICENSE, en la raíz del repositorio.

export const PROGRAMA = "Simulador de cobertura · Red MeshCore de Trama";
export const AUTOR = "Giancarlo González Guerrero";
export const INGENIERO = "Pablo Felipe Acevedo";
export const EMPRESA = "Melki";
export const ANIO = 2026;

/** Titulares de los derechos patrimoniales, según el contrato entre las partes. */
export const TITULARES = [`el Ingeniero ${INGENIERO}`, EMPRESA, AUTOR] as const;

/** «© 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.» */
export const DERECHOS = `© ${ANIO} ${INGENIERO}, ${EMPRESA} y ${AUTOR}. Todos los derechos reservados.`;

export const CREDITO = `Creado por ${AUTOR} para el Ingeniero ${INGENIERO} y la empresa ${EMPRESA}, con ayuda de inteligencia artificial bajo su dirección y revisión.`;

export const TITULARIDAD = `Autor: ${AUTOR}. Titulares de los derechos patrimoniales: el Ingeniero ${INGENIERO}, ${EMPRESA} y ${AUTOR}, según el contrato entre las partes. El autor conserva sus derechos morales.`;

export const PROHIBICION =
  "Prohibido usar, copiar, reproducir, modificar, adaptar, traducir, distribuir, comunicar públicamente, vender, arrendar, sublicenciar o descompilar este programa, en todo o en parte, sin licencia o autorización previa, expresa y escrita de sus titulares. Que el código pueda verse en un repositorio no concede ninguna licencia.";

export const TERCEROS =
  "Las bibliotecas de código abierto, las tipografías, los mapas base y los datos geográficos que usa el programa conservan sus propias licencias y no hacen parte de esta reserva.";

/** Normas colombianas y andinas que protegen el programa (consultar el texto vigente en el Gestor Normativo de Función Pública). */
export const NORMAS: { norma: string; que: string }[] = [
  { norma: "Constitución Política de Colombia, artículo 61", que: "El Estado protege la propiedad intelectual." },
  {
    norma: "Decisión Andina 351 de 1993, artículos 3, 11, 13 y 23 a 27",
    que: "Los programas de ordenador se protegen como obras literarias, en código fuente y en código objeto; el autor tiene derechos morales y patrimoniales, y reproducir el programa, aun para uso personal, exige autorización del titular, salvo la copia de seguridad.",
  },
  {
    norma: "Ley 23 de 1982, artículos 12, 20 y 30, con sus modificaciones (Ley 1450 de 2011, art. 28; Ley 1915 de 2018)",
    que: "Derechos patrimoniales y morales del autor y obras creadas en cumplimiento de un contrato de prestación de servicios.",
  },
  {
    norma: "Decreto 1360 de 1989, compilado en el Decreto 1066 de 2015 (arts. 2.6.1.3.1 a 2.6.1.3.7)",
    que: "El soporte lógico (programa, descripción y material auxiliar) es una creación del dominio literario y se puede inscribir en el Registro Nacional del Derecho de Autor.",
  },
  { norma: "Ley 44 de 1993", que: "Modifica y adiciona la Ley 23 de 1982 (registro y protección del derecho de autor)." },
  {
    norma: "Código Penal (Ley 599 de 2000), artículos 270, 271 y 272, modificados por la Ley 1032 de 2006",
    que: "Castiga la violación de los derechos morales y patrimoniales de autor, incluido el soporte lógico, y de sus mecanismos de protección; los artículos 271 y 272 prevén prisión de 4 a 8 años y multa de 26,66 a 1.000 salarios mínimos.",
  },
];

/** Comentario de cabecera para los archivos que se generan (la versión HTML). */
export const AVISO_CODIGO = `${DERECHOS} Autor: ${AUTOR}, para el Ingeniero ${INGENIERO} y ${EMPRESA}, con ayuda de inteligencia artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272).`;
