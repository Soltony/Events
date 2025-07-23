
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarIcon, UploadCloud, Loader2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import axios from 'axios';

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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { updateEvent, getEventById } from '@/lib/actions';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import LocationInput from '@/components/location-input';

const eventFormSchema = z.object({
  name: z.string().min(3, { message: 'Event name must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  location: z.string().min(3, { message: 'Location is required.' }),
  hint: z.string().optional(),
  date: z.object({
    from: z.date({
      required_error: 'A start date for the event is required.',
    }),
    to: z.date().optional(),
  }),
  category: z.string({ required_error: 'Please select a category.' }),
  otherCategory: z.string().optional(),
  image: z.string().optional(),
}).refine(data => {
    if (data.category === 'Other') {
        return !!data.otherCategory && data.otherCategory.length > 0;
    }
    return true;
}, {
    message: 'Please specify the category.',
    path: ['otherCategory'],
});

type EventFormValues = z.infer<typeof eventFormSchema>;

const defaultCategories = ["Technology", "Music", "Art", "Community", "Business"];
const DEFAULT_IMAGE_PLACEHOLDER = 'https://placehold.co/600x400.png';

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params.id ? parseInt(params.id, 10) : -1;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      description: '',
      location: '',
      hint: '',
      category: '',
      otherCategory: '',
      image: '',
    },
  });

  const watchedCategory = form.watch('category');

  useEffect(() => {
    if (eventId === -1) {
      router.push('/dashboard/events');
      return;
    }

    async function fetchEvent() {
      try {
        setLoading(true);
        const event = await getEventById(eventId);
        if (event) {
          const isOtherCategory = event.category && !defaultCategories.includes(event.category);
          
          form.reset({
            name: event.name,
            description: event.description,
            location: event.location,
            hint: event.hint || '',
            category: isOtherCategory ? 'Other' : event.category,
            otherCategory: isOtherCategory ? event.category : '',
            date: {
              from: new Date(event.startDate),
              to: event.endDate ? new Date(event.endDate) : undefined,
            },
            image: event.image || '',
          });
          if (event.image) {
            setPreviewImage(event.image);
          }
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Event not found.' });
            router.push('/dashboard/events');
        }
      } catch (error) {
        console.error("Failed to fetch event", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load event data.' });
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [eventId, form, router, toast]);

  async function onSubmit(data: EventFormValues) {
    setIsSubmitting(true);
    try {
        const finalData = {
            ...data,
            category: data.category === 'Other' ? data.otherCategory : data.category,
        };

        await updateEvent(eventId, finalData);
        toast({
            title: 'Event Updated!',
            description: `Successfully updated "${data.name}".`,
        });
        router.push(`/dashboard/events/${eventId}`);
    } catch (error) {
        console.error("Failed to update event:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to update event. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setIsUploading(true);
        setPreviewImage(URL.createObjectURL(file)); // Local preview
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const response = await axios.post('/api/upload', { file: reader.result });
            if (response.data.success) {
              form.setValue('image', response.data.url);
              setPreviewImage(response.data.url); // Final URL
            } else {
              toast({ variant: 'destructive', title: 'Upload failed', description: response.data.error });
              setPreviewImage(form.getValues('image')); // Revert to original on failure
            }
          } catch (error) {
            toast({ variant: 'destructive', title: 'Upload failed', description: 'An error occurred.' });
            setPreviewImage(form.getValues('image'));
          } finally {
            setIsUploading(false);
          }
        };
        reader.readAsDataURL(file);
      }
    };

  if (loading) {
    return (
        <div className="flex flex-1 flex-col gap-4 md:gap-8 p-4 lg:p-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10" />
                <div>
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-5 w-48" />
                </div>
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-48 mb-2" />
                    <Skeleton className="h-4 w-80" />
                </CardHeader>
                <CardContent className="space-y-8">
                   <Skeleton className="h-10 w-full" />
                   <Skeleton className="h-20 w-full" />
                   <Skeleton className="h-10 w-full" />
                   <div className="grid grid-cols-3 gap-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                   </div>
                   <Skeleton className="h-10 w-32" />
                </CardContent>
            </Card>
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
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Event</h1>
            <p className="text-muted-foreground">Update the details for "{form.getValues('name')}"</p>
        </div>
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
                    <FormLabel>Event Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Tech Conference 2025" {...field} />
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
                        placeholder="Tell us a little bit about your event"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {defaultCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                           <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedCategory === 'Other' && (
                  <FormField
                    control={form.control}
                    name="otherCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom Category</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Charity, Food Festival" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Event Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'w-full md:w-[300px] justify-start text-left font-normal',
                              !field.value?.from && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value?.from ? (
                              field.value.to ? (
                                <>
                                  {format(field.value.from, 'LLL dd, y')} -{' '}
                                  {format(field.value.to, 'LLL dd, y')}
                                </>
                              ) : (
                                format(field.value.from, 'LLL dd, y')
                              )
                            ) : (
                              <span>Pick a date range</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <LocationInput
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      Start typing to search for a location in Ethiopia.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specific Location Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Millennium Hall, 2nd Floor, Room 201. Near the main entrance."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                     <FormDescription>
                      Optional: Provide more detailed location info like landmarks, building names, or floor numbers.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Separator />

              <div className="space-y-4">
                <div>
                  <FormLabel>Event Image</FormLabel>
                  <FormDescription>Update the image for your event gallery.</FormDescription>
                   <FormMessage className="pt-2">{form.formState.errors.image?.message}</FormMessage>
                </div>
                <div className="w-full max-w-sm">
                   <FormField
                      control={form.control}
                      name="image"
                      render={({ field }) => (
                      <FormItem>
                          <FormControl>
                            <div className="aspect-video rounded-md relative group bg-muted border-dashed border-2 flex items-center justify-center">
                              {isUploading && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
                                      <Loader2 className="h-8 w-8 animate-spin text-white" />
                                  </div>
                              )}
                              {previewImage && !isUploading ? (
                                <Image
                                  src={previewImage}
                                  alt="Event image preview"
                                  fill
                                  className="object-cover rounded-md"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = DEFAULT_IMAGE_PLACEHOLDER;
                                    target.srcset = '';
                                  }}
                                />
                              ) : null}
                              <div className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity ${previewImage ? 'bg-black/40 opacity-0 group-hover:opacity-100' : 'bg-transparent'} ${isUploading ? 'opacity-0' : ''}`}>
                                <label htmlFor="image-upload" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-9 px-3 cursor-pointer bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                  <UploadCloud className="mr-2 h-4 w-4" />
                                  {previewImage ? 'Change' : 'Upload'}
                                  <Input
                                    id="image-upload"
                                    type="file"
                                    className="sr-only"
                                    accept="image/png, image/jpeg, image/gif"
                                    onChange={handleFileChange}
                                    disabled={isUploading}
                                  />
                                </label>
                              </div>
                            </div>
                          </FormControl>
                           <FormMessage />
                      </FormItem>
                      )}
                    />
                </div>
              </div>

              <Separator />

              <Button type="submit" disabled={isSubmitting || isUploading}>
                {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

    