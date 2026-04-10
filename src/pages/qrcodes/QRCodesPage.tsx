import React from 'react';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, ExternalLink } from 'lucide-react';

const QRCodesPage = () => {
  useRoleGuard(['admin', 'manager']);
  const { hotel } = useHotel();

  const baseUrl = window.location.origin;
  const bookingUrl = `${baseUrl}/booking/${hotel?.slug}`;
  const menuUrl = `${baseUrl}/menu/${hotel?.slug}`;

  return (
    <div className="page-container space-y-6">
      <PageHeader title="QR Codes" subtitle="Générez des QR codes pour vos services" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />Portail de réservation</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <QRCodeSVG value={bookingUrl} size={200} />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Scannez pour accéder au portail de réservation</p>
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 justify-center mt-1">
                {bookingUrl}<ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />Menu QR</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <QRCodeSVG value={menuUrl} size={200} />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Scannez pour accéder au menu et services</p>
              <a href={menuUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 justify-center mt-1">
                {menuUrl}<ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QRCodesPage;
