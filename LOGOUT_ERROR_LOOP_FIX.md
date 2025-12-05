# Logout Error Loop Fix

## Problem
When logging out, the app entered an error loop in the terminal with continuous reconnection attempts and errors from services trying to access user data that no longer exists.

## Root Causes

### 1. Real-Time Manager Auto-Reconnect
The `realTimeManager` has automatic reconnection logic that continued trying to reconnect even after logout:
- Network monitoring remained active
- `handleNetworkRecovery()` automatically called `connect()` when network state changed
- `scheduleReconnect()` kept attempting reconnections
- No check for valid user session before reconnecting

### 2. Services Not Cleaned Up
When logging out, services like `notificationManager` weren't being cleaned up, causing them to continue trying to access user data.

### 3. No Session Validation
The `connect()` method didn't check if there was a valid user session before attempting to connect.

---

## Solutions Implemented

### 1. Prevent Auto-Reconnect After Logout

**File:** `services/realtime.ts`

#### A. Set Max Reconnect Attempts on Disconnect
```typescript
disconnect(): void {
  console.log('Disconnecting from real-time service');
  
  // ... clear timers and channels ...
  
  // Reset reconnection attempts to prevent auto-reconnect after logout
  this.connectionState.reconnectAttempts = this.MAX_RECONNECT_ATTEMPTS;
  
  this.notifyConnectionChange(false);
}
```

This ensures that after logout, the reconnection attempts are maxed out, preventing any auto-reconnect logic from triggering.

#### B. Check Max Attempts in Network Recovery
```typescript
private handleNetworkRecovery(): void {
  // Don't auto-reconnect if we've hit max attempts (e.g., after logout)
  if (this.connectionState.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
    console.log('Not auto-reconnecting - max attempts reached (likely logged out)');
    return;
  }
  
  // ... rest of recovery logic ...
}
```

#### C. Check Connection State in Schedule Reconnect
```typescript
private scheduleReconnect(): void {
  // ... network and max attempts checks ...
  
  // Don't reconnect if we're not connected (e.g., after logout)
  if (!this.connectionState.isConnected && !this.connectionState.isConnecting) {
    console.log('Not attempting reconnect - service was explicitly disconnected');
    return;
  }
  
  // ... rest of reconnect logic ...
}
```

### 2. Validate Session Before Connecting

**File:** `services/realtime.ts`

```typescript
async connect(): Promise<void> {
  if (this.connectionState.isConnected || this.connectionState.isConnecting) {
    return;
  }
  
  // Check if user is authenticated before connecting
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.log('No active session, skipping real-time connection');
    return;
  }
  
  // ... rest of connection logic ...
}
```

This prevents the real-time manager from attempting to connect when there's no authenticated user.

### 3. Cleanup Notification Manager on Logout

**File:** `app/_layout.tsx`

```typescript
useEffect(() => {
  if (user && !loading) {
    console.log('User authenticated, connecting real-time manager');
    realTimeManager.connect()
      .then(() => console.log('Real-time manager connected'))
      .catch(error => console.error('Error connecting real-time manager:', error));
  } else if (!user && !loading) {
    console.log('User not authenticated, disconnecting real-time manager');
    realTimeManager.disconnect();
    
    // Also cleanup notification manager to prevent errors
    notificationManager.cleanup();
  }
}, [user, loading]);
```

### 4. Added Logging to AuthContext

**File:** `contexts/AuthContext.tsx`

```typescript
const logout = async () => {
  console.log('[AuthContext] Logging out user');
  await authService.logout();
  setUser(null);
  setPreferences(null);
  console.log('[AuthContext] User logged out, state cleared');
};
```

This helps track the logout flow in the console.

---

## How It Works Now

### Logout Flow:
1. User clicks logout
2. `AuthContext.logout()` is called
3. `authService.logout()` signs out from Supabase
4. User state is set to `null`
5. Preferences state is set to `null`
6. `useEffect` in `_layout.tsx` detects `user === null`
7. `realTimeManager.disconnect()` is called:
   - Clears all timers
   - Unsubscribes from all channels
   - Sets `reconnectAttempts` to max (prevents auto-reconnect)
8. `notificationManager.cleanup()` is called
9. User is redirected to login screen

### Reconnection Prevention:
- `disconnect()` sets `reconnectAttempts = MAX_RECONNECT_ATTEMPTS`
- `handleNetworkRecovery()` checks if max attempts reached → returns early
- `scheduleReconnect()` checks connection state → returns early
- `connect()` checks for valid session → returns early if no session

---

## Testing

### Test Logout:
1. Login to the app
2. Navigate around (home, watchlist, profile)
3. Click logout
4. Check terminal/console logs

### Expected Behavior:
✅ Clean logout with no errors
✅ Logs show:
```
[AuthContext] Logging out user
User not authenticated, disconnecting real-time manager
Disconnecting from real-time service
[AuthContext] User logged out, state cleared
```

✅ No reconnection attempts
✅ No errors about missing user data
✅ Redirect to login screen

### What NOT to See:
❌ Continuous reconnection attempts
❌ Errors about "user not found"
❌ Errors about "session expired"
❌ Network recovery triggering reconnects
❌ Services trying to access user data

---

## Edge Cases Handled

### 1. Network Change After Logout
- Network goes offline → comes back online
- `handleNetworkRecovery()` checks max attempts
- Does NOT attempt to reconnect
- ✅ No errors

### 2. Rapid Logout/Login
- User logs out → immediately logs back in
- `connect()` checks for valid session
- Only connects if session exists
- ✅ Clean state transition

### 3. Background Services
- Services like notification manager cleaned up
- No lingering subscriptions or timers
- ✅ No memory leaks

### 4. Real-Time Subscriptions
- All channels unsubscribed on disconnect
- No orphaned subscriptions
- ✅ Clean disconnection

---

## Files Modified

1. ✅ `services/realtime.ts` - Added session validation and reconnection prevention
2. ✅ `app/_layout.tsx` - Added notification manager cleanup on logout
3. ✅ `contexts/AuthContext.tsx` - Added logging for logout flow

---

## Benefits

✅ **Clean Logout** - No error loops or continuous reconnection attempts
✅ **Resource Cleanup** - All services properly cleaned up
✅ **Session Validation** - Only connects when user is authenticated
✅ **Better Logging** - Clear console logs for debugging
✅ **Edge Case Handling** - Network changes, rapid logout/login handled
✅ **Memory Efficiency** - No lingering subscriptions or timers

---

## Rollback

If you need to revert these changes:

```bash
git diff services/realtime.ts
git diff app/_layout.tsx
git diff contexts/AuthContext.tsx
```

Then manually revert the specific changes or use:
```bash
git checkout HEAD -- services/realtime.ts app/_layout.tsx contexts/AuthContext.tsx
```

---

## Related Issues

This fix also prevents:
- Memory leaks from lingering subscriptions
- Battery drain from continuous reconnection attempts
- Network spam from failed connection attempts
- Console spam from error messages

---

**Status:** ✅ Fixed
**Date:** December 5, 2025
**Impact:** High - Affects all users on logout
