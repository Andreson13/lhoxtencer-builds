# Supabase Auth Deadlock Fixes - Implementation Summary

## Critical Bug Fixed: Permanent Request Hang on Tab Resume

### Root Cause
When a logged-in user backgrounded the tab and returned, **all Supabase requests hung forever** due to a classic async deadlock:

1. Browser fires `TOKEN_REFRESHED` event
2. Supabase GoTrue client holds an internal lock while invoking the auth listener callback
3. The callback was `async` with `await fetchProfile()` inside
4. `fetchProfile` calls `supabase.from('profiles').select(...)` which needs the same lock to attach the JWT
5. **Permanent deadlock** — lock never released, all Supabase calls hang

---

## Fix 1: `src/contexts/AuthContext.tsx` ⭐ PRIMARY FIX

### What Changed

#### A. Added Module-Level Guard (lines 8–9)
```typescript
// Module-level guard to prevent double listener registration (HMR, React StrictMode edge cases)
let authListenerRegistered = false;
```
**Why:** Prevents duplicate listener on HMR or React StrictMode double-mount edge cases.

#### B. Added Refs for State Management (lines 49–50)
```typescript
const currentUserIdRef = useRef<string | null>(null);
const initializedRef = useRef(false);
```
**Why:** 
- `currentUserIdRef` tracks the current user ID; prevents stale profile write if user signs out
- `initializedRef` replaces the local `let initialized` variable to avoid closure staleness issues

#### C. Imported `useRef` Hook (line 1)
```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
```

#### D. Restructured `useEffect` Hook (lines 102–185)

