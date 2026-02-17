# Security Implementation - Critical Fixes

This document summarizes the critical production readiness fixes implemented to address vulnerabilities identified in the production review.

## 1. ✅ Payment Security (CRITICAL)

### Issue: No Razorpay Signature Verification
**Before:** Payment verification blindly trusted client-submitted data, allowing payment fraud.
**After:** 
- Implemented HMAC-SHA256 signature verification for all Razorpay payments
- Server verifies signature using `RAZORPAY_KEY_SECRET`
- Invalid signatures immediately rejected with 400 error
- Additional verification: Fetch payment from Razorpay API and verify amount matches

**Files Changed:**
- `controllers/paymentController.js` - `verifyPayment()` method

**Code:**
```javascript
const signatureData = `${razorpayOrderId}|${razorpayPaymentId}`;
const expectedSignature = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(signatureData)
  .digest('hex');

if (razorpaySignature !== expectedSignature) {
  return sendError(res, 400, 'Payment verification failed - Invalid signature');
}
```

---

## 2. ✅ Token Management (CRITICAL)

### Issue: Unbounded refreshTokens Array in User Model
**Before:** Each refresh token stored in User's refreshTokens array, causing:
- Array grows unbounded with each token generation
- Can't implement token rotation
- Token revocation difficult

**After:**
- Created separate `RefreshToken` collection for scalability
- Each token document tracks: userId, token, tokenFamily, expiresAt, revokedAt
- Automatic cleanup with 90-day TTL index
- Enables token rotation and family-based revocation

**Files Created:**
- `models/RefreshToken.js`

**Key Features:**
- Unique index on token prevents duplication
- Composite index on userId + tokenFamily for fast rotation
- Automatic document deletion after 90 days via TTL

---

## 3. ✅ Token Rotation (CRITICAL)

### Issue: No Token Rotation Implementation
**Before:** Tokens valid indefinitely once issued; stolen token = permanent access.
**After:**
- Implemented token family concept
- Each token refresh creates new token in same family
- Old token revoked before new token issued
- Token theft detection: If refresh token expired, entire family revoked

**Files Changed:**
- `controllers/authController.js` - `refreshAccessToken()` new method
- `middleware/authMiddleware.js` - Enhanced

**Process:**
1. Client uses refresh token
2. Server finds and validates token
3. Marks old token as `revokedAt: now`
4. Creates new token in same `tokenFamily`
5. Returns new token
6. Old token rejected on next use

---

## 4. ✅ Logout Security (CRITICAL)

### Issue: Tokens Remain Valid for 30 Days After Logout
**Before:** Logout didn't invalidate access tokens; user could stay logged in if token wasn't explicitly revoked.
**After:**
- Created `TokenBlacklist` collection
- Token added to blacklist on logout
- Auth middleware checks blacklist before allowing request
- Automatic cleanup after token expiration (30 days)

**Files Created:**
- `models/TokenBlacklist.js`

**Files Modified:**
- `middleware/authMiddleware.js` - Added blacklist check

**Code:**
```javascript
const isBlacklisted = await TokenBlacklist.findOne({ token });
if (isBlacklisted) {
  return sendError(res, 401, 'Token has been revoked. Please login again');
}
```

---

## 5. ✅ Brute Force Protection (HIGH)

### Issue: No Protection Against Credential Brute Force
**Before:** Attackers could attempt unlimited login tries without restriction.
**After:**
- Created `LoginAttempt` collection
- Tracks failed attempts per email
- Locks account for 30 minutes after 5 failed attempts
- Auto-cleanup after 1 hour

**Files Created:**
- `models/LoginAttempt.js`

**Files Modified:**
- `controllers/authController.js` - `login()` method

**Security:**
- Even if email doesn't exist, failed attempt is recorded (prevents enumeration)
- Same error message for missing email/wrong password
- Account locked message reveals remaining lockout time

---

## 6. ✅ Webhook Idempotency (CRITICAL)

### Issue: Duplicate Webhook Events = Double-Charged Customers
**Before:** No idempotency; webhook delivered twice = payment processed twice.
**After:**
- Created `WebhookLog` collection with unique razorpayEventId
- Duplicate webhooks detected and skipped
- Signature verification prevents spoofed webhooks
- Auto-cleanup after 7 days

**Files Created:**
- `models/WebhookLog.js`

**Files Modified:**
- `controllers/paymentController.js` - `handleWebhook()` method

**Process:**
1. Webhook arrives with event ID
2. Check if already processed in WebhookLog
3. If exists: return 200 (already processed)
4. If new: verify signature, process, log event

---

## 7. ✅ Idempotency Keys (CRITICAL)

### Issue: Retry Requests Could Create Duplicate Bookings/Payments
**Before:** Client retry on network failure = duplicate booking.
**After:**
- Booking and Payment models include `idempotencyKey` field (unique, sparse)
- Client sends UUID in request body
- Server checks for existing record with same key
- Returns existing booking/payment if already created

