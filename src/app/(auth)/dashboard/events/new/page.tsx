
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';

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
import { addEvent } from '@/lib/store';
import { Separator } from '@/components/ui/separator';

const eventFormSchema = z.object({
  name: z.string().min(3, { message: 'Event name must be at least 3 characters.' }),
  location: z.string().min(3, { message: 'Location must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  date: z.object({
    from: z.date({
      required_error: 'A start date for the event is required.',
    }),
    to: z.date().optional(),
  }),
  category: z.string({ required_error: 'Please select a category.' }),
  images: z.array(z.object({
    url: z.string().url({ message: "Please enter a valid URL." }).min(1, {message: "Image URL cannot be empty."})
  })).min(1, { message: "Please add at least one image URL."}),
  tickets: z.array(z.object({
    name: z.string().min(1, { message: "Ticket name can't be empty."}),
    price: z.coerce.number().min(0, { message: 'Price must be a positive number.' }),
    capacity: z.coerce.number().int().min(1, { message: 'Capacity must be at least 1.' }),
  })).min(1, { message: 'You must have at least one ticket tier.'}),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

export default function CreateEventPage() {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: '',
      location: '',
      description: '',
      category: '',
      images: [{ url: 'https://placehold.co/600x400.png' }],
      tickets: [{ name: 'General Admission', price: 25, capacity: 100 }],
    },
  });

  const { fields: ticketFields, append: appendTicket, remove: removeTicket } = useFieldArray({
    control: form.control,
    name: "tickets"
  });

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control: form.control,
    name: "images"
  });

  function onSubmit(data: EventFormValues) {
    addEvent({
      ...data,
      images: data.images.map(img => img.url),
    });
    toast({
      title: 'Event Created!',
      description: `Successfully created "${data.name}".`,
    });
    router.push('/dashboard/events');
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
                      <Input placeholder="e.g., Metropolis Convention Center" {...field} />
                    </FormControl>
                    <FormDescription>
                      Where will your event be held?
                    </FormDescription>
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

              <div className="space-y-6">
                <div>
                    <FormLabel>Event Images</FormLabel>
                    <FormDescription>Add one or more image URLs for your event gallery.</FormDescription>
                    <FormMessage>{form.formState.errors.images?.message}</FormMessage>
                </div>
                
                {imageFields.map((field, index) => (
                   <Card key={field.id} className="p-4">
                     <div className="flex gap-4 items-start">
                      <FormField
                          control={form.control}
                          name={`images.${index}.url`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className={cn(index !== 0 && "sr-only")}>Image URL</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="https://example.com/image.png" />
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
                              onClick={() => removeImage(index)}
                              disabled={imageFields.length <= 1}
                          >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remove image</span>
                          </Button>
                        </div>
                     </div>
                   </Card>
                ))}
                 <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendImage({ url: '' })}
                    >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Image URL
                </Button>
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
                        name={`tickets.${index}.capacity`}
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
                    onClick={() => appendTicket({ name: '', price: 0, capacity: 50 })}
                    >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Ticket Tier
                </Button>
              </div>

              <Separator />

              <Button type="submit">Create Event</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
