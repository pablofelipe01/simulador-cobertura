// Melki: robot con antena en la cabeza (diseño original en la paleta de la marca).
export function MelkiAvatar({ className = "h-14 w-14", hablando = false }: { className?: string; hablando?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={`${className} ${hablando ? "melki-hablando" : ""}`} aria-hidden="true">
      {/* Ondas de radio que salen de la antena al hablar */}
      <path className="melki-onda" d="M40.5 4.5 a7 7 0 0 1 0 9" fill="none" stroke="#E07A3F" strokeWidth="2" strokeLinecap="round" opacity={hablando ? undefined : 0} />
      <path className="melki-onda o2" d="M44 1.5 a11.5 11.5 0 0 1 0 15" fill="none" stroke="#E07A3F" strokeWidth="2" strokeLinecap="round" opacity={hablando ? undefined : 0} />
      {/* Antena */}
      <line x1="32" y1="17" x2="32" y2="8" stroke="#2B2F2E" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="32" cy="8" r="4.2" fill="#E07A3F" stroke="#2B2F2E" strokeWidth="2" />
      {/* Orejas */}
      <rect x="5" y="30" width="7" height="13" rx="3" fill="#4F6D59" stroke="#2B2F2E" strokeWidth="2" />
      <rect x="52" y="30" width="7" height="13" rx="3" fill="#4F6D59" stroke="#2B2F2E" strokeWidth="2" />
      {/* Cabeza */}
      <rect x="10" y="16" width="44" height="40" rx="13" fill="#8FAE96" stroke="#2B2F2E" strokeWidth="2.4" />
      <path d="M15 22 q4 -3 9 -3" stroke="#F4F2EE" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
      {/* Visor */}
      <rect x="16" y="26" width="32" height="21" rx="8" fill="#2B2F2E" />
      <rect className="melki-ojo" x="22" y="31" width="6" height="8" rx="3" fill="#F4F2EE" />
      <rect className="melki-ojo" x="36" y="31" width="6" height="8" rx="3" fill="#F4F2EE" />
      <rect className="melki-boca" x="28.5" y="42" width="7" height="2.2" rx="1.1" fill="#E07A3F" />
      {/* Mejillas */}
      <circle cx="17" cy="50" r="2" fill="#E07A3F" opacity="0.55" />
      <circle cx="47" cy="50" r="2" fill="#E07A3F" opacity="0.55" />
    </svg>
  );
}