**Files Modified:**
- `models/Booking.js` - Added idempotencyKey field
- `models/Payment.js` - Added idempotencyKey field
- `controllers/bookingController.js` - `createBooking()` checks idempotency
- `controllers/paymentController.js` - `createOrder()` checks idempotency

**Usage:**
```javascript
const idempotencyKey = uuidv4();
const response = await createBooking({
  serviceId, addressId, date, time,
  idempotencyKey  // Client sends UUID
});
```

---

## 8. ✅ Database Transactions (CRITICAL)

### Issue: Multi-Step Operations Not Atomic (Race Conditions)
**Before:** 
- Create booking → Clear cart → Create notification: If middle step fails, system in inconsistent state
- Multiple bookings in same slot due to concurrent requests

**After:**
- All critical operations wrapped in MongoDB transactions
- All-or-nothing guarantee: operation succeeds completely or rolls back entirely
- Prevents intermediate states

**Files Modified:**
- `controllers/authController.js` - signup, login, logout, resetPassword, deleteAccount
- `controllers/bookingController.js` - createBooking, cancelBooking
- `controllers/paymentController.js` - createOrder, verifyPayment, refundPayment

**Pattern:**
```javascript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // All DB operations with { session }
  await Model.create(data, { session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

## 9. ✅ Refund Logic (CRITICAL)

### Issue: Cancelling Booking Didn't Process Refund
**Before:** Cancellation status updated but payment never refunded.
**After:**
- Cancel booking → Automatically process refund via Razorpay
- Refund amount calculated based on cancellation time
- Refund status tracked: pending/processed/failed
- Allows retry if refund fails

**Files Modified:**
- `models/Booking.js` - Added refundAmount, refundDate, refundStatus fields
- `models/Payment.js` - Added refundStatus field
- `controllers/bookingController.js` - `cancelBooking()` processes refund
- `controllers/paymentController.js` - `refundPayment()` new method

**Logic:**
1. Booking cancelled with reason
2. Check if within 2-hour cancellation deadline
3. Find associated payment
4. Call Razorpay refund API
5. Update payment refund status
6. Notify user of refund

---

## 10. ✅ Email Enumeration Prevention (MEDIUM)

### Issue: Forgot Password Revealed Whether Email Exists
**Before:** Different response for existing/non-existing emails.
**After:**
- Same response for both: "If account exists, OTP will be sent"
- Prevents attackers from enumerating valid email addresses
- Silently sends OTP only for existing accounts

**Files Modified:**
- `controllers/authController.js` - `forgotPassword()` method

---

## 11. ✅ API Versioning (CRITICAL)

### Issue: No API Versioning
**Before:** Single endpoint structure; breaking changes would affect all clients.
**After:**
- All endpoints prefixed with `/api/v1/`
- Legacy routes `/api/` still work (backward compatibility)
- Webhooks at `/api/webhooks/` (no versioning for stability)
- Future versions can be `/api/v2/` with parallel support

**Files Modified:**
- `server.js` - Updated route registrations

**Example:**
```
Old:  POST /api/auth/login
New:  POST /api/v1/auth/login
Both: Still work (legacy)
```

---

## 12. ✅ Webhook Security (CRITICAL)

### Issue: Webhooks Lacked Signature Verification
**Before:** Any request to webhook endpoint could trigger payment updates.
**After:**
- Webhook signature verified using `x-razorpay-signature` header
- HMAC-SHA256 with `RAZORPAY_WEBHOOK_SECRET`
- Invalid signatures immediately rejected
- Prevents spoofed webhook attacks

**Files Modified:**
- `controllers/paymentController.js` - `handleWebhook()` method
- `routes/webhookRoutes.js` - Created

---

## 13. ✅ Enhanced JWT Security (HIGH)

### Issue: Weak JWT Secret Validation
**Before:** No validation of JWT secret strength.
**After:**
- Validate secret is minimum 32 characters on import
- Add issuer claim ('home-service-api') to all tokens
- Verify issuer in all token validations
- Prevents token confusion attacks

**Files Modified:**
- `utils/tokenUtils.js` - Enhanced validation

---

## 14. ✅ Data Anonymization (MEDIUM)

### Issue: Deleted Accounts Contained PII
**Before:** Soft delete didn't anonymize personal data.
**After:**
- Email replaced with `deleted_<userid>@deleted.local`
- Phone set to null
- Profile image removed
- Prevents recovery of PII

**Files Modified:**
- `controllers/authController.js` - `deleteAccount()` method

---

## Testing Critical Endpoints

### 1. Test Payment Signature Verification
```bash
# Valid payment
POST /api/v1/payments/verify
{
  "razorpayOrderId": "order_123",
  "razorpayPaymentId": "pay_456",
  "razorpaySignature": "<valid-hmac-sha256>"
}
# ✓ 200 OK

