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
