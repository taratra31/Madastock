import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { Button } from './ui';
import { toast } from 'sonner';

interface DetectedBarcode {
  rawValue: string;
}

/** Chrome/Edge exposent l'API BarcodeDetector ; sinon onScan n'est pas disponible. */
type BarcodeDetectorCtor = new (options?: { formats: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};

function getDetectorCtor(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];

/**
 * Bouton « scanner » : ouvre la caméra arrière, détecte un code-barres et
 * renvoie le code lu. Sur les navigateurs sans BarcodeDetector (Safari
 * ancien, Firefox), le bouton explique pourquoi il est indisponible plutôt
 * que de ne rien faire.
 */
export default function BarcodeScanner({
  onScan,
  disabled,
  label = 'Scanner',
}: {
  onScan: (code: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);

  const supported = getDetectorCtor() !== null;

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    const Detector = getDetectorCtor();
    if (!Detector) {
      toast.error(
        'Ce navigateur ne gère pas le scan vidéo. Utilisez Chrome/Edge, ou saisissez le code à la main.',
      );
      return;
    }

    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;

      // La vidéo doit être dans la page avant de lancer la détection.
      setActive(true);
      await new Promise((resolve) => setTimeout(resolve, 60));

      const video = videoRef.current;
      if (!video) throw new Error('Vidéo indisponible');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();

      const detector = new Detector({ formats: FORMATS });
      const scan = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue?.trim();
          if (value) {
            const now = Date.now();
            // Le même code reste affiché plusieurs secondes : on ignore les
            // répétitions pour ne pas ajouter 10 fois le même article.
            if (value !== lastCodeRef.current.code || now - lastCodeRef.current.at > 2500) {
              lastCodeRef.current = { code: value, at: now };
              onScan(value);
            }
          }
        } catch {
          // Une frame illisible n'est pas une erreur : on continue la boucle.
        }
        rafRef.current = requestAnimationFrame(() => void scan());
      };
      rafRef.current = requestAnimationFrame(() => void scan());
    } catch (error) {
      stop();
      const message =
        (error as Error).name === 'NotAllowedError'
          ? 'Accès à la caméra refusé : autorisez-le dans votre navigateur.'
          : 'Caméra indisponible sur cet appareil.';
      toast.error(message);
    } finally {
      setStarting(false);
    }
  };

  if (!supported) {
    return (
      <Button type="button" variant="outline" disabled title="Scan vidéo non supporté par ce navigateur">
        <CameraOff className="w-4 h-4" />
        Scan indisponible
      </Button>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => (active ? stop() : void start())}>
        {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        {active ? 'Arrêter le scan' : label}
      </Button>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg space-y-3">
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} className="h-72 w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-green-400" />
            </div>
            <p className="text-center text-sm text-white">
              Cadrez le code-barres : il sera ajouté automatiquement.
            </p>
            <div className="flex justify-center">
              <Button type="button" variant="outline" onClick={stop}>
                <CameraOff className="w-4 h-4" />
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
