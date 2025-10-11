

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { PlusCircle, Trash2, UploadCloud, Loader2, X } from 'lucide-react';
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
import { useAuth } from '@/context/auth-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const locationConfigSchema = z.record(z.object({
    price: z.coerce.number().min(0, { message: 'Price must be non-negative.' }),
    quantity: z.coerce.number().int().min(0, { message: 'Quantity must be a non-negative integer.' }),
}));

const eventFormSchema = z.object({
  name: z.string().min(3, { message: 'Event name must be at least 3 characters.' }),
  color: z.string().optional(), // This field will now store the organizer name
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  locations: z.array(z.object({
    value: z.string().min(3, { message: "Location can't be empty."}),
  })).min(1, { message: 'You must have at least one location.'}),
  hint: z.string().optional(),
  startDate: z.date({
    required_error: 'A start date and time for the event is required.',
  }),
  endDate: z.date().optional(),
  category: z.string({ required_error: 'Please select a category.' }),
  otherCategory: z.string().optional(),
  images: z.array(z.string()).min(1, { message: 'Please upload at least one image.' }),
  tickets: z.array(z.object({
    name: z.string().min(1, { message: "Ticket name can't be empty."}),
    description: z.string().optional(),
    locationConfigs: locationConfigSchema,
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

const DEFAULT_IMAGE_PLACEHOLDER = '/image/nibtickets.jpg';

export default function CreateEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      color: '', // organizer name
      description: '',
      locations: [{ value: '' }],
      hint: '',
      category: '',
      otherCategory: '',
      images: [],
      tickets: [{ name: 'General Admission', description: 'Standard entry to the event.', locationConfigs: {} }],
    },
  });

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control: form.control,
    name: "images" as any
  });

  const watchedImages = form.watch('images');
  const watchedCategory = form.watch('category');
  const watchedLocations = form.watch('locations');

  const { fields: ticketFields, append: appendTicket, remove: removeTicket } = useFieldArray({
    control: form.control,
    name: "tickets"
  });

  const { fields: locationFields, append: appendLocation, remove: removeLocation } = useFieldArray({
    control: form.control,
    name: "locations"
  });

  async function onSubmit(data: EventFormValues) {
    setIsSubmitting(true);
    try {
        const finalData = {
            ...data,
            category: data.category === 'Other' ? data.otherCategory : data.category,
            images: data.images,
        };
        const newEvent = await addEvent(finalData);
        
        if (newEvent.status === 'PENDING') {
            toast({
                title: 'Event Submitted!',
                description: `Your event "${data.name}" is now pending admin approval.`,
            });
        } else {
            toast({
                title: 'Event Created!',
                description: `Successfully created "${data.name}".`,
            });
        }
        
        router.push('/dashboard/events');
    } catch (error: any) {
        console.error("Failed to create event:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: error.message || 'Failed to create event. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (files) {
        setIsUploading(true);
        const uploadPromises = Array.from(files).map(file => {
          return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const response = await axios.post('/api/upload', { file: reader.result });
            if (response.data.success) {
              resolve(response.data.url);
            } else {
              reject(response.data.error);
            }
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsDataURL(file);
      });
    });

    try {
      const uploadedUrls = await Promise.all(uploadPromises);
      uploadedUrls.forEach(url => appendImage({ value: url }));
          } catch (error) {
             toast({ variant: 'destructive', title: 'Upload failed', description: 'An error occurred during upload.' });
          } finally {
             setIsUploading(false);
          }       
    }
  };
  
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-4xl">
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
                  name="color" // <-- Now using 'color' field
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organizer Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Acme Inc. or John Doe" {...field} />
                      </FormControl>
                      <FormDescription>
                        Optional: The name that will be publicly displayed as the event organizer.
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

                <div className="space-y-4">
                  <FormLabel>Locations</FormLabel>
                  <FormDescription>Add one or more locations for your event. Start typing to search for a location in Ethiopia.</FormDescription>
                  <FormMessage>{form.formState.errors.locations?.message}</FormMessage>

                  {locationFields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-2">
                          <FormField
                              control={form.control}
                              name={`locations.${index}.value`}
                              render={({ field }) => (
                                  <FormItem className="flex-grow">
                                      <FormControl>
                                          <LocationInput
                                              value={field.value}
                                              onChange={field.onChange}
                                          />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => removeLocation(index)}
                              disabled={locationFields.length <= 1}
                          >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remove location</span>
                          </Button>
                      </div>
                  ))}
                  <Button
                      type="button"
                      variant="outline"
                      onClick={() => appendLocation({ value: '' })}
                  >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Location
                  </Button>
                </div>


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
                        Optional: Provide more detailed location info like landmarks, building names, or floor numbers. This applies to all locations.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Separator />

                <div className="space-y-4">
                    <div>
                    <FormLabel>Event Visuals</FormLabel>
                    <FormDescription>Upload one or more images for your event.</FormDescription>
                    <FormMessage className="pt-2">{form.formState.errors.images?.message}</FormMessage>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {watchedImages.map((image, index) => (
                        <div key={index} className="relative aspect-video rounded-md overflow-hidden group">
                        <Image
                            src={typeof image === 'string' ? image : (image as any).value}
                            alt={`Event image ${index + 1}`}
                            fill
                            className="object-cover"
                        />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removeImage(index)}
                            >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove image</span>
                            </Button>
                        </div>
                        </div>
                      ))}
                      <label htmlFor="image-upload" className="aspect-video rounded-md border-dashed border-2 flex items-center justify-center cursor-pointer hover:border-primary hover:text-primary transition-colors text-muted-foreground">
                  
                        <div className="text-center">
                            {isUploading ? (
                            <Loader2 className="h-8 w-8 animate-spin" />
                            ) : (
                            <>
                                <PlusCircle className="h-8 w-8 mx-auto" />
                                <span className="text-sm mt-2">Add Image</span>
                            </>
                            )}
                        </div>
                        <Input
                            id="image-upload"
                            type="file"
                            multiple
                            className="sr-only"
                            accept="image/png, image/jpeg, image/gif"
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                        </label>
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
                    <Card key={field.id} className="p-4 space-y-4">
                        <div className="flex justify-between items-start">
                        <FormField
                            control={form.control}
                            name={`tickets.${index}.name`}
                            render={({ field }) => (
                            <FormItem className="flex-grow pr-4">
                                <FormLabel>Ticket Name</FormLabel>
                                <FormControl><Input {...field} placeholder="e.g., VIP Pass" /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeTicket(index)}
                            disabled={ticketFields.length <= 1}
                            className="mt-8"
                        >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove tier</span>
                        </Button>
                        </div>
                        
                         <FormField
                          control={form.control}
                          name={`tickets.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="Describe what this ticket includes (e.g., front row seats, free drink)." className="resize-none" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {watchedLocations && watchedLocations.length > 0 && watchedLocations.every(l => l.value) ? (
                            <div className="pt-4">
                                <h4 className="font-medium text-sm mb-2">Location Prices & Quantities</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Location</TableHead>
                                            <TableHead className="w-[120px]">Price (ETB)</TableHead>
                                            <TableHead className="w-[120px]">Quantity</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {watchedLocations.map((location) => (
                                            <TableRow key={location.value}>
                                                <TableCell className="font-medium">{location.value}</TableCell>
                                                <TableCell>
                                                     <FormField
                                                        control={form.control}
                                                        name={`tickets.${index}.locationConfigs.${location.value}.price`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <Input type="number" {...field} placeholder="e.g., 50" />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                     <FormField
                                                        control={form.control}
                                                        name={`tickets.${index}.locationConfigs.${location.value}.quantity`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <Input type="number" {...field} placeholder="e.g., 100" />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                          <div className="pt-4 text-sm text-muted-foreground">
                            Please add at least one valid location to set prices and quantities.
                          </div>
                        )}
                    </Card>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => appendTicket({ name: '', description: '', locationConfigs: {} })}
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
    </div>
  );
}

