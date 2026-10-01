import { cn } from './ui';

export type MobileMoneyOperator = 'MVOLA' | 'ORANGE_MONEY' | 'AIRTEL_MONEY';

/**
 * Marque mobile money Malawi.
 * Les pictogrammes sont des SVG integrés : aucun appel externe, donc aucune
 * modification de CSP. Remplacez-les par les fichiers officiels si vous
 * disposez des droits d'usage des logos de MVola / Orange / Airtel.
 */
export function MobileMoneyLogo({
  operator,
  className,
}: {
  operator: MobileMoneyOperator;
  className?: string;
}) {
  if (operator === 'MVOLA') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 ring-1 ring-orange-200',
          className,
        )}
        title="MVola"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" role="img" aria-label="MVola">
          <rect width="24" height="24" rx="6" fill="#F97316" />
          <path
            d="M5 16.5V8l3.6 5.4L12 8.4l3.4 5L19 8v8.5h-2.4v-3.9l-2.3 3.3h-.7l-2.3-3.4v4H5z"
            fill="#fff"
          />
        </svg>
        <span className="text-xs font-bold text-orange-700">MVola</span>
      </span>
    );
  }

  if (operator === 'ORANGE_MONEY') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 ring-1 ring-orange-200',
          className,
        )}
        title="Orange Money"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" role="img" aria-label="Orange Money">
          <rect width="24" height="24" rx="6" fill="#FF7900" />
          <circle cx="12" cy="12" r="5.4" fill="none" stroke="#fff" strokeWidth="2.2" />
          <path d="M12 6.6A5.4 5.4 0 0 0 12 17.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <span className="text-xs font-bold text-orange-700">Orange Money</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 ring-1 ring-red-200',
        className,
      )}
      title="Airtel Money"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" role="img" aria-label="Airtel Money">
        <rect width="24" height="24" rx="6" fill="#E4002B" />
        <path
          d="M12 5.4c-2 0-3.3 1-3.3 2.3 0 .9.6 1.5 1.5 1.9-.6.4-.9 1-.9 1.7 0 1.4 1.2 2.3 2.7 2.3s2.7-.9 2.7-2.3c0-.7-.3-1.3-.9-1.7.9-.4 1.5-1 1.5-1.9 0-1.3-1.3-2.3-3.3-2.3zm0 1.7c.9 0 1.5.4 1.5 1s-.6 1-1.5 1-1.5-.4-1.5-1 .6-1 1.5-1z"
          fill="#fff"
        />
        <path d="M7.6 18.6h8.8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="text-xs font-bold text-red-700">Airtel Money</span>
    </span>
  );
}

export const MOBILE_MONEY_OPERATORS: MobileMoneyOperator[] = ['MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY'];
