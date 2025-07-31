
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Upload, Loader2 } from 'lucide-react';
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
    loading: () => <div className="w-full aspect-square bg-muted rounded-lg border-dashed border-2 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
});


export default function ScanQrPage() {
    const [scanResult, setScanResult] = useState<CheckInResult | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleScanSuccess = async (decodedText: string) => {
        setIsScanning(false);
        setIsLoading(true);
        setScanResult(null);
        setScanError(null);
        
        try {
            // A brief delay can sometimes help UI updates register before heavy processing
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
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsLoading(true);
            setScanResult(null);
            setScanError(null);
            const qrScanner = new Html5Qrcode('qr-code-reader-file-upload', { verbose: false });
             // A hidden div is needed for the file scanner to work
            const hiddenDiv = document.getElementById('qr-code-reader-file-upload');
            if (!hiddenDiv) {
                console.error("Hidden div for file upload not found.");
                setIsLoading(false);
                return;
            }
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
                     <QrScannerComponent
                        onScanSuccess={handleScanSuccess}
                        isScanning={isScanning}
                        onStop={() => setIsScanning(false)}
                    />
                    <div id="qr-code-reader-file-upload" style={{ display: 'none' }}></div>
                    
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
