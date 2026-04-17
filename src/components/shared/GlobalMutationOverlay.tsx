import { useIsMutating } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export const GlobalMutationOverlay = () => {
  const activeMutations = useIsMutating();

  if (activeMutations === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/35 backdrop-blur-[1px]">
      <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">Traitement en cours</p>
          <p className="text-xs text-muted-foreground">Veuillez patienter...</p>
        </div>
      </div>
    </div>
  );
};