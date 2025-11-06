
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Save, Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const branchFormSchema = z.object({
  branchName: z.string().min(1, 'Branch name is required.'),
  districtName: z.string().min(1, 'District name is required.'),
  contactPersonName: z.string().min(1, 'Contact person name is required.'),
  contactPersonPhone: z.string().min(10, 'Contact person phone must be at least 10 digits.'),
});

type BranchFormValues = z.infer<typeof branchFormSchema>;

export default function BranchDistrictRegistrationPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const branchForm = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      branchName: '',
      districtName: '',
      contactPersonName: '',
      contactPersonPhone: '',
    },
  });

  const onBranchSubmit = (data: BranchFormValues) => {
    setIsSubmitting(true);
    // Placeholder for actual submission logic
    console.log('Branch registration data:', data);
    setTimeout(() => {
        toast({
            title: 'Registration Submitted',
            description: 'The branch and district information has been recorded.',
        });
        branchForm.reset();
        setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-4xl">
             <div className="flex items-center gap-4 mb-4 md:mb-8">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Branch and District Registration</h1>
                    <p className="text-muted-foreground">Add new branch and district information to the system.</p>
                </div>
            </div>
            <Card>
                <CardContent className="p-6">
                    <Form {...branchForm}>
                        <form onSubmit={branchForm.handleSubmit(onBranchSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={branchForm.control}
                                    name="branchName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Branch Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., Main Branch" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={branchForm.control}
                                    name="districtName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>District Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., Central District" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={branchForm.control}
                                    name="contactPersonName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contact Person Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., Jane Doe" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={branchForm.control}
                                    name="contactPersonPhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contact Person Phone Number</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g., 0912345678" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Save Registration
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
