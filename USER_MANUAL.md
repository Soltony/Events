# NibTera Tickets - User Manual

Welcome to the official user manual for the NibTera Tickets platform. This guide provides a comprehensive overview of all features and step-by-step instructions for every user type.

## Part 1: For Customers (Event Attendees)

This section guides you through finding events, purchasing tickets, and managing them.

### 1. Finding an Event

The homepage is your gateway to all exciting upcoming events.

-   **Browse Events**: Scroll through the homepage to see all available events, displayed as cards.
-   **Search for Events**: Use the **search bar** at the top of the page to find events by name or description.
-   **Filter by Category**: Use the **category dropdown** to narrow down events by type (e.g., Music, Technology, Art).

### 2. Viewing Event Details

Clicking on any event card will open a pop-up window with more details. For a full-screen view, click the "Buy Tickets" button.

-   **Event Information**: View the event's date, time, location, and a detailed description.
-   **Ticket Tiers**: See the different types of tickets available, their prices, and how many are left.

### 3. Purchasing Tickets

1.  **Select Tickets**: On the event details page, find the "Tickets" section. Use the `+` and `-` buttons to select the quantity for each ticket type you wish to purchase.
2.  **Order Summary**: As you select tickets, an "Order Summary" will appear, showing the subtotal.
3.  **Apply Promo Code**: If you have a promotional code, enter it in the "Promo Code" input field and click **Apply**. The discount will be reflected in the total.
4.  **Proceed to Purchase**: Click the **Purchase Tickets** button.
5.  **Enter Attendee Info**: A dialog will appear asking for your **Full Name** and **Phone Number**. Fill in these details.
6.  **Make Payment**: Click **Proceed to Payment**. You will be redirected to the secure ArifPay payment gateway to complete your transaction.

### 4. Accessing Your Ticket

After a successful payment, you will be redirected to the **Ticket Confirmed** page.

-   **QR Code**: This page displays your unique QR code, which is your ticket. Present this code at the event for check-in.
-   **Download**: Click the **Download QR Code** button to save an image of your ticket to your device.

### 5. Managing Your Tickets

You can view your purchased tickets at any time.

1.  From the homepage, click the **My Tickets** button at the top right.
2.  This page lists all tickets you have purchased on your current device or while logged into your account.
3.  Click **View QR Code & Details** on any ticket to see the confirmation page again.

## Part 2: For Organizers & Administrators

This section covers creating and managing events, users, and system settings.

### 1. Logging In

-   Navigate to the `/login` page on the website.
-   Enter the **Phone Number** and **Password** provided by the system administrator.
-   Upon first login, you will be required to change your temporary password for security.

### 2. Dashboard Overview

The dashboard is the central hub for managing your activities.

-   **Key Metrics**: At a glance, view `Total Revenue`, `Tickets Sold`, and `Total Events`. Admins can also see the number of `Pending Events`.
-   **Sales Overview**: A bar chart displays a summary of tickets sold for each of your approved events.

### 3. Managing Events (`Manage Events` page)

This is where you view, create, edit, and manage all your events.

#### Creating an Event
1.  Click the **Create Event** button.
2.  Fill in the form with all required details:
    -   `Event Name`, `Description`, `Category`
    -   `Start Date & Time`, `End Date & Time` (optional)
    -   `Location` (searchable) and `Specific Location Description` (optional)
    -   `Event Image`: Upload a promotional image.
    -   `Ticket Tiers`: Add at least one ticket type, specifying its name, price, and quantity.
3.  Click **Create Event**.
    -   **Organizers**: Your event will be submitted for admin approval (`Pending` status).
    -   **Admins**: Your event will be created and approved immediately.

#### Editing an Event
1.  On the `Manage Events` page, find your event card and click the **pencil icon**.
2.  Update any details in the form and click **Save Changes**.

#### Deleting an Event
1.  On the `Manage Events` page, find your event card and click the **trash can icon**.
2.  Confirm the deletion in the dialog. **Warning**: This action is irreversible and will delete all associated tickets and sales data.

#### Viewing Event Details & Reports (`Manage` / `Arrow` button)
Click the **Manage** button (for Admins on pending events) or the **arrow icon** to access the detailed view for a specific event. This view has several tabs:

-   **Dashboard**: A detailed breakdown of revenue, tickets sold, and capacity for that specific event, including a sales chart.
-   **Attendees**: A list of all attendees who have purchased tickets, their ticket type, and their check-in status.
-   **Tickets**: Manage the ticket tiers for the event. You can **Add**, **Edit**, or **Delete** ticket types.
-   **Promo Codes**: Create and manage promotional codes. You can **Add**, **Edit**, or **Delete** codes.
-   **Export Report**: Click the "Export Report" button to download a CSV file of all attendee data for the event.

### 4. Scanning Tickets (`Scan QR` page)

This page turns your device into a ticket scanner for check-ins.
1.  Click **Start Camera**. Your device's camera will activate.
2.  Align an attendee's QR code within the camera view.
3.  Upon a successful scan, the system will instantly display the check-in result:
    -   **Success**: The attendee's name and ticket details will appear in a green alert.
    -   **Already Checked In**: A yellow alert will indicate the ticket has already been used.
    -   **Invalid**: A red alert will show if the ticket is not valid.
4.  You can also **Upload QR from Image** to scan a ticket from a saved file.

### 5. Reports (`Reports` page)

This page provides comprehensive sales reports.
-   **Daily Sales**: View sales data filtered by a date range.
-   **Product Sales**: See a breakdown of sales by each ticket type across all your events.
-   **Promo Codes Report**: Analyze the usage and total discount of your promo codes.
-   **Download**: Each report can be downloaded as a CSV file.

### 6. Settings (Admin & Authorized Users)

The `Settings` section is for user and role management. Access is based on permissions.

#### User Management
-   **View Users**: See a list of all users you have permission to manage.
-   **Edit User**: Click the **pencil icon** to edit a user's details, including their assigned role and NIB Account.
-   **Change Status**: Use the toggle to activate or deactivate a user's account.
-   **Add User**: Click **Add User** to go to the registration page.

#### User Registration
1.  Navigate to `Settings` > `User Registration`.
2.  Fill in the new user's `First Name`, `Last Name`, `Phone Number`, `Email`, and assign them a `Role`. The NIB account is optional.
3.  A temporary password will be generated from their email (e.g., `user@example.com` becomes `user@123`). The user will be required to change it on their first login.

#### Role Management
1.  Navigate to `Settings` > `Role Management`.
2.  Here, you can see all existing roles and the number of permissions assigned to them.
3.  **Add New Role**: Click to create a new role. Give it a name and description, then select the specific permissions for each feature (e.g., can only `Read` Events but `Create`, `Read`, `Update`, `Delete` Reports).
4.  **Edit Role**: Click the **pencil icon** to modify an existing role's permissions.
5.  **Delete Role**: Click the **trash can icon**. You can only delete a role if no users are assigned to it.
***