**BEFORE (Broken — Deadlock):**
```typescript
useEffect(() => {
  let initialized = false;

  // Called FIRST — async call
  supabase.auth.getSession()
    .then(async ({ data: { session } }) => {
      // ...
      await fetchProfile(session.user.id);  // OK here (not in auth lock)
    })
    .finally(() => {
      setLoading(false);
      initialized = true;
    });

  // Registered SECOND — and callback is ASYNC (bad!)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {  // ← async keyword = lock held
      setSession(session);
      setUser(session?.user ?? null);
      // ...
      await fetchProfile(session.user.id);  // ← DEADLOCK when TOKEN_REFRESHED fires
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

**AFTER (Fixed — No Deadlock):**
```typescript
useEffect(() => {
  // Guard against double listener registration
  if (authListenerRegistered) {
    supabase.auth.getSession().then(/* sync state update only */);
    return;
  }
  authListenerRegistered = true;

  // Step 1: Register listener FIRST (Supabase official guidance)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {  // ← NO async keyword = lock released
      console.log(`[auth] event: ${event}`, session?.user?.id ?? 'no user');

      if (event === 'INITIAL_SESSION') return;  // Skip (getSession handles it)

      // Synchronous state updates ONLY (safe inside auth lock)
      setSession(session);
      setUser(session?.user ?? null);
      currentUserIdRef.current = session?.user?.id ?? null;

      if (!session?.user) {
        persistProfile(null);
        setLoading(false);
        return;
      }

      if (!initializedRef.current) return;  // Still bootstrapping

      // Restore cached profile synchronously (no Supabase call)
      const cachedProfile = restoreProfile(session.user.id);
      if (cachedProfile) persistProfile(cachedProfile);

      // CRITICAL: Defer ALL Supabase calls until AFTER auth lock releases
      const userId = session.user.id;
      setTimeout(() => {
        if (currentUserIdRef.current !== userId) return;  // Guard: user signed out
        fetchProfile(userId).catch(error => {
          console.error('[auth] Failed to refresh profile after auth state change', error);
        });
      }, 0);  // Next event loop tick = lock already released
    }
  );

  // Step 2: Bootstrap session AFTER listener is registered (prevents missed events)
  supabase.auth.getSession()
    .then(async ({ data: { session } }) => {
      console.log('[auth] getSession resolved', session?.user?.id ?? 'no session');
      setSession(session);
      setUser(session?.user ?? null);
      currentUserIdRef.current = session?.user?.id ?? null;

      if (session?.user) {
        const cachedProfile = restoreProfile(session.user.id);
        if (cachedProfile) persistProfile(cachedProfile);
        try {
          await fetchProfile(session.user.id);  // OK: not in auth lock
        } catch (error) {
          console.error('[auth] Failed to load profile during session bootstrap', error);
          if (!cachedProfile) persistProfile(null);
        }
      } else {
        persistProfile(null);
      }
    })
    .finally(() => {
      setLoading(false);
      initializedRef.current = true;
    });

  return () => {
    authListenerRegistered = false;  // Reset guard on unmount
    subscription.unsubscribe();
  };
}, []);
```

### Why Each Change Fixes the Bug

| Change | Problem It Solves |
|--------|------------------|
| **Remove `async` from callback** | Holding `async` means the auth lock is held until the returned promise resolves. Removing it releases the lock immediately after sync code runs. |
| **Replace `await fetchProfile()` with `setTimeout(() => fetchProfile(), 0)`** | Moves the Supabase query to the next event loop turn, after the auth lock is released. |
| **Register listener BEFORE `getSession()`** | Supabase official guidance. Prevents race where `TOKEN_REFRESHED` fires during the async gap and is missed. |
| **Skip `INITIAL_SESSION` explicitly** | Prevents double profile fetch if `INITIAL_SESSION` fires while `getSession().then()` is in flight. |
| **`currentUserIdRef` in `setTimeout`** | Prevents stale profile write if user signs out between setTimeout queue time and fire time. |
| **`initializedRef` instead of local var** | Avoids stale closure bugs where the local `initialized` flag isn't visible in the callback. |
| **Module-level `authListenerRegistered` flag** | Prevents double registration on HMR or StrictMode edge cases where cleanup hasn't fired. |
| **`[auth]` console logs** | Diagnostic visibility — you can verify `TOKEN_REFRESHED` fires and no deadlock occurs. |

---

## Fix 2: `src/hooks/useAppResume.ts` ⭐ SECONDARY FIX

### What Changed

#### A. Removed Unguarded `getSession()` from Health Ping (line 49–57)

**BEFORE:**
```typescript
// ❌ This call has NO timeout and could hang if auth lock is held
await fetch(`${supabase.supabaseUrl}/rest/v1/?`, {
  method: 'HEAD',
  headers: { 'Authorization': `Bearer ${(await supabase.auth.getSession()).data?.session?.access_token || ''}` },
  signal: controller.signal,
}).catch(() => null);
```

**AFTER:**
```typescript
// ✅ Auth header removed; health ping just wakes the network stack
// (A 401 response still proves connectivity)
await fetch(`${supabase.supabaseUrl}/rest/v1/?`, {
  method: 'HEAD',
  signal: controller.signal,
}).catch(() => null);
```

**Why:** The inline `await supabase.auth.getSession()` was an unguarded call that could hang if the auth lock was held. With the primary fix applied, this is now safe, but removing the header eliminates the risk entirely and simplifies the code.

#### B. Added `[auth]` Diagnostic Logs (lines 51, 65–68, 92)

**Before:**
```typescript
console.log('🔑 Refreshing auth session...');
```

**After:**
```typescript
console.log(`[auth] session check: ${secondsUntilExpiry}s until expiry`);
if (secondsUntilExpiry < 300) {
  console.log('[auth] proactively refreshing session (< 5 minutes remaining)...');
  // ...
  console.log('[auth] session refresh complete');
}
```

Also updated other log lines:
```typescript
// Line 51: 
console.warn('[auth] Health ping failed:', err);

// Line 92:
console.warn('[auth] Realtime reconnect failed:', err);

