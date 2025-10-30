'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Upload, Loader2, CameraOff, Video } from 'lucide-react';
import { checkInAttendee } from '@/lib/actions';
import type { Attendee, Event as EventType, TicketType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

interface CheckInResult extends Attendee {
  event: EventType;
  ticketType: TicketType;
}

const QR_REGION_ID = 'qr-code-reader-view';

export default function ScanQrPage() {
  const [result, setResult] = useState<{ data: CheckInResult | null; error: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();

  /** ✅ Get camera permission */
  const getCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setHasCameraPermission(true);
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error: any) {
      console.error('Camera permission error:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Error',
        description: 'Please allow camera access in your browser settings.',
      });
      return false;
    }
  };

  /** ✅ Handle decoded QR */
  const processScan = async (decodedText: string) => {
    setIsLoading(true);
    setResult(null);
    try {
      const ticketId = parseInt(decodedText, 10);
      if (isNaN(ticketId)) throw new Error('Invalid QR data.');
      const checkInResult = await checkInAttendee(ticketId);
      if (checkInResult.error) {
        setResult({ data: checkInResult.data, error: checkInResult.error });
        toast({ variant: 'destructive', title: 'Check-in Failed', description: checkInResult.error });
      } else {
        setResult({ data: checkInResult.data, error: null });
        toast({ title: 'Success!', description: `${checkInResult.data.name} checked in.` });
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setResult({ data: null, error: err.message || 'QR not valid.' });
      toast({ variant: 'destructive', title: 'Scan Error', description: err.message });
    } finally {
      setIsLoading(false);
      stopScanning();
    }
  };

  /** ✅ Start scanning */
  const startScanning = async () => {
    const permission = hasCameraPermission ?? (await getCameraPermission());
    if (!permission) return;

    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      }

      const scanner = new Html5Qrcode(QR_REGION_ID);
      html5QrCodeRef.current = scanner;

      const config = { fps: 10, qrbox: 250 };

      await scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => processScan(decodedText),
        (errorMsg) => console.warn('QR scan error:', errorMsg)
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Camera start error:', err);
      toast({
        variant: 'destructive',
        title: 'Camera Error',
        description: 'Could not start camera. Refresh or allow permissions.',
      });
      setIsScanning(false);
    }
  };

  /** ✅ Stop scanning */
  const stopScanning = async () => {
    try {
      if (html5QrCodeRef.current) {
        const state = html5QrCodeRef.current.getState?.();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch (err) {
      console.warn('Stop scanner failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  /** ✅ Scan QR from image */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileScanner = new Html5Qrcode('qr-code-image-uploader');
      const decodedText = await fileScanner.scanFile(file, true);
      await processScan(decodedText);
      await fileScanner.clear();
    } catch (err) {
      console.error('Image scan failed:', err);
      setResult({ data: null, error: 'Could not decode QR from image.' });
      toast({
        variant: 'destructive',
        title: 'Scan Error',
        description: 'Could not decode QR code from uploaded image.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ✅ Fixed useEffect for async permission
  useEffect(() => {
    const init = async () => {
      await getCameraPermission();
    };
    init();
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8 max-w-2xl mx-auto p-4 sm:p-0">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Scan QR Code</h1>
        <p className="text-muted-foreground">Point the camera at the ticket to check in.</p>
      </div>

      <div id="qr-code-image-uploader" style={{ display: 'none' }}></div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="w-full aspect-square bg-muted rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden relative">
            <div id={QR_REGION_ID} className="w-full h-full" />
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                <CameraOff className="h-10 w-10 mb-2" />
                <p>Camera inactive. Click "Start Camera".</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Button onClick={isScanning ? stopScanning : startScanning} variant={isScanning ? 'destructive' : 'default'}>
              {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
              {isScanning ? 'Stop Scanning' : 'Start Camera'}
            </Button>

            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isScanning}>
              <Upload className="mr-2 h-4 w-4" /> Upload QR from Image
            </Button>
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        </CardContent>
      </Card>

      {result && (
        <Alert variant={result.error ? 'destructive' : 'default'}>
          {result.error ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
          <AlertTitle>{result.error ? 'Check-in Failed' : 'Success'}</AlertTitle>
          <AlertDescription>
            {result.error ? result.error : `${result.data?.name} has been checked in.`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
