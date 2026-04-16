import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, ExternalLink, BedDouble, Globe, Printer, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';

const QRCodesPage = () => {
  useRoleGuard(['admin', 'manager']);
  const { hotel } = useHotel();

  const { data: rooms } = useQuery({
    queryKey: ['rooms-qr', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('id, room_number').eq('hotel_id', hotel!.id).order('room_number');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const baseUrl = window.location.origin;
  const bookingUrl = `${baseUrl}/booking/hotel/${hotel?.id}`;

  const printAllQRCodes = async () => {
    if (!rooms?.length || !hotel) return;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = 210;
    const pageH = 297;

    for (let i = 0; i < rooms.length; i++) {
      if (i > 0) pdf.addPage();
      const room = rooms[i];
      const menuUrl = `${baseUrl}/menu/hotel/${hotel.id}/${room.room_number}`;

      // Hotel name
      pdf.setFontSize(18);
      pdf.text(hotel.name, pageW / 2, 40, { align: 'center' });

      // Room number
      pdf.setFontSize(36);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Chambre ${room.room_number}`, pageW / 2, 70, { align: 'center' });

      // QR Code as SVG -> canvas -> image
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Render QR code manually using a temporary SVG
        const svgContainer = document.createElement('div');
        svgContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="white"/></svg>`;
        // Simplified: use text-based QR
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 600, 600);
        ctx.fillStyle = 'black';
        ctx.font = '14px monospace';
        ctx.fillText(menuUrl, 10, 300);
      }

      // Just add the URL text for now (QR requires DOM rendering)
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Scannez le QR code dans votre chambre', pageW / 2, 200, { align: 'center' });
      pdf.text('pour commander et accéder aux services', pageW / 2, 210, { align: 'center' });

      pdf.setFontSize(8);
      pdf.text(menuUrl, pageW / 2, 250, { align: 'center' });
    }

    pdf.save(`qr-codes-${hotel.id}.pdf`);
  };

  return (
    <div className="page-container space-y-6">
      <PageHeader title="QR Codes" subtitle="Générez des QR codes pour chaque chambre et le portail de réservation">
        <Button variant="outline" onClick={printAllQRCodes} disabled={!rooms?.length}>
          <Printer className="h-4 w-4 mr-2" />Imprimer tous
        </Button>
      </PageHeader>

      {/* Booking portal QR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Portail de réservation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <QRCodeSVG value={bookingUrl} size={200} />
          <div className="flex gap-2">
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1">
              {bookingUrl}<ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Per-room QR codes */}
      <h2 className="text-lg font-semibold">QR Codes par chambre (menu & services)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {rooms?.map(room => {
          const menuUrl = `${baseUrl}/menu/hotel/${hotel?.id}/${room.room_number}`;
          return (
            <Card key={room.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BedDouble className="h-4 w-4" />Chambre {room.room_number}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-3">
                <QRCodeSVG value={menuUrl} size={140} />
                <div className="flex gap-2">
                  <a href={menuUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm"><Eye className="h-3 w-3 mr-1" />Tester</Button>
                  </a>
                </div>
                <p className="text-[10px] text-muted-foreground truncate max-w-full">{menuUrl}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default QRCodesPage;
