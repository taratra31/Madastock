import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { formatAr, formatDate } from './format';
import { invoiceDocTypeLabels, invoiceStatusLabels } from './labels';

interface InvoicePdfItem {
  type: string;
  description: string;
  product?: { id: string; name: string; sku?: string | null } | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoicePdfData {
  id: string;
  number: string;
  docType: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  subtotalAr: number;
  discountAr: number;
  taxAr: number;
  totalAr: number;
  amountPaidAr: number;
  paymentMethod: string | null;
  notes: string | null;
  customer?: { id: string; fullName: string; phone?: string | null; city?: string | null } | null;
  vehicle?: { id: string; plateNumber: string } | null;
  workOrder?: { id: string; orderNumber: string } | null;
  items: InvoicePdfItem[];
}

const MM = 13.8;
const PAGE_W = 210;
const BAND_H = 36;
const BRAND: RGB = [5, 139, 92];
const BRAND2: RGB = [16, 185, 129];

type RGB = [number, number, number];

const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];

interface MetaItem {
  value: string | null;
}

export async function downloadInvoicePdf(invoice: InvoicePdfData, storeName?: string): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const title = invoiceDocTypeLabels[invoice.docType] ?? 'Document';
  const status = invoiceStatusLabels[invoice.status] ?? invoice.status;
  const remaining = Math.max(0, invoice.totalAr - invoice.amountPaidAr);
  const brand = storeName || 'Ma boutique';

  // --- Bandeau dégradé ---
  drawGradient(doc, 0, 0, PAGE_W, BAND_H, BRAND, BRAND2);

  // Logo MadaStock (pastille blanche)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MM, 8, 12, 12, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND);
  doc.text('MS', MM + 6, 16, { align: 'center' });

  // Nom de la boutique + marque
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(brand, MM + 16, 13.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(220, 250, 235);
  doc.text('MadaStock  -  Gestion de boutique', MM + 16, 18.5);

  // Titre document
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text(title, PAGE_W - MM, 13, { align: 'right' });
  doc.setFontSize(10.5);
  doc.text(`N° ${invoice.number}`, PAGE_W - MM, 19, { align: 'right' });

  // Ligne blanche sous le bandeau
  doc.setFillColor(255, 255, 255);
  doc.rect(0, BAND_H, PAGE_W, 0.8, 'F');

  // --- Infos client / document (2 colonnes + reste à payer) ---
  const colW = (PAGE_W - MM * 2) / 2;
  let y = BAND_H + 12;

  const drawMeta = (titleLabel: string, items: MetaItem[], x: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(titleLabel.toUpperCase(), x, y);
    let yy = y + 5;
    for (const it of items) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(it.value || '—', colW - 6);
      doc.text(lines, x, yy);
      yy += lines.length * 4.3 + 1.2;
    }
    return yy;
  };

  const customerMeta: MetaItem[] = [
    { value: invoice.customer?.fullName ?? null },
    { value: [invoice.customer?.phone, invoice.customer?.city].filter(Boolean).join(' • ') || null },
    { value: [invoice.vehicle ? `Véhicule : ${invoice.vehicle.plateNumber}` : null, invoice.workOrder ? `O.T. : ${invoice.workOrder.orderNumber}` : null].filter(Boolean).join('\n') || null },
  ];

  const docMeta: MetaItem[] = [
    { value: `Date : ${formatDate(invoice.issueDate)}` },
    { value: `Échéance : ${invoice.dueDate ? formatDate(invoice.dueDate) : '—'}` },
    { value: `Paiement : ${invoice.paymentMethod ? invoice.paymentMethod : 'À régler'}` },
    { value: invoice.docType === 'QUOTE' ? `Valeur : ${formatAr(remaining)}` : `Reste : ${formatAr(remaining)}` },
  ];

  let yLeft = drawMeta('Facturé à', customerMeta, MM);
  let yRight = drawMeta('Informations', docMeta, MM + colW);
  y = Math.max(yLeft, yRight) + 4;

  // Badge statut (à droite, sous le titre)
  const statusW = doc.getTextWidth(status) + 12;
  doc.setFillColor(...BRAND);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.roundedRect(PAGE_W - MM - statusW, 26, statusW, 6.5, 3.25, 3.25, 'F');
  doc.text(status, PAGE_W - MM - statusW / 2, 30, { align: 'center' });

  if (invoice.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    const note = doc.splitTextToSize(`Note : ${invoice.notes}`, PAGE_W - MM * 2);
    doc.text(note, MM, y);
    y += note.length * 4 + 6;
  }

  // --- Tableau des articles ---
  autoTable(doc, {
    startY: y + 4,
    margin: { left: MM, right: MM },
    head: [['Désignation', 'Qté', 'P.U. (Ar)', 'Total (Ar)']],
    body: invoice.items.map((it) => [
      it.product && it.product.name !== it.description
        ? `${it.description}\n${it.product.name}`
        : it.description,
      String(it.quantity),
      formatAr(it.unitPrice),
      formatAr(it.lineTotal),
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3,
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: BRAND,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      font: 'helvetica',
    },
    columnStyles: {
      1: { halign: 'right', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 42 },
      3: { halign: 'right', cellWidth: 42 },
    },
  });

  const tableEnd = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;

  // --- Bloc totaux + QR ---
  const totalW = 108;
  const totalX = PAGE_W - MM - totalW;

  const totalRows: Array<{ label: string; value: string; strong?: boolean }> = [
    { label: 'Sous-total', value: formatAr(invoice.subtotalAr) },
    { label: 'Remise', value: `- ${formatAr(invoice.discountAr)}` },
    { label: 'TVA', value: formatAr(invoice.taxAr) },
    { label: 'TOTAL', value: formatAr(invoice.totalAr), strong: true },
    { label: 'Payé', value: formatAr(invoice.amountPaidAr) },
  ];

  let ty = tableEnd;
  for (const row of totalRows) {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.15);
    doc.line(totalX, ty + 2.5, PAGE_W - MM, ty + 2.5);
    doc.setFont('helvetica', row.strong ? 'bold' : 'normal');
    doc.setTextColor(...INK);
    doc.setFontSize(row.strong ? 11 : 9);
    doc.text(row.label, totalX + 1, ty + 5.5);
    doc.text(row.value, PAGE_W - MM - 1, ty + 5.5, { align: 'right' });
    ty += 8.8;
  }

  // Reste à payer (encadré vert)
  const restBoxH = 14;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.35);
  doc.roundedRect(totalX, ty + 2, totalW, restBoxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND);
  doc.text(invoice.docType === 'QUOTE' ? 'Valeur du devis' : 'Reste à payer', totalX + 3, ty + 11);
  doc.text(formatAr(remaining), PAGE_W - MM - 3, ty + 11, { align: 'right' });
  ty += restBoxH + 6;

  // --- QR code Paiement (bande pleine largeur) ---
  const qrText = [
    title.toUpperCase(),
    `Réf. : ${invoice.number}`,
    `Client : ${invoice.customer?.fullName ?? '—'}`,
    `Total : ${formatAr(invoice.totalAr)}`,
    `Reste : ${formatAr(remaining)}`,
    'Payable en espèce ou Mobile Money via MadaStock.',
  ].join('\n');

  let qrData: string | null = null;
  try {
    qrData = await QRCode.toDataURL(qrText, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 260,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch {
    qrData = null;
  }

  let payY = ty + 8;
  if (payY > 245) {
    doc.addPage();
    payY = 30;
  }

  // Carte QR
  const qrBox = 26;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.3);
  doc.roundedRect(MM, payY, qrBox, qrBox, 2.5, 2.5, 'FD');
  if (qrData) doc.addImage(qrData, 'PNG', MM + 1.5, payY + 1.5, qrBox - 3, qrBox - 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...BRAND);
  doc.text('Scannez pour payer', MM + qrBox / 2, payY + qrBox + 3.5, { align: 'center' });

  // Infos paiement
  const infoX = MM + qrBox + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text('Mode de paiement', infoX, payY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const payInfo: string[] = [
    '• Espèces   • Mobile Money (MVola, Orange Money, Airtel Money)   • Virement bancaire',
    invoice.docType === 'INVOICE' && remaining > 0
      ? `Reste à régler : ${formatAr(remaining)}.`
      : 'Document intégralement réglé. Merci.',
    invoice.paymentMethod ? `Mode utilisé pour ce document : ${invoice.paymentMethod}.` : '',
    `Émis le ${formatDate(invoice.issueDate)}${invoice.workOrder ? ` - O.T. n° ${invoice.workOrder.orderNumber}` : ''}.`,
  ];
  doc.text(payInfo, infoX, payY + 11);

  const stripBottom = payY + Math.max(qrBox + 10, payInfo.length * 5 + 16);

  // --- Pied de page ---
  const footerY = Math.min(281, stripBottom + 16);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MM, footerY - 8, PAGE_W - MM, footerY - 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text('Misaotra betsaka fa nisafidy anay !', MM, footerY - 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(brand, MM, footerY + 2);
  doc.text(
    `Document généré avec MadaStock le ${new Date().toLocaleDateString('fr-FR')} - Ce document fait foi.`,
    PAGE_W - MM,
    footerY + 2,
    { align: 'right' }
  );

  doc.save(`${invoice.number.replace(/[^A-Za-z0-9-]/g, '').toUpperCase()}-${brand.replace(/\s+/g, '').slice(0, 12)}.pdf`);
}

function drawGradient(doc: jsPDF, x: number, y: number, w: number, h: number, from: RGB, to: RGB): void {
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round(from[0] + (to[0] - from[0]) * t);
    const g = Math.round(from[1] + (to[1] - from[1]) * t);
    const b = Math.round(from[2] + (to[2] - from[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(x, y + (h / steps) * i, w, h / steps + 0.1, 'F');
  }
}