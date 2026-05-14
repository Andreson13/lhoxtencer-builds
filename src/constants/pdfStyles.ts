// PDF styling constants for consistent branding and appearance

export const PDF_COLORS = {
  NAVY: [15, 23, 42] as const,
  SLATE: [51, 65, 85] as const,
  GRAY_DARK: [120, 120, 120] as const,
  GRAY_MID: [80, 80, 80] as const,
  GRAY_LIGHT: [200, 200, 200] as const,
  WHITE: [255, 255, 255] as const,
  ALT_ROW: [245, 247, 250] as const,
  PURPLE: [109, 40, 217] as const,
  GREEN: [16, 185, 129] as const,
  RED: [220, 38, 38] as const,
  ORANGE: [251, 146, 60] as const,
};

export const PDF_DIMENSIONS = {
  LOGO_WIDTH: 25,
  LOGO_HEIGHT: 25,
  MARGIN_LEFT: 14,
  MARGIN_RIGHT: 14,
  MARGIN_TOP: 10,
  MARGIN_BOTTOM: 10,
  PAGE_HEIGHT: 297,
  PAGE_WIDTH: 210,
  HEADER_HEIGHT: 50,
  FOOTER_HEIGHT: 20,
  LINE_HEIGHT: 7,
};

export const PDF_TEXT = {
  FOOTER_BRAND: 'Lhoxtencer',
  APP_NAME: 'HotelManager Pro',
};

export const PDF_STYLES = {
  header: {
    fillColor: PDF_COLORS.NAVY,
    textColor: PDF_COLORS.WHITE,
    fontSize: 11,
    fontStyle: 'bold',
    halign: 'center',
    padding: 4,
  },
  subheader: {
    fillColor: PDF_COLORS.SLATE,
    textColor: PDF_COLORS.WHITE,
    fontSize: 9,
    fontStyle: 'bold',
    halign: 'left',
    padding: 3,
  },
  body: {
    fontSize: 8,
    cellPadding: 2,
    lineColor: PDF_COLORS.GRAY_LIGHT,
    textColor: PDF_COLORS.SLATE,
  },
  alternateRow: {
    fillColor: PDF_COLORS.ALT_ROW,
  },
  total: {
    fillColor: PDF_COLORS.SLATE,
    textColor: PDF_COLORS.WHITE,
    fontStyle: 'bold',
    fontSize: 9,
  },
  error: {
    textColor: PDF_COLORS.RED,
  },
  success: {
    textColor: PDF_COLORS.GREEN,
  },
};

export const PDF_TABLE_STYLES = {
  striped: {
    fontSize: 7.5,
    cellPadding: 2,
    lineColor: [200, 200, 200],
    textColor: [51, 51, 51],
  },
  headStyles: {
    fillColor: PDF_COLORS.NAVY,
    textColor: PDF_COLORS.WHITE,
    fontSize: 7,
    fontStyle: 'bold',
  },
  alternateRowStyles: {
    fillColor: PDF_COLORS.ALT_ROW,
  },
  footStyles: {
    fillColor: PDF_COLORS.SLATE,
    textColor: PDF_COLORS.WHITE,
    fontStyle: 'bold',
    fontSize: 8,
  },
};
