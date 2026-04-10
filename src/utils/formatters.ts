import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export const formatFCFA = (amount: number | null | undefined): string => {
  if (amount == null) return '0 FCFA';
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
};

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy', { locale: fr });
};

export const formatDateTime = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: fr });
};

export const formatFullDate = (date: Date): string => {
  return format(date, "EEEE d MMMM yyyy", { locale: fr });
};

export const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '-';
  return phone;
};

export const generateReservationNumber = (): string => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const r = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `R${y}${m}-${r}`;
};

export const generateInvoiceNumber = (): string => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const r = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `F${y}${m}-${r}`;
};

export const generateOrderNumber = (): string => {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const r = Math.floor(Math.random() * 999).toString().padStart(3, '0');
  return `CMD-${h}${m}-${r}`;
};
