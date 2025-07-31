
'use client';

import { useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeError, Html5QrcodeResult } from 'html5-qrcode';
import { useToast } from '@/hooks/use-toast';

const QR_REGION_ID = "qr-code-reader-view";

interface QrScannerProps {
    onScanSuccess: (text: string) => void;
    onScanFailure: (error: string) => void;
}

export default function QrScannerComponent({ onScanSuccess, onScanFailure }: QrScannerProps) {
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Ensure the container element exists
        const containerElement = document.getElementById(QR_REGION_ID);
        if (!containerElement) {
            console.error(`QR Code reader element with ID ${QR_REGION_ID} not found.`);
            return;
        }

        const html5QrCode = new Html5Qrcode(QR_REGION_ID, { verbose: false });

        const qrCodeSuccessCallback = (decodedText: string, result: Html5QrcodeResult) => {
            onScanSuccess(decodedText);
            // After a successful scan, we should stop the scanner
            if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(err => console.error("Failed to stop scanner after success", err));
            }
        };

        const qrCodeErrorCallback = (errorMessage: string, error: Html5QrcodeError) => {
            // This callback is called frequently, so we typically ignore errors here
            // unless we want to display a "no QR code found" message.
            // onScanFailure(errorMessage);
        };
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            // Only show the camera feed, not the result text from the library
            disableFlip: false
        };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
        ).catch(err => {
            console.error("Unable to start scanning", err);
            toast({ variant: 'destructive', title: 'Camera Error', description: err.message || 'Could not access camera. Please check permissions.' });
        });
        
        // Cleanup function to stop the scanner when the component unmounts
        return () => {
            if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().catch(err => {
                    console.error("Failed to stop scanner on cleanup", err);
                });
            }
        };
    }, [onScanSuccess, toast]);

    return <div id={QR_REGION_ID} className="w-full h-full" />;
}
