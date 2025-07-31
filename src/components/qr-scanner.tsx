
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
        // This check is crucial for preventing SSR execution
        if (typeof window === 'undefined') {
            return;
        }

        const containerElement = document.getElementById(QR_REGION_ID);
        if (!containerElement) {
            console.error(`QR Code reader element with ID ${QR_REGION_ID} not found.`);
            return;
        }

        // html5-qrcode instance
        const html5QrCode = new Html5Qrcode(QR_REGION_ID);
        let isScannerRunning = false;

        const qrCodeSuccessCallback = (decodedText: string, result: Html5QrcodeResult) => {
            if (isScannerRunning) {
                onScanSuccess(decodedText);
                isScannerRunning = false; // Prevent multiple success triggers
                 html5QrCode.stop().catch(err => {
                    console.error("Failed to stop scanner after success", err);
                });
            }
        };

        const qrCodeErrorCallback = (errorMessage: string, error: Html5QrcodeError) => {
            // This callback is called frequently, so we can ignore most errors.
            // You can use onScanFailure for more verbose logging if needed.
        };

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false,
        };
        
        // Start scanning
        html5QrCode.start(
            { facingMode: "environment" },
            config,
            qrCodeSuccessCallback,
            qrCodeErrorCallback
        ).then(() => {
            isScannerRunning = true;
        }).catch(err => {
            console.error("Unable to start QR Code scanner.", err);
            onScanFailure(err.message || 'Could not access camera. Please check permissions.');
            toast({
                variant: 'destructive',
                title: 'Camera Error',
                description: err.message || 'Could not access camera. Please check permissions.'
            });
        });

        // Cleanup function to stop the scanner when the component unmounts
        return () => {
            if (isScannerRunning && html5QrCode.isScanning) {
                html5QrCode.stop().catch(err => {
                    console.error("Error stopping the scanner on cleanup.", err);
                });
            }
        };
    }, [onScanSuccess, onScanFailure, toast]);

    return <div id={QR_REGION_ID} className="w-full h-full" />;
}