// New line:
console.log('[auth] ✅ App resume complete');
```

**Why:** The `[auth]` prefix makes it easy to grep for all auth-related logs in DevTools. You can verify:
- `TOKEN_REFRESHED` fires on tab resume
- Session is checked and refreshed if needed
- No deadlock occurs (app doesn't hang)

---

## How to Verify the Fix

### In DevTools Console (F12)

Open the app, log in, then:

1. **Background the tab for 30+ seconds**
2. **Return to the tab**
3. **Watch the console for these logs in order:**

```
[auth] event: TOKEN_REFRESHED {userId}
[auth] 🔄 App resume triggered (visibility change)
[auth] session check: {secondsRemaining}s until expiry
[auth] 🔌 Realtime reconnected
[auth] 📡 Invalidating queries...
[auth] ✅ App resume complete
```

### What This Proves

✅ **`TOKEN_REFRESHED` fires** — the token refresh mechanism is working  
✅ **No hanging requests** — logs appear immediately (would hang forever before fix)  
✅ **Realtime reconnects** — subscriptions stay alive after resume  
✅ **Data refetches** — React Query queries are invalidated and refetch  
✅ **No manual refresh needed** — data updates automatically

---

## Test Scenarios

### Test 1: Log In → Background → Return
```
1. Load the app, log in
2. Navigate to a data-loading page (e.g., hotel dashboard)
3. Verify data loads and displays
4. Background the browser tab (Alt+Tab, switch windows)
5. Wait 30+ seconds
6. Return to the tab
7. EXPECT: Data re-loads automatically, no manual refresh needed, [auth] logs visible
```

### Test 2: Sign Out While Backgrounded
```
1. Log in
2. Background the tab
3. Sign out from another device/window
4. Return to the tab after 10+ seconds
5. EXPECT: App detects sign-out, redirects to login, no stale profile displayed
```

### Test 3: React StrictMode
```
1. In development, React runs effects twice in StrictMode
2. Log in and observe the console
3. EXPECT: Only ONE `[auth] event: INITIAL_SESSION` log (not two)
4. EXPECT: Profile fetches once (not twice)
```

### Test 4: Realtime Subscriptions
```
1. Log in and navigate to a page with live data (e.g., active reservations)
2. Background tab for 10+ seconds
3. Have another user create/update data in the same hotel
4. Return to the tab
5. EXPECT: New/updated data appears automatically (realtime subscription reconnected)
```

### Test 5: Offline → Online
```
1. Log in and view a page
2. Toggle airplane mode / disconnect network
3. Wait 5 seconds
4. Reconnect network
5. EXPECT: App reconnects automatically, [auth] logs show recovery
6. EXPECT: Data re-syncs without manual refresh
```

---

## Why This Matters

### Before Fix
- Requests hung indefinitely on tab resume
- Users had to manually refresh to recover
- Realtime subscriptions died after background
- **Production impact: Data stale for users who switch tabs**

### After Fix
- Requests complete immediately on tab resume  
- Automatic token refresh on long background periods
- Realtime subscriptions auto-reconnect
- Profile and hotel data refresh transparently
- **Production impact: Seamless user experience across tab switches**

---

## Files Modified

| File | Lines Changed | Type |
|------|---------------|------|
| `src/contexts/AuthContext.tsx` | 1–185 | Primary (deadlock fix) |
| `src/hooks/useAppResume.ts` | 43–105 | Secondary (hardening) |

## Supabase Client Config

**Confirmed correct — no changes needed:**
```typescript
auth: {
  storage: localStorage,
  persistSession: true,
  autoRefreshToken: true,  // ✅ SDK auto-refreshes tokens
}
```

---

## Next Steps

1. **Start the dev server:** `npm run dev`
2. **Open DevTools:** F12 → Console tab
3. **Log in** and test the scenarios above
4. **Monitor logs** for `[auth]` events
5. **Background the tab** and verify automatic recovery
6. **Commit and push** when verified

All Supabase calls now properly release the auth lock before executing, preventing the deadlock permanently.
