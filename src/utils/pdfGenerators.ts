import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatFCFA, formatDate, formatDateTime } from './formatters';

// ============================================================================
// IMPROVED PDF UTILITIES & HELPERS
// ============================================================================

/**
 * Format FCFA values consistently without excessive spacing
 */
const formatCurrencyPDF = (value: number): string => {
  if (!value || value === 0) return '0 FCFA';
  const absVal = Math.abs(Math.round(value));
  const formatted = absVal.toLocaleString('fr-FR');
  return `${formatted} FCFA`;
};

/**
 * Format date in French locale
 */
const formatDateFR = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  } catch {
    return '-';
  }
};

/**
 * Format date and time in French locale
 */
const formatDateTimeFR = (date: Date | string): string => {
  try {
    return new Date(date).toLocaleString('fr-FR');
  } catch {
    return '-';
  }
};

/**
 * Format payment method with proper names
 */
const formatPaymentMethod = (method: string): string => {
  const methods: Record<string, string> = {
    cash: 'Espèces',
    mtn_momo: 'MTN MoMo',
    orange_money: 'Orange Money',
    bank_transfer: 'Virement bancaire',
  };
  return methods[method] || method || '-';
};

/**
 * Format item type with proper labels
 */
const formatItemType = (type: string, description?: string): string => {
  if (type === 'service' && /sieste/i.test(description || '')) return 'Sieste';
  const types: Record<string, string> = {
    room: 'Hébergement',
    restaurant: 'Restaurant',
    bar: 'Bar',
    minibar: 'Minibar',
    extra: 'Extra',
    service: 'Service',
    sieste: 'Sieste',
    tax: 'Taxe',
    wifi: 'WiFi',
    linen: 'Linge',
  };
  return types[type] || type || '-';
};

/**
 * Get most used room category
 */
