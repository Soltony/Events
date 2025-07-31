
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Upload, Loader2, CameraOff } from 'lucide-react';
import { checkInAttendee } from '@/lib/actions';
import type { Attendee, Event as EventType, TicketType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import dynamic from 'next/dynamic';
import { Html5Qrcode } from 'html5-qrcode';

interface CheckInResult extends Attendee {
    event: EventType;
    ticketType: TicketType;
}

const QrScannerComponent = dynamic(() => import('@/components/qr-scanner'), { 
    ssr: false,
    loading: () => (
        <div className="w-full aspect-square bg-muted rounded-lg border-dashed border-2 flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <p>Starting Camera...</p>
        </div>
    )
});


export default function ScanQrPage() {
    const [scanResult, setScanResult] = useState<CheckInResult | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleScanSuccess = async (decodedText: string) => {
        // Stop scanning immediately to prevent multiple scans
        setIsScanning(false);
        setIsLoading(true);
        setScanResult(null);
        setScanError(null);
        
        try {
            // Attempt to parse, but handle non-JSON QR codes gracefully.
            let ticketId;
            try {
                const data = JSON.parse(decodedText);
                ticketId = data.ticketId;
                if (!ticketId) {
                   throw new Error("Invalid QR code format.");
                }
            } catch (e) {
                 // If parsing fails, maybe the QR code just contains the ID.
                 // This is a fallback and can be removed if QR format is strict.
                 if (typeof decodedText === 'string' && decodedText.length > 0) {
                     // Basic validation if it could be an ID. This is just an example.
                     // In a real scenario, you might just pass the raw string to the backend.
                    ticketId = parseInt(decodedText, 10);
                    if (isNaN(ticketId)) {
                        throw new Error("QR code contains invalid data.");
                    }
                 } else {
                    throw new Error("QR code is empty or unreadable.");
                 }
            }
            
            const result = await checkInAttendee(ticketId);

            if (result.error) {
                setScanError(result.error);
                toast({ variant: 'destructive', title: 'Check-in Failed', description: result.error });
            } else if(result.data) {
                setScanResult(result.data);
                toast({ title: 'Check-in Successful!', description: `${result.data.name} has been checked in.` });
            }
        } catch (error: any) {
            console.error("Scan processing error:", error);
            const errorMessage = error.message || "Invalid QR code. Please scan a valid NibTera ticket.";
            setScanError(errorMessage);
            toast({ variant: 'destructive', title: 'Scan Error', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsLoading(true);
            setScanResult(null);
            setScanError(null);
            // This hidden div is a requirement for the html5-qrcode library to process files.
            const qrScanner = new Html5Qrcode('qr-code-reader-file-upload');
            try {
                const decodedText = await qrScanner.scanFile(file, false);
                await handleScanSuccess(decodedText);
            } catch (err) {
                 setScanError("Could not decode QR code from image.");
                 toast({ variant: 'destructive', title: 'Scan Error', description: "Could not decode QR code from image." });
            } finally {
                setIsLoading(false);
                if(fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        }
    };

    const renderResult = () => {
        if (isLoading) {
             return (
                <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Processing...</AlertTitle>
                    <AlertDescription>Validating ticket, please wait.</AlertDescription>
                </Alert>
            );
        }
        
        if (scanResult) {
            return (
                <Alert variant="default" className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800 dark:text-green-300">Check-in Successful</AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-400">
                       <div className="font-semibold text-lg">{scanResult.name}</div>
                       <p><span className="font-medium">Event:</span> {scanResult.event.name}</p>
                       <p><span className="font-medium">Ticket:</span> {scanResult.ticketType.name}</p>
                    </AlertDescription>
                </Alert>
            );
        }

        if (scanError) {
             return (
                 <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Check-in Failed</AlertTitle>
                    <AlertDescription>{scanError}</AlertDescription>
                </Alert>
             )
        }

        return null;
    }


    return (
        <div className="flex flex-1 flex-col gap-4 md:gap-8 max-w-2xl mx-auto">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Scan QR Code</h1>
                <p className="text-muted-foreground">
                    Point the camera at an attendee's ticket to check them in.
                </p>
            </div>
            
            <Card>
                <CardContent className="p-4 sm:p-6">
                    <div className="w-full aspect-square bg-muted rounded-lg border-dashed border-2 flex items-center justify-center overflow-hidden relative">
                         {isScanning ? (
                            <QrScannerComponent
                                onScanSuccess={handleScanSuccess}
                                onScanFailure={(error) => {
                                    // You can optionally handle scan failures, e.g., QR not found
                                }}
                            />
                         ) : (
                            <div className="text-center text-muted-foreground">
                                <CameraOff className="mx-auto h-12 w-12" />
                                <p className="mt-2">Camera is off. Press "Start Camera" to begin.</p>
                            </div>
                         )}
                    </div>
                     {/* Hidden element for file-based scanning */}
                    <div id="qr-code-reader-file-upload" style={{ display: 'none' }}></div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <Button onClick={() => {
                            setIsScanning(prev => !prev);
                            setScanResult(null);
                            setScanError(null);
                        }} variant={isScanning ? "destructive" : "default"}>
                            {isScanning ? 'Stop Scanning' : 'Start Camera'}
                        </Button>

                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isScanning}>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload QR from Image
                        </Button>
                        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
                    </div>
                </CardContent>
            </Card>

            {renderResult()}
            
        </div>
    );
}
