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
  ChevronDown,
} from 'lucide-react';
import './BookingPortalPage.css';

type Room = {
  id: string;
  name: string;
  description: string;
  price_per_night: number;
  images: string[];
  capacity: number;
  features: string[];
  category_id: string;
};

const featureIcons: Record<string, any> = { WiFi: Wifi, TV: Tv, AC: Wind };

const BookingPortalPage = () => {
  const { t, lang } = useI18n();
  const { slug, hotelId } = useParams<{ slug?: string; hotelId?: string }>();
  const hotelKey = slug || hotelId;
  const [submitted, setSubmitted] = useState(false);
  const [resNumber, setResNumber] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
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
    <div className="booking-portal min-h-screen bg-white">
      {/* Modern Header */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 md:px-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {hotel.name}
          </h2>
          <nav className="hidden md:flex gap-6 text-sm text-muted-foreground">
            <a href="#rooms" className="hover:text-foreground transition-colors">{t('portal.rooms.title')}</a>
            <a href="#services" className="hover:text-foreground transition-colors">{t('portal.services.title')}</a>
            <a href="#about" className="hover:text-foreground transition-colors">{t('portal.about.title')}</a>
          </nav>
          <Button
            size="sm"
            onClick={() => document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            {t('portal.form.submit')} <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </header>

      {/* Hero Section with Modern Design */}
      <section className="relative overflow-hidden px-4 md:px-8 py-12 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8">
              <div className="relative h-80 md:h-96 overflow-hidden rounded-lg bg-muted shadow-lg group">
                {coverPhoto ? (
                  <img src={coverPhoto} alt={hotel.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                    <Building2 className="h-12 w-12 text-muted-foreground/40" />
                    <p className="mt-2 text-muted-foreground/60">{t('portal.hero.kicker')}</p>
                  </div>
                )}

                {portalPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"
                      onClick={() => setHeroIndex((prev) => (prev - 1 + portalPhotos.length) % portalPhotos.length)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"
                      onClick={() => setHeroIndex((prev) => (prev + 1) % portalPhotos.length)}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                      {portalPhotos.slice(0, 6).map((p: any, idx: number) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`h-2 rounded-full transition-all ${idx === heroIndex ? 'w-6 bg-white' : 'w-2 bg-white/50'}`}
                          onClick={() => setHeroIndex(idx)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 space-y-2">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">{hotel.name}</h1>
                <div className="flex flex-wrap gap-3">
                  {hotel.city && <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" />{hotel.city}{hotel.country ? `, ${hotel.country}` : ''}</Badge>}
                  {hotel.phone && <Badge variant="outline" className="gap-1"><Phone className="h-3 w-3" />{hotel.phone}</Badge>}
                  {hotel.email && <Badge variant="outline" className="gap-1"><Mail className="h-3 w-3" />{hotel.email}</Badge>}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <Card className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-sm">{t('portal.trust.direct')}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Sunrise className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-sm">{t('portal.trust.confirm')}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                      <span className="text-sm">{t('portal.trust.support')}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                    <span className="ml-2 text-xs text-muted-foreground">{t('portal.trust.rating')}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-primary/5">
                <CardContent className="pt-6 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('portal.rooms.title')}</p>
                  <p className="text-2xl font-bold text-foreground">{categories?.length || 0}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 md:px-8 py-12">
        {galleryPhotos.length > 1 && (
          <section className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {galleryPhotos.map((p: any) => (
              <div key={p.id} className="relative h-40 overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <img src={p.url} alt={p.caption || hotel.name} className="w-full h-full object-cover hover:scale-110 transition-transform duration-300" />
              </div>
            ))}
          </section>
        )}

        {hotel.description && (
          <section id="about" className="mb-12">
            <h2 className="mb-6 text-3xl md:text-4xl font-bold">{t('portal.about.title')}</h2>
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <p className="text-base leading-relaxed text-foreground/80 whitespace-pre-wrap">{hotel.description}</p>
              </div>
              <div className="space-y-4">
                {hotel.city && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-muted-foreground">Localisation</p>
                      <p className="font-medium">{hotel.city}{hotel.country ? `, ${hotel.country}` : ''}</p>
                    </div>
                  </div>
                )}
                {hotel.address && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-muted-foreground">Adresse</p>
                      <p className="font-medium">{hotel.address}</p>
                    </div>
                  </div>
                )}
                {hotel.phone && (
                  <a href={`tel:${hotel.phone}`} className="flex items-start gap-3 hover:text-primary transition-colors">
                    <Phone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-muted-foreground">Téléphone</p>
                      <p className="font-medium">{hotel.phone}</p>
                    </div>
                  </a>
                )}
                {hotel.email && (
                  <a href={`mailto:${hotel.email}`} className="flex items-start gap-3 hover:text-primary transition-colors">
                    <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{hotel.email}</p>
                    </div>
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-12 gap-8">
          <section className="lg:col-span-7 space-y-8">
            {services && services.length > 0 && (
              <Card className="border-0 shadow-sm" id="services">
                <CardHeader>
                  <CardTitle>{t('portal.services.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {services.map((s: any) => {
                      const Icon = mapServiceIcon(s.name || 'service');
                      return (
                        <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm hover:bg-card transition-colors">
                          <Icon className="h-4 w-4 text-primary shrink-0" />
                          <span className="line-clamp-1">{s.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <section id="rooms">
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <h2 className="text-3xl font-bold">{t('portal.rooms.title')}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t('portal.rooms.subtitle')}</p>
                </div>
              </div>

              <div className="space-y-3">
                {categories?.map((cat: any) => {
                  const avail = roomCounts?.[cat.id] || 0;
                  const catPhoto = categoryPhotoById[cat.id] || coverPhoto;
                  const isExpanded = expandedCategory === cat.id;

                  return (
                    <Card
                      key={cat.id}
                      className={`cursor-pointer transition-all border-0 shadow-sm hover:shadow-md ${selectedCategoryId === cat.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                    >
                      <CardContent className="p-0">
                        <div className="flex gap-4 p-4">
                          {catPhoto && (
                            <div className="h-32 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
                              <img src={catPhoto} alt={cat.name} className="h-full w-full object-cover" />
                            </div>
                          )}

                          <div className="flex flex-1 flex-col justify-between">
                            <div>
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h3 className="text-lg font-semibold">{cat.name}</h3>
                                  {cat.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{cat.description}</p>}
                                </div>
                                <Button
                                  size="sm"
                                  variant={selectedCategoryId === cat.id ? 'default' : 'outline'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id);
                                  }}
                                >
                                  {selectedCategoryId === cat.id ? <Check className="h-4 w-4 mr-1" /> : null}
                                  {selectedCategoryId === cat.id ? t('portal.rooms.selected') : t('portal.rooms.choose')}
                                </Button>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {(cat.features as string[])?.slice(0, 4).map((f: string) => {
                                  const Icon = featureIcons[f] || Sparkles;
                                  return (
                                    <span key={f} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                                      <Icon className="h-3 w-3" /> {f}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t pt-4">
                              <div>
                                <p className="text-2xl font-bold text-primary">{formatFCFA(cat.price_per_night)}</p>
                                <p className="text-xs text-muted-foreground">{t('portal.rooms.perNight')}</p>
                              </div>
                              <Badge variant={avail > 0 ? 'outline' : 'destructive'}>
                                {avail > 0 ? `${avail} ${t('portal.rooms.available')}` : t('portal.rooms.full')}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          </section>

          <aside className="lg:col-span-5">
            <Card className="sticky top-20 border-0 shadow-xl" id="booking-form">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('portal.form.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">{t('portal.form.fullName')}</Label>
                    <Input placeholder={t('common.firstName') + ' ' + t('common.lastName')} value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm">{t('portal.form.phone')}</Label>
                    <Input placeholder="+1 (555) 000-0000" value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm">{t('common.email')}</Label>
                    <Input type="email" placeholder="name@example.com" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} className="mt-1" />
                  </div>
                </div>

                <div className="space-y-3 border-t pt-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">{t('portal.form.arrival')}</Label>
                      <Input type="date" value={form.check_in_date} onChange={e => setForm(f => ({ ...f, check_in_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} className="mt-1" />
                      <p className="text-xs text-muted-foreground mt-1">{t('portal.form.checkInNote')}</p>
                    </div>
                    <div>
                      <Label className="text-sm">{t('portal.form.departure')}</Label>
                      <Input type="date" value={form.check_out_date} onChange={e => setForm(f => ({ ...f, check_out_date: e.target.value }))} min={form.check_in_date || new Date().toISOString().split('T')[0]} className="mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">{t('portal.form.adults')}</Label>
                      <Input type="number" value={form.number_of_adults} onChange={e => setForm(f => ({ ...f, number_of_adults: Number(e.target.value) }))} min={1} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">{t('portal.form.children')}</Label>
                      <Input type="number" value={form.number_of_children} onChange={e => setForm(f => ({ ...f, number_of_children: Number(e.target.value) }))} min={0} className="mt-1" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t pt-5">
                  <Label className="text-sm">{t('portal.form.paymentPreference')}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'payment_cash', label: t('portal.form.payment.arrival') },
                      { key: 'payment_momo', label: t('portal.form.payment.momo') },
                      { key: 'payment_om', label: t('portal.form.payment.orangeMoney') },
                    ].map(({ key, label }) => (
                      <Button
                        key={key}
                        type="button"
                        variant={form[key as keyof typeof form] ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const update = { payment_cash: false, payment_momo: false, payment_om: false };
                          update[key as keyof typeof update] = true;
                          setForm(f => ({ ...f, ...update }));
                        }}
                        className="text-xs"
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm">{t('portal.form.specialRequests')}</Label>
                  <Textarea value={form.special_requests} onChange={e => setForm(f => ({ ...f, special_requests: e.target.value }))} className="mt-1 resize-none" rows={3} />
                </div>

                <div className="space-y-3 rounded-lg bg-primary/5 border border-primary/10 p-4">
                  {selectedCategory ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{selectedCategory.name}</span>
                        <span className="font-medium">{formatFCFA(selectedCategory.price_per_night)}/night</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{Math.max(1, nights)} night(s)</span>
                        <span className="font-medium">{formatFCFA(selectedCategory.price_per_night * Math.max(1, nights))}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('portal.form.selectCategory')}</p>
                  )}
                  <div className="border-t pt-3 flex items-end justify-between">
                    <span className="text-sm font-semibold">{t('portal.form.estimation')}</span>
                    <span className="text-2xl font-bold text-primary">{formatFCFA(total)}</span>
                  </div>
                </div>

                <Button
                  className="w-full h-11 text-base"
                  onClick={() => submitMutation.mutate()}
                  disabled={!form.guest_name || !form.check_in_date || !form.check_out_date || !selectedCategoryId || submitMutation.isPending}
                >
                  {submitMutation.isPending ? t('portal.form.submitting') : t('portal.form.submit')}
                  {!submitMutation.isPending && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>

                <div className="space-y-1 border-t pt-4 text-center">
                  <p className="text-xs text-muted-foreground">{t('portal.form.note')}</p>
                  <p className="text-xs font-medium text-emerald-600">{t('portal.form.policy')}</p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* Contact Section */}
      <section className="border-t bg-secondary/30 px-4 md:px-8 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-3xl font-bold md:text-4xl">{t('portal.contact.title')}</h2>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              {hotel.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-6 w-6 text-primary shrink-0" />
                  <div>
                    <p className="mb-1 text-sm font-semibold text-muted-foreground">Adresse</p>
                    <p className="text-base">{hotel.address}</p>
                  </div>
                </div>
              )}
              {hotel.phone && (
                <a href={`tel:${hotel.phone}`} className="flex items-start gap-3 hover:text-primary transition-colors">
                  <Phone className="mt-1 h-6 w-6 text-primary shrink-0" />
                  <div>
                    <p className="mb-1 text-sm font-semibold text-muted-foreground">Téléphone</p>
                    <p className="text-base font-medium">{hotel.phone}</p>
                  </div>
                </a>
              )}
              {hotel.email && (
                <a href={`mailto:${hotel.email}`} className="flex items-start gap-3 hover:text-primary transition-colors">
                  <Mail className="mt-1 h-6 w-6 text-primary shrink-0" />
                  <div>
                    <p className="mb-1 text-sm font-semibold text-muted-foreground">Email</p>
                    <p className="text-base font-medium">{hotel.email}</p>
                  </div>
                </a>
              )}
            </div>
            <div className="overflow-hidden rounded-xl shadow-lg h-80">
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

      <footer className="border-t bg-gradient-to-b from-white to-slate-50/50">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
          <div className="mb-6 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold">{hotel.name}</h3>
              {hotel.address && <p className="text-sm text-muted-foreground">{hotel.address}</p>}
              {hotel.city && <p className="text-sm text-muted-foreground">{hotel.city}{hotel.country ? `, ${hotel.country}` : ''}</p>}
            </div>
            <div className="space-y-2">
              {hotel.phone && (
                <a href={`tel:${hotel.phone}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Phone className="h-4 w-4" /> {hotel.phone}
                </a>
              )}
              {hotel.email && (
                <a href={`mailto:${hotel.email}`} className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                  <Mail className="h-4 w-4" /> {hotel.email}
                </a>
              )}
            </div>
          </div>
          <div className="border-t pt-4 text-center text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} {hotel.name}. {t('portal.footer')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BookingPortalPage;
