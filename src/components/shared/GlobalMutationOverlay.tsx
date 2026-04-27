import { useIsMutating } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export const GlobalMutationOverlay = () => {
  const activeMutations = useIsMutating();

  if (activeMutations === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100]">
      <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="text-xs font-medium text-primary">Traitement...</p>
      </div>
    </div>
  );
};