import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHotel } from '@/contexts/HotelContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, ExternalLink, BedDouble, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const bookingUrl = `${baseUrl}/booking/${hotel?.slug}`;

  return (
    <div className="page-container space-y-6">
      <PageHeader title="QR Codes" subtitle="Générez des QR codes pour chaque chambre et le portail de réservation" />

      {/* Booking portal QR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Portail de réservation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <QRCodeSVG value={bookingUrl} size={200} />
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1">
            {bookingUrl}<ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      {/* Per-room QR codes */}
      <h2 className="text-lg font-semibold">QR Codes par chambre (menu & services)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {rooms?.map(room => {
          const menuUrl = `${baseUrl}/menu/${hotel?.slug}/${room.room_number}`;
          return (
            <Card key={room.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BedDouble className="h-4 w-4" />Chambre {room.room_number}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-3">
                <QRCodeSVG value={menuUrl} size={140} />
                <a href={menuUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 truncate max-w-full">
                  Menu & Services<ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default QRCodesPage;
