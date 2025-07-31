
'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Camera } from 'lucide-react';

const QR_REGION_ID = "qr-code-reader";

interface QrScannerProps {
    onScanSuccess: (text: string) => void;
    isScanning: boolean;
    onStop: () => void;
}

export default function QrScannerComponent({ onScanSuccess, isScanning, onStop }: QrScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (!scannerRef.current) {
            scannerRef.current = new Html5Qrcode(QR_REGION_ID, {
                verbose: false
            });
        }
        const scanner = scannerRef.current;
        
        if (isScanning && scanner.getState() === Html5QrcodeScannerState.NOT_STARTED) {
            scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                onScanSuccess,
                (errorMessage) => { /* ignore errors */ }
            ).catch(err => {
                console.error("Unable to start scanning", err);
                toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera. Please check permissions.' });
                onStop();
            });
        } else if (!isScanning && scanner.isScanning) {
            scanner.stop().catch(err => console.error("Failed to stop scanner", err));
        }

        return () => {
             if (scanner && scanner.isScanning) {
                scanner.stop().catch(err => {
                    console.error("Failed to stop scanner on cleanup", err);
                });
            }
        };
    }, [isScanning, onScanSuccess, toast, onStop]);


    return (
        <div className="w-full aspect-square bg-muted rounded-lg border-dashed border-2 flex items-center justify-center transition-all overflow-hidden relative">
             <div id={QR_REGION_ID} className={cn("absolute inset-0 transition-opacity", isScanning ? "opacity-100" : "opacity-0")} />
            {!isScanning && (
                <div className="text-center text-muted-foreground">
                    <Camera className="mx-auto h-12 w-12" />
                    <p className="mt-2">Camera is off</p>
                </div>
            )}
        </div>
    );
}
