import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export interface Hotel {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  currency: string;
  timezone: string;
  subscription_plan: string;
  subscription_status: string;
  sieste_default_duration_hours: number;
  sieste_overtime_rate_per_hour: number;
}

interface HotelContextType {
  hotel: Hotel | null;
  loading: boolean;
  refreshHotel: () => Promise<void>;
}

const HotelContext = createContext<HotelContextType>({
  hotel: null,
  loading: true,
  refreshHotel: async () => {},
});

export const HotelProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHotel = async (hotelId: string) => {
    const { data } = await supabase
      .from('hotels')
      .select('*')
      .eq('id', hotelId)
      .single();
    if (data) setHotel(data as unknown as Hotel);
    setLoading(false);
  };

  useEffect(() => {
    if (profile?.hotel_id) {
      fetchHotel(profile.hotel_id);
    } else {
      setHotel(null);
      setLoading(false);
    }
  }, [profile?.hotel_id]);

  const refreshHotel = async () => {
    if (profile?.hotel_id) await fetchHotel(profile.hotel_id);
  };

  return (
    <HotelContext.Provider value={{ hotel, loading, refreshHotel }}>
      {children}
    </HotelContext.Provider>
  );
};

export const useHotel = () => useContext(HotelContext);
