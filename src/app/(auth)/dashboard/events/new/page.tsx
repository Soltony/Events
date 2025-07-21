
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2, UploadCloud, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
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
import { addEvent } from '@/lib/actions';
import { Separator } from '@/components/ui/separator';

const eventFormSchema = z.object({
  name: z.string().min(3, { message: 'Event name must be at least 3 characters.' }),
  location: z.string().min(1, { message: 'Please enter a location.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  date: z.object({
    from: z.date({
      required_error: 'A start date for the event is required.',
    }),
    to: z.date().optional(),
  }),
  category: z.string({ required_error: 'Please select a category.' }),
  otherCategory: z.string().optional(),
  images: z.array(z.object({
    url: z.string().min(1, { message: "Image cannot be empty." })
  })).min(1, { message: "Please upload at least one image."}),
  tickets: z.array(z.object({
    name: z.string().min(1, { message: "Ticket name can't be empty."}),
    price: z.coerce.number().min(0, { message: 'Price must be a positive number.' }),
    total: z.coerce.number().int().min(1, { message: 'Capacity must be at least 1.' }),
  })).min(1, { message: 'You must have at least one ticket tier.'}),
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

const DEFAULT_IMAGE_PLACEHOLDER = 'https://placehold.co/600x400.png';

export default function CreateEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState<number | null>(null);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      location: 'Addis Ababa, Ethiopia',
      description: '',
      category: '',
      otherCategory: '',
      images: [{ url: '' }],
      tickets: [{ name: 'General Admission', price: 25, total: 100 }],
    },
  });

  const watchedCategory = form.watch('category');
  const watchedImages = form.watch('images');

  const { fields: ticketFields, append: appendTicket, remove: removeTicket } = useFieldArray({
    control: form.control,
    name: "tickets"
  });

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control: form.control,
    name: "images"
  });

  const handleRemoveImage = (index: number) => {
    removeImage(index);
  }

  async function onSubmit(data: EventFormValues) {
    setIsSubmitting(true);
    try {
        const finalData = {
            ...data,
            category: data.category === 'Other' ? data.otherCategory : data.category,
        };
        await addEvent(finalData);
        toast({
            title: 'Event Created!',
            description: `Successfully created "${data.name}".`,
        });
        router.push('/dashboard/events');
    } catch (error) {
        console.error("Failed to create event:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to create event. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Create New Event</CardTitle>
          <CardDescription>Fill out the details below to create your new event.</CardDescription>
        </CardHeader>
        <CardContent>
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
                    <FormDescription>
                      This is the public name of your event.
                    </FormDescription>
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
                    <FormDescription>
                      A brief, catchy description that will appear on the event page.
                    </FormDescription>
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
                            <Input placeholder="e.g., Millennium Hall" {...field} />
                        </FormControl>
                         <FormDescription>
                          Enter the venue or address for your event.
                        </FormDescription>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                         <FormDescription>
                          What type of event is it?
                        </FormDescription>
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
                           <FormDescription>
                            Please specify your category.
                           </FormDescription>
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
                    <FormDescription>
                      The start and end date for your event.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Separator />

              <div className="space-y-4">
                <div>
                  <FormLabel>Event Images</FormLabel>
                  <FormDescription>Upload one or more images for your event gallery.</FormDescription>
                  <FormMessage className="pt-2">{form.formState.errors.images?.root?.message}</FormMessage>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {imageFields.map((item, index) => (
                    <FormField
                      key={item.id}
                      control={form.control}
                      name={`images.${index}.url`}
                      render={({ field: { onChange, value, ...fieldProps } }) => {
                        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsUploading(index);
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              try {
                                const response = await axios.post('/api/upload', { file: reader.result });
                                if (response.data.success) {
                                  onChange(response.data.url);
                                } else {
                                  toast({ variant: 'destructive', title: 'Upload failed', description: response.data.error });
                                }
                              } catch (error) {
                                toast({ variant: 'destructive', title: 'Upload failed', description: 'An error occurred while uploading the image.' });
                              } finally {
                                setIsUploading(null);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        
                        const displayUrl = watchedImages[index]?.url;

                        return (
                          <FormItem>
                            <FormControl>
                              <div className="aspect-video rounded-md relative group bg-muted border-dashed border-2 flex items-center justify-center">
                                {isUploading === index && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
                                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                                    </div>
                                )}
                                {displayUrl && !(isUploading === index) ? (
                                  <Image
                                    src={displayUrl}
                                    alt={`Event image ${index + 1}`}
                                    fill
                                    className="object-cover rounded-md"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = DEFAULT_IMAGE_PLACEHOLDER;
                                      target.srcset = '';
                                    }}
                                  />
                                ) : null}
                                <div className={`absolute inset-0 flex items-center justify-center gap-2 transition-opacity ${displayUrl ? 'bg-black/40 opacity-0 group-hover:opacity-100' : 'bg-transparent'} ${isUploading === index ? 'opacity-0' : ''}`}>
                                  <label htmlFor={`image-upload-${index}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-9 px-3 cursor-pointer bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                    <UploadCloud className="mr-2 h-4 w-4" />
                                    {displayUrl ? 'Change' : 'Upload'}
                                    <Input
                                      id={`image-upload-${index}`}
                                      type="file"
                                      className="sr-only"
                                      accept="image/png, image/jpeg, image/gif"
                                      onChange={handleFileChange}
                                      disabled={isUploading !== null}
                                      {...fieldProps}
                                    />
                                  </label>
                                  {imageFields.length > 1 && displayUrl ? (
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="h-9 w-9"
                                      onClick={() => handleRemoveImage(index)}
                                      disabled={isUploading !== null}
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
                      disabled={isUploading !== null}
                      >
                      <PlusCircle className="h-6 w-6" />
                      <span>Add Image</span>
                  </Button>
                </div>
              </div>


              <Separator />

              <div className="space-y-6">
                <div>
                    <FormLabel>Ticket Tiers</FormLabel>
                    <FormDescription>Create one or more ticket types for your event.</FormDescription>
                    <FormMessage>{form.formState.errors.tickets?.message}</FormMessage>
                </div>

                {ticketFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_auto] gap-4 items-start">
                      <FormField
                        control={form.control}
                        name={`tickets.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={cn(index !== 0 && "sr-only")}>Ticket Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., VIP Pass" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`tickets.${index}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className={cn(index !== 0 && "sr-only")}>Price</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} placeholder="e.g., 50" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`tickets.${index}.total`}
                        render={({ field }) => (
                          <FormItem>
                             <FormLabel className={cn(index !== 0 && "sr-only")}>Quantity</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} placeholder="e.g., 100"/>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className={cn("flex items-end h-full", index !== 0 && "pt-8")}>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeTicket(index)}
                            disabled={ticketFields.length <= 1}
                        >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove tier</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                 <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendTicket({ name: '', price: 0, total: 50 })}
                    >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Ticket Tier
                </Button>
              </div>

              <Separator />

              <Button type="submit" disabled={isSubmitting || isUploading !== null}>
                {(isSubmitting || isUploading !== null) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Event
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
