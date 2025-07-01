export const events = [
    { id: 1, name: 'Tech Conference 2024', date: '2024-10-26', location: 'Metropolis Convention Center', image: 'https://placehold.co/600x400.png', ticketsSold: 850, totalTickets: 1200 },
];

export const ticketTypes = [
    { id: 1, eventId: 1, name: 'General Admission', price: 99.00, sold: 700, total: 1000 },
    { id: 2, eventId: 1, name: 'VIP', price: 249.00, sold: 150, total: 200 },
];

export const attendees = [
    { id: 1, eventId: 1, name: 'Alice Johnson', ticketType: 'VIP', email: 'alice@example.com', checkedIn: true },
    { id: 2, eventId: 1, name: 'Bob Williams', ticketType: 'General Admission', email: 'bob@example.com', checkedIn: false },
    { id: 3, eventId: 1, name: 'Charlie Brown', ticketType: 'General Admission', email: 'charlie@example.com', checkedIn: true },
    { id: 4, eventId: 1, name: 'Diana Prince', ticketType: 'VIP', email: 'diana@example.com', checkedIn: false },
    { id: 5, eventId: 1, name: 'Ethan Hunt', ticketType: 'General Admission', email: 'ethan@example.com', checkedIn: false },
];

export const promoCodes = [
    { id: 1, eventId: 1, code: 'EARLYBIRD10', type: 'percentage', value: 10, uses: 50, maxUses: 100 },
    { id: 2, eventId: 1, code: 'TECHVIP25', type: 'fixed', value: 25, uses: 12, maxUses: 50 },
];
