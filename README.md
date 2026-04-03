
# NibTera Tickets - System Architecture Overview

This document provides a high-level overview of the application's system architecture, covering its various layers and deployment strategy.

## 1. System Architecture

The application is built on a modern, monolithic architecture using the Next.js framework, which provides a robust foundation for both the frontend (presentation layer) and backend (application layer). This structure simplifies development and deployment while maintaining a clear separation of concerns.

### 1.1. Presentation Layer (Frontend)

-   **Framework**: Built with **React** and the **Next.js App Router**. This enables a file-system-based routing system and leverages modern React features.
-   **Components**: Utilizes **ShadCN UI** for a consistent, accessible, and themeable component library. These components are built on top of Radix UI for accessibility and styled with Tailwind CSS for flexibility.
-   **Rendering Strategy**: Employs a hybrid rendering model. Most UI components are **React Server Components (RSCs)** by default, which improves performance by rendering on the server and sending minimal JavaScript to the client. Client-side interactivity is added where necessary using `'use client'` directives.

### 1.2. Application Layer (Backend)

-   **Framework**: Handled by **Next.js Server Actions** and **API Routes**. Server Actions provide a seamless way to execute backend logic directly from a component, simplifying form submissions and data mutations. API Routes handle webhook callbacks and other direct API interactions.
-   **Business Logic**: Core application logic—such as creating events, managing users, or processing payments—is encapsulated within server-side functions located in `src/lib/actions.ts`. This centralizes business rules and ensures they are executed securely on the server.

### 1.3. Data Layer

-   **Database**: Uses **PostgreSQL**, a powerful and scalable open-source relational database known for its reliability and feature set.
-   **ORM (Object-Relational Mapper)**: **Prisma** serves as the ORM, providing a type-safe and intuitive API for database operations. It manages database queries, migrations (schema changes are tracked in `prisma/migrations`), and data seeding (`prisma/seed.ts`).

### 1.4. Security Layer

-   **Authentication**: A custom, robust authentication system is implemented using **JWTs (JSON Web Tokens)** stored in secure, **HTTP-only cookies**. This approach prevents client-side script access (mitigating XSS) and token substitution attacks.
-   **Authorization**: A relational, Role-Based Access Control (RBAC) system is implemented.
    -   Permissions are defined in the database via `Permission` and `RolePermission` tables.
    -   All authorization checks are strictly enforced on the server-side within API routes and Server Actions, ensuring that users can only access resources and perform actions they are explicitly permitted to.
-   **CSRF Protection**: The application uses a "Double Submit Cookie" pattern to mitigate Cross-Site Request Forgery (CSRF) attacks for all state-changing requests (POST, PUT, DELETE).

### 1.5. Deployment & Infrastructure

The application is designed for a secure, scalable, and highly available production environment.

-   **Scalable Deployment**: The application server is stateless and can be scaled horizontally. Multiple instances can be run behind a Load Balancer (LB) to distribute traffic. This setup works for both cloud-based auto-scaling groups and on-premises server clusters.

-   **High Availability**: High availability is achieved by deploying redundant application servers and a clustered/replicated PostgreSQL database across different availability zones or physical racks. The load balancer manages health checks and routes traffic away from failed instances.

-   **Network Segmentation**: The system is deployed across two main network segments: a Public Subnet and a Private Subnet, ensuring a secure and layered architecture.
    -   **Public Subnet**: This is the public-facing zone accessible from the internet. It contains the Firewall/WAF and the Load Balancer/IIS. These components handle incoming user traffic, provide security screening, and distribute requests to the application servers in the private subnet. The Email Service is also accessible from this subnet.
    -   **Private Subnet**: This isolated network is not directly accessible from the internet. It hosts the core components which are the Application Server (running the Next.js app) and the PostgreSQL Database. The Application Server accepts traffic from the Load Balancer/IIS, providing a high level of security. Both the application server and the database server are deployed in one server within this subnet.

-   **Build & Run Process**:
    1.  The `next.config.js` file is configured with `output: "standalone"`. When `npm run build` is executed, Next.js creates a minimal, production-ready Node.js server in the `/.next/standalone` directory.
    2.  This standalone output is deployed to each application server in the private subnet.
    3.  A process manager (like PM2) is used to run the Node.js application (`server.js`) and ensure it remains active (e.g., restarting on failure).

## 2. Data Flow Diagrams (DFD)

The following sections describe the flow of data through the system at different levels of detail.

### 2.1. Level 0: Context Diagram

The Level 0 DFD shows the entire system as a single process and illustrates its interaction with external entities.

-   **Process:**
    -   **0. EventFlow Tickets System**: The complete application.
-   **External Entities:**
    -   **User/Attendee**: Public user browsing events and purchasing tickets.
    -   **Authenticated User (Admin/Organizer)**: A user who has logged into the system to manage events, users, or other resources.
    -   **Payment Gateway (NIB SuperApp)**: The external service responsible for processing payments.
    -   **Email Service (Nodemailer)**: The external service used for sending transactional emails (e.g., temporary passwords).
