import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatFCFA, formatDate, formatDateTime } from './formatters';

const addHeader = (doc: jsPDF, hotel: any, title: string) => {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(hotel.name, 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text([hotel.address || '', `${hotel.city || ''}, ${hotel.country || ''}`, hotel.phone || ''].filter(Boolean).join(' • '), 105, 28, { align: 'center' });
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 105, 42, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(20, 46, 190, 46);
  return 52;
};

const addFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('HôtelManager Pro', 105, 290, { align: 'center' });
    doc.text(`Page ${i}/${pageCount}`, 190, 290, { align: 'right' });
  }
};

export const generateFicheDePolice = (hotel: any, guest: any, stay?: any) => {
  const doc = new jsPDF();
  let y = addHeader(doc, hotel, 'FICHE DE RENSEIGNEMENTS');

  const fields = [
    ['Nom', guest.last_name || ''],
    ['Nom de jeune fille', guest.maiden_name || ''],
    ['Prénom', guest.first_name || ''],
    ['Date de naissance', formatDate(guest.date_of_birth)],
    ['Lieu de naissance', guest.place_of_birth || ''],
    ['Nationalité', guest.nationality || ''],
    ['Pays de résidence', guest.country_of_residence || ''],
    ['Adresse habituelle', guest.usual_address || ''],
    ['Profession', guest.profession || ''],
    ['Téléphone', guest.phone || ''],
    ['Email', guest.email || ''],
    ['Venant de', guest.coming_from || ''],
    ['Se rendant à', guest.going_to || ''],
    ['Moyen de transport', guest.means_of_transport || ''],
    ['Sexe', guest.gender === 'M' ? '☑ M  ☐ F' : guest.gender === 'F' ? '☐ M  ☑ F' : '☐ M  ☐ F'],
    ['Type de pièce', guest.id_type || ''],
    ['N° pièce d\'identité', guest.id_number || ''],
    ['Délivré le', formatDate(guest.id_issued_on)],
    ['Délivré à', guest.id_issued_at || ''],
  ];

  fields.forEach(([label, value]) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 25, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), 80, y);
    doc.line(80, y + 1, 185, y + 1);
    y += 8;
    if (y > 260) { doc.addPage(); y = 20; }
  });

  if (stay) {
    y += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DÉTAILS DU SÉJOUR', 25, y);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['CH N°', 'Arrivée', 'Départ', 'Nuits', 'Prix', 'Réceptionniste']],
      body: [[
        stay.rooms?.room_number || '-',
        formatDate(stay.check_in_date),
        formatDate(stay.check_out_date),
        String(stay.number_of_nights || '-'),
        formatFCFA(stay.total_price),
        stay.receptionist_name || '-',
      ]],
      theme: 'grid',
      styles: { fontSize: 9 },
    });
  }

  y += 40;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.text('Signature du client:', 25, y);
  doc.rect(25, y + 3, 70, 25);
  doc.text('Signature du réceptionniste:', 115, y);
  doc.rect(115, y + 3, 70, 25);

  addFooter(doc);
  doc.save(`fiche-${guest.last_name}-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateReceipt = (hotel: any, payment: any, invoice: any, guestName: string) => {
  const doc = new jsPDF();
  let y = addHeader(doc, hotel, 'REÇU DE PAIEMENT');

  doc.setFontSize(11);
  const lines = [
    ['Date', formatDateTime(payment.created_at)],
    ['Client', guestName],
    ['N° Facture', invoice.invoice_number],
    ['Mode de paiement', payment.payment_method || 'Cash'],
    ['Référence', payment.reference_number || '-'],
  ];
  lines.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${k}:`, 30, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(v), 80, y);
    y += 8;
  });

  y += 10;
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(formatFCFA(payment.amount), 105, y, { align: 'center' });

  y += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Reçu par: ${payment.created_by_name || '-'}`, 30, y);

  addFooter(doc);
  doc.save(`recu-${invoice.invoice_number}-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateInvoicePDF = (hotel: any, invoice: any, items: any[], payments: any[], guestName: string) => {
  const doc = new jsPDF();
  let y = addHeader(doc, hotel, 'FACTURE');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`N° ${invoice.invoice_number}`, 30, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(invoice.created_at)}`, 140, y);
  y += 8;
  doc.text(`Client: ${guestName}`, 30, y);
  y += 10;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Type', 'Qté', 'P.U.', 'Sous-total']],
    body: items.map(i => [i.description, i.item_type || '-', String(i.quantity || 1), formatFCFA(i.unit_price), formatFCFA(i.subtotal)]),
    theme: 'striped',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text(`Sous-total: ${formatFCFA(invoice.subtotal)}`, 140, y);
  y += 6;
  doc.text(`Taxes: ${formatFCFA(invoice.tax_amount)}`, 140, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${formatFCFA(invoice.total_amount)}`, 140, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Payé: ${formatFCFA(invoice.amount_paid)}`, 140, y);
  y += 6;
  const balance = invoice.balance_due || 0;
  doc.setFont('helvetica', 'bold');
  doc.text(`Solde: ${formatFCFA(balance)}`, 140, y);

  // Payments history
  if (payments.length > 0) {
    y += 15;
    doc.setFontSize(12);
    doc.text('Historique des paiements', 30, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Montant', 'Mode', 'Référence']],
      body: payments.map(p => [formatDateTime(p.created_at), formatFCFA(p.amount), p.payment_method || '-', p.reference_number || '-']),
      theme: 'grid',
      styles: { fontSize: 9 },
    });
  }

  addFooter(doc);
  doc.save(`facture-${invoice.invoice_number}-${guestName.replace(/\s+/g, '-')}.pdf`);
};
