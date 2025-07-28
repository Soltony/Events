
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createRole } from '@/lib/actions';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

const permissionsSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const roleFormSchema = z.object({
  name: z.string().min(3, { message: 'Role name must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  permissions: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: 'You have to select at least one permission.',
  }),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

const permissionCategories = {
    'Dashboard': ['View'],
    'Scan QR': ['View'],
    'Events': ['View', 'Create', 'Update', 'Delete'],
    'Reports': ['View'],
    'User Registration': ['Create', 'Read', 'Update', 'Delete'],
    'User Management': ['Create', 'Read', 'Update', 'Delete'],
    'Role Management': ['Create', 'Read', 'Update', 'Delete'],
};


export default function CreateRolePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: [],
    },
  });

  async function onSubmit(data: RoleFormValues) {
    setIsSubmitting(true);
    try {
        await createRole(data);
        toast({
            title: 'Role Created!',
            description: `Successfully created the "${data.name}" role.`,
        });
        router.push('/dashboard/settings/roles');
    } catch (error) {
        console.error("Failed to create role:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to create role. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

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


  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
       <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Create New Role</h1>
          <p className="text-muted-foreground">
            Define a new role and select the granular permissions it has for each page.
          </p>
        </div>
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Event Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                           const hasAll = selectedCategoryPermissions.length === categoryPermissions.length && actions.length > 0;
                           
                           return (
                            <Card key={category}>
                                <CardHeader>
                                    <CardTitle className="text-lg">{category}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {actions.length > 1 && (
                                        <>
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
                                        </>
                                    )}
                                    <div className={cn("grid gap-4", actions.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
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
                 <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

    