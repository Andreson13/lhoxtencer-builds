import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Colors: Navy & Gold luxury aesthetic
const NAVY = '#0B1A2E';
const GOLD = '#C9A84C';
const LIGHT_GRAY = '#F5F5F5';
const TEXT_COLOR = '#333333';

// Format currency properly
const formatCurrency = (value: string | number): string => {
  if (typeof value === 'string' && value.includes('FCFA')) return value;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num) + ' FCFA';
};

interface ClientData {
  id?: string;
  last_name?: string;
  first_name?: string;
  phone?: string;
  email?: string;
  nationality?: string;
  total?: number;
  amount?: number;
  [key: string]: any;
}

export const generateClientDossierPDF = async (
  data: ClientData[] | any[] | Array<{ sheetName: string; data: any[] }>,
  filename: string,
  title: string
): Promise<void> => {
  try {
    // Use A4 size for professional documents
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;

    const isMultiSheet = Array.isArray(data) && data.length > 0 && 'sheetName' in data[0];

    if (isMultiSheet) {
      // Handle multi-sheet export
      const sheets = data as Array<{ sheetName: string; data: any[] }>;

      sheets.forEach((sheet, sheetIndex) => {
        if (sheetIndex > 0) {
          pdf.addPage();
        }

        let yPosition = margin;

        // Header with luxury styling
        pdf.setFillColor(11, 26, 46); // NAVY
        pdf.rect(0, 0, pageWidth, 30, 'F');

        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.setTextColor(201, 168, 76); // GOLD
        pdf.text('HOTEL HARMONY', pageWidth / 2, 12, { align: 'center' });

        pdf.setFontSize(10);
        pdf.setTextColor(201, 168, 76);
        pdf.text('Export Data Report', pageWidth / 2, 22, { align: 'center' });

        yPosition = 45;

        // Title
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(11, 26, 46); // NAVY
        pdf.text(`${sheet.sheetName.toUpperCase()}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;

        if (sheet.data.length > 0) {
          const allKeys = new Set<string>();
          sheet.data.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));

          const displayKeys = Array.from(allKeys).filter(k =>
            !k.includes('id') &&
            !k.includes('hotel') &&
            !k.includes('created_at') &&
            !k.includes('updated_at')
          ).slice(0, 8);

          const headers = displayKeys.map(k =>
            k.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          );

          const tableData = sheet.data.map(row =>
            displayKeys.map(key => {
              const value = row[key];
              if (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('price'))) {
                return formatCurrency(value);
              }
              if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
                return new Date(value).toLocaleDateString('fr-FR');
              }
              return String(value || '—').substring(0, 50);
            })
          );

          (pdf as any).autoTable({
            head: [headers],
            body: tableData,
            startY: yPosition,
            margin: margin,
            theme: 'grid',
            headStyles: {
              fillColor: [11, 26, 46], // NAVY
              textColor: [201, 168, 76], // GOLD
              fontStyle: 'bold',
              fontSize: 9,
              cellPadding: 5,
            },
            bodyStyles: {
              textColor: [51, 51, 51],
              fontSize: 8,
              cellPadding: 4,
            },
            alternateRowStyles: {
              fillColor: [245, 245, 245], // LIGHT_GRAY
            },
            columnStyles: {
              ...displayKeys.reduce((acc, key, i) => {
                if (key.includes('amount') || key.includes('total') || key.includes('price') || key.includes('count')) {
                  acc[i] = { halign: 'right' };
                }
                return acc;
              }, {} as any),
            },
            didDrawPage: () => {
              pdf.setFont('Helvetica', 'normal');
              pdf.setFontSize(8);
              pdf.setTextColor(153, 153, 153);

              pdf.text(
                `Page ${sheetIndex + 1}`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
              );
            },
          });
        } else {
          pdf.setFontSize(10);
          pdf.text('Aucune donnée disponible', pageWidth / 2, yPosition + 20, { align: 'center' });
        }
      });
    } else {
      // Handle single sheet export
      const rows = data as ClientData[];

      let yPosition = margin;

      // Header with luxury styling
      pdf.setFillColor(11, 26, 46); // NAVY
      pdf.rect(0, 0, pageWidth, 30, 'F');

      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(201, 168, 76); // GOLD
      pdf.text('HOTEL HARMONY', pageWidth / 2, 12, { align: 'center' });

      pdf.setFontSize(10);
      pdf.setTextColor(201, 168, 76);
      pdf.text('Export Data Report', pageWidth / 2, 22, { align: 'center' });

      yPosition = 45;

      // Title
      pdf.setFont('Helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(11, 26, 46); // NAVY
      pdf.text(`${title.toUpperCase()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Client info (if available)
      if (rows.length > 0 && rows[0].last_name) {
        const client = rows[0];
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(11, 26, 46);
        const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
        pdf.text(clientName || 'Client', margin, yPosition);
        yPosition += 10;

        // Personal Info Section
        pdf.setFont('Helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(11, 26, 46);
        pdf.text('INFORMATIONS PERSONNELLES', margin, yPosition);
        yPosition += 8;

        pdf.setFont('Helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(51, 51, 51);

        const personalInfo = [
          [`Téléphone: ${client.phone || '—'}`, `Email: ${client.email || '—'}`],
          [`Nationalité: ${client.nationality || '—'}`, `Créé le: ${client.created_at ? new Date(client.created_at).toLocaleDateString('fr-FR') : '—'}`],
        ];

        personalInfo.forEach(row => {
          pdf.text(row[0], margin, yPosition);
          pdf.text(row[1], pageWidth / 2, yPosition);
          yPosition += 6;
        });

        yPosition += 5;
      }

      if (rows.length > 0) {
        const allKeys = new Set<string>();
        rows.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));

        const displayKeys = Array.from(allKeys).filter(k =>
          !k.includes('id') &&
          !k.includes('hotel') &&
          !k.includes('created_at') &&
          !k.includes('updated_at')
        ).slice(0, 8);

        const headers = displayKeys.map(k =>
          k.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        );

        const tableData = rows.map(row =>
          displayKeys.map(key => {
            const value = row[key];
            if (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('price'))) {
              return formatCurrency(value);
            }
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
              return new Date(value).toLocaleDateString('fr-FR');
            }
            return String(value || '—').substring(0, 50);
          })
        );

        (pdf as any).autoTable({
          head: [headers],
          body: tableData,
          startY: yPosition,
          margin: margin,
          theme: 'grid',
          headStyles: {
            fillColor: [11, 26, 46], // NAVY
            textColor: [201, 168, 76], // GOLD
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 5,
          },
          bodyStyles: {
            textColor: [51, 51, 51],
            fontSize: 8,
            cellPadding: 4,
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245], // LIGHT_GRAY
          },
          columnStyles: {
            ...displayKeys.reduce((acc, key, i) => {
              if (key.includes('amount') || key.includes('total') || key.includes('price') || key.includes('count')) {
                acc[i] = { halign: 'right' };
              }
              return acc;
            }, {} as any),
          },
          didDrawPage: () => {
            pdf.setFont('Helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(153, 153, 153);

            pdf.text(
              `Document généré le ${new Date().toLocaleDateString('fr-FR')} — HotelManager Pro`,
              pageWidth / 2,
              pageHeight - 10,
              { align: 'center' }
            );
          },
        });
      } else {
        pdf.setFontSize(10);
        pdf.text('Aucune donnée disponible', pageWidth / 2, yPosition + 20, { align: 'center' });
      }
    }

    // Add bottom footer with gold accent
    pdf.setDrawColor(201, 168, 76); // GOLD
    pdf.setLineWidth(0.5);
    pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);

    pdf.setFont('Helvetica', 'italic');
    pdf.setFontSize(7);
    pdf.setTextColor(153, 153, 153);
    pdf.text('Document confidentiel — Usage interne uniquement', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Save the PDF
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Erreur lors de la génération du PDF');
  }
};

export default generateClientDossierPDF;