-   **Data Flows:**
    -   **User/Attendee -> System**:
        -   `Event Browsing Request`: Views public event pages.
        -   `Ticket Purchase Request`: Submits attendee details and selected tickets to initiate a purchase.
        -   `Ticket Status Check`: Requests to view purchased tickets.
        -   `Registration Details`: Submits information to create a new Organizer account.
    -   **System -> User/Attendee**:
        -   `Public Event Data`: Returns event details, dates, and ticket availability.
        -   `Payment Redirect/Hand-off`: Provides a payment token to the client to hand off to the SuperApp.
        -   `Ticket Confirmation & QR Code`: Displays the final purchased ticket.
    -   **Authenticated User -> System**:
        -   `Login Credentials`: Submits phone number and password for authentication.
        -   `Management Actions`: Submits data to create/update events, users, roles, and promo codes.
        -   `Check-in Scan`: Submits a QR code for attendee validation.
    -   **System -> Authenticated User**:
        -   `Dashboard & Report Data`: Returns aggregated sales data, event lists, and user information.
        -   `Session Token (Cookie)`: Sets a secure, HTTP-only cookie upon successful login.
        -   `Check-in Confirmation/Rejection`: Returns the result of a QR code scan.
    -   **System -> Payment Gateway**:
        -   `Payment Initiation Request`: Sends transaction details (amount, ID, callback URL) to start a payment.
    -   **Payment Gateway -> System**:
        -   `Payment Completion Webhook`: Sends a notification to a callback URL to confirm a successful payment.
    -   **System -> Email Service**:
        -   `New User Email Request`: Sends user details and a temporary password to be emailed.

### 2.2. Level 1: High-Level Diagram

This DFD breaks down the system into its major sub-processes and shows how data flows between them and to the primary data store.

-   **Processes:**
    -   **1.0 User & Event Management**: Handles user authentication, registration, role management, and event CRUD operations.
    -   **2.0 Ticket Purchasing**: Manages the public-facing ticket selection and checkout flow.
    -   **3.0 Payment Processing**: Interfaces with the external payment gateway and handles payment callbacks.
    -   **4.0 Attendee Check-in**: Validates QR codes for event entry.
-   **Data Stores:**
    -   **DS1: PostgreSQL Database**: Contains all application data (Users, Events, Roles, Permissions, Tickets, Attendees, Orders, Payments).
-   **Data Flows:**
    -   **Authentication Flow**:
        -   `Login Credentials` -> **1.0 User & Event Management**
        -   `User Record` is read from `DS1`.
        -   `Session Token` is sent back to the Authenticated User.
    -   **Event Management Flow**:
        -   `Event Data` -> **1.0 User & Event Management** -> `DS1` (write/update).
        -   `Event Read Request` -> **1.0 User & Event Management** -> `DS1` (read) -> `Dashboard Data`.
    -   **Ticket Purchase Flow**:
        -   `Public Event Data` is read from `DS1` and sent to the User/Attendee.
        -   `Selected Ticket Info` -> **2.0 Ticket Purchasing**
        -   `Pending Order` is created in `DS1`.
        -   `Payment Details` flow from **2.0** to **3.0 Payment Processing**.
    -   **Payment Flow**:
        -   `Payment Initiation` -> **3.0 Payment Processing** -> **Payment Gateway**.
        -   `Payment Webhook` -> **3.0 Payment Processing**.
        -   `Order Status Update` is written to `DS1`.
        -   `Attendee & Ticket Records` are created in `DS1`.
    -   **Check-in Flow**:
        -   `QR Code Data` -> **4.0 Attendee Check-in**.
        -   `Attendee Record` is read from `DS1`.
        -   `Check-in Status` is updated in `DS1`.
        -   `Validation Result` is sent back to the AuthenticatedUser.

### 2.3. Level 2: Detailed DFD (Example: Ticket Purchase & Payment)

This DFD details the `2.0 Ticket Purchasing` and `3.0 Payment Processing` processes.

-   **Processes:**
    -   **2.1 Select Tickets**: User interacts with the event page UI.
    -   **2.2 Create Pending Order**: An API endpoint (`/api/payment/pending-order`) creates a temporary order record.
    -   **3.1 Initiate Gateway Payment**: An API endpoint (`/api/payment/nib/initiate`) builds and sends the payment request to the gateway.
    -   **3.2 Handle Gateway Callback**: A webhook endpoint (`/api/portal/payment-callback`) receives confirmation from the gateway.
    -   **3.3 Finalize Ticket**: A background or transactional process that updates the database after successful payment.
-   **Data Stores:**
    -   `DS1.1`: Users Table
    -   `DS1.2`: Events Table
    -   `DS1.3`: TicketTypes Table
    -   `DS1.4`: PromoCodes Table
    -   `DS1.5`: PendingOrders Table
    -   `DS1.6`: Attendees Table
    -   `DS1.7`: EventPayments Table