# Invalid signature
POST /api/v1/payments/verify
{
  "razorpayOrderId": "order_123",
  "razorpayPaymentId": "pay_456",
  "razorpaySignature": "invalid-signature"
}
# ✗ 400 Bad Request
```

### 2. Test Token Rotation
```bash
# Login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
# Returns: accessToken, refreshToken

# Refresh with old token
POST /api/v1/auth/refresh-access-token
{
  "refreshToken": "<old-refresh-token>"
}
# Returns: New accessToken, new refreshToken
# Old token is now revoked
```

### 3. Test Logout
```bash
# Logout with token
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
{
  "revokeAll": false
}
# ✓ 200 OK - Token blacklisted

# Try to use same token
GET /api/v1/auth/profile
Authorization: Bearer <accessToken>
# ✗ 401 Unauthorized - Token revoked
```

### 4. Test Brute Force Protection
```bash
# Attempt login 5 times with wrong password
POST /api/v1/auth/login  (5x with wrong password)
# 5th attempt locks account

# 6th attempt
POST /api/v1/auth/login
# ✗ 429 Too Many Requests - Account locked for 30 minutes
```

### 5. Test Booking Idempotency
```bash
# Create booking
POST /api/v1/bookings
{
  "serviceId": "...",
  "addressId": "...",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
# ✓ 201 - Booking created

# Retry same request
POST /api/v1/bookings
{
  "serviceId": "...",
  "addressId": "...",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
# ✓ 200 - Same booking returned (not duplicated)
```

### 6. Test Webhook Idempotency
```bash
# Webhook arrives twice with same event ID
POST /api/webhooks/razorpay
# (1st time) ✓ 200 - Processed
# (2nd time) ✓ 200 - Already processed (skipped)
```

---

## Environment Variables Required

```bash
# Razorpay
RAZORPAY_KEY_ID=<your-razorpay-key>
RAZORPAY_KEY_SECRET=<your-razorpay-secret>
RAZORPAY_WEBHOOK_SECRET=<your-webhook-secret>

# JWT
JWT_SECRET=<min-32-chars-random-string>
JWT_REFRESH_SECRET=<min-32-chars-random-string>

# Database
DATABASE_URL=<mongodb-atlas-connection-string>

# Server
PORT=5000
NODE_ENV=production
```

---

## Migration Path for Existing Users

1. **New logins** - Use RefreshToken collection automatically
2. **Existing tokens** - Still valid until 30-day expiration
3. **Next refresh** - Migrates to RefreshToken collection
4. **No breaking changes** - Transparent to clients

---

## Remaining TODOs (Next Phase)

1. **Joi/Yup Schema Validation** - Input validation on all endpoints
2. **Sentry Error Monitoring** - Track errors in production
3. **Morgan Request Logging** - Request/response logging
4. **Redis Caching** - Cache frequently accessed data
5. **Bull Job Queue** - Async job processing (refunds, notifications)
6. **Rate Limiting Enhancement** - Per-user rate limits
7. **Request ID Tracking** - UUID for distributed tracing

---

## Security Checklist

- ✅ Payment signature verification
- ✅ Token rotation with family concept
- ✅ Token blacklist on logout
- ✅ Brute force protection
- ✅ Idempotency keys (bookings, payments)
- ✅ Database transactions (atomic operations)
- ✅ Webhook signature verification
- ✅ Webhook idempotency
- ✅ Email enumeration prevention
- ✅ Data anonymization on deletion
- ✅ API versioning
- ✅ JWT secret validation
- ⏳ Input validation (Joi schemas)
- ⏳ Error monitoring (Sentry)
- ⏳ Request logging (Morgan)

---

## Production Deployment Checklist

Before deploying to production:

1. **Environment Variables**
   - [ ] Set strong JWT secrets (32+ chars)
   - [ ] Configure Razorpay keys correctly
   - [ ] Set NODE_ENV=production

2. **Database**
   - [ ] Verify indexes created (TTL, unique, composite)
   - [ ] Enable MongoDB transactions
   - [ ] Backup existing data

3. **Testing**
   - [ ] Run all security tests above
   - [ ] Load test concurrent bookings
   - [ ] Test webhook with multiple events

4. **Monitoring**
   - [ ] Set up error tracking (Sentry)
   - [ ] Configure alerts for payment failures
   - [ ] Monitor webhook processing

5. **Documentation**
   - [ ] Update API documentation for /api/v1/
   - [ ] Publish migration guide for clients
   - [ ] Document webhook signature verification

---

**Last Updated:** January 2025
**Status:** CRITICAL FIXES COMPLETE - Ready for testing phase
**Rating Improvement:** 6.5/10 → ~8.5/10 expected (pending validation tests)
