
export const events = [
    { id: 1, name: 'Tech Conference 2024', date: '2024-10-26', location: 'Metropolis Convention Center', image: 'https://placehold.co/600x400.png', hint: 'conference technology', category: 'Technology', description: 'An annual conference for tech enthusiasts and professionals. Explore the latest trends in AI, software development, and cloud computing. Network with industry leaders and innovators.' },
    { id: 2, name: 'Summer Music Festival', date: '2024-08-15', location: 'Greenfield Park', image: 'https://placehold.co/600x400.png', hint: 'music festival', category: 'Music', description: 'A three-day outdoor music festival featuring a diverse lineup of artists from rock, pop, and electronic genres. Enjoy live music, food trucks, and art installations under the summer sky.' },
    { id: 3, name: 'Art & Design Expo', date: '2024-11-05', location: 'The Modern Gallery', image: 'https://placehold.co/600x400.png', hint: 'art gallery', category: 'Art', description: 'Discover contemporary art and design from emerging and established artists. The expo includes paintings, sculptures, photography, and interactive installations. Perfect for collectors and art lovers alike.' },
];

export const ticketTypes = [
    { id: 1, eventId: 1, name: 'General Admission', price: 99.00, sold: 700, total: 1000 },
    { id: 2, eventId: 1, name: 'VIP Pass', price: 249.00, sold: 150, total: 200 },
    { id: 3, eventId: 2, name: 'Standard Ticket', price: 75.00, sold: 500, total: 1500 },
    { id: 4, eventId: 3, name: 'Gallery Pass', price: 30.00, sold: 250, total: 500 },
];

export const attendees = [
    { id: 1, eventId: 1, name: 'Alice Johnson', ticketType: 'VIP', email: 'alice@example.com', checkedIn: true },
    { id: 2, eventId: 1, name: 'Bob Williams', ticketType: 'General Admission', email: 'bob@example.com', checkedIn: false },
    { id: 3, eventId: 1, name: 'Charlie Brown', ticketType: 'General Admission', email: 'charlie@example.com', checkedIn: true },
    { id: 4, eventId: 1, name: 'Diana Prince', ticketType: 'VIP', email: 'diana@example.com', checkedIn: false },
    { id: 5, eventId: 1, name: 'Ethan Hunt', ticketType: 'General Admission', email: 'ethan@example.com', checkedIn: false },
    { id: 6, eventId: 2, name: 'Fiona Glenanne', ticketType: 'Standard Ticket', email: 'fiona@example.com', checkedIn: true },
    { id: 7, eventId: 3, name: 'George Costanza', ticketType: 'Gallery Pass', email: 'george@example.com', checkedIn: false },
];

export const promoCodes = [
    { id: 1, eventId: 1, code: 'EARLYBIRD10', type: 'percentage', value: 10, uses: 50, maxUses: 100 },
    { id: 2, eventId: 1, code: 'TECHVIP25', type: 'fixed', value: 25, uses: 12, maxUses: 50 },
    { id: 3, eventId: 2, code: 'SUMMER24', type: 'percentage', value: 20, uses: 100, maxUses: 200 },
];
