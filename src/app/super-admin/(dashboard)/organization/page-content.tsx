
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Building, Users, Pencil, Trash2, Download, Upload } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getDistricts,
  getBranches,
  createDistrict,
  createBranch,
  updateDistrict,
  updateBranch,
  deleteDistrict,
  deleteBranch,
  bulkCreateDistricts,
  bulkCreateBranches,
} from '@/lib/super-admin-user-actions';
import type { District, Branch } from '@prisma/client';

interface DistrictWithBranches extends District {
  branches: Branch[];
}

const districtFormSchema = z.object({
  districtName: z.string().min(1, 'District name is required.'),
  contactPersonName: z.string().min(1, 'Contact person name is required.'),
  contactPersonPhone: z.string().min(10, 'Contact person phone must be at least 10 digits.'),
});

const branchFormSchema = z.object({
  branchName: z.string().min(1, 'Branch name is required.'),
  districtId: z.string({ required_error: 'Please select a district.' }),
  contactPersonName: z.string().min(1, 'Contact person name is required.'),
  contactPersonPhone: z.string().min(10, 'Contact person phone must be at least 10 digits.'),
});

type DistrictFormValues = z.infer<typeof districtFormSchema>;
type BranchFormValues = z.infer<typeof branchFormSchema>;

export default function OrganizationPageContent() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmittingDistrict, setIsSubmittingDistrict] = useState(false);
  const [isSubmittingBranch, setIsSubmittingBranch] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingDistrict, setDeletingDistrict] = useState<District | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [isSubmittingEditDistrict, setIsSubmittingEditDistrict] = useState(false);
  const [isSubmittingEditBranch, setIsSubmittingEditBranch] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'district' | 'branch'>('district');
  const [isBulkDistrictOpen, setIsBulkDistrictOpen] = useState(false);
  const [isBulkBranchOpen, setIsBulkBranchOpen] = useState(false);
  const [bulkDistrictFile, setBulkDistrictFile] = useState<File | null>(null);
  const [bulkBranchFile, setBulkBranchFile] = useState<File | null>(null);
  const [isBulkUploadingDistricts, setIsBulkUploadingDistricts] = useState(false);
  const [isBulkUploadingBranches, setIsBulkUploadingBranches] = useState(false);

  const fetchAndSetData = async () => {
    const [fetchedDistricts, fetchedBranches] = await Promise.all([getDistricts(), getBranches()]);
    setDistricts(fetchedDistricts);
    setBranches(fetchedBranches);
  };

  useEffect(() => {
    fetchAndSetData();
  }, []);

  const districtForm = useForm<DistrictFormValues>({
    resolver: zodResolver(districtFormSchema),
    defaultValues: { districtName: '', contactPersonName: '', contactPersonPhone: '' },
  });

  const branchForm = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: { branchName: '', districtId: undefined, contactPersonName: '', contactPersonPhone: '' },
  });

  const editDistrictForm = useForm<DistrictFormValues>({
    resolver: zodResolver(districtFormSchema),
    defaultValues: { districtName: '', contactPersonName: '', contactPersonPhone: '' },
  });

  const editBranchForm = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: { branchName: '', districtId: undefined, contactPersonName: '', contactPersonPhone: '' },
  });

  const openEditDistrict = (district: District) => {
    setEditingDistrict(district);
    editDistrictForm.reset({
      districtName: district.name,
      contactPersonName: district.contactPersonName,
      contactPersonPhone: district.contactPersonPhone,
    });
  };

  const openEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    editBranchForm.reset({
      branchName: branch.name,
      districtId: branch.districtId,
      contactPersonName: branch.contactPersonName,
      contactPersonPhone: branch.contactPersonPhone,
    });
  };

  const onEditDistrictSubmit = async (data: DistrictFormValues) => {
    if (!editingDistrict) return;
    setIsSubmittingEditDistrict(true);
    try {
      const result = await updateDistrict(editingDistrict.id, data);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
        return;
      }
      toast({ title: 'District Updated', description: `The district "${data.districtName}" has been successfully updated.` });
      setEditingDistrict(null);
      await fetchAndSetData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update the district.' });
    } finally {
      setIsSubmittingEditDistrict(false);
    }
  };

  const onEditBranchSubmit = async (data: BranchFormValues) => {
    if (!editingBranch) return;
    setIsSubmittingEditBranch(true);
    try {
      const result = await updateBranch(editingBranch.id, data);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
        return;
      }
      toast({ title: 'Branch Updated', description: `The branch "${data.branchName}" has been successfully updated.` });
      setEditingBranch(null);
      await fetchAndSetData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update the branch.' });
    } finally {
      setIsSubmittingEditBranch(false);
    }
  };

  const handleDeleteDistrict = async () => {
    if (!deletingDistrict) return;
    setIsDeleting(true);
    try {
      const result = await deleteDistrict(deletingDistrict.id);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
        return;
      }
      toast({ title: 'District Deleted', description: `The district "${deletingDistrict.name}" has been deleted.` });
      setDeletingDistrict(null);
      await fetchAndSetData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete the district.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!deletingBranch) return;
    setIsDeleting(true);
    try {
      const result = await deleteBranch(deletingBranch.id);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
        return;
      }
      toast({ title: 'Branch Deleted', description: `The branch "${deletingBranch.name}" has been deleted.` });
      setDeletingBranch(null);
      await fetchAndSetData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete the branch.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const onDistrictSubmit = async (data: DistrictFormValues) => {
    setIsSubmittingDistrict(true);
    try {
      const result = await createDistrict(data);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
        return;
      }
      toast({ title: 'District Registered', description: `The district "${data.districtName}" has been successfully saved.` });
      districtForm.reset();
      await fetchAndSetData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to save the district.' });
    } finally {
      setIsSubmittingDistrict(false);
    }
  };

  const onBranchSubmit = async (data: BranchFormValues) => {
    setIsSubmittingBranch(true);
    try {
      const result = await createBranch(data);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
        return;
      }
      toast({ title: 'Branch Registered', description: `The branch "${data.branchName}" has been successfully saved.` });
      branchForm.reset();
      await fetchAndSetData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to save the branch.' });
    } finally {
      setIsSubmittingBranch(false);
    }
  };

  const districtsWithBranches: DistrictWithBranches[] = districts.map((district) => ({
    ...district,
    branches: branches.filter((branch) => branch.districtId === district.id),
  }));

  const downloadCsv = (filename: string, rows: Record<string, string>[]) => {
    const headers = Object.keys(rows[0]);
    const escapeCell = (value: string) => {
      if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };
    const csv = [headers, ...rows.map((row) => headers.map((header) => row[header]))]
      .map((line) => line.map(escapeCell).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportDistricts = () => {
    if (districts.length === 0) {
      toast({ variant: 'destructive', title: 'Nothing to export', description: 'There are no districts to export.' });
      return;
    }
    downloadCsv('districts.csv', districts.map((district) => ({
      'District Name': district.name,
      'Contact Person Name': district.contactPersonName,
      'Contact Person Phone': district.contactPersonPhone,
    })));
  };

  const handleExportBranches = () => {
    if (branches.length === 0) {
      toast({ variant: 'destructive', title: 'Nothing to export', description: 'There are no branches to export.' });
      return;
    }
    downloadCsv('branches.csv', branches.map((branch) => ({
      'Branch Name': branch.name,
      District: districts.find((district) => district.id === branch.districtId)?.name ?? '',
      'Contact Person Name': branch.contactPersonName,
      'Contact Person Phone': branch.contactPersonPhone,
    })));
  };

  const parseCsvRows = (text: string): string[][] =>
    text
      .split(/\r\n|\n|\r/)
      .filter((line) => line.trim().length > 0)
      .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));

  // Maps CSV rows to plain objects keyed by lowercased header name. Falls back
  // to a fixed column order if the file has no recognizable header row, so
  // older headerless exports (name[,district]) still work.
  const rowsToRecords = (rows: string[][], fallbackHeaders: string[]): Record<string, string>[] => {
    if (rows.length === 0) return [];
    const firstRow = rows[0].map((cell) => cell.trim().toLowerCase());
    const hasHeader = firstRow.includes('name');
    const headers = hasHeader ? firstRow : fallbackHeaders;
    const dataRows = hasHeader ? rows.slice(1) : rows;
    return dataRows.map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, i) => {
        record[header] = (row[i] ?? '').trim();
      });
      return record;
    });
  };

  const downloadDistrictTemplate = () => {
    downloadCsv('district-upload-template.csv', [{
      name: 'Central District',
      'Contact Person Name': 'Jane Doe',
      'Contact Person Phone': '0912345678',
    }]);
  };

  const downloadBranchTemplate = () => {
    downloadCsv('branch-upload-template.csv', [{
      name: 'Main Branch',
      district: 'Central District',
      'Contact Person Name': 'John Smith',
      'Contact Person Phone': '0987654321',
    }]);
  };

  const handleBulkUploadDistricts = async () => {
    if (!bulkDistrictFile) return;
    setIsBulkUploadingDistricts(true);
    try {
      const text = await bulkDistrictFile.text();
      const records = rowsToRecords(parseCsvRows(text), ['name']);
      const districtRows = records
        .map((r) => ({
          name: r['name'] ?? '',
          contactPersonName: r['contact person name'] ?? '',
          contactPersonPhone: r['contact person phone'] ?? '',
        }))
        .filter((row) => row.name);
      if (districtRows.length === 0) {
        toast({ variant: 'destructive', title: 'No districts found', description: 'The CSV file did not contain any district names.' });
        return;
      }
      const result = await bulkCreateDistricts(districtRows);
      if (result.error !== undefined) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
        return;
      }
      const { created, skipped } = result.data;
      toast({
        title: 'Bulk Upload Complete',
        description: `${created} district${created === 1 ? '' : 's'} created.${skipped.length ? ` Skipped: ${skipped.join(', ')}.` : ''}`,
      });
      setIsBulkDistrictOpen(false);
      setBulkDistrictFile(null);
      await fetchAndSetData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to process the CSV file.' });
    } finally {
      setIsBulkUploadingDistricts(false);
    }
  };

  const handleBulkUploadBranches = async () => {
    if (!bulkBranchFile) return;
    setIsBulkUploadingBranches(true);
    try {
      const text = await bulkBranchFile.text();
      const records = rowsToRecords(parseCsvRows(text), ['name', 'district']);
      const branchRows = records
        .map((r) => ({
          name: r['name'] ?? '',
          district: r['district'] ?? '',
          contactPersonName: r['contact person name'] ?? '',
          contactPersonPhone: r['contact person phone'] ?? '',
        }))
        .filter((row) => row.name);
      if (branchRows.length === 0) {
        toast({ variant: 'destructive', title: 'No branches found', description: 'The CSV file did not contain any branch rows.' });
        return;
      }
      const result = await bulkCreateBranches(branchRows);
      if (result.error !== undefined) {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
        return;
      }
      const { created, skipped } = result.data;
      toast({
        title: 'Bulk Upload Complete',
        description: `${created} branch${created === 1 ? '' : 'es'} created.${skipped.length ? ` Skipped: ${skipped.join(', ')}.` : ''}`,
      });
      setIsBulkBranchOpen(false);
      setBulkBranchFile(null);
      await fetchAndSetData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to process the CSV file.' });
    } finally {
      setIsBulkUploadingBranches(false);
    }
  };

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organization Management</h1>
          <p className="text-muted-foreground">Manage branches, districts, and Head Office organizational units. Add new districts first, then add branches under them.</p>
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'district' | 'branch')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="district">District Registration</TabsTrigger>
            <TabsTrigger value="branch">Branch Registration</TabsTrigger>
          </TabsList>
          <TabsContent value="district">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Register a New District</CardTitle>
                  <CardDescription>Use this form to add a new district to the system.</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setIsBulkDistrictOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" /> Bulk Upload
                </Button>
              </CardHeader>
              <CardContent>
                <Form {...districtForm}>
                  <form onSubmit={districtForm.handleSubmit(onDistrictSubmit)} className="space-y-6">
                    <FormField control={districtForm.control} name="districtName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>District Name</FormLabel>
                        <FormControl><Input placeholder="e.g., Central District" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={districtForm.control} name="contactPersonName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person Name</FormLabel>
                          <FormControl><Input placeholder="e.g., Jane Doe" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={districtForm.control} name="contactPersonPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Person Phone</FormLabel>
                          <FormControl><Input placeholder="e.g., 0912345678" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={isSubmittingDistrict} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                        {isSubmittingDistrict ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save District
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="branch">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Register a New Branch</CardTitle>
                  <CardDescription>Select a district and provide branch details.</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setIsBulkBranchOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" /> Bulk Upload
                </Button>
              </CardHeader>
              <CardContent>
                <Form {...branchForm}>
                  <form onSubmit={branchForm.handleSubmit(onBranchSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={branchForm.control} name="branchName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch Name</FormLabel>
                          <FormControl><Input placeholder="e.g., Main Branch" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={branchForm.control} name="districtId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>District</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {districts.map((district) => (<SelectItem key={district.id} value={district.id}>{district.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={branchForm.control} name="contactPersonName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch Contact Person Name</FormLabel>
                          <FormControl><Input placeholder="e.g., John Smith" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={branchForm.control} name="contactPersonPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch Contact Person Phone</FormLabel>
                          <FormControl><Input placeholder="e.g., 0987654321" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button type="submit" disabled={isSubmittingBranch} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                        {isSubmittingBranch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Branch
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{activeTab === 'district' ? 'Registered Districts' : 'Registered Districts and Branches'}</CardTitle>
              <CardDescription>
                {activeTab === 'district' ? 'A list of all registered districts.' : 'A hierarchical view of all registered entities.'}
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={handleExportDistricts}>
                <Download className="mr-2 h-4 w-4" /> Export Districts
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportBranches}>
                <Download className="mr-2 h-4 w-4" /> Export Branches
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === 'district' ? (
              <div className="space-y-4">
                {districts.length > 0 ? (
                  districts.map((district, index) => (
                    <div key={district.id}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Building className="h-5 w-5" />
                        </div>
                        <h3 className="flex-1 text-lg font-semibold">{district.name}</h3>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDistrict(district)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit District</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeletingDistrict(district)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete District</span>
                        </Button>
                      </div>
                      {index < districts.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground">No districts have been registered yet.</p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {districtsWithBranches.length > 0 ? (
                  districtsWithBranches.map((district, index) => (
                    <div key={district.id}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Building className="h-5 w-5" />
                        </div>
                        <h3 className="flex-1 text-lg font-semibold">{district.name}</h3>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDistrict(district)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit District</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeletingDistrict(district)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete District</span>
                        </Button>
                      </div>
                      {district.branches.length > 0 ? (
                        <ul className="mt-2 ml-6 space-y-2 border-l-2 border-dashed pl-6">
                          {district.branches.map((branch) => (
                            <li key={branch.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span className="flex-1">{branch.name}</span>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditBranch(branch)}>
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="sr-only">Edit Branch</span>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeletingBranch(branch)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                <span className="sr-only">Delete Branch</span>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 ml-12 text-sm text-muted-foreground italic">No branches registered for this district.</p>
                      )}
                      {index < districtsWithBranches.length - 1 && <Separator className="mt-6" />}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground">No districts have been registered yet.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isBulkDistrictOpen}
        onOpenChange={(open) => {
          setIsBulkDistrictOpen(open);
          if (!open) setBulkDistrictFile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Districts</DialogTitle>
            <DialogDescription>
              Upload a CSV file with &quot;name&quot;, &quot;Contact Person Name&quot;, and &quot;Contact Person Phone&quot;
              columns to create multiple districts at once. All three fields are required for each row.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <button
              type="button"
              onClick={downloadDistrictTemplate}
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: '#B45309' }}
            >
              <Download className="h-4 w-4" /> Download CSV template
            </button>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">CSV File</label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setBulkDistrictFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsBulkDistrictOpen(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={!bulkDistrictFile || isBulkUploadingDistricts}
              onClick={handleBulkUploadDistricts}
              style={{ backgroundColor: '#FBBF24', color: '#422006' }}
            >
              {isBulkUploadingDistricts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload Districts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBulkBranchOpen}
        onOpenChange={(open) => {
          setIsBulkBranchOpen(open);
          if (!open) setBulkBranchFile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Branches</DialogTitle>
            <DialogDescription>
              Upload a CSV file with &quot;name&quot;, &quot;district&quot;, &quot;Contact Person Name&quot;, and
              &quot;Contact Person Phone&quot; columns to create multiple branches at once. The district name must match an
              existing registered district, and all fields are required for each row.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <button
              type="button"
              onClick={downloadBranchTemplate}
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: '#B45309' }}
            >
              <Download className="h-4 w-4" /> Download CSV template
            </button>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">CSV File</label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setBulkBranchFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsBulkBranchOpen(false)}>Cancel</Button>
            <Button
              type="button"
              disabled={!bulkBranchFile || isBulkUploadingBranches}
              onClick={handleBulkUploadBranches}
              style={{ backgroundColor: '#FBBF24', color: '#422006' }}
            >
              {isBulkUploadingBranches ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload Branches
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDistrict} onOpenChange={(open) => !open && setEditingDistrict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit District</DialogTitle>
            <DialogDescription>Update the details for this district.</DialogDescription>
          </DialogHeader>
          <Form {...editDistrictForm}>
            <form onSubmit={editDistrictForm.handleSubmit(onEditDistrictSubmit)} className="space-y-6">
              <FormField control={editDistrictForm.control} name="districtName" render={({ field }) => (
                <FormItem>
                  <FormLabel>District Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Central District" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={editDistrictForm.control} name="contactPersonName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Jane Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editDistrictForm.control} name="contactPersonPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person Phone</FormLabel>
                    <FormControl><Input placeholder="e.g., 0912345678" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingDistrict(null)}>Cancel</Button>
                <Button type="submit" disabled={isSubmittingEditDistrict} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                  {isSubmittingEditDistrict ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBranch} onOpenChange={(open) => !open && setEditingBranch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>Update the details for this branch.</DialogDescription>
          </DialogHeader>
          <Form {...editBranchForm}>
            <form onSubmit={editBranchForm.handleSubmit(onEditBranchSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={editBranchForm.control} name="branchName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Main Branch" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editBranchForm.control} name="districtId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {districts.map((district) => (<SelectItem key={district.id} value={district.id}>{district.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={editBranchForm.control} name="contactPersonName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch Contact Person Name</FormLabel>
                    <FormControl><Input placeholder="e.g., John Smith" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editBranchForm.control} name="contactPersonPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch Contact Person Phone</FormLabel>
                    <FormControl><Input placeholder="e.g., 0987654321" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingBranch(null)}>Cancel</Button>
                <Button type="submit" disabled={isSubmittingEditBranch} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                  {isSubmittingEditBranch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingDistrict} onOpenChange={(open) => !open && setDeletingDistrict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this district?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the district <strong>{deletingDistrict?.name}</strong>. This action cannot be undone,
              and it will fail if the district still has branches assigned to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDistrict} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingBranch} onOpenChange={(open) => !open && setDeletingBranch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this branch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the branch <strong>{deletingBranch?.name}</strong>. This action cannot be undone,
              and it will fail if the branch still has users assigned to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBranch} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
