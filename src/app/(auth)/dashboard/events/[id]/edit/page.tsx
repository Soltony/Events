
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, UploadCloud, Loader2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';

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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { updateEvent, getEventById } from '@/lib/actions';
import { Separator } from '@/components/ui/separator';
import { ethiopianLocations } from '@/lib/locations';
import { Skeleton } from '@/components/ui/skeleton';
import type { Event } from '@prisma/client';

const eventFormSchema = z.object({
  name: z.string().min(3, { message: 'Event name must be at least 3 characters.' }),
  location: z.string().min(1, { message: 'Please select a location.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  date: z.object({
    from: z.date({
      required_error: 'A start date for the event is required.',
    }),
    to: z.date().optional(),
  }),
  category: z.string({ required_error: 'Please select a category.' }),
  images: z.array(z.object({
    url: z.string().min(1, { message: "Image cannot be empty." })
  })).min(1, { message: "Please upload at least one image."}),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params.id ? parseInt(params.id, 10) : -1;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      location: '',
      description: '',
      category: '',
      images: [],
    },
  });

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
          form.reset({
            name: event.name,
            location: event.location,
            description: event.description,
            category: event.category,
            date: {
              from: new Date(event.startDate),
              to: event.endDate ? new Date(event.endDate) : undefined,
            },
            images: event.image ? event.image.split(',').map(url => ({ url })) : [],
          });
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

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control: form.control,
    name: "images"
  });

  async function onSubmit(data: EventFormValues) {
    setIsSubmitting(true);
    try {
        await updateEvent(eventId, data);
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
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {ethiopianLocations.map((cityGroup) => (
                            <SelectGroup key={cityGroup.city}>
                              <SelectLabel>{cityGroup.city}</SelectLabel>
                              {cityGroup.areas.map(area => (
                                <SelectItem key={`${cityGroup.city}-${area}`} value={`${area}, ${cityGroup.city}`}>{area}</SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Music">Music</SelectItem>
                        <SelectItem value="Art">Art</SelectItem>
                        <SelectItem value="Community">Community</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              
              <Separator />

              <div className="space-y-4">
                <div>
                  <FormLabel>Event Images</FormLabel>
                  <FormDescription>Update the images for your event gallery.</FormDescription>
                  <FormMessage className="pt-2">{form.formState.errors.images?.root?.message}</FormMessage>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {imageFields.map((item, index) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name={`images.${index}.url`}
                      render={({ field: { onChange, value } }) => {
                        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              onChange(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        };

                        return (
                          <FormItem>
                            <FormControl>
                              <div className="aspect-video rounded-md relative group bg-muted border-dashed border-2 flex items-center justify-center">
                                {value ? (
                                  <Image
                                    src={value}
                                    alt={`Event image ${index + 1}`}
                                    fill
                                    className="object-cover rounded-md"
                                  />
                                ) : null}
                                <div className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity ${value ? 'bg-black/40 opacity-0 group-hover:opacity-100' : 'bg-transparent'}`}>
                                  <label htmlFor={`image-upload-${index}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-9 px-3 cursor-pointer bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                    <UploadCloud className="mr-2 h-4 w-4" />
                                    {value ? 'Change' : 'Upload'}
                                    <Input
                                      id={`image-upload-${index}`}
                                      type="file"
                                      className="sr-only"
                                      accept="image/png, image/jpeg, image/gif"
                                      onChange={handleFileChange}
                                    />
                                  </label>
                                  {imageFields.length > 1 && value ? (
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="h-9 w-9"
                                      onClick={() => removeImage(index)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Remove image</span>
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                   <Button
                      type="button"
                      variant="outline"
                      onClick={() => appendImage({ url: '' })}
                      className="aspect-video h-full flex-col gap-2"
                      >
                      <PlusCircle className="h-6 w-6" />
                      <span>Add Image</span>
                  </Button>
                </div>
              </div>

              <Separator />

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
