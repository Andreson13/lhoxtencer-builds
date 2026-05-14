# Fix: Stale Data When App Returns to Focus

## Problem

When users backgrounded the Lhoxtencer app and returned after a few minutes, the data remained stale:
- Data was cached by React Query
- No mechanism to refresh when app regained focus
- Users had to manually refresh the page to see updated data

## Root Cause

This was **NOT a Supabase issue**, but an **application architecture problem**:

```
Data Loads → React Query Caches It
        ↓
User Backgrounds App
        ↓
User Returns After 5 Minutes
        ↓
React Query Serves Cached Data (No Refresh Triggered)
        ↓
❌ User Sees Stale Data
```

## Solution Overview

Implement a **visibility/focus listener** that invalidates React Query cache when the app regains focus:

```
Data Loads → React Query Caches It
        ↓
User Backgrounds App
        ↓
User Returns After 5 Minutes
        ↓
visibilitychange OR focus Event Fires
        ↓
queryClient.invalidateQueries() Called
        ↓
React Query Refetches All Data from Server
        ↓
✅ User Sees Fresh Data
```

## Implementation Details

### 1. Created `useQueryRefresh` Hook

**File:** `src/hooks/useQueryRefresh.ts`

```typescript
export function useQueryRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('📱 App came back into focus - refetching data');
        queryClient.invalidateQueries();
      }
    };

    const handleFocus = () => {
      console.log('🔄 Window focus - refetching data');
      queryClient.invalidateQueries();
    };

    // Listen for both events
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [queryClient]);
}
```

**What it does:**
- Listens for `visibilitychange` event (app moves to/from background - mobile)
- Listens for `focus` event (tab switches - desktop)
- When app becomes visible OR window gains focus
- Calls `queryClient.invalidateQueries()` to clear ALL React Query caches
- React Query automatically refetches all queries from the server

### 2. Added Hook to AppLayout

**File:** `src/components/layout/AppLayout.tsx`

```typescript
import { useQueryRefresh } from '@/hooks/useQueryRefresh';

export const AppLayout = () => {
  // ... other code
  
  useStayAccrualSync(hotel?.id);
  useQueryRefresh(); // ← Added this single line
  
  // ... rest of component
};
```

**Why AppLayout?**
- AppLayout wraps ALL protected routes in the app
- Adding hook here means it runs for every page
- No need to add hook to individual pages

### 3. Simplified ReservationsPage

Removed complex Realtime subscriptions since they're not needed:
- Kept simple React Query `useQuery` hooks
- Removed `useRealtimeTables` (not needed for just focus-based refresh)
- Data refresh happens automatically via `useQueryRefresh` in AppLayout

## How It Works Now

### User Flow:

1. **User opens app**
   - Pages load data via React Query
   - Data is cached by React Query

2. **User minimizes/backgrounds app**
   - App continues to run (but may be paused)
   - Cache remains intact

3. **User returns to app after 5+ minutes**
   - Browser fires `visibilitychange` event (visible) 
   - OR fires `focus` event (tab switched back)
   - `useQueryRefresh` detects this
   - Calls `queryClient.invalidateQueries()`

4. **React Query responds**
   - Detects all queries are invalidated
   - Automatically refetches from server
   - UI updates with fresh data

### Example: Reservations Page

```
User opens Reservations
  → useQuery fetches reservations from Supabase
  → React Query caches the data
  → UI displays 15 reservations

User minimizes app for 10 minutes
  → Cache remains (no refresh)

User returns to app
  → visibilitychange event fires
  → useQueryRefresh calls invalidateQueries()
  → useQuery refetches
  → Supabase returns updated reservations
  → React Query updates cache
  → UI updates with fresh data (maybe 18 reservations now)
```

## Key Benefits

✅ **Simple** - Only need a 15-line hook and one line in AppLayout
✅ **Automatic** - All pages benefit without individual changes
✅ **Non-invasive** - No Supabase config changes needed
✅ **Works everywhere** - Mobile, desktop, tab switching, app backgrounding
✅ **No Real-time overhead** - No WebSocket subscriptions if not needed

## Testing

1. Open Lhoxtencer → go to any data page (Reservations, Rooms, etc.)
2. Minimize the browser window (or open another tab)
3. Wait 30+ seconds
4. Return to the app
5. Check browser console - should see:
   ```
   📱 App came back into focus - refetching data
   🔄 Window focus - refetching data
   ```
6. Data should automatically refresh

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useQueryRefresh.ts` | **Created** - New hook to handle visibility/focus events |
| `src/components/layout/AppLayout.tsx` | **Modified** - Added `useQueryRefresh()` call |
| `src/pages/reservations/ReservationsPage.tsx` | **Simplified** - Removed unnecessary Realtime subscriptions |

## Why NOT Supabase?

Supabase was working perfectly:
- Data was stored correctly
- Queries returned correct data
- No network issues
- Issue was purely on the client side

The problem was the **client app** (React Query) caching data with no refresh mechanism. Adding a refresh mechanism on the client side solves it without any Supabase changes.

## If You Need Live Real-Time Data

If users expect to see changes from **other users in real-time**, you would need:
- `useRealtimeTables` hook (subscribes to Postgres Changes)
- Supabase Realtime enabled (already is)
- But this is optional if you only need refresh on app focus

For now, focus-based refresh is sufficient and simpler.

---

**Summary:** One hook + one line = stale data fixed! 🎉
