

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
    const [result, setResult] = useState<{data: CheckInResult | null, error: string | null} | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const qrUploaderId = "qr-code-image-uploader";


    const processScan = async (decodedText: string) => {
        setIsLoading(true);
        setResult(null);
        
        try {
            let ticketId;
            try {
                // Standard flow: QR code contains a JSON object
                const data = JSON.parse(decodedText);
                ticketId = data.ticketId;
                if (!ticketId || isNaN(parseInt(ticketId, 10))) {
                   throw new Error("Invalid QR code format.");
                }
                ticketId = parseInt(ticketId, 10);

            } catch (e) {
                 // Fallback flow: QR code contains only the ticket ID as a number
                 if (typeof decodedText === 'string' && /^\d+$/.test(decodedText)) {
                    ticketId = parseInt(decodedText, 10);
                 } else {
                    throw new Error("QR code contains invalid data.");
                 }
            }
            
            const checkInResult = await checkInAttendee(ticketId);

            if (checkInResult.error) {
                setResult({ data: checkInResult.data, error: checkInResult.error });
                toast({ variant: 'destructive', title: 'Check-in Failed', description: checkInResult.error });
            } else if(checkInResult.data) {
                setResult({ data: checkInResult.data, error: null });
                toast({ title: 'Check-in Successful!', description: `${checkInResult.data.name} has been checked in.` });
            }
        } catch (error: any) {
            console.error("Scan processing error:", error);
            const errorMessage = error.message || "Invalid QR code. Please scan a valid NibTera ticket.";
            setResult({ data: null, error: errorMessage });
            toast({ variant: 'destructive', title: 'Scan Error', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleScanSuccess = (decodedText: string) => {
        setIsScanning(false);
        processScan(decodedText);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        // Initialize scanner attached to a hidden div
        const qrScanner = new Html5Qrcode(qrUploaderId);
    
        try {
            // Decode QR from image
            const decodedText = await qrScanner.scanFile(file, false);
            await processScan(decodedText);
        } catch (err) {
            console.error("QR decode failed:", err);
            setResult({ data: null, error: "Could not decode QR code from image." });
            toast({
                variant: 'destructive',
                title: 'Scan Error',
                description: "Could not decode QR code from image.",
            });
        } finally {
            // Clean up: only needed for file scan
            if (qrScanner.isScanning) {
                await qrScanner.stop();
            }
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
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
        
        if (!result) return null;
        
        if (result.data && !result.error) {
            return (
                <Alert variant="default" className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800 dark:text-green-300">Check-in Successful</AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-400">
                       <div className="font-semibold text-lg">{result.data.name}</div>
                       <p><span className="font-medium">Event:</span> {result.data.event.name}</p>
                       <p><span className="font-medium">Ticket:</span> {result.data.ticketType.name}</p>
                    </AlertDescription>
                </Alert>
            );
        }

        if (result.error) {
             return (
                 <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Check-in Failed</AlertTitle>
                    <AlertDescription>
                      {result.error}
                      {result.data && (
                         <div className="mt-2 pt-2 border-t border-destructive/20">
                            <p className="font-semibold">{result.data.name}</p>
                            <p><span className="font-medium">Event:</span> {result.data.event.name}</p>
                          </div>
                      )}
                    </AlertDescription>
                </Alert>
             )
        }

        return null;
    }


    return (
        <div className="flex flex-1 flex-col gap-4 md:gap-8 max-w-2xl mx-auto p-4 sm:p-0">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Scan QR Code</h1>
                <p className="text-muted-foreground">
                    Point the camera at an attendee's ticket to check them in.
                </p>
            </div>
            
            <div id={qrUploaderId} style={{ display: 'none' }}></div>

            <Card>
                <CardContent className="p-4 sm:p-6">
                    <div className="w-full aspect-square bg-muted rounded-lg border-dashed border-2 flex items-center justify-center overflow-hidden relative">
                         {isScanning ? (
                            <QrScannerComponent
                                onScanSuccess={handleScanSuccess}
                                onScanFailure={(error) => {
                                    // You can optionally handle scan failures
                                }}
                            />
                         ) : (
                            <div className="text-center text-muted-foreground p-4">
                                <CameraOff className="mx-auto h-12 w-12" />
                                <p className="mt-2">Camera is off. Press "Start Camera" to begin.</p>
                            </div>
                         )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <Button onClick={() => {
                            setIsScanning(prev => !prev);
                            setResult(null);
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