-   **Data Flows:**
    1.  User selects tickets and provides attendee details (**Process 2.1**).
    2.  `Attendee Info` and `Ticket Selection` are sent to **Process 2.2**.
    3.  **Process 2.2** writes a new `Pending Order` record to `DS1.5` and returns a `Transaction ID` to the client.
    4.  The client sends the `Transaction ID` and `Total Amount` to **Process 3.1**.
    5.  **Process 3.1** reads `SuperApp Token` from the user's cookie and `Event Bank Account` from `DS1.2`. It generates a signature and creates a `Pending Payment` record in `DS1.7`.
    6.  **Process 3.1** sends the `Payment Request` to the **Payment Gateway** and receives a `Payment Token`.
    7.  The `Payment Token` is returned to the client, which hands it off to the SuperApp.
    8.  The **Payment Gateway** completes the payment and sends a `Payment Confirmation Webhook` (containing `paidAmount`, `txnRef`) to **Process 3.2**.
    9.  **Process 3.2** finds the corresponding order in `DS1.5` and payment record in `DS1.7` using `txnRef`.
    10. **Process 3.2** triggers **Process 3.3**.
    11. **Process 3.3** creates a new `Attendee Record` in `DS1.6`, decrements stock in `DS1.3`, updates uses in `DS1.4`, and marks the records in `DS1.5` and `DS1.7` as `COMPLETED`.
    12. The user, on the success page, polls an endpoint that checks the status in `DS1.5` and is redirected to the final ticket confirmation page.

## 3. Business Logic

This section outlines how the application's core business rules, workflows, and validation logic are implemented and managed.

### 3.1. Business Rules and Workflows

The application's logic is centralized in Next.js Server Actions within `src/lib/actions.ts`. This ensures all business rules are executed securely on the server. Key workflows include:

-   **User Registration & Approval**:
    1.  New Organizers register through the public registration form.
    2.  Their account is created with a `status` of `INACTIVE`.
    3.  An Admin must review and manually approve the account (`status` -> `ACTIVE`) via the User Management dashboard before the Organizer can log in and create events.
-   **Event Creation & Approval**:
    1.  An authenticated Organizer or Admin creates an event.
    2.  If created by an Organizer, the event's `status` is set to `PENDING`.
    3.  An Admin must review the event in the "Manage Events" dashboard and either `APPROVE` or `REJECT` it.
    4.  Only `APPROVED` events are visible to the public.
-   **Ticket Sales & Inventory**:
    1.  Ticket inventory (`total` and `sold` counts) is managed in the `TicketType` table.
    2.  When a payment is successfully confirmed via the payment gateway webhook, a database transaction decrements the available ticket count (`sold` is incremented).
    3.  The system prevents overselling by checking availability.

### 3.2. Validation Logic

Data integrity is enforced at multiple levels:

-   **Client-Side**: Forms throughout the application (e.g., event creation, user registration) use the **Zod** library for schema-based validation. This provides immediate feedback to the user and prevents malformed data from being submitted.
-   **Server-Side**: All Server Actions in `src/lib/actions.ts` perform critical server-side validation. For example:
    -   The `deleteUser` action verifies that an Organizer does not have active events before allowing deletion.
    -   The `createRole` and `updateRole` actions validate submitted permissions against a canonical, server-defined allowlist (`ALLOWED_PERMISSIONS`) to prevent privilege escalation attacks.

### 3.3. Configurable Business Rules (RBAC)

A key requirement for configurable business rules is met by the **Role-Based Access Control (RBAC)** system.

-   **Mechanism**: The system does not hardcode user permissions. Instead, an Admin can define and modify `Roles` and their associated `Permissions` directly through the "Role Management" interface.
-   **Configuration Without Code Changes**: An Admin can create a new role (e.g., "Auditor"), assign it a specific set of read-only permissions, and then assign that role to users. This entire process occurs through the UI and database updates, requiring **no source code modification**.
-   **Enforcement**: The `AuthGuard` and server-side checks use the permissions associated with a user's role in the database to grant or deny access to pages and actions, ensuring the configured rules are enforced application-wide.

### 3.4. Traceability and Auditing

-   **Centralized Actions**: All state-changing operations (Create, Update, Delete) are consolidated within `src/lib/actions.ts`. This provides a single, logical place to implement comprehensive logging for all business-critical transactions.
-   **Database Records**: All core business objects (Events, Tickets, Users, Payments) have `createdAt` and `updatedAt` timestamps, providing a basic audit trail of when records were created or modified.
-   **Payment Tracking**: The `EventPayment` and `PendingOrder` tables create a traceable record of every payment attempt, linking it to the user, event, and final status, which is essential for financial auditing.
-   **Note**: While the structure supports full audit logging (e.g., logging every action to a separate `AuditLog` table), this feature is not yet explicitly implemented but can be easily added to the server actions.
