
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { PlusCircle, Trash2, UploadCloud, Loader2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addEvent } from '@/lib/actions';
import { Separator } from '@/components/ui/separator';
import LocationInput from '@/components/location-input';
import { DateTimePicker } from '@/components/datetime-picker';

const eventFormSchema = z.object({
  name: z.string().min(3, { message: 'Event name must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  location: z.string().min(3, { message: 'Location is required.' }),
  hint: z.string().optional(),
  startDate: z.date({
    required_error: 'A start date and time for the event is required.',
  }),
  endDate: z.date().optional(),
  category: z.string({ required_error: 'Please select a category.' }),
  otherCategory: z.string().optional(),
  image: z.string().optional(),
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
      tickets: [{ name: 'General Admission', price: 25, total: 100 }],
    },
  });

  const watchedCategory = form.watch('category');

  const { fields: ticketFields, append: appendTicket, remove: removeTicket } = useFieldArray({
    control: form.control,
    name: "tickets"
  });

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setIsUploading(true);
        setPreviewImage(URL.createObjectURL(file)); // Create a local URL for instant preview
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const response = await axios.post('/api/upload', { file: reader.result });
            if (response.data.success) {
              form.setValue('image', response.data.url);
              setPreviewImage(response.data.url); // Update preview with the final URL
            } else {
              toast({ variant: 'destructive', title: 'Upload failed', description: response.data.error });
               setPreviewImage(null); // Clear preview on failure
            }
          } catch (error) {
            toast({ variant: 'destructive', title: 'Upload failed', description: 'An error occurred while uploading the image.' });
            setPreviewImage(null);
          } finally {
            setIsUploading(false);
          }
        };
        reader.readAsDataURL(file);
      }
    };

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date & Time</FormLabel>
                        <DateTimePicker
                          date={field.value}
                          setDate={field.onChange}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date & Time</FormLabel>
                         <DateTimePicker
                          date={field.value}
                          setDate={field.onChange}
                        />
                         <FormDescription>
                           Optional: For multi-day events.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

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
                  <FormDescription>Upload an image for your event.</FormDescription>
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
                            <FormLabel className={index !== 0 ? "sr-only" : ""}>Ticket Name</FormLabel>
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
                            <FormLabel className={index !== 0 ? "sr-only" : ""}>Price</FormLabel>
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
                             <FormLabel className={index !== 0 ? "sr-only" : ""}>Quantity</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} placeholder="e.g., 100"/>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className={`flex items-end h-full ${index !== 0 ? "pt-8" : ""}`}>
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

              <Button type="submit" disabled={isSubmitting || isUploading}>
                {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Event
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
