
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, PlusCircle } from 'lucide-react';
import type { Role } from '@prisma/client';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getRoles, updateRole } from '@/lib/actions';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';


const roleFormSchema = z.object({
  name: z.string().min(3, { message: 'Role name must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  permissions: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'You have to select at least one permission.',
  }),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

const permissionCategories = {
    Dashboard: ['View', 'Update', 'Create', 'Delete'],
    'Scan QR': ['View', 'Update', 'Create', 'Delete'],
    'Manage and Create Events': ['View', 'Update', 'Create', 'Delete'],
    Reports: ['View', 'Update', 'Create', 'Delete'],
    Settings: ['View', 'Update', 'Create', 'Delete'],
};

function RoleForm({ role, onSave }: { role: Role; onSave: (id: string, data: RoleFormValues) => Promise<void> }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: role.name,
      description: role.description,
      permissions: role.permissions ? role.permissions.split(',') : [],
    },
  });

  const handleFullAccessChange = (category: string, actions: string[], checked: boolean | 'indeterminate') => {
      const currentPermissions = form.getValues('permissions');
      const categoryPermissions = actions.map(action => `${category}:${action}`);
      
      let newPermissions;
      if (checked) {
          newPermissions = [...new Set([...currentPermissions, ...categoryPermissions])];
      } else {
          newPermissions = currentPermissions.filter(p => !categoryPermissions.includes(p));
      }
      form.setValue('permissions', newPermissions, { shouldValidate: true });
  };
  
  async function onSubmit(data: RoleFormValues) {
      setIsSubmitting(true);
      try {
        await onSave(role.id, data);
        toast({
            title: "Role Updated",
            description: `Successfully updated the "${data.name}" role.`
        });
      } catch (error) {
         toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to update role. Please try again.',
        });
      } finally {
        setIsSubmitting(false);
      }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-1">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Briefly describe this role's purpose"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Separator />

        <div>
          <FormLabel>Permissions</FormLabel>
          <FormDescription>Select the permissions for this role.</FormDescription>
          <FormField
            control={form.control}
            name="permissions"
            render={({ field }) => (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {Object.entries(permissionCategories).map(([category, actions]) => {
                     const categoryPermissions = actions.map(action => `${category}:${action}`);
                     const selectedCategoryPermissions = field.value.filter(p => categoryPermissions.includes(p));
                     const hasAll = selectedCategoryPermissions.length === categoryPermissions.length;

                     return (
                      <Card key={category}>
                          <CardHeader>
                              <CardTitle className="text-lg">{category}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                               <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                      <Checkbox
                                          checked={hasAll}
                                          onCheckedChange={(checked) => handleFullAccessChange(category, actions, checked)}
                                      />
                                  </FormControl>
                                  <FormLabel className="font-semibold">Full Access</FormLabel>
                              </FormItem>
                              <Separator />
                              <div className="grid grid-cols-2 gap-4">
                              {actions.map((action) => {
                                  const permissionId = `${category}:${action}`;
                                  return (
                                      <FormField
                                          key={permissionId}
                                          control={form.control}
                                          name="permissions"
                                          render={({ field: singleField }) => (
                                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                  <FormControl>
                                                      <Checkbox
                                                          checked={singleField.value?.includes(permissionId)}
                                                          onCheckedChange={(checked) => {
                                                              const updated = checked
                                                              ? [...singleField.value, permissionId]
                                                              : singleField.value?.filter((value) => value !== permissionId);
                                                              singleField.onChange(updated);
                                                          }}
                                                      />
                                                  </FormControl>
                                                  <FormLabel className="font-normal">{action}</FormLabel>
                                              </FormItem>
                                          )}
                                      />
                                  );
                              })}
                              </div>
                          </CardContent>
                      </Card>
                     )
                  })}
              </div>
            )}
          />
           <FormMessage className="pt-4">{form.formState.errors.permissions?.message}</FormMessage>
        </div>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
          </Button>
        </div>
      </form>
    </Form>
  )
}


export default function ManageRolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRoles = async () => {
      try {
          !loading && setLoading(true);
          const fetchedRoles = await getRoles();
          setRoles(fetchedRoles);
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not load roles.' });
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleSaveRole = async (id: string, data: RoleFormValues) => {
    await updateRole(id, { ...data, permissions: data.permissions.join(',') });
    await fetchRoles(); // refresh data
  }
  
  if (loading) {
    return (
        <div className="flex flex-1 flex-col gap-4 md:gap-8">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10" />
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-80" />
                </div>
            </div>
            <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Manage Roles</h1>
          <p className="text-muted-foreground">
            Update role permissions or create new roles for your team.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/settings/roles/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Role
          </Link>
        </Button>
       </div>
      
       <Accordion type="single" collapsible className="w-full" defaultValue={roles[0]?.id}>
         {roles.map((role) => (
          <AccordionItem value={role.id} key={role.id}>
            <AccordionTrigger className="text-xl font-semibold">{role.name}</AccordionTrigger>
            <AccordionContent>
               <RoleForm role={role} onSave={handleSaveRole} />
            </AccordionContent>
          </AccordionItem>
         ))}
       </Accordion>
    </div>
  );
}
