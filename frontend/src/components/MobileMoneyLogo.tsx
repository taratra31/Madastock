import { useState } from 'react';
import { cn } from './ui';

export type MobileMoneyOperator = 'MVOLA' | 'ORANGE_MONEY' | 'AIRTEL_MONEY';

const LOGO: Record<
  MobileMoneyOperator,
  { src?: string; tint: string; swatch: string; label: string }
> = {
  MVOLA: {
    src: '/logos/mvola.png',
    tint: 'bg-orange-50 ring-orange-200',
    swatch: 'bg-[#F97316]',
    label: 'MVola',
  },
  ORANGE_MONEY: {
    src: '/logos/orange-money.png',
    tint: 'bg-orange-50 ring-orange-200',
    swatch: 'bg-[#FF7900]',
    label: 'Orange Money',
  },
  AIRTEL_MONEY: {
    src: '/logos/airtel-money.png',
    tint: 'bg-red-50 ring-red-200',
    swatch: 'bg-[#E4002B]',
    label: 'Airtel Money',
  },
};

/**
 * Marque mobile money Malawi.
 *
 * Orange Money et Airtel Money utilisent les fichiers officiels déposés dans
 * `frontend/public/logos/` : servis par le même domaine, ils restent
 * compatibles avec la CSP (`img-src 'self'`). Le logo n'est pas étiré : il est
 * borné en hauteur et conservé tel quel (marges transparentes comprises), avec
 * une pastille de couleur en repli si le fichier manque au build.
 */
export function MobileMoneyLogo({
  operator,
  className,
  compact = false,
}: {
  operator: MobileMoneyOperator;
  className?: string;
  /** Version resserrée pour les listes denses (historique de paiement). */
  compact?: boolean;
}) {
  const conf = LOGO[operator];
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        // `h-*` fixe + `justify-center` garantissent une hauteur identique
        // quel que soit le ratio du logo : sinon les trois vignettes se
        // décalent verticalement des que l'une d'elles a une marge blanche.
        'inline-flex items-center justify-center rounded-lg ring-1 leading-none',
        compact ? 'h-8 px-1.5' : 'h-10 px-2.5',
        conf.tint,
        className,
      )}
      title={conf.label}
    >
      {conf.src && !failed ? (
        <img
          src={conf.src}
          alt={conf.label}
          onError={() => setFailed(true)}
          className={cn(
            'shrink-0 object-contain',
            compact ? 'h-4 max-w-[4rem]' : 'h-5 max-w-[6rem]',
          )}
          style={{ width: 'auto' }}
          loading="lazy"
        />
      ) : conf.src ? (
        <span className={cn('shrink-0 rounded-md', compact ? 'h-4 w-4' : 'h-5 w-5', conf.swatch)} />
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" role="img" aria-label="MVola">
          <rect width="24" height="24" rx="6" fill="#F97316" />
          <path
            d="M5 16.5V8l3.6 5.4L12 8.4l3.4 5L19 8v8.5h-2.4v-3.9l-2.3 3.3h-.7l-2.3-3.4v4H5z"
            fill="#fff"
          />
        </svg>
      )}
    </span>
  );
}

export const MOBILE_MONEY_OPERATORS: MobileMoneyOperator[] = ['MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY'];
