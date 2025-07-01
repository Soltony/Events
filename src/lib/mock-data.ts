
export const events = [
    { id: 1, name: 'Tech Conference 2024', date: 'Oct 26, 2024', location: 'Metropolis Convention Center', image: ['https://placehold.co/600x400.png', 'https://placehold.co/600x400.png', 'https://placehold.co/600x400.png'], hint: 'tech conference', category: 'Technology', description: 'An annual conference for tech enthusiasts and professionals. Explore the latest trends in AI, software development, and cloud computing. Network with industry leaders and innovators.' },
    { id: 2, name: 'Summer Music Festival', date: 'Aug 15, 2024 - Aug 17, 2024', location: 'Greenfield Park', image: ['https://placehold.co/600x400.png'], hint: 'concert crowd', category: 'Music', description: 'A three-day outdoor music festival featuring a diverse lineup of artists from rock, pop, and electronic genres. Enjoy live music, food trucks, and art installations under the summer sky.' },
    { id: 3, name: 'Art & Design Expo', date: 'Nov 05, 2024', location: 'The Modern Gallery', image: ['https://placehold.co/600x400.png'], hint: 'art exhibition', category: 'Art', description: 'Discover contemporary art and design from emerging and established artists. The expo includes paintings, sculptures, photography, and interactive installations. Perfect for collectors and art lovers alike.' },
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

export const mockUsers = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' },
    { id: 2, name: 'Bob Williams', email: 'bob@example.com', role: 'Event Manager' },
    { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'Support' },
    { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'Event Manager' },
];

const permissionModulesForMock = {
  'Events': ['Create', 'Read', 'Update', 'Delete'],
  'Attendees': ['Read', 'Update'],
  'Reports': ['Read'],
  'Users & Roles': ['Create', 'Read', 'Update', 'Delete']
};

const allMockPermissions = Object.entries(permissionModulesForMock).flatMap(([module, actions]) =>
  actions.map(action => `${module}:${action}`)
);

export const mockRoles = [
    { 
      id: 'admin', 
      name: 'Admin', 
      permissions: allMockPermissions 
    },
    { 
      id: 'event-manager', 
      name: 'Event Manager', 
      permissions: [
        'Events:Create', 'Events:Read', 'Events:Update', 'Events:Delete',
        'Attendees:Read', 'Attendees:Update',
        'Reports:Read'
      ] 
    },
    { 
      id: 'support', 
      name: 'Support', 
      permissions: ['Attendees:Read', 'Attendees:Update'] 
    },
    { 
      id: 'viewer', 
      name: 'Viewer', 
      permissions: ['Reports:Read'] 
    },
];
