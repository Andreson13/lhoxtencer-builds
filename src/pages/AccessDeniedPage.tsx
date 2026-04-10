import React from 'react';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const AccessDeniedPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <ShieldX className="h-16 w-16 text-destructive mb-4" />
      <h1 className="text-2xl font-semibold mb-2">Accès refusé</h1>
      <p className="text-muted-foreground mb-4">Vous n'avez pas les permissions pour accéder à cette page.</p>
      <Button onClick={() => navigate('/dashboard')}>Retour au tableau de bord</Button>
    </div>
  );
};

export default AccessDeniedPage;
