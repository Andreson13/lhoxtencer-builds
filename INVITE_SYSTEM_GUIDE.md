# Hotel Harmony - User Invite System Guide

## Overview

The Hotel Harmony invite system allows hotel administrators and managers to invite team members to join their hotel with specific roles. Invitations are stored in the database and managed through the admin interface. When invited users sign up or log in, they automatically see their pending invitations and can accept or reject them.

## How It Works

### 1. Sending an Invitation

**Location:** Settings → Team Tab → "Invite" Button

**Steps:**
1. Navigate to Settings → Team Tab
2. Click the "Invite" button
3. Enter the team member's email address
4. Select their role:
   - **Admin**: Full access, can manage all hotel settings and staff
   - **Manager**: Can manage day-to-day operations and staff roles
   - **Receptionist**: Front desk operations
   - **Accountant**: Financial management and billing
   - **Restaurant**: Restaurant/dining management
   - **Kitchen**: Kitchen operations
   - **Housekeeping**: Housekeeping task management

5. Click "Invite" - the invitation is stored in the database
6. The invited user will see it when they next sign up or log in

**For Existing Users:**
- If the email belongs to an existing user, they are immediately added to the hotel with that role
- They will see the change reflected when they next refresh their profile

### 2. Managing Invitations

**As an Admin/Manager:**
- View all pending invitations in Settings → Team Tab → "Pending Invitations" section
- See email, role, and invitation date for each pending invite
- Cancel pending invitations using the delete button if needed

### 3. Accepting an Invitation

**For New Users (Signup Flow):**
1. User signs up with email that matches a pending invitation
2. After account creation, they are directed to the "Pending Invitations" page
3. They see a clear list of invitations showing:
   - Hotel name
   - Assigned role (with color badge)
   - Owner status (if applicable)
4. User can:
   - **Accept**: Join the hotel with the assigned role → goes directly to dashboard
   - **Reject**: Keep the account but don't join that hotel → goes to onboarding
   - **Ignore and Continue**: Skip all invitations → goes to onboarding

**For Existing Users (Login Flow):**
1. User logs in with email that has pending invitations
2. After login, they are directed to the "Pending Invitations" page
3. Same flow as above - accept, reject, or ignore

### 4. Dashboard After Acceptance

Once a user accepts an invitation:
1. They are immediately assigned to the hotel
2. Their role is set to the invited role
3. They are redirected to their role-specific dashboard:
   - **Admin/Manager/Receptionist**: Reception dashboard with room status, guest info, payments
   - **Accountant**: Financial dashboard with revenue, payments, invoices
   - **Restaurant/Kitchen**: Restaurant orders and kitchen display
   - **Housekeeping**: Housekeeping tasks and room assignments

## Technical Details

### Database Table: invitations

```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL,        -- Which hotel
  email TEXT NOT NULL,           -- Invited email
  role TEXT NOT NULL,            -- Assigned role
  is_hotel_owner BOOLEAN,        -- Owner flag
  invited_by UUID,               -- Who invited them
  status TEXT,                   -- 'pending', 'accepted', 'rejected', 'expired'
  created_at TIMESTAMP,          -- When invited
  expires_at TIMESTAMP,          -- Expires in 30 days
  accepted_at TIMESTAMP          -- When they accepted
)
```

### Flow Diagram

```
Admin sends invite via UI
        ↓
Invitation stored in database with status='pending'
        ↓
User signs up or logs in with that email
        ↓
System queries invitations table
        ↓
If pending invitations found:
    User → PendingInvitationsPage
        ↓
    User accepts invitation
        ↓
    hotel_memberships entry created
        ↓
    profiles updated with hotel_id & role
        ↓
    Redirect to dashboard
        ↓
If no pending invitations:
    New user → onboarding
    Existing user → dashboard
```

## User Experience Flow

### New User Signup
```
Sign up page → Enter email/password/name
    ↓
Check for pending invitations
    ↓
Has pending invites? → YES → Pending Invitations Page
                    → NO  → Onboarding Page
```

### Existing User Login
```
Login page → Enter email/password
    ↓
Check for pending invitations
    ↓
Has pending invites? → YES → Pending Invitations Page
                    → NO  → Dashboard
```

## Features

### For Administrators
- **Centralized invite management**: All pending invites visible in one place
- **No manual link sharing**: Invites are automatic - just need email address
- **Easy cancellation**: Cancel invites with one click if needed
- **Immediate assignment**: Existing users are instantly added to the hotel
- **Role assignment**: Specify role during invitation
- **Owner designation**: Option to make new users hotel owners

### For Users
- **Clear invitation details**: See exactly which hotel and what role they're invited to
- **Explicit acceptance**: Users must actively accept invitations
- **Option to reject**: Can reject invitations without losing their account
- **Flexible onboarding**: Can still set up own hotel if they reject all invites
- **No complex links**: Just sign up with invited email address

### Security
- **RLS Policies**: Row-level security ensures users only see their own invitations
- **Email verification**: Invitations matched by email address
- **Status tracking**: All invitations have clear status (pending, accepted, rejected)
- **Expiration**: Invitations expire after 30 days (for future enforcement)

## Troubleshooting

### User doesn't see pending invitations after signup
- Verify the email used in signup matches the invited email (case-insensitive)
- Check the invitations table to confirm invitation exists and has status='pending'
- Ensure the invitation hasn't expired

### User was added but doesn't see the hotel
- User may need to refresh the page or log out/in
- Check that hotel_id is correctly set in profiles table
- Verify hotel_memberships entry was created

### Admin can't see pending invitations in settings
- Make sure you have admin or manager role
- Check that invitation status is 'pending' (not 'accepted' or 'rejected')
- Verify the invitation belongs to your hotel

### Email already has an account
- If user already exists in system, they are immediately added instead of getting pending invite
- They'll see the new hotel when they next log in
- No invitation record is created in this case

## Future Enhancements

Potential improvements:
1. **Email notifications**: Send automated emails to invited users
2. **Bulk invites**: Invite multiple users via CSV
3. **Invite expiration enforcement**: Automatically expire old invitations
4. **Invitation reminders**: Remind users of pending invitations
5. **Custom invite messages**: Add personalized message to invitations
6. **Invite tracking**: See acceptance/rejection statistics
7. **Team templates**: Save common role configurations as templates
