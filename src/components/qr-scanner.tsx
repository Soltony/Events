
'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
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
        let didStart = false;

        if (isScanning) {
            scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                onScanSuccess,
                (errorMessage) => { /* ignore errors */ }
            ).then(() => {
                didStart = true;
            }).catch(err => {
                console.error("Unable to start scanning", err);
                toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera. Please check permissions.' });
                onStop();
            });
        } else {
             if (scanner.isScanning) {
                scanner.stop().catch(err => console.error("Failed to stop scanner", err));
             }
        }

        return () => {
             if (didStart && scanner && scanner.isScanning) {
                scanner.stop().catch(err => {
                    console.error("Failed to stop scanner on cleanup", err);
                });
            }
        };
    }, [isScanning, onScanSuccess, toast, onStop]);


    return (
        <div id={QR_REGION_ID} className={cn("w-full aspect-square bg-muted rounded-lg border-dashed border-2 flex items-center justify-center transition-all overflow-hidden", isScanning ? 'p-0 border-primary' : 'p-4')}>
            {!isScanning && (
                <div className="text-center text-muted-foreground">
                    <Camera className="mx-auto h-12 w-12" />
                    <p className="mt-2">Camera is off</p>
                </div>
            )}
        </div>
    );
}
