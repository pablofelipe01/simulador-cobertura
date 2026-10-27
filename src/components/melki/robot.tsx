// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// El robot de Melki de cuerpo entero, en vectores (diseño original en la paleta de la marca): flota sobre un
// propulsor, parpadea, habla (boca y ondas de radio en la antena), señala con el brazo derecho, saluda y se inclina
// al volar. Las animaciones están en globals.css (clases «robot-…») y respetan «reducir movimiento».

export type GestoRobot = "flotando" | "hablando" | "senalando" | "saludando" | "volando" | "pensando";

export function RobotMelki({
  gesto = "flotando",
  hablando = false,
  mirando = "derecha",
  className = "h-40 w-32",
  titulo = "Melki",
}: {
  gesto?: GestoRobot;
  hablando?: boolean;
  mirando?: "derecha" | "izquierda";
  className?: string;
  titulo?: string;
}) {
  const clases = ["robot-melki", `robot-${gesto}`, hablando ? "robot-hablando" : "", mirando === "izquierda" ? "robot-espejo" : ""].filter(Boolean).join(" ");
  return (
    <svg viewBox="0 0 160 210" className={`${className} ${clases}`} role="img" aria-label={titulo}>
      <defs>
        <linearGradient id="robot-cuerpo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A9C4AF" />
          <stop offset="1" stopColor="#7E9F86" />
        </linearGradient>
        <linearGradient id="robot-cabeza" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A3C0A9" />
          <stop offset="1" stopColor="#82A48A" />
        </linearGradient>
        <radialGradient id="robot-fuego" cx="0.5" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#FFF1C9" />
          <stop offset="0.35" stopColor="#F5B04A" />
          <stop offset="1" stopColor="#E07A3F" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="robot-sombra" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2B2F2E" stopOpacity="0.35" />
          <stop offset="1" stopColor="#2B2F2E" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Sombra en el suelo: crece y se achica con el vuelo */}
      <ellipse className="robot-sombra" cx="80" cy="200" rx="34" ry="6" fill="url(#robot-sombra)" />
      <g className="robot-orientacion">
        <g className="robot-flota">
          {/* Propulsor */}
          <path className="robot-llama" d="M66 168 Q80 206 94 168 Z" fill="url(#robot-fuego)" />
          <rect x="64" y="162" width="32" height="10" rx="5" fill="#4F6D59" stroke="#2B2F2E" strokeWidth="2.5" />
          {/* Brazo izquierdo (del robot) */}
          <g className="robot-brazo robot-brazo-izq">
            <rect x="26" y="118" width="16" height="40" rx="8" fill="#6E8F78" stroke="#2B2F2E" strokeWidth="2.8" />
            <circle cx="34" cy="161" r="7.5" fill="#F4F2EE" stroke="#2B2F2E" strokeWidth="2.6" />
          </g>
          {/* Brazo derecho: señala y saluda */}
          <g className="robot-brazo robot-brazo-der">
            <rect x="118" y="118" width="16" height="40" rx="8" fill="#6E8F78" stroke="#2B2F2E" strokeWidth="2.8" />
            <circle cx="126" cy="161" r="7.5" fill="#F4F2EE" stroke="#2B2F2E" strokeWidth="2.6" />
          </g>
          {/* Cuerpo */}
          <rect x="42" y="110" width="76" height="58" rx="24" fill="url(#robot-cuerpo)" stroke="#2B2F2E" strokeWidth="3" />
          <path d="M52 122 q6 -6 16 -7" stroke="#F4F2EE" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7" />
          {/* Pantalla del pecho: la señal de la malla */}
          <rect x="58" y="124" width="44" height="30" rx="9" fill="#2B2F2E" />
          <circle cx="72" cy="146" r="3" fill="#E07A3F" />
          <path className="robot-senal s1" d="M77 141 a7 7 0 0 1 0 10" stroke="#E07A3F" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path className="robot-senal s2" d="M82 136 a13 13 0 0 1 0 20" stroke="#E07A3F" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path className="robot-senal s3" d="M87 131 a19 19 0 0 1 0 30" stroke="#E07A3F" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          {/* Cuello */}
          <rect x="70" y="100" width="20" height="13" rx="4" fill="#4F6D59" stroke="#2B2F2E" strokeWidth="2.6" />
          {/* Cabeza */}
          <g className="robot-cabeza">
            {/* Antena con su luz */}
            <line x1="80" y1="38" x2="80" y2="20" stroke="#2B2F2E" strokeWidth="3.4" strokeLinecap="round" />
            <circle className="robot-luz" cx="80" cy="15" r="7" fill="#E07A3F" stroke="#2B2F2E" strokeWidth="2.6" />
            <path className="robot-onda o1" d="M91 8 a11 11 0 0 1 0 14" fill="none" stroke="#E07A3F" strokeWidth="2.6" strokeLinecap="round" />
            <path className="robot-onda o2" d="M97 3 a18 18 0 0 1 0 24" fill="none" stroke="#E07A3F" strokeWidth="2.6" strokeLinecap="round" />
            {/* Orejas */}
            <rect x="21" y="60" width="13" height="26" rx="5" fill="#4F6D59" stroke="#2B2F2E" strokeWidth="2.6" />
            <rect x="126" y="60" width="13" height="26" rx="5" fill="#4F6D59" stroke="#2B2F2E" strokeWidth="2.6" />
            <rect x="32" y="36" width="96" height="70" rx="27" fill="url(#robot-cabeza)" stroke="#2B2F2E" strokeWidth="3.2" />
            <path d="M42 50 q7 -7 18 -8" stroke="#F4F2EE" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.8" />
            {/* Visor */}
            <rect x="44" y="52" width="72" height="44" rx="17" fill="#2B2F2E" />
            <g className="robot-ojos">
              <rect x="59" y="62" width="12" height="17" rx="6" fill="#F4F2EE" />
              <rect x="89" y="62" width="12" height="17" rx="6" fill="#F4F2EE" />
              <circle cx="67" cy="67" r="2.2" fill="#2B2F2E" opacity="0.35" />
              <circle cx="97" cy="67" r="2.2" fill="#2B2F2E" opacity="0.35" />
            </g>
            <rect className="robot-boca" x="73" y="85" width="14" height="4" rx="2" fill="#E07A3F" />
            <circle cx="47" cy="99" r="3" fill="#E07A3F" opacity="0.55" />
            <circle cx="113" cy="99" r="3" fill="#E07A3F" opacity="0.55" />
          </g>
        </g>
      </g>
    </svg>
  );
}
