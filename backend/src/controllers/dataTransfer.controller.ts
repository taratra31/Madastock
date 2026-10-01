import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as dataTransfer from '../services/dataTransfer.service';

async function sendCsv(
  res: Response,
  payload: { filename: string; csv: string },
  resFilename: string,
) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${resFilename}"`);
  res.send(payload.csv);
}

export const exportProducts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const payload = await dataTransfer.exportProducts(req.store.id);
  sendCsv(res, payload, payload.filename);
});

export const exportStock = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const payload = await dataTransfer.exportStock(req.store.id);
  sendCsv(res, payload, payload.filename);
});

export const exportSales = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const payload = await dataTransfer.exportSales(
    req.store.id,
    req.query.from as string | undefined,
    req.query.to as string | undefined,
  );
  sendCsv(res, payload, payload.filename);
});

export const exportInvoices = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const payload = await dataTransfer.exportInvoices(req.store.id);
  sendCsv(res, payload, payload.filename);
});

/** Modèle CSV vierge pour aider l'utilisateur à préparer son fichier. */
export const importTemplate = asyncHandler(async (req: Request, res: Response) => {
  const kind = (req.query.kind as 'products' | 'stock') ?? 'products';
  const csv =
    kind === 'stock'
      ? dataTransfer.toCsv(
          ['sku', 'nom', 'depot', 'quantite', 'lot', 'peremption'],
          [
            ['RIZ1', 'Riz 1kg', 'Dépôt principal', 25, 'LOT-2026-01', '2027-01-31'],
            ['HUILE5', 'Huile 5L', 'Dépôt II', 8, '', ''],
          ],
        )
      : dataTransfer.toCsv(
          ['nom', 'sku', 'codeBarres', 'categorie', 'marque', 'unite', 'prixAchat', 'prixVente', 'prixGros', 'tvaPct', 'seuilAlerte', 'suiviStock'],
          [
            ['Riz 1kg', 'RIZ1', '4567890123', 'Alimentation', 'Local', 'kg', 2500, 3500, 3200, 0, 5, 'oui'],
          ],
        );

  const filename = `modele-import-${kind === 'stock' ? 'inventaire' : 'produits'}.csv`;
  sendCsv(res, { filename, csv }, filename);
});

export const importProducts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const content = extractCsv(req);
  const result = await dataTransfer.importProducts(req.store.id, content);
  res.json(result);
});

export const importStock = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const content = extractCsv(req);
  const result = await dataTransfer.importStock(req.store.id, content, req.user?.id);
  res.json(result);
});

/**
 * Le contenu du fichier arrive en texte dans le corps de la requête : le
 * front fait un `FileReader` et envoie `{ csv }`. On limite la taille pour
 * éviter d'envoyer un fichier énorme.
 */
function extractCsv(req: Request): string {
  const csv = typeof req.body?.csv === 'string' ? req.body.csv.trim() : '';
  if (!csv) throw badRequest('Aucun fichier CSV reçu');
  if (csv.length > 5_000_000) throw badRequest('Fichier trop volumineux (max 5 Mo)');
  return csv;
}
