// Torre en celosía pequeña para listas y botones (misma figura que el marcador del mapa).
export function IconoTorre({ className = "h-5 w-5", baliza }: { className?: string; baliza?: string }) {
  return (
    <svg viewBox="-1 -1 34 41" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 9 L9.5 38 M16 9 L22.5 38 M11.4 29.5 H20.6 M12.9 22.5 H19.1 M11.4 29.5 L19.1 22.5 M20.6 29.5 L12.9 22.5 M7 38 H25" />
        <path d="M10.2 3.2 a8 8 0 0 0 0 10.4 M21.8 3.2 a8 8 0 0 1 0 10.4" />
      </g>
      <circle cx="16" cy="8.4" r="3.4" fill={baliza ?? "currentColor"} stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

// Equipo de campo (nodo): cuerpo redondeado con antena corta (misma figura que su marcador).
export function IconoEquipo({ className = "h-5 w-5", baliza }: { className?: string; baliza?: string }) {
  return (
    <svg viewBox="-1 -1 34 41" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19.5 6 V17" />
        <rect x="10" y="16" width="13" height="20" rx="3.2" />
        <path d="M13.2 22 H19.8 M13.2 26 H19.8 M13.2 30 H17" />
      </g>
      <circle cx="19.5" cy="6.2" r="3.4" fill={baliza ?? "currentColor"} stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

/** Ícono según el tipo de nodo. */
export function IconoNodo({ tipo, className, baliza }: { tipo?: "antena" | "nodo"; className?: string; baliza?: string }) {
  return (tipo ?? "antena") === "nodo" ? <IconoEquipo className={className} baliza={baliza} /> : <IconoTorre className={className} baliza={baliza} />;
}

// Persona (modo «Sembrar la malla»): misma figura que su marcador.
export function IconoPersona({ className = "h-5 w-5", relleno }: { className?: string; relleno?: string }) {
  return (
    <svg viewBox="-1 -1 34 41" className={className} aria-hidden="true">
      <g fill={relleno ?? "none"} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <circle cx="16" cy="9.6" r="5.4" />
        <path d="M6.6 37 V28.4 a9.4 9.4 0 0 1 18.8 0 V37 Z" />
      </g>
    </svg>
  );
}

// Gateway + Internet: el router donde entra el internet, con la nube «IA» (el gateway lleva la inteligencia artificial).
export function IconoGateway({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 30" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11.4 14.2 a5.2 5.2 0 0 1 7.2 0 M8.9 11.6 a8.8 8.8 0 0 1 12.2 0" />
        <rect x="4" y="18" width="22" height="9" rx="2.2" />
        <path d="M8.6 18 L7 14.6 M21.4 18 L23 14.6" />
      </g>
      <circle cx="9.2" cy="22.5" r="1.2" fill="currentColor" />
      <circle cx="13.2" cy="22.5" r="1.2" fill="currentColor" />
      <path d="M23.2 10.6 H31 a3 3 0 0 0 .4-6 A4.2 4.2 0 0 0 23.6 3.4 a3.6 3.6 0 0 0-.4 7.2 Z" fill="#3EE6C8" stroke="#0F1F1C" strokeWidth=".8" />
      <text x="27" y="9" textAnchor="middle" fontSize="5.2" fontWeight="800" fill="#0F1F1C" fontFamily="sans-serif">IA</text>
    </svg>
  );
}

/** Ícono de cada pieza del modo «Sembrar la malla». */
export function IconoPieza({ pieza, className }: { pieza: "gateway" | "repetidor" | "persona"; className?: string }) {
  if (pieza === "gateway") return <IconoGateway className={className} />;
  if (pieza === "persona") return <IconoPersona className={className} />;
  return <IconoTorre className={className} />;
}
