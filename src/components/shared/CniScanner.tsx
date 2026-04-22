import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Camera, Upload, ScanLine, RefreshCw, Check, Loader2, X } from 'lucide-react';

export interface CniData {
  last_name?: string | null;
  first_name?: string | null;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  id_number?: string | null;
  id_issued_on?: string | null;
  id_issued_at?: string | null;
  usual_address?: string | null;
}

interface CniScannerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: CniData, imageUrl?: string) => void;
  hotelId: string;
  guestId?: string;
}

export const CniScanner: React.FC<CniScannerProps> = ({ open, onClose, onConfirm, hotelId, guestId }) => {
  const [step, setStep] = useState<'choose' | 'camera' | 'review'>('choose');
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState<CniData | null>(null);
  const [editedData, setEditedData] = useState<CniData | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleClose = () => {
    stopCamera();
    setStep('choose');
    setScannedData(null);
    setEditedData(null);
    setCapturedImageUrl(null);
    setUploadedImageUrl(null);
    onClose();
  };

  const startCamera = async () => {
    setStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      toast.error('Impossible d\'accéder à la caméra');
      setStep('choose');
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    stopCamera();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImageUrl(dataUrl);
    scanImage(dataUrl, 'image/jpeg');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCapturedImageUrl(dataUrl);
      const mimeType = file.type || 'image/jpeg';
      scanImage(dataUrl, mimeType);
    };
    reader.readAsDataURL(file);
  };

  const scanImage = async (dataUrl: string, mimeType: string) => {
    setLoading(true);
    try {
      const base64 = dataUrl.split(',')[1];
      const { data, error } = await supabase.functions.invoke('scan-cni', {
        body: { imageBase64: base64, mimeType },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Scan échoué');
      setScannedData(data.data);
      setEditedData(data.data);
      // Upload image to storage
      if (hotelId && guestId) {
        await uploadCniImage(dataUrl, mimeType);
      }
      setStep('review');
    } catch (err: any) {
      toast.error(err.message || 'Impossible de scanner la CNI');
      setStep('choose');
    } finally {
      setLoading(false);
    }
  };

  const uploadCniImage = async (dataUrl: string, mimeType: string) => {
    try {
      const base64 = dataUrl.split(',')[1];
      const byteString = atob(base64);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });
      const ext = mimeType === 'image/png' ? 'png' : 'jpg';
      const path = `${hotelId}/cni/${guestId || 'new'}-${Date.now()}.${ext}`;
      const { data } = await supabase.storage.from('hotel-assets').upload(path, blob, { upsert: true });
      if (data) {
        const { data: urlData } = supabase.storage.from('hotel-assets').getPublicUrl(path);
        setUploadedImageUrl(urlData.publicUrl);
      }
    } catch {
      // ignore upload errors silently
    }
  };

  const handleConfirm = () => {
    if (!editedData) return;
    onConfirm(editedData, uploadedImageUrl || undefined);
    handleClose();
  };

  const updateField = (field: keyof CniData, value: string) => {
    setEditedData((prev) => ({ ...prev, [field]: value || null }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Scanner la CNI
          </DialogTitle>
        </DialogHeader>

        {/* Step: choose */}
        {step === 'choose' && !loading && (
          <div className="grid grid-cols-2 gap-4 py-4">
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={startCamera}
            >
              <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
                <Camera className="h-10 w-10 text-primary" />
                <p className="font-medium text-center">Scanner avec la caméra</p>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
                <Upload className="h-10 w-10 text-primary" />
                <p className="font-medium text-center">Télécharger une photo</p>
              </CardContent>
            </Card>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </div>
        )}

        {/* Step: camera */}
        {step === 'camera' && (
          <div className="space-y-3">
            <video ref={videoRef} className="w-full rounded-lg bg-black" autoPlay playsInline muted />
            <div className="flex gap-2">
              <Button onClick={captureFromCamera} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />Capturer
              </Button>
              <Button variant="outline" onClick={() => { stopCamera(); setStep('choose'); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Analyse de la CNI en cours...</p>
          </div>
        )}

        {/* Step: review */}
        {step === 'review' && editedData && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <p className="text-sm text-muted-foreground">Vérifiez et modifiez les données extraites :</p>
            {capturedImageUrl && (
              <img src={capturedImageUrl} alt="CNI capturée" className="w-full max-h-32 object-cover rounded-lg border" />
            )}
            <div className="grid grid-cols-2 gap-3">
              {([
                ['last_name', 'Nom'],
                ['first_name', 'Prénom'],
                ['date_of_birth', 'Date de naissance'],
                ['place_of_birth', 'Lieu de naissance'],
                ['gender', 'Sexe (M/F)'],
                ['nationality', 'Nationalité'],
                ['id_number', 'N° pièce'],
                ['id_issued_on', 'Délivré le'],
                ['id_issued_at', 'Délivré à'],
                ['usual_address', 'Adresse'],
              ] as [keyof CniData, string][]).map(([field, label]) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    value={editedData[field] || ''}
                    onChange={(e) => updateField(field, e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'review' && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setStep('choose'); setScannedData(null); setEditedData(null); }}>
              <RefreshCw className="h-4 w-4 mr-2" />Scanner à nouveau
            </Button>
            <Button onClick={handleConfirm}>
              <Check className="h-4 w-4 mr-2" />Confirmer et remplir
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