const getMostUsedCategory = (stays: any[]): string => {
  const counts: Record<string, number> = {};
  stays.forEach((s) => {
    const categoryName = s.room_categories?.name || s.rooms?.room_categories?.name;
    if (categoryName) {
      counts[categoryName] = (counts[categoryName] || 0) + 1;
    }
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
};

/**
 * Get most used payment method
 */
const getMostUsedPaymentMethod = (payments: any[]): string => {
  const counts: Record<string, number> = {};
  payments.forEach((p) => {
    if (p.payment_method) {
      counts[p.payment_method] = (counts[p.payment_method] || 0) + 1;
    }
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? formatPaymentMethod(top) : '-';
};

/**
 * Fetch image as Base64
 */
const fetchImageAsBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

/**
 * Add professional header to PDF
 */
const addHeader = (doc: jsPDF, hotel: any, title: string) => {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text((hotel.name || '').toUpperCase(), 105, 20, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const headerDetails = [hotel.address || '', `${hotel.city || ''}, ${hotel.country || ''}`, hotel.phone || '']
    .filter(Boolean)
    .join(' • ');
  doc.text(headerDetails, 105, 27, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 105, 40, { align: 'center' });
  
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.5);
  doc.line(20, 43, 190, 43);
  
  return 50;
};

/**
 * Add footer to all pages
 */
const addFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.text('HôtelManager Pro', pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`Page ${i}/${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
};

/**
 * Add dossier page header with consistent styling
 */
const addDossierPageHeader = (
  doc: jsPDF,
  guest: any,
  hotel: any,
  pageWidth: number,
  sectionTitle: string
) => {
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(hotel.name || '', 14, 10);
  doc.text(
    `${(guest.last_name || '').toUpperCase()} ${guest.first_name || ''} - Dossier Client`,
    pageWidth / 2,
    10,
    { align: 'center' }
  );
  doc.text(new Date().toLocaleDateString('fr-FR'), pageWidth - 14, 10, { align: 'right' });
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(14, 12, pageWidth - 14, 12);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 242, 245);
  doc.rect(14, 15, pageWidth - 28, 8, 'F');
  doc.text(sectionTitle, 16, 19.5);
};

/**
 * Add page footer with consistent formatting
 */
const addPageFooter = (
  doc: jsPDF,
  hotel: any,
  pageWidth: number,
  pageHeight: number,
  pageNum: number
) => {
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
  doc.text(hotel.name || '', 14, pageHeight - 6);
  doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
  doc.text('HotelManager Pro', pageWidth - 14, pageHeight - 6, { align: 'right' });
  doc.setTextColor(0, 0, 0);
};

// ============================================================================
// POLICE REGISTER GENERATION
// ============================================================================

export async function generatePoliceRegister(params: {
  hotel: any;
  guests: any[];
  periodStart: string;
  periodEnd: string;
  generatedBy: string;
  download?: boolean;
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Add logo if available
  if (params.hotel.logo_url) {
    try {
      const logoBase64 = await fetchImageAsBase64(params.hotel.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 14, 8, 25, 25);
      }
    } catch {
      // ignore logo errors
    }
  }

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text((params.hotel.name || '').toUpperCase(), pageWidth / 2, 14, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(params.hotel.address || '', pageWidth / 2, 19, { align: 'center' });
  doc.text(
    `${params.hotel.city || ''} - Tel: ${params.hotel.phone || ''}`,
    pageWidth / 2,
    23,
    { align: 'center' }
  );

  // Title box
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.setFillColor(51, 65, 85);
  doc.setTextColor(255, 255, 255);
  doc.rect(pageWidth / 2 - 60, 27, 120, 10, 'F');
  doc.text('REGISTRE DE POLICE / POLICE REGISTER', pageWidth / 2, 33.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Period info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const periodText = `Période du ${formatDateFR(params.periodStart)} au ${formatDateFR(params.periodEnd)}`;
  doc.text(periodText, pageWidth / 2, 43, { align: 'center' });
  doc.text(
    `Généré le ${formatDateTimeFR(new Date())} par ${params.generatedBy}`,
    pageWidth / 2,
    47,
    { align: 'center' }
  );
  doc.text(`Nombre de fiches: ${params.guests.length}`, 14, 47);

  // Main table
  autoTable(doc, {
    startY: 51,
    head: [
      [
        { content: 'N°', styles: { halign: 'center', cellWidth: 8 } },
        { content: 'N° Chambre', styles: { halign: 'center', cellWidth: 15 } },
        { content: 'Nom et Prénoms\nFull Name', styles: { halign: 'center', cellWidth: 38 } },
        { content: 'Date & Lieu de Naissance\nDate & Place of Birth', styles: { halign: 'center', cellWidth: 28 } },
        { content: 'Nationalité\nNationality', styles: { halign: 'center', cellWidth: 22 } },
        { content: 'Qualité/Profession\nOccupation', styles: { halign: 'center', cellWidth: 25 } },
        { content: 'Domicile Habituel\nPermanent Address', styles: { halign: 'center', cellWidth: 30 } },
        { content: "Date d'Arrivée\nCheck-in", styles: { halign: 'center', cellWidth: 20 } },
        { content: 'Date de Départ\nCheck-out', styles: { halign: 'center', cellWidth: 20 } },
        { content: "Pièce d'Identité\nID / Passport", styles: { halign: 'center', cellWidth: 28 } },
        { content: 'Observations', styles: { halign: 'center', cellWidth: 24 } },
      ],
    ],
    body: params.guests.map((row, index) => {
      const guest = row.guest || {};
      return [
        { content: String(index + 1).padStart(3, '0'), styles: { halign: 'center' } },
        { content: row.room_number || '-', styles: { halign: 'center' } },
        { content: `${(guest.last_name || '').toUpperCase()} ${guest.first_name || ''}`, styles: { fontStyle: 'bold' } },
        {
          content: guest.date_of_birth
            ? `${formatDateFR(guest.date_of_birth)}\n${guest.place_of_birth || ''}`
            : '-',
        },
        { content: guest.nationality || '-' },
        { content: guest.profession || '-' },
        { content: guest.usual_address || '-' },
        { content: row.check_in_date ? formatDateFR(row.check_in_date) : '-', styles: { halign: 'center' } },
        { content: row.check_out_date ? formatDateFR(row.check_out_date) : '-', styles: { halign: 'center' } },
        { content: guest.id_number ? `${guest.id_type || ''}\n${guest.id_number}` : '-' },
        { content: row.observation || '' },
      ];
    }),
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 12,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    rowPageBreak: 'avoid',
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${params.hotel.name} - Registre de Police - ${periodText}`,
        14,
        pageHeight - 6
      );
      doc.text(
        `Page ${data.pageNumber} / ${pageCount} - Document officiel - HotelManager Pro`,
        pageWidth - 14,
        pageHeight - 6,
        { align: 'right' }
      );
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(14, pageHeight - 9, pageWidth - 14, pageHeight - 9);
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  if (finalY < pageHeight - 40) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Fait à ${params.hotel.city || '___________'}, le ___________________________`,
      14,
      finalY + 8
    );
    doc.text('Signature et cachet du Directeur / Manager:', 14, finalY + 18);
    doc.rect(14, finalY + 22, 60, 20);
    doc.text('Visa des autorités / Police Stamp:', pageWidth - 90, finalY + 18);
    doc.rect(pageWidth - 90, finalY + 22, 76, 20);
  }

  const filename = `registre-police-${params.hotel.slug || 'hotel'}-${params.periodStart}-${params.periodEnd}.pdf`;
  if (params.download === false) {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }
  doc.save(filename);
}

// ============================================================================
// CUSTOMER DOSSIER GENERATION (IMPROVED VERSION)
// ============================================================================

export async function generateCustomerDossier(params: {
  guest: any;
  hotel: any;
  stays: any[];
  siestes: any[];
  payments: any[];
  generatedBy: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ========== PAGE 1: HEADER & PERSONAL INFO ==========

  // Add logo if available
  if (params.hotel.logo_url) {
    try {
      const logo = await fetchImageAsBase64(params.hotel.logo_url);
      if (logo) {
        doc.addImage(logo, 'PNG', pageWidth - 40, 8, 26, 26);
      }
    } catch {
      // ignore
    }
  }

  // Hotel header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text((params.hotel.name || '').toUpperCase(), 14, 16);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(params.hotel.address || '', 14, 21);
  doc.text(`${params.hotel.city || ''} - ${params.hotel.phone || ''}`, 14, 25);

  // Title section
  doc.setFillColor(15, 23, 42);
  doc.rect(14, 32, pageWidth - 28, 12, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('DOSSIER CLIENT / CUSTOMER FILE', pageWidth / 2, 39.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Guest name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `${(params.guest.last_name || '').toUpperCase()} ${params.guest.first_name || ''}`,
    pageWidth / 2,
    56,
    { align: 'center' }
  );

  // Calculate statistics
  const totalStays = params.stays.length;
  const totalSiestes = params.siestes.length;
  const totalNights = params.stays.reduce((sum, s) => sum + (s.number_of_nights || 0), 0);
  const totalPaid = params.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const firstVisit = [...params.stays, ...params.siestes]
    .sort((a: any, b: any) => new Date(a.check_in_date || a.arrival_date).getTime() - new Date(b.check_in_date || b.arrival_date).getTime())[0];

  // Summary cards
  const statBoxes = [
    { label: 'Séjours', value: String(totalStays) },
    { label: 'Siestes', value: String(totalSiestes) },
    { label: 'Nuits totales', value: String(totalNights) },
    { label: 'Total payé', value: formatCurrencyPDF(totalPaid) },
  ];

  const boxWidth = (pageWidth - 28 - 12) / 4;
  statBoxes.forEach((stat, i) => {
    const x = 14 + i * (boxWidth + 4);
    doc.setDrawColor(51, 65, 85);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.rect(x, 61, boxWidth, 18, 'S');
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(stat.value, x + boxWidth / 2, 70, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(stat.label.toUpperCase(), x + boxWidth / 2, 76, { align: 'center' });
  });
  doc.setTextColor(0, 0, 0);

  // Personal information section
  let y = 84;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(51, 65, 85);
  doc.setTextColor(255, 255, 255);
  doc.rect(14, y, pageWidth - 28, 7, 'F');
  doc.text('INFORMATIONS PERSONNELLES / PERSONAL INFORMATION', 16, y + 4.5);
  doc.setTextColor(0, 0, 0);

  y += 10;
  const personalFields = [
    ['Nom / Last Name', params.guest.last_name?.toUpperCase() || '-'],
    ['Prénoms / Given Names', params.guest.first_name || '-'],
    ['Nom de jeune fille / Maiden Name', params.guest.maiden_name || '-'],
    ['Date de naissance / Date of Birth', params.guest.date_of_birth ? formatDateFR(params.guest.date_of_birth) : '-'],
    ['Lieu de naissance / Place of Birth', params.guest.place_of_birth || '-'],
    ['Sexe / Gender', params.guest.gender === 'M' ? 'Masculin / Male' : params.guest.gender === 'F' ? 'Féminin / Female' : '-'],
    ['Nationalité / Nationality', params.guest.nationality || '-'],
    ['Pays de résidence / Country of Residence', params.guest.country_of_residence || '-'],
    ['Adresse / Address', params.guest.usual_address || '-'],
    ['Profession / Occupation', params.guest.profession || '-'],
    ['Téléphone / Phone', params.guest.phone || '-'],
    ['Email', params.guest.email || '-'],
  ];

  personalFields.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.rect(14, y - 3, pageWidth - 28, 6, 'F');
    
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(label, 16, y + 0.5);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(String(value), 90, y + 0.5);
    
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(14, y + 3, pageWidth - 14, y + 3);
    y += 6;
  });

  // Identity section
  y += 4;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(51, 65, 85);
  doc.setTextColor(255, 255, 255);
  doc.rect(14, y, pageWidth - 28, 7, 'F');
  doc.text("PIÈCE D'IDENTITÉ / IDENTITY DOCUMENT", 16, y + 4.5);
  doc.setTextColor(0, 0, 0);
  y += 10;

  const idFields = [
    ["Type de pièce / ID Type", params.guest.id_type || '-'],
    ['Numéro / Number', params.guest.id_number || '-'],
    ['Délivrée le / Issued on', params.guest.id_issued_on ? formatDateFR(params.guest.id_issued_on) : '-'],
    ['Délivrée à / Issued at', params.guest.id_issued_at || '-'],
  ];

  idFields.forEach(([label, value]) => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(label, 16, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(String(value), 90, y);
    
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(14, y + 2, pageWidth - 14, y + 2);
    y += 7;
  });

  // Signature area
  y += 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature du client / Customer Signature:', 14, y);
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(14, y + 3, 70, 20);

  if (params.guest.customer_signature_url) {
    try {
      const sigBase64 = await fetchImageAsBase64(params.guest.customer_signature_url);
      if (sigBase64) {
        doc.addImage(sigBase64, 'PNG', 15, y + 4, 68, 18);
      }
    } catch {
      // ignore
    }
  }

  addPageFooter(doc, params.hotel, pageWidth, pageHeight, 1);

  // ========== PAGE 2: STAY HISTORY ==========

  doc.addPage();
  addDossierPageHeader(doc, params.guest, params.hotel, pageWidth, 'HISTORIQUE DES SÉJOURS / STAY HISTORY');

  autoTable(doc, {
    startY: 45,
    head: [
      [
        { content: 'N°', styles: { halign: 'center', cellWidth: 8 } },
        { content: 'Type', styles: { halign: 'center', cellWidth: 15 } },
        { content: 'Chambre', styles: { halign: 'center', cellWidth: 18 } },
        { content: 'Catégorie', styles: { cellWidth: 28 } },
        { content: 'Arrivée', styles: { halign: 'center', cellWidth: 22 } },
        { content: 'Départ', styles: { halign: 'center', cellWidth: 22 } },
        { content: 'Nuits', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'Adultes', styles: { halign: 'center', cellWidth: 12 } },
        { content: 'Montant total', styles: { halign: 'right', cellWidth: 25 } },
        { content: 'Montant payé', styles: { halign: 'right', cellWidth: 25 } },
        { content: 'Solde', styles: { halign: 'right', cellWidth: 20 } },
        { content: 'Statut', styles: { halign: 'center', cellWidth: 18 } },
      ],
    ],
    body: params.stays.map((stay, i) => [
      { content: String(i + 1), styles: { halign: 'center' } },
      { content: stay.stay_type === 'sieste' ? 'Sieste' : 'Nuit', styles: { halign: 'center' } },
      { content: stay.rooms?.room_number || '-', styles: { halign: 'center' } },
      { content: stay.room_categories?.name || stay.rooms?.room_categories?.name || '-' },
      { content: stay.check_in_date ? formatDateFR(stay.check_in_date) : '-', styles: { halign: 'center' } },
      {
        content: stay.actual_check_out
          ? formatDateFR(stay.actual_check_out)
          : stay.check_out_date
            ? formatDateFR(stay.check_out_date)
            : '-',
        styles: { halign: 'center' },
      },
      { content: String(stay.number_of_nights || 0), styles: { halign: 'center' } },
      { content: String(stay.number_of_adults || 1), styles: { halign: 'center' } },
      { content: formatCurrencyPDF(stay.invoices?.total_amount || 0), styles: { halign: 'right' } },
      { content: formatCurrencyPDF(stay.invoices?.amount_paid || 0), styles: { halign: 'right' } },
      {
        content: formatCurrencyPDF(stay.invoices?.balance_due || 0),
        styles: {
          halign: 'right',
          textColor: (stay.invoices?.balance_due || 0) > 0 ? [220, 38, 38] : [16, 185, 129],
        },
      },
      {
        content: stay.status === 'checked_out' ? 'Parti' : stay.status === 'active' ? 'En cours' : stay.status,
        styles: { halign: 'center' },
      },
    ]),
    foot: [
      [
        { content: 'TOTAL', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
        {
          content: formatCurrencyPDF(params.stays.reduce((s, st) => s + (st.invoices?.total_amount || 0), 0)),
          styles: { halign: 'right', fontStyle: 'bold' },
        },
        {
          content: formatCurrencyPDF(params.stays.reduce((s, st) => s + (st.invoices?.amount_paid || 0), 0)),
          styles: { halign: 'right', fontStyle: 'bold' },
        },
        {
          content: formatCurrencyPDF(params.stays.reduce((s, st) => s + (st.invoices?.balance_due || 0), 0)),
          styles: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
        },
        { content: '' },
      ],
    ],
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 242, 245], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: (data) => addPageFooter(doc, params.hotel, pageWidth, pageHeight, data.pageNumber),
  });

  // Siestes section
  if (params.siestes.length > 0) {
    const siesteY = (doc as any).lastAutoTable.finalY + 10;
    if (siesteY > pageHeight - 50) {
      doc.addPage();
      addDossierPageHeader(doc, params.guest, params.hotel, pageWidth, 'SIESTES');
      const currentY = 45;

      autoTable(doc, {
        startY: currentY,
        head: [
          [
            { content: 'N°', styles: { halign: 'center', cellWidth: 10 } },
            { content: 'Date', styles: { halign: 'center', cellWidth: 25 } },
            { content: 'Chambre', styles: { halign: 'center', cellWidth: 20 } },
            { content: 'Arrivée', styles: { halign: 'center', cellWidth: 20 } },
            { content: 'Départ', styles: { halign: 'center', cellWidth: 20 } },
            { content: 'Durée', styles: { halign: 'center', cellWidth: 15 } },
            { content: 'Montant payé', styles: { halign: 'right', cellWidth: 30 } },
            { content: 'Mode paiement', styles: { halign: 'center', cellWidth: 30 } },
          ],
        ],
        body: params.siestes.map((sieste, i) => [
          { content: String(i + 1), styles: { halign: 'center' } },
          { content: formatDateFR(sieste.arrival_date), styles: { halign: 'center' } },
          { content: sieste.rooms?.room_number || '-', styles: { halign: 'center' } },
          { content: sieste.arrival_time || '-', styles: { halign: 'center' } },
          { content: sieste.departure_time || '-', styles: { halign: 'center' } },
          { content: sieste.duration_hours ? `${sieste.duration_hours}h` : '-', styles: { halign: 'center' } },
          { content: formatCurrencyPDF(sieste.amount_paid || 0), styles: { halign: 'right' } },
          { content: formatPaymentMethod(sieste.payment_method), styles: { halign: 'center' } },
        ]),
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: (data) => addPageFooter(doc, params.hotel, pageWidth, pageHeight, data.pageNumber),
      });
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(109, 40, 217);
      doc.setTextColor(255, 255, 255);
      doc.rect(14, siesteY, pageWidth - 28, 7, 'F');
      doc.text('SIESTES', 16, siesteY + 4.5);
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: siesteY + 10,
        head: [
          [
            { content: 'N°', styles: { halign: 'center', cellWidth: 10 } },
            { content: 'Date', styles: { halign: 'center', cellWidth: 25 } },
            { content: 'Chambre', styles: { halign: 'center', cellWidth: 20 } },
            { content: 'Arrivée', styles: { halign: 'center', cellWidth: 20 } },
            { content: 'Départ', styles: { halign: 'center', cellWidth: 20 } },
            { content: 'Durée', styles: { halign: 'center', cellWidth: 15 } },
            { content: 'Montant payé', styles: { halign: 'right', cellWidth: 30 } },
            { content: 'Mode paiement', styles: { halign: 'center', cellWidth: 30 } },
          ],
        ],
        body: params.siestes.map((sieste, i) => [
          { content: String(i + 1), styles: { halign: 'center' } },
          { content: formatDateFR(sieste.arrival_date), styles: { halign: 'center' } },
          { content: sieste.rooms?.room_number || '-', styles: { halign: 'center' } },
          { content: sieste.arrival_time || '-', styles: { halign: 'center' } },
          { content: sieste.departure_time || '-', styles: { halign: 'center' } },
          { content: sieste.duration_hours ? `${sieste.duration_hours}h` : '-', styles: { halign: 'center' } },
          { content: formatCurrencyPDF(sieste.amount_paid || 0), styles: { halign: 'right' } },
          { content: formatPaymentMethod(sieste.payment_method), styles: { halign: 'center' } },
        ]),
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: (data) => addPageFooter(doc, params.hotel, pageWidth, pageHeight, data.pageNumber),
      });
    }
  }

  // ========== PAGE 3+: INVOICE DETAILS ==========

  doc.addPage();
  addDossierPageHeader(doc, params.guest, params.hotel, pageWidth, 'DÉTAIL DES FACTURES / INVOICE DETAILS');

  let currentY = 45;
  params.stays.forEach((stay, stayIndex) => {
    if (!stay.invoices) return;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(59, 130, 246);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, currentY, pageWidth - 28, 8, 'F');
    doc.text(
      `Séjour ${stayIndex + 1} - Chambre ${stay.rooms?.room_number || '?'} - ${formatDateFR(
        stay.check_in_date
      )} au ${formatDateFR(stay.check_out_date)} - Facture ${stay.invoices.invoice_number}`,
      16,
      currentY + 5.5
    );
    doc.setTextColor(0, 0, 0);
    currentY += 10;

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          { content: 'Description', styles: { cellWidth: 80 } },
          { content: 'Type', styles: { halign: 'center', cellWidth: 25 } },
          { content: 'Qté', styles: { halign: 'center', cellWidth: 12 } },
          { content: 'P.U. (FCFA)', styles: { halign: 'right', cellWidth: 28 } },
          { content: 'Sous-total (FCFA)', styles: { halign: 'right', cellWidth: 30 } },
        ],
      ],
      body: [
        ...((stay.invoices.invoice_items || []).map((item: any) => [
          item.description,
          { content: formatItemType(item.item_type, item.description), styles: { halign: 'center' } },
          { content: String(item.quantity), styles: { halign: 'center' } },
          { content: formatCurrencyPDF(item.unit_price), styles: { halign: 'right' } },
          { content: formatCurrencyPDF(item.subtotal), styles: { halign: 'right' } },
        ])),
        [
          { content: 'Sous-total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatCurrencyPDF(stay.invoices.subtotal), styles: { halign: 'right', fontStyle: 'bold' } },
        ],
        ...(stay.invoices.tax_percentage > 0
          ? [
              [
                { content: `TVA (${stay.invoices.tax_percentage}%)`, colSpan: 4, styles: { halign: 'right' } },
                { content: formatCurrencyPDF(stay.invoices.tax_amount), styles: { halign: 'right' } },
              ],
            ]
          : []),
        [
          { content: 'TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 242, 245] } },
          { content: formatCurrencyPDF(stay.invoices.total_amount), styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 242, 245] } },
        ],
        [
          { content: 'Montant payé', colSpan: 4, styles: { halign: 'right', textColor: [16, 185, 129] } },
          { content: formatCurrencyPDF(stay.invoices.amount_paid), styles: { halign: 'right', textColor: [16, 185, 129] } },
        ],
        [
          {
            content: 'Solde restant',
            colSpan: 4,
            styles: {
              halign: 'right',
              textColor: stay.invoices.balance_due > 0 ? [220, 38, 38] : [16, 185, 129],
              fontStyle: 'bold',
            },
          },
          {
            content: formatCurrencyPDF(stay.invoices.balance_due),
            styles: {
              halign: 'right',
              textColor: stay.invoices.balance_due > 0 ? [220, 38, 38] : [16, 185, 129],
              fontStyle: 'bold',
            },
          },
        ],
      ],
      styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.2 },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        addPageFooter(doc, params.hotel, pageWidth, pageHeight, data.pageNumber);
        currentY = data.cursor?.y || currentY;
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    // Payment history
    const stayPayments = params.payments.filter((p) => p.invoice_id === stay.invoices?.id);
    if (stayPayments.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Paiements reçus:', 14, currentY);
      currentY += 4;
      
      stayPayments.forEach((payment) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(
          `- ${formatDateTimeFR(payment.created_at)} - ${formatCurrencyPDF(payment.amount)} - ${formatPaymentMethod(payment.payment_method)} - Par: ${payment.recorded_by_name || '-'}`,
          18,
          currentY
        );
        currentY += 5;
      });
    }

    currentY += 8;
    if (currentY > pageHeight - 40) {
      doc.addPage();
      addDossierPageHeader(doc, params.guest, params.hotel, pageWidth, 'DÉTAIL DES FACTURES (suite)');
      currentY = 45;
    }
  });

  // ========== FINAL PAGE: SUMMARY ==========

  doc.addPage();
  addDossierPageHeader(doc, params.guest, params.hotel, pageWidth, 'RÉSUMÉ FINANCIER / FINANCIAL SUMMARY');

  let summaryY = 50;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(14, summaryY, pageWidth - 28, 25, 3, 3, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('VALEUR TOTALE CLIENT / TOTAL CUSTOMER VALUE', pageWidth / 2, summaryY + 9, { align: 'center' });
  doc.setFontSize(18);
  doc.text(formatCurrencyPDF(totalPaid), pageWidth / 2, summaryY + 20, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  summaryY += 32;

  autoTable(doc, {
    startY: summaryY,
    head: [['Indicateur', 'Valeur']],
    body: [
      ['Nombre de séjours (nuits)', String(totalStays)],
      ['Nombre de siestes', String(totalSiestes)],
      ['Total nuits passées', String(totalNights)],
      ['Première visite', firstVisit ? formatDateFR(firstVisit.check_in_date || firstVisit.arrival_date) : '-'],
      ['Dernière visite', params.stays.length > 0 ? formatDateFR(params.stays[0].check_in_date) : '-'],
      ['Total facturé', formatCurrencyPDF(params.stays.reduce((s, st) => s + (st.invoices?.total_amount || 0), 0))],
      ['Total payé', formatCurrencyPDF(totalPaid)],
      ['Solde restant', formatCurrencyPDF(params.stays.reduce((s, st) => s + (st.invoices?.balance_due || 0), 0))],
      ['Catégorie préférée', getMostUsedCategory(params.stays)],
      ['Mode de paiement préféré', getMostUsedPaymentMethod(params.payments)],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle: 'bold', textColor: [51, 65, 85] }, 1: { halign: 'right' } },
    didDrawPage: (data) => addPageFooter(doc, params.hotel, pageWidth, pageHeight, data.pageNumber),
  });

  const lastY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text(`Document généré le ${formatDateTimeFR(new Date())} par ${params.generatedBy} - HotelManager Pro`, pageWidth / 2, lastY, {
    align: 'center',
  });
  doc.text('Document confidentiel - Usage interne uniquement', pageWidth / 2, lastY + 5, { align: 'center' });

  addPageFooter(doc, params.hotel, pageWidth, pageHeight, doc.getNumberOfPages());

  const filename = `dossier-client-${(params.guest.last_name || '').toLowerCase()}-${(params.guest.first_name || '').toLowerCase()}-${new Date()
    .toISOString()
    .split('T')[0]}.pdf`;
  doc.save(filename);
}

// ============================================================================
// POLICE FORM GENERATION
// ============================================================================

export const generateFicheDePolice = (hotel: any, guest: any, stay?: any) => {
  const doc = new jsPDF();
  let y = addHeader(doc, hotel, 'FICHE DE RENSEIGNEMENTS');

  const fields = [
    ['Nom', guest.last_name || ''],
    ['Nom de jeune fille', guest.maiden_name || ''],
    ['Prénom', guest.first_name || ''],
    ['Date de naissance', formatDateFR(guest.date_of_birth)],
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
    ['Délivré le', formatDateFR(guest.id_issued_on)],
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
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
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
      body: [
        [
          stay.rooms?.room_number || '-',
          formatDateFR(stay.check_in_date),
          formatDateFR(stay.check_out_date),
          String(stay.number_of_nights || '-'),
          formatCurrencyPDF(stay.total_price),
          stay.receptionist_name || '-',
        ],
      ],
      theme: 'grid',
      styles: { fontSize: 9 },
    });
  }

  y += 40;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(10);
  doc.text('Signature du client:', 25, y);
  doc.rect(25, y + 3, 70, 25);
  doc.text('Signature du réceptionniste:', 115, y);
  doc.rect(115, y + 3, 70, 25);

  addFooter(doc);
  doc.save(`fiche-${guest.last_name}-${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================================
// PAYMENT RECEIPT GENERATION
// ============================================================================

export const generateReceipt = (hotel: any, payment: any, invoice: any, guestName: string) => {
  const doc = new jsPDF();
  let y = addHeader(doc, hotel, 'REÇU DE PAIEMENT');

  doc.setFontSize(11);
  const lines = [
    ['Date', formatDateTimeFR(payment.created_at)],
    ['Client', guestName],
    ['N° Facture', invoice.invoice_number],
    ['Mode de paiement', formatPaymentMethod(payment.payment_method || 'Cash')],
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
  doc.text(formatCurrencyPDF(payment.amount), 105, y, { align: 'center' });

  y += 15;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Reçu par: ${payment.created_by_name || '-'}`, 30, y);

  addFooter(doc);
  doc.save(`recu-${invoice.invoice_number}-${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================================
// INVOICE GENERATION
// ============================================================================

export const generateInvoicePDF = (
  hotel: any,
  invoice: any,
  items: any[],
  payments: any[],
  guestName: string
) => {
  const doc = new jsPDF();
  let y = addHeader(doc, hotel, 'FACTURE');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`N° ${invoice.invoice_number}`, 30, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDateFR(invoice.created_at)}`, 140, y);
  y += 8;
  doc.text(`Client: ${guestName}`, 30, y);
  y += 10;

  const mainItems = items.filter((i) => i.item_type !== 'tax');
  const taxItems = items.filter((i) => i.item_type === 'tax');

  // Main items table
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Type', 'Qté', 'P.U.', 'Sous-total']],
    body: mainItems.map((i) => [
      i.description,
      formatItemType(i.item_type, i.description),
      String(i.quantity || 1),
      formatCurrencyPDF(i.unit_price),
      formatCurrencyPDF(i.subtotal),
    ]),
    theme: 'striped',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // Taxes section
  if (taxItems.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(245, 245, 245);
    doc.rect(20, y, 170, 7, 'F');
    doc.text('Taxes & Frais obligatoires', 25, y + 5);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [['Description', 'Qté', 'P.U.', 'Sous-total']],
      body: taxItems.map((i) => [
        i.description,
        String(i.quantity || 1),
        formatCurrencyPDF(i.unit_price),
        formatCurrencyPDF(i.subtotal),
      ]),
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [100, 100, 100] },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  doc.setFontSize(11);
  doc.text(`Sous-total: ${formatCurrencyPDF(invoice.subtotal)}`, 140, y);
  y += 6;
  doc.text(`Taxes: ${formatCurrencyPDF(invoice.tax_amount)}`, 140, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAL: ${formatCurrencyPDF(invoice.total_amount)}`, 140, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Payé: ${formatCurrencyPDF(invoice.amount_paid)}`, 140, y);
  y += 6;
  const balance = invoice.balance_due || 0;
  doc.setFont('helvetica', 'bold');
  doc.text(`Solde: ${formatCurrencyPDF(balance)}`, 140, y);

  // Payments history
  if (payments.length > 0) {
    y += 15;
    doc.setFontSize(12);
    doc.text('Historique des paiements', 30, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Montant', 'Mode', 'Référence']],
      body: payments.map((p) => [
        formatDateTimeFR(p.created_at),
        formatCurrencyPDF(p.amount),
        formatPaymentMethod(p.payment_method || '-'),
        p.reference_number || '-',
      ]),
      theme: 'grid',
      styles: { fontSize: 9 },
    });
  }

  addFooter(doc);
  doc.save(`facture-${invoice.invoice_number}-${guestName.replace(/\s+/g, '-')}.pdf`);
};

// ============================================================================
// REPORTS GENERATION
// ============================================================================

type ReportData = {
  summary: {
    occupancyRate: number;
    totalCheckIns: number;
    totalRevenue: number;
    totalPaid: number;
    totalExpenses: number;
    netProfit: number;
    restaurantRevenue: number;
  };
  topRooms?: Array<{ room_number: string; stays: number; nights: number }>;
  topFoodItems?: Array<{ name: string; count: number; revenue: number }>;
  topGuests?: Array<{ name: string; tier: string; loyalty_points: number; total: number }>;
};

const renderReportPdf = (
  hotel: any,
  title: string,
  periodLabel: string,
  data: ReportData,
  filePrefix: string
) => {
  const doc = new jsPDF();
  let y = addHeader(doc, hotel, title);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Période: ${periodLabel}`, 20, y);
  y += 6;
  doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 20, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Indicateur', 'Valeur']],
    body: [
      ['Taux occupation', `${data.summary.occupancyRate}%`],
      ['Check-ins', String(data.summary.totalCheckIns)],
      ['Revenu total', formatCurrencyPDF(data.summary.totalRevenue)],
      ['Montant payé', formatCurrencyPDF(data.summary.totalPaid)],
      ['Dépenses', formatCurrencyPDF(data.summary.totalExpenses)],
      ['Profit net', formatCurrencyPDF(data.summary.netProfit)],
      ['CA restaurant', formatCurrencyPDF(data.summary.restaurantRevenue)],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  if ((data.topRooms || []).length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Top chambres', 20, y);
    autoTable(doc, {
      startY: y + 2,
      head: [['Chambre', 'Séjours', 'Nuits']],
      body: (data.topRooms || [])
        .slice(0, 10)
        .map((r) => [r.room_number, String(r.stays), String(r.nights)]),
      theme: 'striped',
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if ((data.topFoodItems || []).length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Top produits / plats', 20, y);
    autoTable(doc, {
      startY: y + 2,
      head: [['Article', 'Qté', 'CA']],
      body: (data.topFoodItems || [])
        .slice(0, 10)
        .map((r) => [r.name, String(r.count), formatCurrencyPDF(r.revenue)]),
      theme: 'striped',
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [16, 185, 129] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if ((data.topGuests || []).length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Top clients (dépenses)', 20, y);
    autoTable(doc, {
      startY: y + 2,
      head: [['Client', 'Niveau', 'Points', 'Dépenses']],
      body: (data.topGuests || [])
        .slice(0, 10)
        .map((g) => [g.name, g.tier, String(g.loyalty_points || 0), formatCurrencyPDF(g.total)]),
      theme: 'striped',
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [245, 158, 11] },
    });
  }

  addFooter(doc);
  const dateKey = new Date().toISOString().split('T')[0];
  doc.save(`${filePrefix}-${dateKey}.pdf`);
};

export const generateWeeklyReport = (
  hotel: any,
  dateRange: { start: string; end: string },
  data: ReportData
) => {
  renderReportPdf(
    hotel,
    'RAPPORT HEBDOMADAIRE',
    `${formatDate(dateRange.start)} au ${formatDate(dateRange.end)}`,
    data,
    'rapport-hebdomadaire'
  );
};

export const generateDailyReport = (hotel: any, dateRange: { start: string; end: string }, data: ReportData) => {
  renderReportPdf(
    hotel,
    'RAPPORT JOURNALIER',
    `${formatDate(dateRange.start)}`,
    data,
    'rapport-journalier'
  );
};

export const generateMonthlyReport = (
  hotel: any,
  dateRange: { start: string; end: string },
  data: ReportData
) => {
  renderReportPdf(
    hotel,
    'RAPPORT MENSUEL',
    `${formatDate(dateRange.start)} au ${formatDate(dateRange.end)}`,
    data,
    'rapport-mensuel'
  );
};