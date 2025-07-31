
'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, CheckCircle2, XCircle, Upload, Loader2, User, Ticket as TicketIcon } from 'lucide-react';
import { checkInAttendee } from '@/lib/actions';
import type { Attendee, Event as EventType, TicketType } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';

interface CheckInResult extends Attendee {
    event: EventType;
    ticketType: TicketType;
}

const QR_REGION_ID = "qr-code-reader";

function QrScannerComponent({ onScanSuccess, onScanError, onStart, onStop, isScanning }: { 
    onScanSuccess: (text: string) => void,
    onScanError: (error: string) => void,
    onStart: () => void,
    onStop: () => void,
    isScanning: boolean
}) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!scannerRef.current) {
            scannerRef.current = new Html5Qrcode(QR_REGION_ID, {
                verbose: false
            });
        }
        const scanner = scannerRef.current;

        if (isScanning) {
            scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                onScanSuccess,
                onScanError
            ).catch(err => {
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
             if (scanner && scanner.isScanning) {
                scanner.stop().catch(err => {
                    console.error("Failed to stop scanner on cleanup", err);
                });
            }
        };
    }, [isScanning, onScanSuccess, onScanError, toast, onStop]);


    return (
        <div id={QR_REGION_ID} className={cn("w-full aspect-square bg-muted rounded-lg border-dashed border-2 flex items-center justify-center transition-all", isScanning ? 'p-0' : 'p-4')}>
            {!isScanning && (
                <div className="text-center text-muted-foreground">
                    <Camera className="mx-auto h-12 w-12" />
                    <p className="mt-2">Camera is off</p>
                </div>
            )}
        </div>
    );
}


export default function ScanQrPage() {
    const [scanResult, setScanResult] = useState<CheckInResult | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleScanSuccess = async (decodedText: string) => {
        setIsScanning(false);
        setIsLoading(true);
        setScanResult(null);
        setScanError(null);
        
        try {
            // Added a slight delay to allow UI to update
            await new Promise(resolve => setTimeout(resolve, 100));

            const data = JSON.parse(decodedText);
            if (!data.ticketId) {
                throw new Error("Invalid QR code format.");
            }

            const result = await checkInAttendee(data.ticketId);

            if (result.error) {
                setScanError(result.error);
                toast({ variant: 'destructive', title: 'Check-in Failed', description: result.error });
            } else if(result.data) {
                setScanResult(result.data);
                toast({ title: 'Check-in Successful!', description: `${result.data.name} has been checked in.` });
            }
        } catch (error) {
            console.error("Scan processing error:", error);
            const errorMessage = "Invalid QR code. Please scan a valid NibTera ticket.";
            setScanError(errorMessage);
            toast({ variant: 'destructive', title: 'Scan Error', description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleScanError = (errorMessage: string) => {
        // This is called frequently by the library, we can ignore it.
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsLoading(true);
            const qrScanner = new Html5Qrcode(QR_REGION_ID, { verbose: false });
            try {
                const decodedText = await qrScanner.scanFile(file, false);
                await handleScanSuccess(decodedText);
            } catch (err) {
                 setScanError("Could not decode QR code from image.");
            } finally {
                setIsLoading(false);
                // Clear the file input for next upload
                if(fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        }
    };

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
                    {isClient && (
                         <QrScannerComponent
                            onScanSuccess={handleScanSuccess}
                            onScanError={handleScanError}
                            onStart={() => setIsScanning(true)}
                            onStop={() => setIsScanning(false)}
                            isScanning={isScanning}
                        />
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        {isScanning ? (
                            <Button onClick={() => setIsScanning(false)} variant="destructive">Stop Scanning</Button>
                        ) : (
                            <Button onClick={() => {
                                setIsScanning(true);
                                setScanResult(null);
                                setScanError(null);
                            }}>Start Camera</Button>
                        )}
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload QR from Image
                        </Button>
                        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
                    </div>
                </CardContent>
            </Card>

            {isLoading && (
                <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertTitle>Processing...</AlertTitle>
                    <AlertDescription>Validating ticket, please wait.</AlertDescription>
                </Alert>
            )}

            {scanResult && !isLoading && (
                <Alert variant="default" className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800 dark:text-green-300">Check-in Successful</AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-400">
                       <div className="font-semibold text-lg">{scanResult.name}</div>
                       <p><span className="font-medium">Event:</span> {scanResult.event.name}</p>
                       <p><span className="font-medium">Ticket:</span> {scanResult.ticketType.name}</p>
                    </AlertDescription>
                </Alert>
            )}

            {scanError && !isLoading && (
                 <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Check-in Failed</AlertTitle>
                    <AlertDescription>{scanError}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}

