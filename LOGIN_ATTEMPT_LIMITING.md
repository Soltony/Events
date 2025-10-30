# Login Attempt Limiting Implementation

## Overview
The system now implements robust login attempt limiting to prevent brute force attacks. Users who fail to log in more than 5 times will be locked out for 30 seconds before they can attempt to log in again.

## Features Implemented

### 1. Failed Attempt Tracking
- **Maximum Attempts**: 5 failed login attempts before lockout
- **Persistent Storage**: Failed attempts are stored in `localStorage` and persist across browser sessions
- **Real-time Updates**: Counter increments with each failed login attempt

### 2. Lockout Mechanism
- **Lockout Duration**: 30 seconds after reaching maximum failed attempts
- **Persistent Lockout**: Lockout state is stored in `localStorage` and survives page refreshes
- **Automatic Cleanup**: Expired lockouts are automatically cleared on app initialization

### 3. User Experience
- **Clear Feedback**: Users receive toast notifications about failed attempts and lockout status
- **Time Remaining**: During lockout, users see exactly how many seconds they need to wait
- **Graceful Handling**: The system prevents API calls during lockout periods

## Implementation Details

### Constants
```typescript
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 1000; // 30 seconds
```

### State Management
- `failedAttempts`: Tracks current number of failed attempts
- `lockoutUntil`: Timestamp when lockout expires (null if not locked out)

### localStorage Keys
- `failedLoginAttempts`: Stores current failed attempt count
- `lockoutUntil`: Stores lockout expiration timestamp

### Flow
1. **Login Attempt**: User submits login form
2. **Lockout Check**: System checks if user is currently locked out
3. **API Call**: If not locked out, proceeds with authentication
4. **Success**: On successful login, clears all failed attempt data
5. **Failure**: On failed login, increments counter and persists to localStorage
6. **Lockout**: After 5 failures, activates 30-second lockout period

## Security Benefits
- **Brute Force Protection**: Prevents automated login attempts
- **Rate Limiting**: Limits login attempts per user session
- **Persistent Protection**: Security persists across browser sessions
- **User-Friendly**: Provides clear feedback without being overly restrictive

## Testing the Functionality
To test the login attempt limiting:

1. Navigate to the login page
2. Enter incorrect credentials 5 times
3. Observe the lockout message after the 5th attempt
4. Wait 30 seconds or refresh the page to see persistent lockout
5. Try logging in with correct credentials after lockout expires

The system will automatically reset failed attempts and lockout state on successful login.
