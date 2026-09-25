import { useId } from 'react';

/**
 * Drapeau de Madagascar en SVG.
 * L'emoji 🇲🇬 nisarana tsy sari amin'ny Windows (mampiseho « MG » fotsiny),
 * ka mampiasa sary vektora izahay mba hiseho amin'ny telefaona sy ny PC rehetra.
 */
export default function FlagMG({ className = 'h-3 w-4' }: { className?: string }) {
  const clipId = `mg-clip-${useId().replace(/:/g, '')}`;
  return (
    <svg
      viewBox="0 0 24 16"
      className={`${className} inline-block align-[-2px] shrink-0`}
      role="img"
      aria-label="Madagascar"
    >
      <defs>
        <clipPath id={clipId}>
          <rect width="24" height="16" rx="2.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="24" height="16" fill="#ffffff" />
        <rect x="8" width="16" height="8" fill="#00A550" />
        <rect x="8" y="8" width="16" height="8" fill="#CE1126" />
      </g>
      <rect width="24" height="16" rx="2.5" fill="none" stroke="rgba(15,23,42,.18)" />
    </svg>
  );
}
