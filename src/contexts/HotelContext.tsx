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
  managedHotels: Hotel[];
  loading: boolean;
  refreshHotel: () => Promise<void>;
  switchHotel: (hotelId: string) => Promise<void>;
}

const HotelContext = createContext<HotelContextType>({
  hotel: null,
  managedHotels: [],
  loading: true,
  refreshHotel: async () => {},
  switchHotel: async () => {},
});

export const HotelProvider = ({ children }: { children: ReactNode }) => {
  const { profile, refreshProfile } = useAuth();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [managedHotels, setManagedHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHotel = async (hotelId: string) => {
    const { data } = await supabase
      .from('hotels')
      .select('*')
      .eq('id', hotelId)
      .single();
    if (data) setHotel(data as unknown as Hotel);
  };

  const fetchManagedHotels = async (userId: string, currentHotelId: string | null, isSuperAdmin: boolean) => {
    if (isSuperAdmin) {
      const { data: allHotels, error: allHotelsError } = await supabase
        .from('hotels')
        .select('*')
        .order('name', { ascending: true });

      if (allHotelsError) throw allHotelsError;
      setManagedHotels((allHotels || []) as unknown as Hotel[]);
      return;
    }

    try {
      const { data: memberships, error: membershipsError } = await (supabase as any)
        .from('hotel_memberships')
        .select('hotel_id')
        .eq('user_id', userId);

      if (membershipsError) {
        throw membershipsError;
      }

      const membershipHotelIds = (memberships || [])
        .map((row: any) => row.hotel_id)
        .filter((value: any) => typeof value === 'string');

      const uniqueHotelIds = Array.from(new Set([
        ...membershipHotelIds,
        ...(currentHotelId ? [currentHotelId] : []),
      ]));

      if (uniqueHotelIds.length === 0) {
        setManagedHotels([]);
        return;
      }

      const { data: hotelsData, error: hotelsError } = await supabase
        .from('hotels')
        .select('*')
        .in('id', uniqueHotelIds as string[]);

      if (hotelsError) throw hotelsError;
      setManagedHotels((hotelsData || []) as unknown as Hotel[]);
    } catch {
      // If migration is not applied yet, fall back to current profile hotel only.
      if (!currentHotelId) {
        setManagedHotels([]);
        return;
      }

      const { data } = await supabase
        .from('hotels')
        .select('*')
        .eq('id', currentHotelId)
        .single();

      setManagedHotels(data ? [data as unknown as Hotel] : []);
    }
  };

  useEffect(() => {
    const syncHotelContext = async () => {
      setLoading(true);

      if (!profile?.id) {
        setHotel(null);
        setManagedHotels([]);
        setLoading(false);
        return;
      }

      await fetchManagedHotels(profile.id, profile.hotel_id || null, Boolean(profile.is_super_admin));

      if (profile.hotel_id) {
        await fetchHotel(profile.hotel_id);
      } else {
        setHotel(null);
      }

      setLoading(false);
    };

    syncHotelContext().catch(() => {
      setHotel(null);
      setManagedHotels([]);
      setLoading(false);
    });
  }, [profile?.id, profile?.hotel_id]);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`hotel-memberships-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hotel_memberships',
          filter: `user_id=eq.${profile.id}`,
        },
        async () => {
          await fetchManagedHotels(profile.id, profile.hotel_id || null, Boolean(profile.is_super_admin));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.hotel_id, profile?.is_super_admin]);

  const refreshHotel = async () => {
    if (!profile?.id) return;
    setLoading(true);
    await fetchManagedHotels(profile.id, profile.hotel_id || null, Boolean(profile.is_super_admin));
    if (profile.hotel_id) {
      await fetchHotel(profile.hotel_id);
    } else {
      setHotel(null);
    }
    setLoading(false);
  };

  const switchHotel = async (hotelId: string) => {
    if (!profile?.id) return;

    if (!profile.is_super_admin && !managedHotels.some((managedHotel) => managedHotel.id === hotelId)) {
      throw new Error('Vous n\'avez pas accès à cet hôtel');
    }

    let nextRole = profile.role;
    let nextOwner = profile.is_hotel_owner;

    try {
      const { data: membership } = await (supabase as any)
        .from('hotel_memberships')
        .select('role, is_hotel_owner')
        .eq('user_id', profile.id)
        .eq('hotel_id', hotelId)
        .maybeSingle();

      if (membership?.role) nextRole = membership.role;
      if (membership && typeof membership.is_hotel_owner === 'boolean') {
        nextOwner = membership.is_hotel_owner;
      }
    } catch {
      // Ignore memberships lookup failures (e.g. migration not yet applied) and keep current profile role.
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        hotel_id: hotelId,
        role: nextRole,
        is_hotel_owner: nextOwner,
      } as any)
      .eq('id', profile.id);

    if (error) throw error;
    await refreshProfile();
  };

  return (
    <HotelContext.Provider value={{ hotel, managedHotels, loading, refreshHotel, switchHotel }}>
      {children}
    </HotelContext.Provider>
  );
};

export const useHotel = () => useContext(HotelContext);
