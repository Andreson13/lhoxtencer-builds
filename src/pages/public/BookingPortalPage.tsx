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
} from 'lucide-react';
import './BookingPortalPage.css';

const featureIcons: Record<string, any> = { WiFi: Wifi, TV: Tv, AC: Wind };

const BookingPortalPage = () => {
  const { t } = useI18n();
  const { slug, hotelId } = useParams<{ slug?: string; hotelId?: string }>();
  const hotelKey = slug || hotelId;
  const [submitted, setSubmitted] = useState(false);
  const [resNumber, setResNumber] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
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

  // Count available rooms per category
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

  return (
    <div className="booking-portal min-h-screen">
      {/* Sticky Navigation Header */}
      <header className="portal-header sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/5 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8 flex-1">
            <h2 className="text-lg font-semibold text-foreground">{hotel.name}</h2>
            <nav className="hidden md:flex gap-6 text-sm text-muted-foreground">
              <a href="#rooms" className="hover:text-foreground transition-colors">{t('portal.rooms.title')}</a>
              <a href="#services" className="hover:text-foreground transition-colors">{t('portal.services.title')}</a>
              <a href="#about" className="hover:text-foreground transition-colors">{t('portal.about.title')}</a>
              <a href="#contact" className="hover:text-foreground transition-colors">{t('portal.contact.title')}</a>
            </nav>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const form = document.getElementById('booking-form');
              form?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {t('portal.form.submit')} <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </header>

      <section className="portal-hero px-4 md:px-8 py-10 md:py-14" id="top">
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

          <div className="lg:col-span-4 portal-trust-card">
            <p className="portal-kicker">{t('portal.trust.title')}</p>
            <div className="space-y-3 mt-3">
              <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-500" /><span>{t('portal.trust.direct')}</span></div>
              <div className="flex items-center gap-3"><Sunrise className="h-5 w-5 text-amber-500" /><span>{t('portal.trust.confirm')}</span></div>
              <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-indigo-500" /><span>{t('portal.trust.support')}</span></div>
            </div>
            <div className="portal-rating mt-6">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span>{t('portal.trust.rating')}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-8 pb-12">
        {/* Guest-Friendly Facts Section */}
        <section className="portal-stats-strip mb-8">
          <div className="portal-stat">
            <p className="portal-stat-label">{t('portal.rooms.title')}</p>
            <p className="portal-stat-value">{categories?.length || 0}</p>
          </div>
          <div className="portal-stat">
            <p className="portal-stat-label">Check-in</p>
            <p className="portal-stat-value">14:00</p>
          </div>
          <div className="portal-stat">
            <p className="portal-stat-label">WiFi</p>
            <p className="portal-stat-value">✓</p>
          </div>
          <div className="portal-stat">
            <p className="portal-stat-label">Confirmation</p>
            <p className="portal-stat-value">24h</p>
          </div>
        </section>

        {galleryPhotos.length > 1 && (
          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
            {galleryPhotos.map((p: any) => (
              <div key={p.id} className="portal-gallery-tile">
                <img src={p.url} alt={p.caption || hotel.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </section>
        )}

        {/* About Section */}
        {hotel.description && (
          <section id="about" className="mb-12">
            <h2 className="portal-section-title mb-6 text-3xl md:text-4xl">{t('portal.about.title')}</h2>
            <Card className="portal-section-card border-0 shadow-sm">
              <CardContent className="pt-6">
                <div className="grid lg:grid-cols-2 gap-8">
                  <div className="portal-about-text">
                    <p className="text-base leading-relaxed text-foreground/80 whitespace-pre-wrap">{hotel.description}</p>
                  </div>
                  <div className="space-y-4">
                    {hotel.city && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">Localisation</p>
                          <p className="font-medium">{hotel.city}{hotel.country ? `, ${hotel.country}` : ''}</p>
                        </div>
                      </div>
                    )}
                    {hotel.address && (
                      <div className="flex items-start gap-3">
                        <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">Adresse</p>
                          <p className="font-medium">{hotel.address}</p>
                        </div>
                      </div>
                    )}
                    {hotel.phone && (
                      <a href={`tel:${hotel.phone}`} className="flex items-start gap-3 hover:text-primary transition-colors">
                        <Phone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">Téléphone</p>
                          <p className="font-medium">{hotel.phone}</p>
                        </div>
                      </a>
                    )}
                    {hotel.email && (
                      <a href={`mailto:${hotel.email}`} className="flex items-start gap-3 hover:text-primary transition-colors">
                        <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium">{hotel.email}</p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <div className="grid lg:grid-cols-12 gap-8">
          <section className="lg:col-span-7 space-y-8">
            {services && services.length > 0 && (
              <Card className="portal-section-card border-0 shadow-sm" id="services">
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

            <section id="rooms">
              <div className="flex items-end justify-between mb-4">
                <h2 className="portal-section-title">{t('portal.rooms.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('portal.rooms.subtitle')}</p>
              </div>

              <div className="space-y-4">
                {categories?.map((cat: any, idx: number) => {
                  const avail = roomCounts?.[cat.id] || 0;
                  const catPhoto = categoryPhotoById[cat.id] || coverPhoto;
                  return (
                    <Card
                      key={cat.id}
                      className={`portal-room-card ${selectedCategoryId === cat.id ? 'selected' : ''}`}
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

          <aside className="lg:col-span-5">
            <Card className="portal-booking-card sticky top-20 border-0 shadow-xl" id="booking-form">
              <CardHeader>
                <CardTitle className="portal-section-title flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('portal.form.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label>{t('portal.form.fullName')}</Label><Input placeholder={t('common.firstName') + ' ' + t('common.lastName')} value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} /></div>
                  <div><Label>{t('portal.form.phone')}</Label><Input placeholder="+1 (555) 000-0000" value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} /></div>
                  <div className="md:col-span-2"><Label>{t('common.email')}</Label><Input type="email" placeholder="name@example.com" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} /></div>
                  <div><Label>{t('portal.form.arrival')}</Label><Input type="date" value={form.check_in_date} onChange={e => setForm(f => ({ ...f, check_in_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} /><p className="text-xs text-muted-foreground mt-1">{t('portal.form.checkInNote')}</p></div>
                  <div><Label>{t('portal.form.departure')}</Label><Input type="date" value={form.check_out_date} onChange={e => setForm(f => ({ ...f, check_out_date: e.target.value }))} min={form.check_in_date || new Date().toISOString().split('T')[0]} /></div>
                  <div><Label>{t('portal.form.adults')}</Label><Input type="number" value={form.number_of_adults} onChange={e => setForm(f => ({ ...f, number_of_adults: Number(e.target.value) }))} min={1} /></div>
                  <div><Label>{t('portal.form.children')}</Label><Input type="number" value={form.number_of_children} onChange={e => setForm(f => ({ ...f, number_of_children: Number(e.target.value) }))} min={0} /></div>
                </div>

                <div>
                  <Label className="mb-3 block">{t('portal.form.paymentPreference')}</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={form.payment_cash ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setForm(f => ({ ...f, payment_cash: !f.payment_cash, payment_momo: false, payment_om: false }))}
                    >
                      {t('portal.form.payment.arrival')}
                    </Button>
                    <Button
                      type="button"
                      variant={form.payment_momo ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setForm(f => ({ ...f, payment_momo: !f.payment_momo, payment_cash: false, payment_om: false }))}
                    >
                      {t('portal.form.payment.momo')}
                    </Button>
                    <Button
                      type="button"
                      variant={form.payment_om ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setForm(f => ({ ...f, payment_om: !f.payment_om, payment_cash: false, payment_momo: false }))}
                    >
                      {t('portal.form.payment.orangeMoney')}
                    </Button>
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
      </div>

      {/* Contact Section */}
      <section id="contact" className="portal-contact-section px-4 md:px-8 py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="portal-section-title text-3xl md:text-4xl mb-8">{t('portal.contact.title')}</h2>
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {hotel.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-6 w-6 text-primary mt-1 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-muted-foreground mb-1">Adresse</p>
                    <p className="text-base">{hotel.address}</p>
                  </div>
                </div>
              )}
              {hotel.phone && (
                <a href={`tel:${hotel.phone}`} className="flex items-start gap-3 hover:text-primary transition-colors">
                  <Phone className="h-6 w-6 text-primary mt-1 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-muted-foreground mb-1">Téléphone</p>
                    <p className="text-base font-medium">{hotel.phone}</p>
                  </div>
                </a>
              )}
              {hotel.email && (
                <a href={`mailto:${hotel.email}`} className="flex items-start gap-3 hover:text-primary transition-colors">
                  <Mail className="h-6 w-6 text-primary mt-1 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-muted-foreground mb-1">Email</p>
                    <p className="text-base font-medium">{hotel.email}</p>
                  </div>
                </a>
              )}
            </div>
            <div className="h-80 rounded-xl overflow-hidden shadow-md">
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyDxUQ1pxb3fSBXrwKz6tVZwjCLW8HSBQD4&q=${encodeURIComponent(hotel.city || hotel.name)}`}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="portal-footer bg-gradient-to-b from-white/50 to-slate-50/50 border-t border-black/5">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <div className="grid md:grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="font-semibold mb-2">{hotel.name}</h3>
              {hotel.address && <p className="text-sm text-muted-foreground">{hotel.address}</p>}
              {hotel.city && <p className="text-sm text-muted-foreground">{hotel.city}{hotel.country ? `, ${hotel.country}` : ''}</p>}
            </div>
            <div className="space-y-2">
              {hotel.phone && (
                <a href={`tel:${hotel.phone}`} className="text-sm hover:text-primary transition-colors flex items-center gap-2">
                  <Phone className="h-4 w-4" /> {hotel.phone}
                </a>
              )}
              {hotel.email && (
                <a href={`mailto:${hotel.email}`} className="text-sm hover:text-primary transition-colors flex items-center gap-2">
                  <Mail className="h-4 w-4" /> {hotel.email}
                </a>
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-black/5 text-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} {hotel.name}. {t('portal.footer')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BookingPortalPage;
