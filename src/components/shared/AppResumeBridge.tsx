import { useAppResume } from '@/hooks/useAppResume';

/**
 * Bridge component that enables global app resume handling.
 * Must be rendered inside QueryClientProvider.
 */
export function AppResumeBridge() {
  useAppResume();
  return null;
}
