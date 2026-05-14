# Hotel Harmony - User Invite System Guide

## Overview

The Hotel Harmony invite system allows hotel administrators and managers to invite team members to join their hotel with specific roles. When a user accepts an invite and signs up, they automatically gain access to their hotel's dashboard with their assigned role.

## How It Works

### 1. Sending an Invite

**Location:** Settings → Team Tab → "Invite" Button

**Steps:**
1. Navigate to Settings → Team Tab
2. Click the "Invite" button
3. Enter the new team member's email address
4. Select their role:
   - **Admin**: Full access, can manage all hotel settings and staff
   - **Manager**: Can manage day-to-day operations and staff roles
   - **Receptionist**: Front desk operations
   - **Accountant**: Financial management and billing
   - **Restaurant**: Restaurant/dining management
   - **Kitchen**: Kitchen operations
   - **Housekeeping**: Housekeeping task management

5. The system generates an invite link and copies it to your clipboard
6. Share the link with the team member via email, WhatsApp, or other means

### 2. The Invite Link

The invite URL looks like:
```
https://yourhotel.com/invite/join?email=user@example.com&hotelId=hotel-123&hotelName=My%20Hotel&role=receptionist
```

**Parameters:**
- `email`: The invited user's email address
- `hotelId`: The hotel ID
- `hotelName`: The hotel name (for display purposes)
- `role`: The assigned role
- `owner` (optional): Set to `1` to make the user a hotel owner

### 3. Accepting the Invite

**For New Users:**
1. Click the invite link
2. Create a new account with:
   - Full name
   - Password (minimum 6 characters)
3. Click "Create account and join"
4. Account is created with:
   - Hotel ID automatically set to the invited hotel
   - Role automatically set to the invited role
   - Access to the hotel's dashboard immediately

**For Existing Users:**
1. Click the invite link
2. If already logged in, click "Apply this invitation"
3. The system updates their profile with:
   - Hotel ID set to the invited hotel
   - Role set to the invited role
4. Redirected to the hotel dashboard

### 4. Dashboard After Signup

Once a user accepts the invite and signs up, they are automatically:
1. Logged in with their new account (if new user)
2. Assigned to the hotel and role specified in the invite
3. Redirected to their role-specific dashboard:
   - **Admin/Manager/Receptionist**: Reception dashboard with room status, guest info, payments
   - **Accountant**: Financial dashboard with revenue, payments, invoices
   - **Restaurant/Kitchen**: Restaurant orders and kitchen display
   - **Housekeeping**: Housekeeping tasks and room assignments

## Technical Details

### Database Tables Involved

1. **profiles**
   - `hotel_id`: The hotel the user is assigned to
   - `role`: The user's role
   - `is_hotel_owner`: Whether user is a hotel owner
   - `disabled`: Whether user account is disabled

2. **hotel_memberships**
   - `user_id`: User ID
   - `hotel_id`: Hotel ID
   - `role`: User's role in this hotel
   - `is_hotel_owner`: Whether user owns this hotel
   - Enables users to be members of multiple hotels

3. **hotels**
   - Hotel information (name, address, settings, etc.)

### Flow Diagram

```
Admin sends invite
        ↓
Invite link generated and shared
        ↓
New/Existing user clicks link
        ↓
InviteJoinPage renders with invite details
        ↓
User signs up or applies invite
        ↓
Profile updated with hotel_id & role
        ↓
hotel_memberships entry created
        ↓
Profile refreshed in AuthContext
        ↓
Redirected to /dashboard
        ↓
HotelContext loads hotel data
        ↓
ProtectedRoute shows loading until hotel loads
        ↓
DashboardPage renders with role-specific content
```

## Features

### Enhanced Invite Experience
- **Clear invite details**: Shows hotel name and assigned role with color-coded badge
- **Owner indication**: Displays if user will be a hotel owner
- **Better feedback**: Shows meaningful messages during signup and role assignment
- **Loading state**: Shows "Initializing your hotel..." while context loads

### Role-Based Dashboards
- Each role has a customized dashboard showing relevant metrics and functions
- Users can only access features permitted by their role
- Permissions can be further customized in Settings → Permissions

### Multi-Hotel Support
- Users can be invited to multiple hotels
- Each user has a primary hotel (from profile.hotel_id)
- Users can switch between managed hotels via hotel switcher
- `hotel_memberships` table tracks user's role in each hotel

## Troubleshooting

### User clicks invite but nothing happens
- Check if the URL has all required parameters: `email`, `hotelId`, and `role`
- If user is not logged in and doesn't see signup form, their browser may have cached the page

### User signs up but doesn't see dashboard
- Check that the email in the URL matches the email used for signup
- Verify hotel_id is valid and exists in the database
- Check browser console for errors

### User has wrong role in dashboard
- Verify the invite URL had correct role parameter
- Check `profiles.role` and `hotel_memberships.role` in database
- Use Settings → Team to update the role if needed

### Already-existing user gets permission error
- Check that user's profile has `disabled: false`
- Verify `hotel_memberships` entry exists for user + hotel combination
- Check role permissions in Settings → Permissions

## Future Enhancements

Potential improvements for the invite system:
1. **Automated email sending**: Send invitation emails directly from the app
2. **Invite expiration**: Set expiration dates on invite links
3. **Bulk invites**: Invite multiple users at once via CSV
4. **Invite tracking**: See which invites have been accepted
5. **Invite cancellation**: Cancel pending invites
6. **Custom invite messages**: Personalize invitation text
7. **QR code invites**: Generate QR codes for easier mobile sharing
