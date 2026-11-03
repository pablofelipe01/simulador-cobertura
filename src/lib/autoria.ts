// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Autoría, titularidad y licencia del simulador. Lo muestran «Acerca del simulador», Melki, los metadatos de la
// página y la versión HTML. El texto completo está en LICENSE, en la raíz del repositorio. Las constantes van en
// español (metadatos y versión HTML); las funciones del final dan el mismo texto en el idioma de la pantalla.
import { tx } from "./idioma";

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

/* ───────────── En el idioma de la pantalla ───────────── */

export const programa = () => tx(PROGRAMA, "Coverage Simulator · Trama MeshCore network");
export const derechos = () => tx(DERECHOS, `© ${ANIO} ${INGENIERO}, ${EMPRESA} and ${AUTOR}. All rights reserved.`);
export const credito = () =>
  tx(CREDITO, `Created by ${AUTOR} for Engineer ${INGENIERO} and the company ${EMPRESA}, with the help of artificial intelligence under his direction and review.`);
export const titularidad = () =>
  tx(
    TITULARIDAD,
    `Author: ${AUTOR}. Holders of the economic rights: Engineer ${INGENIERO}, ${EMPRESA} and ${AUTOR}, under the contract between the parties. The author keeps his moral rights.`,
  );
export const prohibicion = () =>
  tx(
    PROHIBICION,
    "Using, copying, reproducing, modifying, adapting, translating, distributing, communicating to the public, selling, leasing, sublicensing or decompiling this program, in whole or in part, without the prior, express and written license or authorization of its rights holders is prohibited. Being able to see the code in a repository does not grant any license.",
  );
export const terceros = () =>
  tx(TERCEROS, "The open-source libraries, fonts, base maps and geographic data used by the program keep their own licenses and are not part of this reservation.");

const NORMAS_EN: { norma: string; que: string }[] = [
  { norma: "Political Constitution of Colombia, article 61", que: "The State protects intellectual property." },
  {
    norma: "Andean Decision 351 of 1993, articles 3, 11, 13 and 23 to 27",
    que: "Computer programs are protected as literary works, in source code and in object code; the author has moral and economic rights, and reproducing the program, even for personal use, requires the rights holder’s authorization, except for the backup copy.",
  },
  {
    norma: "Law 23 of 1982, articles 12, 20 and 30, as amended (Law 1450 of 2011, art. 28; Law 1915 of 2018)",
    que: "Economic and moral rights of the author, and works created under a contract for the provision of services.",
  },
  {
    norma: "Decree 1360 of 1989, compiled in Decree 1066 of 2015 (arts. 2.6.1.3.1 to 2.6.1.3.7)",
    que: "Software (program, description and auxiliary material) is a creation of the literary domain and can be registered in the National Copyright Registry.",
  },
  { norma: "Law 44 of 1993", que: "Amends and supplements Law 23 of 1982 (copyright registration and protection)." },
  {
    norma: "Criminal Code (Law 599 of 2000), articles 270, 271 and 272, as amended by Law 1032 of 2006",
    que: "Punishes the violation of the author’s moral and economic rights, including software, and of their protection measures; articles 271 and 272 provide for 4 to 8 years in prison and a fine of 26.66 to 1,000 minimum monthly wages.",
  },
];

/** Las normas en el idioma de la pantalla. */
export const normas = (): { norma: string; que: string }[] => NORMAS.map((n, i) => ({ norma: tx(n.norma, NORMAS_EN[i].norma), que: tx(n.que, NORMAS_EN[i].que) }));

export const avisoCodigo = () =>
  tx(
    AVISO_CODIGO,
    `${derechos()} Author: ${AUTOR}, for Engineer ${INGENIERO} and ${EMPRESA}, with the help of artificial intelligence. Use, copying, modification or distribution without the written license of the rights holders is prohibited (Law 23 of 1982, Andean Decision 351 of 1993, Criminal Code arts. 270 to 272).`,
  );
