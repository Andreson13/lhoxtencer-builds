import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useI18n } from '@/contexts/I18nContext';
import { supabase } from '@/integrations/supabase/client';
import { generateReservationNumber, formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Check,
  Users,
  Wifi,
  Tv,
  Wind,
  Utensils,
  Car,
  ShieldCheck,
  Sparkles,
  Sunrise,
  ArrowRight,
  Star,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ExternalLink,
  Navigation,
  Copy,
  X,
  Footprints,
  Bus,
  Award,
} from 'lucide-react';
import './BookingPortalPage.css';

const featureIcons: Record<string, any> = { WiFi: Wifi, TV: Tv, AC: Wind };

const BookingPortalPage = () => {
  const { t, setLang, lang } = useI18n();
  const { slug, hotelId } = useParams<{ slug?: string; hotelId?: string }>();

  console.log('BookingPortalPage mounted', { slug, hotelId, hotelKey: slug || hotelId });

  useEffect(() => {
    setLang('fr');
  }, [setLang]);

  const hotelKey = slug || hotelId;
  const [submitted, setSubmitted] = useState(false);
  const [resNumber, setResNumber] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [pinOpen, setPinOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [travelMode, setTravelMode] = useState<'driving' | 'walking' | 'transit'>('driving');

  const [form, setForm] = useState({
    guest_name: '', guest_phone: '', guest_email: '',
    check_in_date: '', check_out_date: '',
    number_of_adults: 1, number_of_children: 0,
    special_requests: '',
    payment_cash: false, payment_momo: false, payment_om: false,
  });

  const { data: hotel } = useQuery({
    queryKey: ['hotel-public', hotelKey],
    queryFn: async () => {
      const identifier = slug || hotelId;
      if (!identifier) return null;

      const { data: bySlug } = await supabase.from('hotels').select('*').eq('slug', identifier).maybeSingle();
      if (bySlug) return bySlug;

      const { data: byId } = await supabase.from('hotels').select('*').eq('id', identifier).maybeSingle();
      return byId;
    },
    enabled: !!hotelKey,
  });

  const { data: categories } = useQuery({
    queryKey: ['room-categories-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('room_categories').select('*').eq('hotel_id', hotel!.id).eq('portal_visible', true).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: roomCounts } = useQuery({
    queryKey: ['room-counts-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('category_id, status').eq('hotel_id', hotel!.id);
      const counts: Record<string, number> = {};
      (data || []).forEach(r => {
        if (r.status === 'available' && r.category_id) {
          counts[r.category_id] = (counts[r.category_id] || 0) + 1;
        }
      });
      return counts;
    },
    enabled: !!hotel?.id,
  });

  const { data: services } = useQuery({
    queryKey: ['services-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('hotel_services').select('*').eq('hotel_id', hotel!.id);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: photos } = useQuery({
    queryKey: ['photos-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase.from('hotel_photos').select('*').eq('hotel_id', hotel!.id).order('display_order');
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const { data: reservationStats } = useQuery({
    queryKey: ['reservation-stats-public', hotel?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('status, check_in_date')
        .eq('hotel_id', hotel!.id);
      return data || [];
    },
    enabled: !!hotel?.id,
  });

  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);
  const nights = form.check_in_date && form.check_out_date ? Math.max(1, Math.ceil((new Date(form.check_out_date).getTime() - new Date(form.check_in_date).getTime()) / 86400000)) : 0;
  const total = nights * (selectedCategory?.price_per_night || 0);

  const allPortalPhotos = photos?.length ? photos : [];

  const categoryPhotos = useMemo(() => {
    if (!selectedCategoryId) return [] as any[];
    return allPortalPhotos.filter((p: any) => p.category_id === selectedCategoryId);
  }, [allPortalPhotos, selectedCategoryId]);

  const portalPhotos = categoryPhotos.length ? categoryPhotos : allPortalPhotos;
  const coverPhoto = portalPhotos[heroIndex]?.url || portalPhotos[0]?.url || allPortalPhotos[0]?.url || '';

  const galleryPhotos = useMemo(() => {
    if (!allPortalPhotos.length) return [] as any[];
    const prioritized = [...portalPhotos];
    if (prioritized.length >= 6) return prioritized.slice(0, 6);

    const used = new Set(prioritized.map((p: any) => p.id));
    const fill = allPortalPhotos.filter((p: any) => !used.has(p.id));
    return [...prioritized, ...fill].slice(0, 6);
  }, [allPortalPhotos, portalPhotos]);

  const categoryPhotoById = useMemo(() => {
    const map: Record<string, string> = {};
    if (!categories?.length) return map;
    categories.forEach((cat: any, idx: number) => {
      const scoped = allPortalPhotos.filter((p: any) => p.category_id === cat.id);
      if (scoped.length > 0) {
        map[cat.id] = scoped[0].url;
        return;
      }
      if (allPortalPhotos.length > 0) {
        map[cat.id] = allPortalPhotos[idx % allPortalPhotos.length]?.url || '';
      }
    });
    return map;
  }, [allPortalPhotos, categories]);

  useEffect(() => {
    if (portalPhotos.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % portalPhotos.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [portalPhotos.length]);

  useEffect(() => {
    if (!portalPhotos.length) return;
    setHeroIndex((prev) => (prev >= portalPhotos.length ? 0 : prev));
  }, [portalPhotos.length]);

  useEffect(() => {
    setHeroIndex(0);
  }, [selectedCategoryId]);

  useEffect(() => {
    if (!pinOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinOpen]);

  const reservationMetrics = useMemo(() => {
    const data = reservationStats || [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = data.filter((r: any) => {
      const ci = r.check_in_date ? new Date(r.check_in_date) : null;
      return ci && ci >= monthStart;
    });
    const pending = data.filter((r: any) => r.status === 'pending').length;
    const confirmed = thisMonth.filter((r: any) => ['confirmed', 'checked_in', 'checked_out'].includes(r.status)).length;
    const confirmationRate = thisMonth.length ? Math.round((confirmed / thisMonth.length) * 100) : 0;
    const totalAvailableNow = Object.values(roomCounts || {}).reduce((sum: number, n: any) => sum + Number(n || 0), 0);
    return { pending, confirmationRate, totalAvailableNow, monthVolume: thisMonth.length };
  }, [reservationStats, roomCounts]);

  const mapServiceIcon = (name: string) => {
    const key = name.toLowerCase();
    if (key.includes('wifi') || key.includes('internet')) return Wifi;
    if (key.includes('tv') || key.includes('canal')) return Tv;
    if (key.includes('clim') || key.includes('ac')) return Wind;
    if (key.includes('parking')) return Car;
    if (key.includes('resta') || key.includes('petit') || key.includes('déjeuner')) return Utensils;
    return Sparkles;
  };

  async function copyCoords() {
    if (!hotel?.latitude || !hotel?.longitude) return;
    const text = `${hotel.latitude.toFixed(6)}, ${hotel.longitude.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const rn = generateReservationNumber();
      const { error } = await supabase.from('reservations').insert({
        hotel_id: hotel!.id, reservation_number: rn,
        guest_name: form.guest_name, guest_phone: form.guest_phone || null, guest_email: form.guest_email || null,
        check_in_date: form.check_in_date, check_out_date: form.check_out_date,
        category_id: selectedCategoryId || null,
        number_of_adults: form.number_of_adults, number_of_children: form.number_of_children,
        number_of_nights: nights, total_price: total, source: 'portal', status: 'pending',
        special_requests: form.special_requests || null,
        payment_method_cash: form.payment_cash, payment_method_momo: form.payment_momo, payment_method_om: form.payment_om,
      } as any);
      if (error) throw error;
      return rn;
    },
    onSuccess: (rn) => { setResNumber(rn); setSubmitted(true); },
    onError: (e: any) => toast.error(e.message),
  });

  const travelModes = [
    { id: 'driving' as const, icon: Car, label: { fr: 'Voiture', en: 'Driving' } },
    { id: 'walking' as const, icon: Footprints, label: { fr: 'Marche', en: 'Walking' } },
    { id: 'transit' as const, icon: Bus, label: { fr: 'Transports', en: 'Transit' } },
  ];

  if (!hotel) return <div className="min-h-screen flex items-center justify-center bg-background"><p>{t('portal.loading')}</p></div>;

  if (submitted) return (
    <div className="booking-portal min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-lg w-full mx-4 border-0 shadow-2xl">
        <CardContent className="pt-10 pb-8 text-center space-y-5">
          <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <Check className="h-9 w-9 text-emerald-600" />
          </div>
          <p className="portal-kicker">{t('portal.submitted.title')}</p>
          <h2 className="portal-title text-4xl">{t('portal.submitted.message')}</h2>
          <p className="text-muted-foreground">{t('portal.submitted.reference')}</p>
          <p className="text-3xl tracking-widest font-bold text-primary">{resNumber}</p>
          <p className="text-sm text-muted-foreground">{t('portal.submitted.confirmation')}</p>
          <Button
            className="mt-2"
            variant="outline"
            onClick={() => {
              setSubmitted(false);
              setSelectedCategoryId(null);
              setForm({ guest_name: '', guest_phone: '', guest_email: '', check_in_date: '', check_out_date: '', number_of_adults: 1, number_of_children: 0, special_requests: '', payment_cash: false, payment_momo: false, payment_om: false });
            }}
          >
            {t('portal.submitted.new')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const mapsUrl = hotel?.latitude && hotel?.longitude ? `https://www.google.com/maps/search/?api=1&query=${hotel.latitude},${hotel.longitude}` : '';
  const directionsUrl = hotel?.latitude && hotel?.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${hotel.latitude},${hotel.longitude}&travelmode=${travelMode}` : '';
  const whatsappNumber = hotel?.phone?.replace(/[^\d+]/g, '') || '237600000000';
  const whatsappMessage = lang === 'fr'
    ? `Bonjour ${hotel.name}, j'aimerais avoir l'itinéraire et plus d'informations sur votre hôtel.`
    : `Hello ${hotel.name}, I'd like to get directions and more information about your hotel.`;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="booking-portal min-h-screen">
      {/* Hero Section */}
      <section className="portal-hero px-4 md:px-8 py-10 md:py-14">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-8 portal-hero-panel">
            {coverPhoto ? (
              <img src={coverPhoto} alt={hotel.name} className="portal-hero-image" />
            ) : (
              <div className="portal-hero-fallback">
                <Building2 className="h-10 w-10" />
                <p>{t('portal.hero.kicker')}</p>
              </div>
            )}

            <div className="portal-hero-overlay" />

            {portalPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  className="portal-hero-nav left"
                  aria-label="Photo précédente"
                  onClick={() => setHeroIndex((prev) => (prev - 1 + portalPhotos.length) % portalPhotos.length)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="portal-hero-nav right"
                  aria-label="Photo suivante"
                  onClick={() => setHeroIndex((prev) => (prev + 1) % portalPhotos.length)}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            <div className="portal-hero-content">
              <p className="portal-kicker">{t('portal.hero.kicker')}</p>
              <h1 className="portal-title text-4xl md:text-5xl">{hotel.name}</h1>
              <div className="flex flex-wrap gap-3 text-sm opacity-95 mt-3">
                <span className="portal-chip"><MapPin className="h-4 w-4" />{hotel.city || ''} {hotel.country || ''}</span>
                {hotel.phone && <span className="portal-chip"><Phone className="h-4 w-4" />{hotel.phone}</span>}
                {hotel.email && <span className="portal-chip"><Mail className="h-4 w-4" />{hotel.email}</span>}
              </div>

              {portalPhotos.length > 1 && (
                <div className="portal-hero-dots mt-4">
                  {portalPhotos.slice(0, 7).map((p: any, idx: number) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`portal-dot ${idx === heroIndex ? 'active' : ''}`}
                      onClick={() => setHeroIndex(idx)}
                      aria-label={`Aller à la photo ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Trust Card */}
          <div className="lg:col-span-4 portal-trust-card">
            <p className="portal-kicker">{t('portal.trust.title')}</p>
            <div className="space-y-3 mt-3">
              <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-500" /><span>{t('portal.trust.direct')}</span></div>
              <div className="flex items-center gap-3"><Sunrise className="h-5 w-5 text-amber-500" /><span>{t('portal.trust.confirm')}</span></div>
              <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-indigo-500" /><span>{t('portal.trust.support')}</span></div>
            </div>
            <div className="portal-rating mt-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
              <span>{t('portal.trust.rating')}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-8 pb-12">
        {/* Stats Strip */}
        <section className="portal-stats-strip mb-8">
          <div className="portal-stat">
            <p className="portal-stat-label">{t('portal.stats.available')}</p>
            <p className="portal-stat-value">{reservationMetrics.totalAvailableNow}</p>
          </div>
          <div className="portal-stat">
            <p className="portal-stat-label">{t('portal.stats.confirmed')}</p>
            <p className="portal-stat-value">{reservationMetrics.confirmationRate}%</p>
          </div>
          <div className="portal-stat">
            <p className="portal-stat-label">{t('portal.stats.pending')}</p>
            <p className="portal-stat-value">{reservationMetrics.pending}</p>
          </div>
          <div className="portal-stat">
            <p className="portal-stat-label">{t('portal.stats.volume')}</p>
            <p className="portal-stat-value">{reservationMetrics.monthVolume}</p>
          </div>
        </section>

        {/* Gallery */}
        {galleryPhotos.length > 1 && (
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {galleryPhotos.map((p: any) => (
              <div key={p.id} className="portal-gallery-tile">
                <img src={p.url} alt={p.caption || hotel.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </section>
        )}

        {/* Highlights */}
        {services && services.length > 0 && (
          <section className="mb-8">
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { icon: Award, title: 'Service 5 étoiles', desc: 'Conciergerie 24/7 et équipe attentionnée.' },
                { icon: Utensils, title: 'Gastronomie', desc: 'Restaurant signature et room service raffiné.' },
                { icon: Sparkles, title: 'Spa & bien-être', desc: 'Soins exclusifs et piscine privée.' },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 font-semibold text-sm">{item.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Services & Rooms */}
          <section className="lg:col-span-7 space-y-8">
            {services && services.length > 0 && (
              <Card className="portal-section-card border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="portal-section-title">{t('portal.services.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {services.map((s: any) => {
                      const Icon = mapServiceIcon(s.name || 'service');
                      return (
                        <div key={s.id} className="portal-service-pill">
                          <Icon className="h-4 w-4 text-primary" />
                          <span>{s.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <section>
              <div className="flex items-end justify-between mb-4">
                <h2 className="portal-section-title">{t('portal.rooms.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('portal.rooms.subtitle')}</p>
              </div>

              <div className="space-y-4">
                {categories?.map((cat: any) => {
                  const avail = roomCounts?.[cat.id] || 0;
                  const catPhoto = categoryPhotoById[cat.id] || coverPhoto;
                  return (
                    <Card
                      key={cat.id}
                      className={`portal-room-card ${selectedCategoryId === cat.id ? 'selected' : ''} cursor-pointer`}
                      onClick={() => setSelectedCategoryId(cat.id)}
                    >
                      <div className="portal-room-media">
                        {catPhoto ? (
                          <img src={catPhoto} alt={cat.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="portal-room-fallback" style={{ background: cat.color || '#3767d7' }} />
                        )}
                      </div>

                      <CardContent className="pt-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-semibold">{cat.name}</h3>
                            {cat.description && <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{formatFCFA(cat.price_per_night)}</p>
                            <p className="text-xs text-muted-foreground">{t('portal.rooms.perNight')}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-4">
                          {(cat.features as string[])?.slice(0, 6).map((f: string) => {
                            const Icon = featureIcons[f] || Sparkles;
                            return (
                              <span key={f} className="portal-feature-chip">
                                <Icon className="h-3 w-3" /> {f}
                              </span>
                            );
                          })}
                        </div>

                        <div className="mt-4 pt-3 border-t flex items-center justify-between">
                          <Badge variant={avail > 0 ? 'outline' : 'destructive'}>
                            {avail > 0 ? `${avail} ${t('portal.rooms.available')}` : t('portal.rooms.full')}
                          </Badge>
                          {selectedCategoryId === cat.id ? (
                            <span className="text-primary text-sm font-medium flex items-center gap-1">{t('portal.rooms.selected')} <Check className="h-4 w-4" /></span>
                          ) : (
                            <span className="text-muted-foreground text-sm">{t('portal.rooms.choose')}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          </section>

          {/* Booking Form */}
          <aside className="lg:col-span-5">
            <Card className="portal-booking-card sticky top-4 border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="portal-section-title flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('portal.form.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>{t('portal.form.fullName')}</Label><Input value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} /></div>
                  <div><Label>{t('portal.form.phone')}</Label><Input value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} /></div>
                  <div className="md:col-span-2"><Label>{t('common.email')}</Label><Input type="email" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} /></div>
                  <div><Label>{t('portal.form.arrival')}</Label><Input type="date" value={form.check_in_date} onChange={e => setForm(f => ({ ...f, check_in_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} /><p className="text-xs text-muted-foreground mt-1">{t('portal.form.checkInNote')}</p></div>
                  <div><Label>{t('portal.form.departure')}</Label><Input type="date" value={form.check_out_date} onChange={e => setForm(f => ({ ...f, check_out_date: e.target.value }))} min={form.check_in_date || new Date().toISOString().split('T')[0]} /></div>
                  <div><Label>{t('portal.form.adults')}</Label><Input type="number" value={form.number_of_adults} onChange={e => setForm(f => ({ ...f, number_of_adults: Number(e.target.value) }))} min={1} /></div>
                  <div><Label>{t('portal.form.children')}</Label><Input type="number" value={form.number_of_children} onChange={e => setForm(f => ({ ...f, number_of_children: Number(e.target.value) }))} min={0} /></div>
                </div>

                <div>
                  <Label className="mb-2 block">{t('portal.form.paymentPreference')}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <label className="portal-pay-option"><Checkbox checked={form.payment_cash} onCheckedChange={v => setForm(f => ({ ...f, payment_cash: !!v }))} /><span>{t('portal.form.payment.arrival')}</span></label>
                    <label className="portal-pay-option"><Checkbox checked={form.payment_momo} onCheckedChange={v => setForm(f => ({ ...f, payment_momo: !!v }))} /><span>{t('portal.form.payment.momo')}</span></label>
                    <label className="portal-pay-option"><Checkbox checked={form.payment_om} onCheckedChange={v => setForm(f => ({ ...f, payment_om: !!v }))} /><span>{t('portal.form.payment.orangeMoney')}</span></label>
                  </div>
                </div>

                <div><Label>{t('portal.form.specialRequests')}</Label><Textarea value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))} /></div>

                <div className="portal-total-box">
                  {selectedCategory ? (
                    <>
                      <p className="text-sm text-muted-foreground">{selectedCategory.name}</p>
                      <p className="text-sm text-muted-foreground">{Math.max(1, nights)} nuit(s) x {formatFCFA(selectedCategory.price_per_night)}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('portal.form.selectCategory')}</p>
                  )}
                  <div className="flex items-end justify-between mt-2">
                    <span className="text-muted-foreground">{t('portal.form.estimation')}</span>
                    <span className="text-3xl font-bold text-primary">{formatFCFA(total)}</span>
                  </div>
                </div>

                <Button
                  className="w-full h-12 text-base"
                  onClick={() => submitMutation.mutate()}
                  disabled={!form.guest_name || !form.check_in_date || !form.check_out_date || !selectedCategoryId || submitMutation.isPending}
                >
                  {submitMutation.isPending ? t('portal.form.submitting') : t('portal.form.submit')}
                  {!submitMutation.isPending && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>

                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p>{t('portal.form.note')}</p>
                  <p className="text-emerald-600 font-medium">{t('portal.form.policy')}</p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* Location Section */}
        {hotel?.latitude && hotel?.longitude && (
          <section className="bg-navy text-navy-foreground rounded-2xl p-8 my-12">
            <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 items-start">
              {/* Location Info */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold mb-2">
                  {lang === 'fr' ? 'Nous trouver' : 'Find us'}
                </p>
                <h2 className="text-3xl font-semibold text-white mb-4">
                  {lang === 'fr' ? 'Au cœur de ' : 'In the heart of '}{hotel.city || ''}
                </h2>
                <p className="text-navy-foreground/80 mb-5">
                  {hotel.address || `${hotel.city}, ${hotel.country}`}
                </p>

                <div className="flex flex-wrap gap-3 mb-5">
                  <Button asChild variant="default" className="bg-gold text-gold-foreground hover:bg-gold/90">
                    <a href={mapsUrl} target="_blank" rel="noreferrer noopener">
                      <MapPin className="h-4 w-4" />
                      {lang === 'fr' ? 'Google Maps' : 'Google Maps'}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="border-gold/40 text-gold hover:bg-gold/10">
                    <a href={directionsUrl} target="_blank" rel="noreferrer noopener">
                      <Navigation className="h-4 w-4" />
                      {lang === 'fr' ? 'Itinéraire' : 'Directions'}
                    </a>
                  </Button>
                  <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe57]">
                    <a href={whatsappUrl} target="_blank" rel="noreferrer noopener">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  </Button>
                </div>

                {/* Travel Mode Selector */}
                <div role="radiogroup" className="inline-flex rounded-full border border-gold/30 bg-navy-foreground/10 p-1 mt-4">
                  {travelModes.map((m) => {
                    const active = travelMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTravelMode(m.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-gold text-gold-foreground'
                            : 'text-navy-foreground/70 hover:text-navy-foreground'
                        }`}
                      >
                        <m.icon className="h-3.5 w-3.5" />
                        {m.label[lang as 'fr' | 'en']}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Map */}
              <div className="relative overflow-hidden rounded-2xl border border-gold/30 shadow-lg">
                <iframe
                  title={`${hotel.name} map`}
                  src={`https://www.google.com/maps?q=${hotel.latitude},${hotel.longitude}&z=17&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-72 w-full border-0"
                />

                {/* Pin */}
                <button
                  type="button"
                  onClick={() => setPinOpen((v) => !v)}
                  aria-expanded={pinOpen}
                  className="absolute left-1/2 top-1/2 z-10 inline-flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-gold-foreground shadow-lg transition-transform hover:-translate-y-[110%]"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {hotel.name}
                </button>

                {/* Pin Details */}
                {pinOpen && (
                  <div className="absolute left-1/2 top-1/2 z-20 w-72 -translate-x-1/2 -translate-y-[calc(100%+2.5rem)] rounded-xl border border-gold/30 bg-card p-4 shadow-lg">
                    <button
                      type="button"
                      onClick={() => setPinOpen(false)}
                      className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="font-semibold text-navy">{hotel.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {hotel.address || `${hotel.city}, ${hotel.country}`}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-2 text-xs">
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Lat</dt>
                        <dd className="font-mono text-navy">{hotel.latitude.toFixed(6)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold uppercase tracking-wide text-muted-foreground">Lng</dt>
                        <dd className="font-mono text-navy">{hotel.longitude.toFixed(6)}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      onClick={copyCoords}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-navy hover:underline"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-success" />
                          <span className="text-success">{lang === 'fr' ? 'Copiées' : 'Copied'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{lang === 'fr' ? 'Copier les coordonnées' : 'Copy coordinates'}</span>
                        </>
                      )}
                    </button>
                    <div className="mt-3 flex gap-2">
                      <Button asChild size="sm" className="flex-1">
                        <a href={directionsUrl} target="_blank" rel="noreferrer noopener">
                          <Navigation className="h-3.5 w-3.5" />
                          {lang === 'fr' ? 'Itinéraire' : 'Directions'}
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <a href={mapsUrl} target="_blank" rel="noreferrer noopener">
                          <ExternalLink className="h-3.5 w-3.5" />
                          {lang === 'fr' ? 'Ouvrir' : 'Open'}
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* WhatsApp Button */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
        >
          <MessageCircle className="h-7 w-7" />
        </a>
      </div>

      {/* Footer */}
      <footer className="portal-footer border-t bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {hotel.name}. {lang === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}</p>
        </div>
      </footer>
    </div>
  );
};

export default BookingPortalPage;
