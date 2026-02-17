# 🔍 Production Readiness Review: Home Service Platform API

**Reviewer:** Senior Backend Architect (10+ years)  
**Date:** February 17, 2026  
**Verdict:** ⚠️ **NOT PRODUCTION READY** - Critical and high-severity issues present

---

## Executive Summary

Your implementation demonstrates solid fundamentals with good architectural decisions. However, there are **14 critical/high-severity issues** that **MUST** be fixed before handling real money and real customers. This is a **6.5/10** implementation with significant gaps in production-level concerns.

**Key Gaps:**
- ❌ No database transactions (race condition vulnerabilities)
- ❌ Incomplete payment security (no Razorpay signature verification)
- ❌ Missing audit logging and monitoring
- ❌ No API versioning strategy
- ❌ Insufficient input validation (NoSQL injection risks)
- ❌ No request/response schema validation
- ❌ Missing queue system for async operations
- ❌ No idempotency keys for critical operations

---

## Section 1: API Design & REST Compliance

### ✅ What's Good
- Clear REST conventions (POST create, GET read, PUT update, DELETE delete)
- Proper HTTP status codes (201 for creation, 400 for validation, 401 for auth)
- Resource-oriented endpoints (`/api/bookings`, `/api/payments`)
- Pagination implemented with `page` and `limit` query parameters

### ❌ Critical Issues

#### 1.1 **No API Versioning** ⚠️ CRITICAL
```javascript
// Current (WRONG)
app.use('/api/auth', require('./routes/authRoutes'));

// Required for production
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v2/auth', require('./routes/authRoutesV2')); // future changes
```

**Why:** Once you have paying customers, you can't break their integrations. Versioning allows backward compatibility.

**Fix:** Implement at least v1 versioning immediately. This is non-negotiable for any production API.

#### 1.2 **Inconsistent Response Format** ⚠️ HIGH
```javascript
// sendPaginatedResponse has different structure
{
  "success": true,
  "message": "Bookings retrieved",
  "data": [...],
  "pagination": { "total": 50, "page": 1, "pages": 5 },
  "timestamp": "..."
}

// But sendResponse sometimes returns arrays directly
// Inconsistency: Different consumers expect different shapes
```

**Impact:** Clients can't write uniform parsers. Third-party integrations break.

**Fix:**
```javascript
// Standardize ALL responses
{
  "status": "success",           // or "error"
  "code": "BOOKING_CREATED",    // machine-readable
  "message": "...",
  "data": { /* actual data */ },
  "meta": {                      // metadata wrapper
    "pagination": { "total": 50, "page": 1, "pages": 5 },
    "timestamp": "2026-02-17T...",
    "requestId": "req_123..."   // for debugging
  }
}
```

#### 1.3 **Missing Request/Response Validation** ⚠️ CRITICAL
```javascript
// No schema validation library (Joi, Zod, or OpenAPI)
// You manually validate in middleware - VERY ERROR PRONE

// Example: What prevents this?
{
  "name": "<img src=x onerror='alert(1)'>",
  "email": "test@test.com",
  "phone": "9999999999",
  "password": "Pass123"
}

// Your validators ONLY check format, not content
```

**Fix:** Integrate **Joi** or **Zod**:

```javascript
// Install
npm install joi

// Use in all endpoints
const joiSchema = Joi.object({
  name: Joi.string().alphanum().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().length(10).pattern(/^[0-9]+$/).required(),
  password: Joi.string().min(8).max(50)
    .pattern(/[A-Z]/)  // at least 1 uppercase
    .pattern(/[0-9]/)  // at least 1 number
    .required()
});

const { value, error } = joiSchema.validate(req.body);
if (error) return sendError(res, 400, error.details[0].message);
```

#### 1.4 **No Endpoint Deprecation Strategy** ⚠️ MEDIUM
Once endpoints are live, how do you deprecate them?

**Add Deprecation Headers:**
```javascript
app.get('/api/v1/bookings/:id', (req, res, next) => {
  // Old endpoint
  res.set('Deprecation', 'true');
  res.set('Sunset', new Date(Date.now() + 90*24*60*60*1000).toUTCString());
  res.set('Link', '</api/v2/bookings/{id}>; rel="successor-version"');
  // ... rest of logic
});
```

---

## Section 2: Authentication & JWT Security

### ✅ What's Good
- JWT tokens with expiry (30 days for access)
- Refresh token rotation pattern
- Password hashing with bcryptjs (10 salt rounds ✅)
- Bearer token in Authorization header

### ❌ Critical Issues

#### 2.1 **Token Stored in Database Array - SCALABILITY KILLER** ⚠️ HIGH
```javascript
refreshTokens: [
  { token: String, createdAt: Date },
  { token: String, createdAt: Date },
  // ... accumulates indefinitely
]
```

**Problem:** After 1000 logins, this array has 1000 entries. Every user query becomes slower.

**Real-world impact at scale:**
- 100,000 users × 50 tokens each = 5M token records in memory
- User update query becomes O(n) instead of O(1)
- Memory bloat in MongoDB

**Fix:** Move to separate collection:

```javascript
// New model: RefreshToken.js
const refreshTokenSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  tokenFamily: { type: String }, // for rotation tracking
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

// TTL index - auto-delete expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Update login:
const refreshToken = generateRefreshToken(user._id);
await RefreshToken.create({
  userId: user._id,
  token: refreshToken,
  tokenFamily: uuidv4(),
  expiresAt: new Date(Date.now() + 90*24*60*60*1000)
});
```

#### 2.2 **Token Rotation Missing** ⚠️ CRITICAL - SECURITY RISK
Your current flow:
```javascript
// Login gives token
// Refresh gives new access token
// But same refresh token stays valid forever
```

**Attack scenario:**
1. Attacker steals refresh token
2. They can generate infinite access tokens
3. You have no way to revoke the refresh token family

**Industry standard:** Token Family-based Rotation

```javascript
exports.refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return sendError(res, 401, 'Refresh token required');
    }

    // Verify and get token family
    const tokenDoc = await RefreshToken.findOne({
      token: refreshToken,
      revokedAt: null  // not revoked
    });

    if (!tokenDoc || new Date() > tokenDoc.expiresAt) {
      // Token expired or doesn't exist
      // Possible theft - revoke entire family
      await RefreshToken.updateMany(
        { tokenFamily: tokenDoc?.tokenFamily },
        { revokedAt: new Date() }
      );
      return sendError(res, 401, 'Invalid refresh token');
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // Create new token with same family
    const newAccessToken = generateAccessToken(decoded.id);
    const newRefreshToken = generateRefreshToken(decoded.id);
    
    // Revoke old refresh token
    await RefreshToken.findByIdAndUpdate(
      tokenDoc._id,
      { revokedAt: new Date() }
    );

    // Create new refresh token in same family
    await RefreshToken.create({
      userId: decoded.id,
      token: newRefreshToken,
      tokenFamily: tokenDoc.tokenFamily,  // same family
      expiresAt: new Date(Date.now() + 90*24*60*60*1000)
    });

    return sendResponse(res, 200, true, 'Token refreshed', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    next(error);
  }
};
```

#### 2.3 **JWT_SECRET Too Short** ⚠️ HIGH
```javascript
// .env
JWT_SECRET=your-secret-key      // ❌ WEAK! Maybe 16 chars
```

**JWT requirement:** Minimum 256 bits (32 bytes) for HS256

**Fix:**
```bash
# Generate strong secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Output: a1b2c3d4e5f6...64chars...

# .env
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8
REFRESH_TOKEN_SECRET=z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k3j2i1h0g9f8e7d6c5b4a3z2y1x0w
```

#### 2.4 **No Logout Functionality** ⚠️ MEDIUM
Your logout endpoint doesn't work:

```javascript
exports.logout = async (req, res, next) => {
  try {
    // You probably try to clear tokens from array
    // But client-side still has the token!
  }
};

// User can still use old access token
// Access tokens are valid for 30 days!
```

**Fix - Blacklist Tokens:**
```javascript
// New collection
const tokenBlacklistSchema = new mongoose.Schema({
  userId: ObjectId,
  token: String,           // Full JWT token
  expiresAt: Date,        // Use same exp from JWT
  blacklistedAt: { type: Date, default: Date.now }
});

tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// In auth middleware
exports.protect = async (req, res, next) => {
  const token = req.headers.authorization.split(' ')[1];
  
  const blacklisted = await TokenBlacklist.findOne({ token });
  if (blacklisted) {
    return sendError(res, 401, 'Token has been revoked');
  }
  
  next();
};

// Logout
exports.logout = async (req, res, next) => {
  const token = req.headers.authorization.split(' ')[1];
  const decoded = jwt.decode(token);
  
  await TokenBlacklist.create({
    userId: req.user.id,
    token,
    expiresAt: new Date(decoded.exp * 1000)
  });
  
  return sendResponse(res, 200, true, 'Logged out successfully');
};
```

#### 2.5 **No OTP Rate Limiting** ⚠️ HIGH
```javascript
// Anyone can spam OTP endpoint
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  // No check for how many OTPs sent in last hour
};

// Attack: Send 1000 OTPs in 1 second = SMS spam
```

**Fix:**
```javascript
// New schema
const otpAttemptSchema = new mongoose.Schema({
  email: String,
  attempts: { type: Number, default: 1 },
  lastAttemptAt: Date,
  resetAt: { type: Date, expires: 3600 }  // 1 hour TTL
});

// Middleware
const checkOTPRateLimit = async (req, res, next) => {
  const { email } = req.body;
  
  const attempt = await OTPAttempt.findOne({ email });
  
  if (attempt && attempt.attempts > 3) {
    const minutesLeft = Math.ceil((attempt.resetAt - Date.now()) / 60000);
    return sendError(res, 429, 
      `Too many OTP attempts. Try again in ${minutesLeft} minutes`);
  }
  
  next();
};
```

#### 2.6 **Password Reset Allows Weak Passwords** ⚠️ MEDIUM
```javascript
// In forgotPassword flow:
const validateResetPassword = (req, res, next) => {
  const { password, confirmPassword } = req.body;

  if (!isValidPassword(password)) {
    // But isValidPassword only checks format
    // What if someone uses "Pass1234" (sequential)?
  }
};
```

**Add password strength checks:**
```javascript
// Install
npm install zxcvbn

const zxcvbn = require('zxcvbn');

const validatePasswordStrength = (password) => {
  const result = zxcvbn(password);
  // Returns score 0-4 (0=very weak, 4=very strong)
  
  if (result.score < 3) {
    return { valid: false, reason: result.feedback.warning };
  }
  
  return { valid: true };
};

// Use in reset password
exports.resetPassword = async (req, res, next) => {
  const { password } = req.body;
  
  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return sendError(res, 400, `Weak password: ${strength.reason}`);
  }
  
  // Continue...
};
```

---

## Section 3: Role-Based Authorization (RBAC)

### ✅ What's Good
- Three roles defined: customer, worker, admin
- Authorization middleware exists
- Endpoints properly protected with auth middleware

### ❌ Critical Issues

#### 3.1 **Authorization Middleware Not Applied Consistently** ⚠️ HIGH
```javascript
// bookingRoutes.js
router.use(authMiddleware);  // Good - protects all routes

router.post('/', validateBooking, bookingController.createBooking);
router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);
router.put('/:id/cancel', bookingController.cancelBooking);
router.put('/:id/reschedule', bookingController.rescheduleBooking);

// But ONLY this route checks admin role:
router.put('/:id/status', authorizeAdmin, bookingController.updateBookingStatus);

// Problem: What if a worker tries to reschedule other users' bookings?
// Your controller DOES check req.user.id, but it's fragile
```

**Fix - Explicit Middleware:**
```javascript
// middleware/rbac.js
const require = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, 
        `Only ${roles.join(', ')} can access this`);
    }
    next();
  };
};

module.exports = { requireRole };

// Usage
const { requireRole } = require('../middleware/rbac');

router.put('/:id/status', 
  requireRole(['admin']), 
  bookingController.updateBookingStatus);

router.put('/:id/reschedule',
  requireRole(['customer']),
  bookingController.rescheduleBooking);
```

#### 3.2 **No Row-Level Security (RLS)** ⚠️ CRITICAL
```javascript
exports.getBookingById = async (req, res, next) => {
  const booking = await Booking.findOne({
    _id: req.params.id,
    userId: req.user.id,  // ← Only this line protects
    isDeleted: false,
  });
};

// What if developer forgets req.user.id check?
// A worker could see any user's booking details
```

**This is an easy bug.** Use middleware to enforce it:

```javascript
// Middleware: ownershipCheck
const checkBookingOwnership = async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  
  if (!booking) {
    return sendError(res, 404, 'Booking not found');
  }
  
  if (booking.userId.toString() !== req.user.id) {
    return sendError(res, 403, 'Not authorized to access this booking');
  }
  
  req.booking = booking;  // Attach to request
  next();
};

// Routes
router.get('/:id', checkBookingOwnership, bookingController.getBookingById);
router.put('/:id/cancel', checkBookingOwnership, bookingController.cancelBooking);
```

#### 3.3 **Worker Role Has No Permissions Defined** ⚠️ HIGH
```javascript
const ROLES = {
  CUSTOMER: 'customer',
  WORKER: 'worker',
  ADMIN: 'admin',
};

// But where can a WORKER access?
// - Can they view assigned bookings?
// - Can they update booking status?
// - Can they view payment history?

// There's no explicit mapping!
```

**Define RBAC Matrix:**
```javascript
// config/rbac.js
const RBAC_PERMISSIONS = {
  'customer': {
    bookings: ['create', 'list', 'view', 'cancel', 'reschedule'],
    cart: ['create', 'update', 'delete', 'clear'],
    addresses: ['create', 'list', 'update', 'delete'],
    ratings: ['create', 'list', 'update'],
    payments: ['list', 'view'],
  },
  'worker': {
    bookings: ['list', 'view', 'update_status'],  // assigned to them
    payments: ['list'],  // their earnings
    ratings: ['list'],   // their reviews
  },
  'admin': {
    bookings: ['list', 'view', 'update_status', 'cancel'],
    services: ['create', 'update', 'delete'],
    users: ['list', 'view', 'block', 'unblock'],
    payments: ['list', 'view'],
    disputes: ['list', 'resolve'],
  }
};

// Test endpoint
router.get('/:id', 
  checkPermission('bookings', 'view'),
  bookingController.getBookingById);
```

---

## Section 4: MongoDB Schema Design & Indexing

### ✅ What's Good
- Proper use of ObjectId references
- TTL index on OTP collection (auto-cleanup)
- Compound indexes where needed (userId + isDeleted)
- Text indexes on service catalog

### ❌ Critical Issues

#### 4.1 **No Database Transactions - RACE CONDITIONS GALORE** ⚠️ CRITICAL

**Scenario 1: Double Booking**
```javascript
// Booking Controller
exports.createBooking = async (req, res, next) => {
  const { serviceId, addressId, date, time } = req.body;

  // ⚠️ RACE CONDITION WINDOW
  // Check if slot available (not shown, but assume you do)
  const existingBooking = await Booking.findOne({
    serviceId, date, time
  });
  
  if (existingBooking) {
    return sendError(res, 400, 'Slot already booked');  // ← LINE A
  }

  // ← RACE CONDITION WINDOW - Another request can come here!
  // Two concurrent requests both think slot is free

  const booking = new Booking({  // ← LINE B
    userId: req.user.id,
    serviceId,
    addressId,
    date: new Date(date),
    time,
    totalAmount: finalPrice,
  });

  await booking.save();  // ← Both save successfully = DOUBLE BOOKING!
};
```

**Timeline of disaster:**
```
Time  Request 1                      Request 2
1ms   ✓ Check slot (free)
2ms                                  ✓ Check slot (free)
3ms   ✓ Save booking                 
4ms                                  ✓ Save booking
5ms   ✓ Created booking              ✓ Created booking (DUPLICATE!)
```

**Fix - Use Transactions:**
```javascript
exports.createBooking = async (req, res, next) => {
  const { serviceId, addressId, date, time, notes } = req.body;
  
  // Start transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const service = await Service.findById(serviceId).session(session);
    if (!service) throw new Error('Service not found');

    const address = await Address.findOne({
      _id: addressId,
      userId: req.user.id,
      isDeleted: false,
    }).session(session);
    if (!address) throw new Error('Address not found');

    // Create with UNIQUE + SPARSE index prevents doubles
    const existingBooking = await Booking.findOne({
      serviceId,
      date: new Date(date),
      time,
      status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.ASSIGNED] }
    }).session(session);
    
    if (existingBooking) {
      throw new Error('Slot already booked');
    }

    // Calculate price
    const discountAmount = (service.price * service.discount) / 100;
    const finalPrice = service.price - discountAmount;

    // Create booking atomically
    const booking = new Booking({
      userId: req.user.id,
      serviceId,
      addressId,
      date: new Date(date),
      time,
      totalAmount: finalPrice,
      notes,
    });

    await booking.save({ session });

    // Clear cart in same transaction
    await Cart.findOneAndDelete({ userId: req.user.id }, { session });

    // Create notification
    const notification = new Notification({
      userId: req.user.id,
      title: 'Booking Confirmed',
      message: `Your booking for ${service.name} is confirmed`,
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      relatedId: booking._id,
    });

    await notification.save({ session });

    // Commit transaction
    await session.commitTransaction();

    await booking.populate(['serviceId', 'addressId']);
    return sendResponse(res, 201, true, 'Booking created', booking);

  } catch (error) {
    // Rollback on error
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
```

**Also add unique index:**
```javascript
// models/Booking.js
bookingSchema.index(
  { serviceId: 1, date: 1, time: 1, isDeleted: 1 },
  { 
    unique: true,
    sparse: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] }
    }
  }
);
```

**Scenario 2: Cart-to-Booking Inconsistency**
```javascript
// currentFlow:
1. Add items to cart
2. Create booking from cart items
3. Clear cart

// Problem: If step 2 fails between booking creation and cart clear
// Cart items remain, user sees them, creates double booking
```

**Use transaction above fixes this.**

**Scenario 3: Payment Race Condition**
```javascript
// If payment succeeds twice = double charge

exports.verifyPayment = async (req, res, next) => {
  const { razorpayOrderId, razorpayPaymentId } = req.body;

  // Two concurrent requests with same paymentId?
  // Both could mark as SUCCESS

  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId },
    { status: PAYMENT_STATUS.SUCCESS }
  );
};

// Fix: Use upsert with unique index
Payment.collection.createIndex({ 
  razorpayPaymentId: 1 
}, { unique: true });

// Then use transaction to mark complete
```

#### 4.2 **Missing Composite Indexes** ⚠️ HIGH
```javascript
// You have:
bookingSchema.index({ userId: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ date: 1 });

// But most queries use multiple fields
// Example from controller:
const bookings = await Booking.find({
  userId: req.user.id,      // ← Field 1
  isDeleted: false,          // ← Field 2  
  status: status             // ← Field 3
}).sort({ createdAt: -1 });

// This needs composite index!
```

**Fix:**
```javascript
// models/Booking.js - Add these
bookingSchema.index({ userId: 1, isDeleted: 1, status: 1 });
bookingSchema.index({ userId: 1, createdAt: -1 });  // for sort
bookingSchema.index({ workerId: 1, status: 1 });    // for worker assignment
bookingSchema.index({ date: 1, serviceId: 1, isDeleted: 1 }); // for slot check
```

**Update all models:**
```javascript
// User.js
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ isActive: 1, isDeleted: 1 });

// Cart.js
cartSchema.index({ userId: 1, updatedAt: -1 });

// Notification.js
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });

// Payment.js
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ bookingId: 1, status: 1 });

// Address.js
addressSchema.index({ userId: 1, isDeleted: 1, isDefault: 1 });
```

#### 4.3 **RefreshToken Array Will KILL Performance** ⚠️ CRITICAL
Already covered in Section 2 - this is the #1 scalability issue.

#### 4.4 **No Sharding Strategy** ⚠️ MEDIUM
At scale, your bookings collection will grow to 100M+ documents. MongoDB can handle it, but requires sharding strategy.

```javascript
// For future sharding, shard by userId
db.bookings.createIndex({ userId: 1 })

// This is your shard key - decide now
```

#### 4.5 **Soft Deletes Not Indexed** ⚠️ HIGH
```javascript
// Every query does this:
Booking.find({
  userId: req.user.id,
  isDeleted: false  // ← Filters on EVERY query
})

// Without index on isDeleted, Mongo does full table scan
```

**Already partially fixed but verify:**
```javascript
// Should have:
bookingSchema.index({ isDeleted: 1 });
bookingSchema.index({ userId: 1, isDeleted: 1 });
```

---

## Section 5: Booking Flow & Edge Cases

### ✅ What's Good
- Clear status flow (pending → assigned → in_progress → completed)
- Cancellation tracking with reason
- Reschedule history stored

### ❌ Critical Issues

#### 5.1 **No Idempotency Keys** ⚠️ CRITICAL
```javascript
// Client's network cuts out during booking creation
// They retry the request
// You create the booking twice

exports.createBooking = async (req, res, next) => {
  // No idempotency check
  const booking = new Booking({ ... });
  await booking.save();
};

// Timeline:
// Request 1: Network fails after save
// Client retries
// Request 2: Booking created again = DUPLICATE
```

**Fix - Idempotency Keys:**
```javascript
// Add to booking request
exports.createBooking = async (req, res, next) => {
  const { serviceId, addressId, date, time, notes, idempotencyKey } = req.body;

  if (!idempotencyKey) {
    return sendError(res, 400, 'idempotencyKey is required');
  }

  // Check if already processed
  const existingBooking = await Booking.findOne({
    idempotencyKey,
    userId: req.user.id
  });

  if (existingBooking) {
    return sendResponse(res, 200, true, 'Booking already created', existingBooking);
  }

  // Create with idempotency key
  const booking = new Booking({
    userId: req.user.id,
    serviceId,
    addressId,
    date: new Date(date),
    time,
    totalAmount: finalPrice,
    notes,
    idempotencyKey  // Store it!
  });

  await booking.save();
  return sendResponse(res, 201, true, 'Booking created', booking);
};

// Schema update
bookingSchema.add({
  idempotencyKey: { type: String, sparse: true },
  createdAt: { type: Date, default: Date.now }
});

bookingSchema.index({ idempotencyKey: 1, userId: 1 }, { sparse: true });
```

#### 5.2 **Cancellation Without Refund Logic** ⚠️ CRITICAL
```javascript
exports.cancelBooking = async (req, res, next) => {
  const { cancellationReason } = req.body;

  const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.id });

  if (!booking) {
    return sendError(res, 404, 'Booking not found');
  }

  // Check if booking can be cancelled
  const bookingDate = new Date(booking.date);
  if (bookingDate < new Date()) {
    return sendError(res, 400, 'Cannot cancel past bookings');
  }

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancellationReason = cancellationReason || 'Cancelled by customer';
  booking.cancellationDate = new Date();

  // ❌ No refund logic!
  // If payment was made, where's the refund?
};
```

**MAJOR ISSUE:** You'll get chargeback disputes.

**Fix:**
```javascript
exports.cancelBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false
    }).session(session);

    if (!booking) throw new Error('Booking not found');

    const bookingDate = new Date(booking.date);
    const hoursUntilBooking = (bookingDate - new Date()) / (1000 * 60 * 60);

    // Cancellation policy
    let refundPercentage = 0;
    if (hoursUntilBooking > 24) {
      refundPercentage = 100;  // Full refund if > 24 hours
    } else if (hoursUntilBooking > 2) {
      refundPercentage = 50;   // 50% if > 2 hours
    } else {
      refundPercentage = 0;    // No refund if < 2 hours
    }

    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancellationReason = req.body.cancellationReason || 'Cancelled by customer';
    booking.cancellationDate = new Date();

    // Find associated payment
    const payment = await Payment.findOne({
      bookingId: booking._id,
      status: PAYMENT_STATUS.SUCCESS
    }).session(session);

    if (payment) {
      const refundAmount = (payment.amount * refundPercentage) / 100;

      if (refundAmount > 0) {
        // TODO: Call Razorpay refund API
        // const refund = await razorpay.payments.refund(
        //   payment.razorpayPaymentId,
        //   { amount: Math.round(refundAmount * 100) }
        // );

        // Update payment
        await Payment.findByIdAndUpdate(
          payment._id,
          {
            status: PAYMENT_STATUS.REFUNDED,
            refundAmount,
            refundDate: new Date()
          },
          { session }
        );
      }

      // Create refund notification
      await Notification.create([{
        userId: req.user.id,
        title: 'Refund Processed',
        message: `₹${refundAmount} has been refunded to your account`,
        type: NOTIFICATION_TYPES.CANCELLATION,
        relatedId: booking._id
      }], { session });
    }

    await booking.save({ session });
    await session.commitTransaction();

    return sendResponse(res, 200, true, 'Booking cancelled', booking);

  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
```

Add to Booking model:
```javascript
bookingSchema.add({
  refundAmount: { type: Number, default: 0 },
  refundDate: { type: Date, default: null }
});
```

#### 5.3 **No Dispute/Conflict Resolution** ⚠️ MEDIUM
```javascript
// Customer: "I was never served"
// Worker: "They refused to let me in"
// You: "🤷‍♂️"
```

**Add dispute tracking:**
```javascript
// New model: Dispute.js
const disputeSchema = new mongoose.Schema({
  bookingId: { type: ObjectId, ref: 'Booking', required: true },
  filedBy: { type: ObjectId, ref: 'User', required: true },  // customer or worker
  reason: String,  // e.g., "service_not_provided", "worker_no_show", "poor_quality"
  description: String,
  evidence: [String],  // URLs to images/videos
  status: { 
    type: String, 
    enum: ['open', 'in_review', 'resolved', 'escalated'],
    default: 'open'
  },
  resolution: {
    type: String,  // e.g., "full_refund", "partial_refund", "no_action"
    default: null
  },
  createdAt: { type: Date, default: Date.now }
});

// Routes
router.post('/disputes', authMiddleware, async (req, res) => {
  const { bookingId, reason, description, evidence } = req.body;
  
  const dispute = new Dispute({
    bookingId,
    filedBy: req.user.id,
    reason,
    description,
    evidence
  });
  
  await dispute.save();
  
  // Notify admin
  await Notification.create({
    userId: ADMIN_ID,
    title: 'New Dispute Filed',
    message: `Dispute for booking ${bookingId} requires review`,
    type: 'dispute_filed',
    relatedId: dispute._id
  });
  
  return sendResponse(res, 201, true, 'Dispute filed', dispute);
});
```

#### 5.4 **Reschedule with Availability Check Missing** ⚠️ HIGH
```javascript
exports.rescheduleBooking = async (req, res, next) => {
  const { newDate, newTime } = req.body;

  const booking = await Booking.findOne({
    _id: req.params.id,
    userId: req.user.id,
    isDeleted: false,
  });

  if (!booking) {
    return sendError(res, 404, 'Booking not found');
  }

  // ❌ No check if new slot is available!
  // Could reschedule to occupied slot
  
  booking.rescheduleHistory.push({
    previousDate: booking.date,
    previousTime: booking.time,
    newDate: new Date(newDate),
    newTime,
    reason: req.body.reason,
    rescheduleDate: new Date(),
  });

  booking.date = new Date(newDate);
  booking.time = newTime;

  await booking.save();
};
```

**Fix:**
```javascript
exports.rescheduleBooking = async (req, res, next) => {
  const { newDate, newTime, reason } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    }).session(session);

    if (!booking) throw new Error('Booking not found');

    // Check can only reschedule future bookings
    if (new Date(booking.date) < new Date()) {
      throw new Error('Cannot reschedule past bookings');
    }

    // Check new date is future
    if (new Date(newDate) < new Date()) {
      throw new Error('New date must be in future');
    }

    // ✅ Check new slot is available
    const conflictingBooking = await Booking.findOne({
      serviceId: booking.serviceId,
      date: new Date(newDate),
      time: newTime,
      status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.ASSIGNED] },
      _id: { $ne: booking._id }
    }).session(session);

    if (conflictingBooking) {
      throw new Error('Slot not available at selected time');
    }

    // Record reschedule
    booking.rescheduleHistory.push({
      previousDate: booking.date,
      previousTime: booking.time,
      newDate: new Date(newDate),
      newTime,
      reason,
      rescheduleDate: new Date(),
    });

    booking.date = new Date(newDate);
    booking.time = newTime;

    await booking.save({ session });

    // Notify worker if assigned
    if (booking.workerId) {
      await Notification.create([{
        userId: booking.workerId,
        title: 'Booking Rescheduled',
        message: `Booking rescheduled to ${newDate} ${newTime}`,
        type: NOTIFICATION_TYPES.RESCHEDULED,
        relatedId: booking._id
      }], { session });
    }

    await session.commitTransaction();
    return sendResponse(res, 200, true, 'Booking rescheduled', booking);

  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
```

#### 5.5 **Worker Assignment is Placeholder** ⚠️ MEDIUM
```javascript
bookingSchema.add({
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,  // ← Just null!
  },
});

// No actual assignment logic
```

**Implement proper assignment:**
```javascript
// After booking creation, in queue job:
async function assignWorkerToBooking(bookingId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await Booking.findById(bookingId).session(session);
    
    // Find available workers
    const availableWorkers = await User.find({
      role: ROLES.WORKER,
      isActive: true,
      isDeleted: false,
      // Skills match (if Worker has skillSet)
      skillSet: booking.serviceId  // Must support this service
    }).session(session);

    if (availableWorkers.length === 0) {
      await Notification.create([{
        userId: booking.userId,
        title: 'Booking Pending',
        message: 'No workers available for this service. We\'ll notify when one is found.',
        type: 'booking_pending_worker',
        relatedId: booking._id
      }], { session });
      
      await session.commitTransaction();
      return;
    }

    // Simple assignment: pick with least current bookings
    const workerWorkloadMap = await Promise.all(
      availableWorkers.map(async (worker) => {
        const count = await Booking.countDocuments({
          workerId: worker._id,
          status: { $in: [BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.IN_PROGRESS] }
        }).session(session);
        return { worker, currentBookings: count };
      })
    );

    const bestWorker = workerWorkloadMap.reduce((prev, curr) =>
      prev.currentBookings < curr.currentBookings ? prev : curr
    ).worker;

    // Assign
    booking.workerId = bestWorker._id;
    booking.status = BOOKING_STATUS.ASSIGNED;

    await booking.save({ session });

    // Notify worker
    await Notification.create([{
      userId: bestWorker._id,
      title: 'New Booking Assigned',
      message: `New ${booking.serviceId.name} booking on ${booking.date}`,
      type: NOTIFICATION_TYPES.WORKER_ASSIGNED,
      relatedId: booking._id
    }], { session });

    // Notify customer
    await Notification.create([{
      userId: booking.userId,
      title: 'Worker Assigned',
      message: `${bestWorker.name} has been assigned to your booking`,
      type: NOTIFICATION_TYPES.WORKER_ASSIGNED,
      relatedId: booking._id
    }], { session });

    await session.commitTransaction();

  } catch (error) {
    await session.abortTransaction();
    console.error('Worker assignment failed:', error);
  } finally {
    session.endSession();
  }
}
```

---

## Section 6: Cart-to-Booking Logic

### ✅ What's Good
- Cart items store price snapshots
- Total price calculated
- Cart clears after booking

### ❌ Critical Issues

#### 6.1 **Race Condition in Cart → Booking** ⚠️ CRITICAL
Already covered in Section 5.1 with transaction example.

#### 6.2 **Price Changed Between Add to Cart and Booking** ⚠️ MEDIUM
```javascript
// Scenario:
// 1. User adds "Cleaning Service" ₹500 to cart
// 2. Admin changes price to ₹1500
// 3. User completes booking at ₹500

// You store priceSnapshot, so this is handled...
// But is it?

const cartItem = {
  serviceId: "...",
  priceSnapshot: {
    price: 500,
    discount: 10,
    finalPrice: 450
  }
};

// ✅ Good - you use snapshot in booking
```

**But verify booking uses cart snapshot, not current price:**
```javascript
// In bookingController:
// ❌ WRONG - uses current service price
const finalPrice = service.price - (service.price * service.discount) / 100;

// ✅ RIGHT - uses cart snapshot
const cartItem = cart.items.find(item => item.serviceId.equals(serviceId));
const finalPrice = cartItem.priceSnapshot.finalPrice;
```

---

## Section 7: Payment Integration Security

### ✅ What's Good
- Payment model tracks status
- Refund amount field exists
- Payment history endpoint

### ❌ Critical Issues - HIGHEST PRIORITY

#### 7.1 **Razorpay Signature Verification is TODO** ⚠️ CRITICAL - SECURITY RISK
```javascript
exports.verifyPayment = async (req, res, next) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

  // TODO: Verify Razorpay signature
  // const crypto = require('crypto');
  // ... commented out!

  // This means ANYONE can claim payment succeeded!
  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId },
    {
      status: PAYMENT_STATUS.SUCCESS,  // ← Marked success WITHOUT verification!
      razorpayPaymentId,
      razorpaySignature,
    },
    { new: true }
  );
};
```

**ANYONE CAN HACK THIS:**
```javascript
// Attacker's request:
{
  "razorpayOrderId": "order_xxx",
  "razorpayPaymentId": "fake_payment",
  "razorpaySignature": "anything",
  "bookingId": "booking_xxx"
}
// ✓ Payment marked as SUCCESS
// ✓ Free booking!
```

**IMPLEMENT IMMEDIATELY:**
```javascript
const crypto = require('crypto');

exports.verifyPayment = async (req, res, next) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

  // ✅ VERIFY SIGNATURE
  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
  const message = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = hmac.update(message).digest('hex');

  if (expectedSignature !== razorpaySignature) {
    return sendError(res, 400, 'Payment verification failed - invalid signature');
  }

  // Verify with Razorpay API also
  const razorpayClient = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

  try {
    const payment = await razorpayClient.payments.fetch(razorpayPaymentId);
    
    if (payment.status !== 'captured') {
      return sendError(res, 400, 'Payment not captured by Razorpay');
    }

    // Update payment
    const paymentDoc = await Payment.findOneAndUpdate(
      { razorpayOrderId },
      {
        status: PAYMENT_STATUS.SUCCESS,
        razorpayPaymentId,
        razorpaySignature,
      },
      { new: true }
    );

    // Update booking
    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { paymentStatus: PAYMENT_STATUS.SUCCESS },
      { new: true }
    );

    return sendResponse(res, 200, true, 'Payment verified', paymentDoc);
  } catch (error) {
    return sendError(res, 400, 'Razorpay verification failed');
  }
};
```

#### 7.2 **No Webhook Security** ⚠️ CRITICAL
```javascript
// You probably don't have webhook endpoint at all
// Razorpay needs to notify you of payment events
```

**Implement Webhook:**
```javascript
// routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

router.post('/razorpay', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body = JSON.stringify(req.body);

  // Verify signature
  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
  const expectedSignature = hmac.update(body).digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { event, payload } = req.body;

  if (event === 'payment.captured') {
    // Payment successful
    const { id: paymentId } = payload.payment;
    
    await Payment.findOneAndUpdate(
      { razorpayPaymentId: paymentId },
      { status: PAYMENT_STATUS.SUCCESS }
    );
  }

  if (event === 'payment.failed') {
    const { id: paymentId } = payload.payment;
    
    await Payment.findOneAndUpdate(
      { razorpayPaymentId: paymentId },
      { status: PAYMENT_STATUS.FAILED }
    );
  }

  res.json({ received: true });
});

module.exports = router;

// server.js
app.use('/api/webhooks', require('./routes/webhookRoutes'));
```

#### 7.3 **No Idempotency on Payment** ⚠️ CRITICAL
```javascript
// If webhook is delivered twice, payment is processed twice
// = double charge!
```

**Add webhook idempotency:**
```javascript
// Track webhook deliveries
const webhookLogSchema = new mongoose.Schema({
  razorpayEventId: { type: String, unique: true },
  eventType: String,
  payload: Object,
  processedAt: { type: Date, default: Date.now }
});

// In webhook endpoint
router.post('/razorpay', async (req, res) => {
  const { id: eventId, event, payload } = req.body;

  // Check if already processed
  const existing = await WebhookLog.findOne({ razorpayEventId: eventId });
  if (existing) {
    return res.json({ received: true });  // Idempotent
  }

  // Process webhook
  try {
    if (event === 'payment.captured') {
      const { id: paymentId } = payload.payment;
      
      await Payment.findOneAndUpdate(
        { razorpayPaymentId: paymentId },
        { status: PAYMENT_STATUS.SUCCESS }
      );
    }

    // Log successful processing
    await WebhookLog.create({
      razorpayEventId: eventId,
      eventType: event,
      payload
    });

    res.json({ received: true });
  } catch (error) {
    // Log but don't throw - Razorpay will retry
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});
```

#### 7.4 **No Wallet/Payment Method Flexibility** ⚠️ MEDIUM
```javascript
const paymentSchema = new mongoose.Schema({
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'wallet', 'cod'],  // ← wallet, cod not implemented
    default: 'razorpay',
  },
  // ...
});

// But no Wallet model or implementation
```

**Implement Wallet (for refunds and credits):**
```javascript
// models/Wallet.js
const walletSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', unique: true },
  balance: { type: Number, default: 0, min: 0 },
  transactions: [{
    type: { type: String, enum: ['credit', 'debit'] },
    amount: Number,
    reason: String,  // refund, earning, admin_credit
    bookingId: ObjectId,
    createdAt: { type: Date, default: Date.now }
  }],
  updatedAt: { type: Date, default: Date.now }
});

walletSchema.index({ userId: 1 });
```

---

## Section 8: Race Conditions & Concurrency Issues

Already extensively covered in Section 4 and 5. Summary:

| Issue | Severity | Location |
|-------|----------|----------|
| Double booking race condition | CRITICAL | createBooking |
| Cart → Booking race condition | CRITICAL | createBooking |
| Payment processed twice | CRITICAL | verifyPayment |
| Worker assignment race condition | HIGH | assignWorker |
| Token array unbounded growth | CRITICAL | User.js |
| Slot availability check | HIGH | rescheduleBooking |

**All require transactions to fix.**

---

## Section 9: Refund & Cancellation Logic

Already covered in Section 5.2.

**Add to schema:**
```javascript
bookingSchema.add({
  refundAmount: { type: Number, default: 0 },
  refundDate: { type: Date, default: null },
  refundStatus: {
    type: String,
    enum: ['pending', 'processed', 'failed'],
    default: null
  }
});
```

---

## Section 10: Soft Delete Handling

### ✅ What's Good
- Soft delete fields exist (`isDeleted`)
- Queries filter `isDeleted: false`

### ❌ Issues

#### 10.1 **No Global Soft Delete Middleware** ⚠️ MEDIUM
```javascript
// Some queries check isDeleted, some don't
// Easy to forget and leak deleted data
```

**Create middleware:**
```javascript
// Mongoose query middleware
bookingSchema.pre(/^find/, function() {
  this.where({ isDeleted: false });
});

userSchema.pre(/^find/, function() {
  // Don't auto-filter users - might need deleted for dispute resolution
  if (this.options._recursed) {
    return;
  }
  this.where({ isDeleted: false });
});

// Apply to all models
```

#### 10.2 **Permanently Deleted Data Unrecoverable** ⚠️ HIGH
```javascript
// If you ever really delete documents
// You lose audit trail
```

**Always keep soft deletes:**
```javascript
// Disable hard delete in schema hooks
userSchema.pre('deleteOne', function(next) {
  return next(new Error('Use soft delete instead'));
});

// To hard delete (admin only, after retention period):
// db.collection('users').deleteMany({ isDeleted: true, deletedAt: { $lt: date90DaysAgo } })
```

---

## Section 11: Database Indexing Strategy

Already covered extensively. Here's the complete indexing plan:

```javascript
// User.js
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ isActive: 1, isDeleted: 1 });
userSchema.index({ createdAt: -1 });

// Address.js
addressSchema.index({ userId: 1 });
addressSchema.index({ userId: 1, isDeleted: 1 });
addressSchema.index({ userId: 1, isDefault: 1, isDeleted: 1 });

// Service.js (already good)
serviceSchema.index({ category: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ name: 'text', description: 'text' });

// Cart.js
cartSchema.index({ userId: 1 });
cartSchema.index({ userId: 1, updatedAt: -1 });

// Booking.js
bookingSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
bookingSchema.index({ workerId: 1, status: 1 });
bookingSchema.index({ serviceId: 1, date: 1, time: 1, isDeleted: 1 }, {
  unique: true,
  partialFilterExpression: {
    status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] }
  }
});
bookingSchema.index({ status: 1, date: 1 });

// Payment.js
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ bookingId: 1, status: 1 });
paymentSchema.index({ razorpayPaymentId: 1 }, { unique: true });
paymentSchema.index({ status: 1 });

// Rating.js
ratingSchema.index({ serviceId: 1, createdAt: -1 });
ratingSchema.index({ userId: 1 });
ratingSchema.index({ bookingId: 1 }, { unique: true });

// Notification.js
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1 });
notificationSchema.index({ createdAt: -1 });

// OTP.js
otpSchema.index({ email: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

---

## Section 12: Input Validation

### ✅ What's Good
- Email validation with regex
- Phone validation (10 digits)
- Password format checking
- Required field validation

### ❌ Critical Issues

#### 12.1 **No NoSQL Injection Prevention** ⚠️ CRITICAL
```javascript
// Mongoose protects by default, but custom queries could be vulnerable
const booking = await Booking.findOne({
  _id: req.params.id,
  userId: req.user.id  // ✅ Safe (from middleware)
});

// But if someone passes:
// req.body: { "userId": { "$gt": "" } }
// Mongoose auto-sanitizes, but not if you build queries manually
```

**Use object notation (already doing it):**
```javascript
// ✅ Safe
Booking.findOne({ userId: req.user.id });

// ❌ Never do this
Booking.findOne({ $where: "this.userId == '" + req.user.id + "'" });
```

#### 12.2 **Upgrade to Joi/Zod** ⚠️ HIGH
Already covered in Section 1.3

#### 12.3 **Regex Validation Too Loose** ⚠️ MEDIUM
```javascript
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// This allows: "test @test .com" ✓
// Should be stricter
```

**Use library:**
```javascript
npm install email-validator

const validator = require('email-validator');
if (!validator.validate(email)) {
  return sendError(res, 400, 'Invalid email');
}
```

---

## Section 13: Error Handling & Monitoring

### ✅ What's Good
- Centralized error handler middleware
- Different error types handled
- Appropriate status codes

### ❌ Critical Issues

#### 13.1 **No Error Tracking/Monitoring** ⚠️ CRITICAL
```javascript
const errorHandler = (err, req, res, next) => {
  console.error(err);  // ← Logs to console only!
  // In production, this is lost!
};
```

**You need:**
1. **Error Tracking:** Sentry, LogRocket, New Relic
2. **Centralized Logging:** ELK Stack, Datadog, CloudWatch
3. **Alerting:** PagerDuty, Slack webhooks

**Minimum Implementation - Sentry:**
```bash
npm install @sentry/node
```

```javascript
// server.js - at top
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());

// ... routes ...

app.use(Sentry.Handlers.errorHandler());

// Error handler (after Sentry)
app.use((err, req, res, next) => {
  console.error(err);
  
  // Send to Sentry
  Sentry.captureException(err, {
    extra: { userId: req.user?.id, path: req.path }
  });

  // ... rest of error handler
});
```

#### 13.2 **No Request Logging** ⚠️ HIGH
```javascript
// Can't debug issues without seeing request details
```

**Add Morgan logging:**
```bash
npm install morgan
```

```javascript
const morgan = require('morgan');

// Custom format
morgan.token('user', (req) => req.user?.id || 'anonymous');

const morganFormat = ':user :method :url :status :response-time ms';

app.use(morgan(morganFormat));

// Or for production (to file):
const fs = require('fs');
const path = require('path');
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'logs', 'access.log'),
  { flags: 'a' }
);

app.use(morgan(morganFormat, { stream: accessLogStream }));
```

#### 13.3 **No Request ID Tracking** ⚠️ HIGH
```javascript
// If error occurs, hard to trace which request caused it
```

**Add request ID:**
```bash
npm install uuid
```

```javascript
const { v4: uuidv4 } = require('uuid');

app.use((req, res, next) => {
  req.id = uuidv4();
  res.set('X-Request-ID', req.id);
  next();
});

// In error handler
Sentry.captureException(err, {
  extra: { 
    requestId: req.id,
    userId: req.user?.id,
    path: req.path,
    method: req.method
  }
});
```

#### 13.4 **Error Messages Expose System Details** ⚠️ MEDIUM
```javascript
// Bad:
catch (error) {
  return sendError(res, 500, error.message);  // Exposes stack!
}

// Good:
catch (error) {
  console.error(error);  // Log internally
  return sendError(res, 500, 'Internal server error');  // Generic to client
}
```

---

## Section 14: Rate Limiting & Security

### ✅ What's Good
- Rate limiter middleware configured
- Different limits for auth vs general API

### ❌ Issues

#### 14.1 **Rate Limiter Uses IP Only** ⚠️ MEDIUM
```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts'
});

// Problem: Behind load balancer, all IPs look same!
```

**Fix:**
```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req, res) => {
    // Use email as key (more reliable than IP)
    return req.body.email || req.ip;
  },
  skip: (req) => {
    // Don't rate limit admins
    return req.user?.role === ROLES.ADMIN;
  },
  message: 'Too many login attempts, please try again in 15 minutes'
});
```

#### 14.2 **No Password Reset Rate Limiting** ⚠️ HIGH
```javascript
// Anyone can spam /forgot-password 1000 times per second
// SMS costs money!
```

**Already covered in Section 2.5**

#### 14.3 **Missing Brute Force Protection** ⚠️ MEDIUM
```javascript
// After 5 failed login attempts, lock account
```

**Implement:**
```javascript
// New model: LoginAttempt.js
const loginAttemptSchema = new mongoose.Schema({
  email: String,
  attempts: { type: Number, default: 1 },
  lastAttemptAt: { type: Date, default: Date.now },
  lockedUntil: Date,
  createdAt: { type: Date, expires: 3600 }  // Auto-cleanup after 1 hour
});

// In login controller
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  // Check if account locked
  const attempt = await LoginAttempt.findOne({ email });
  if (attempt?.lockedUntil && attempt.lockedUntil > new Date()) {
    return sendError(res, 429, 'Account temporarily locked. Try again later');
  }

  const user = await User.findOne({ email });
  if (!user) {
    // Record failed attempt
    await LoginAttempt.findOneAndUpdate(
      { email },
      { 
        $inc: { attempts: 1 },
        lastAttemptAt: new Date(),
        ...(attempts >= 5 && { lockedUntil: new Date(Date.now() + 30*60*1000) })
      },
      { upsert: true }
    );
    return sendError(res, 401, 'Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    // Record failed attempt
    attempt = await LoginAttempt.findOneAndUpdate(
      { email },
      { 
        $inc: { attempts: 1 },
        lastAttemptAt: new Date(),
        ...(attempts >= 5 && { lockedUntil: new Date(Date.now() + 30*60*1000) })
      },
      { upsert: true, new: true }
    );

    const attemptsLeft = Math.max(0, 5 - attempt.attempts);
    return sendError(res, 401, 
      `Invalid password. ${attemptsLeft} attempts remaining`);
  }

  // Success - clear attempts
  await LoginAttempt.deleteOne({ email });

  // ... rest of login logic
};
```

---

## Section 15: Scalability (10k+ Users, 1000+ Bookings/Day)

### Current Bottlenecks

#### 15.1 **No Database Replication/Sharding** ⚠️ MEDIUM (Future)
At 10k users:
- 1000 bookings/day × 365 = 365,000 bookings/year
- 10,000 × 50 refresh tokens = 500,000 token records

MongoDB Atlas handles this, but need:
```javascript
// Shard by userId for horizontal scaling
// Shard key: { userId: 1 }

// Connection pooling
// Mongoose default poolSize: 10
// Increase to 100 for scale:

mongoose.connect(process.env.DATABASE_URL, {
  maxPoolSize: 100,
  minPoolSize: 10,
  maxIdleTimeMS: 45000,
});
```

#### 15.2 **No Caching Layer** ⚠️ HIGH
```javascript
// Every request hits MongoDB
// Service list queried 100+ times/second = DB strain
```

**Add Redis caching:**
```bash
npm install redis
```

```javascript
const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL
});

client.connect();

// Cache service list
router.get('/services', async (req, res, next) => {
  const cacheKey = `services:${req.query.category || 'all'}`;
  
  // Check cache first
  const cached = await client.get(cacheKey);
  if (cached) {
    return sendResponse(res, 200, true, 'Services', JSON.parse(cached));
  }

  // Query DB
  const services = await Service.find({ isActive: true });
  
  // Cache for 5 minutes
  await client.setEx(cacheKey, 5 * 60, JSON.stringify(services));
  
  return sendResponse(res, 200, true, 'Services', services);
});

// Invalidate cache on create/update
router.post('/services', authorizeAdmin, async (req, res) => {
  // ... create service
  
  // Clear cache
  await client.del('services:all');
  await client.del('services:cleaning');  // etc.
});
```

#### 15.3 **No Queue System** ⚠️ HIGH
```javascript
// Synchronous operations in request-response cycle:
// - Send notifications
// - Assign workers
// - Create audit logs

// These should be async jobs
```

**Add Bull Queue:**
```bash
npm install bull
```

```javascript
const Queue = require('bull');

const workerAssignmentQueue = new Queue('worker-assignment', {
  redis: process.env.REDIS_URL
});

const notificationQueue = new Queue('notifications', {
  redis: process.env.REDIS_URL
});

// In bookingController.js
exports.createBooking = async (req, res, next) => {
  // ... create booking ...

  // Queue operations instead of doing sync
  await workerAssignmentQueue.add({
    bookingId: booking._id,
    serviceId: booking.serviceId
  });

  await notificationQueue.add({
    userId: req.user.id,
    type: NOTIFICATION_TYPES.BOOKING_CONFIRMED
  });

  return sendResponse(res, 201, true, 'Booking created', booking);
};

// Process queue jobs separately
workerAssignmentQueue.process(async (job) => {
  const { bookingId, serviceId } = job.data;
  // Long-running assignment logic
  await assignWorker(bookingId, serviceId);
});

notificationQueue.process(async (job) => {
  const { userId, type } = job.data;
  // Send email/SMS
  await sendNotification(userId, type);
});
```

#### 15.4 **No Connection Pooling Optimization** ⚠️ MEDIUM
```javascript
// Default Mongoose settings aren't optimized for scale

mongoose.connect(process.env.DATABASE_URL, {
  maxPoolSize: 100,         // Default is 10
  minPoolSize: 10,          // Maintain 10 connections
  maxIdleTimeMS: 45000,     // Close idle connections
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

#### 15.5 **No Query Optimization** ⚠️ MEDIUM
```javascript
// Every booking query populates related documents
const bookings = await Booking.find({ userId: req.user.id })
  .populate(['serviceId', 'addressId', 'workerId'])  // 3 lookups!
  .sort({ createdAt: -1 });

// For 1000 bookings/day = 1000 × 3 = 3000 lookups = SLOW
```

**Optimize with lean():**
```javascript
// For list endpoints, don't populate
const bookings = await Booking.find({ userId: req.user.id })
  .lean()  // Returns plain JS objects, faster
  .sort({ createdAt: -1 });

// For detail endpoints, populate
const booking = await Booking.findById(id)
  .populate(['serviceId', 'addressId', 'workerId']);
```

#### 15.6 **No Batch Operations** ⚠️ MEDIUM
```javascript
// If you process 1000 bookings, don't do 1000 queries
// Use bulkWrite

const updates = bookings.map(booking => ({
  updateOne: {
    filter: { _id: booking._id },
    update: { status: BOOKING_STATUS.COMPLETED }
  }
}));

await Booking.bulkWrite(updates);  // Single operation, not 1000
```

---

## Section 16: Security Risks & Vulnerabilities

### ✅ What's Good
- No hardcoded secrets (using .env)
- Helmet middleware enabled
- Password hashing

### ❌ Critical Issues

#### 16.1 **Exposed API Endpoints** ⚠️ MEDIUM
```javascript
// Health check endpoint is public
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Attackers can probe and identify service
```

**Remove or protect:**
```javascript
// Option 1: Remove it
// Don't expose health checks

// Option 2: Authenticate it
app.get('/api/health', authMiddleware, (req, res) => {
  res.json({ status: 'Server is running' });
});

// Option 3: Simple token
app.get('/api/health', (req, res) => {
  if (req.headers['x-health-check-token'] !== process.env.HEALTH_CHECK_TOKEN) {
    return sendError(res, 401, 'Unauthorized');
  }
  res.json({ status: 'Server is running' });
});
```

#### 16.2 **No API Keys for Third-Party Access** ⚠️ MEDIUM
```javascript
// If someone builds a mobile app client, how do they authenticate?
// Currently only JWT with email/password

// But third-party integrations need API keys
```

**Implement API Key system:**
```javascript
// New model: APIKey.js
const apiKeySchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User' },
  name: String,
  key: { type: String, unique: true, select: false },
  secret: { type: String, select: false },
  permissions: [String],  // 'read_bookings', 'create_booking', etc.
  lastUsedAt: Date,
  expiresAt: Date,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Generate API key endpoint
router.post('/api-keys', authMiddleware, async (req, res) => {
  const { name } = req.body;

  const key = crypto.randomBytes(16).toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');

  const apiKey = new APIKey({
    userId: req.user.id,
    name,
    key: crypto.createHash('sha256').update(key).digest('hex'),  // Hash it
    secret,
    permissions: ['read_bookings', 'list_services'],
    expiresAt: new Date(Date.now() + 365*24*60*60*1000)  // 1 year
  });

  await apiKey.save();

  return sendResponse(res, 201, true, 'API key created', {
    key,  // Show only once!
    secret
  });
});
```

#### 16.3 **CORS Wide Open** ⚠️ MEDIUM
```javascript
// server.js
app.use(cors());  // Allows ANY origin!
```

**Restrict:**
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

#### 16.4 **No CSRF Protection** ⚠️ MEDIUM
```javascript
// If frontend is same-origin, need CSRF tokens
```

**Add CSRF protection:**
```bash
npm install csurf
```

```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: true }));

// Include token in responses
app.get('/csrf-token', (req, res) => {
  res.json({ token: req.csrfToken() });
});

// Protected routes need token
app.post('/api/bookings', (req, res) => {
  // Middleware validates req.body._csrf
});
```

#### 16.5 **XSS Vulnerability in Notifications** ⚠️ HIGH
```javascript
const notification = new Notification({
  userId: req.user.id,
  title: req.body.title,  // ← User input!
  message: req.body.message,
  type: req.body.type
});

// If frontend renders this without escaping = XSS
```

**Sanitize input:**
```bash
npm install xss
```

```javascript
const xss = require('xss');

const notification = new Notification({
  userId: req.user.id,
  title: xss(req.body.title),    // Sanitize
  message: xss(req.body.message),
  type: req.body.type
});
```

#### 16.6 **No Rate Limiting on Public Endpoints** ⚠️ MEDIUM
```javascript
// /api/services can be queried 100 times/second
// Could be DDoS
```

**Apply to public endpoints:**
```javascript
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 100,                 // 100 requests
  keyGenerator: (req) => req.ip
});

router.get('/services', publicLimiter, serviceController.getServices);
```

---

## Section 17: Logging & Monitoring

Already covered in Section 13.

**Required:**
- Sentry for error tracking
- Morgan for request logging
- Request ID tracking
- Centralized log aggregation (ELK/Datadog)
- APM (New Relic/Datadog) for performance

---

## Section 18: Maintainability & Modularity

### ✅ What's Good
- Clear folder structure (models, controllers, routes, middleware)
- Separation of concerns
- Constants file for enums

### ❌ Issues

#### 18.1 **No Service/Business Logic Layer** ⚠️ HIGH
```javascript
// All logic in controllers - hard to test
// Controllers should be thin

exports.createBooking = async (req, res, next) => {
  // ❌ All business logic here (30+ lines)
  const service = await Service.findById(serviceId);
  const address = await Address.findOne(...);
  const discountAmount = ...;
  const booking = new Booking({...});
  // etc.
};
```

**Create services layer:**
```javascript
// services/bookingService.js
class BookingService {
  async createBooking(userId, bookingData) {
    // All business logic here
    const { serviceId, addressId, date, time, notes } = bookingData;

    const service = await Service.findById(serviceId);
    if (!service) throw new Error('Service not found');

    const address = await Address.findOne({
      _id: addressId,
      userId,
      isDeleted: false
    });
    if (!address) throw new Error('Address not found');

    const discountAmount = (service.price * service.discount) / 100;
    const finalPrice = service.price - discountAmount;

    const booking = new Booking({
      userId,
      serviceId,
      addressId,
      date: new Date(date),
      time,
      totalAmount: finalPrice,
      notes
    });

    await booking.save();
    return booking;
  }

  async cancelBooking(bookingId, userId, reason) {
    // Cancellation logic
  }

  async assignWorker(bookingId) {
    // Worker assignment logic
  }
}

module.exports = new BookingService();

// controllers/bookingController.js
const bookingService = require('../services/bookingService');

exports.createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.createBooking(req.user.id, req.body);
    return sendResponse(res, 201, true, 'Booking created', booking);
  } catch (error) {
    next(error);
  }
};
```

**Benefits:**
- Easy to test (no need to mock Express)
- Reusable (can call from controllers, cron jobs, queue processors)
- Clear separation of concerns

#### 18.2 **No Repository/DAO Pattern** ⚠️ MEDIUM
```javascript
// Direct Mongoose calls scattered across controllers
// Hard to change database later
```

**Create repositories:**
```javascript
// repositories/bookingRepository.js
class BookingRepository {
  async findById(id, userId) {
    return Booking.findOne({ _id: id, userId, isDeleted: false });
  }

  async findByUser(userId, filters = {}) {
    return Booking.find({ userId, isDeleted: false, ...filters });
  }

  async create(bookingData) {
    const booking = new Booking(bookingData);
    return booking.save();
  }

  async updateStatus(id, userId, status) {
    return Booking.findOneAndUpdate(
      { _id: id, userId, isDeleted: false },
      { status },
      { new: true }
    );
  }

  async delete(id, userId) {
    return Booking.findOneAndUpdate(
      { _id: id, userId },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
  }
}

module.exports = new BookingRepository();

// Use in service:
const bookingRepository = require('../repositories/bookingRepository');

async createBooking(userId, data) {
  // ... validation ...
  return bookingRepository.create({ userId, ...data });
}
```

#### 18.3 **No DTO Pattern** ⚠️ MEDIUM
```javascript
// Sending raw Mongoose documents to client
// Exposes unnecessary fields (password hashes, etc.)

return sendResponse(res, 200, true, 'User', user);  // ❌ Sends whole document
```

**Create DTOs:**
```javascript
// dtos/userDTO.js
class UserDTO {
  static fromEntity(user) {
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      createdAt: user.createdAt
      // Excludes: password, refreshTokens, etc.
    };
  }
}

// Use:
return sendResponse(res, 200, true, 'User', UserDTO.fromEntity(user));
```

#### 18.4 **No Constants for Magic Strings** ⚠️ MEDIUM
```javascript
// Status strings hardcoded across codebase
if (booking.status === 'pending') { ... }
if (booking.status === 'completed') { ... }

// One typo = silent bug
```

**Already have constants.js - ensure used everywhere:**
```javascript
// Good:
if (booking.status === BOOKING_STATUS.PENDING) { ... }
if (booking.status === BOOKING_STATUS.COMPLETED) { ... }
```

#### 18.5 **No Configuration Management** ⚠️ MEDIUM
```javascript
// Magic numbers scattered:
max: 5,       // rate limit
expiresIn: '30d'  // token expiry
windowMs: 15 * 60 * 1000  // 15 minutes
```

**Centralize config:**
```javascript
// config/appConfig.js
module.exports = {
  auth: {
    accessTokenExpiry: '30d',
    refreshTokenExpiry: '90d',
    passwordSaltRounds: 10,
    otpExpiry: 10 * 60 * 1000,  // 10 minutes
  },
  rateLimiting: {
    authWindow: 15 * 60 * 1000,
    authMax: 5,
    apiWindow: 15 * 60 * 1000,
    apiMax: 100,
  },
  pagination: {
    defaultPage: 1,
    defaultLimit: 10,
    maxLimit: 100,
  },
  booking: {
    cancellationWindow: 24,  // hours
    fullRefundWindow: 24,    // hours
    partialRefundWindow: 2,  // hours
  }
};

// Use:
const config = require('../config/appConfig');
const accessToken = generateAccessToken(user._id, config.auth.accessTokenExpiry);
```

---

## Section 19: Missing Edge Cases

### Critical Edge Cases Not Handled

#### 19.1 **What if user deletes account while booking in progress?**
```javascript
// Booking.userId refs User._id
// If user deleted, booking becomes orphaned
// Also: user has no way to retrieve their bookings
```

**Fix:**
```javascript
exports.deleteAccount = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(req.user.id).session(session);

    // Check active bookings
    const activeBookings = await Booking.find({
      userId: req.user.id,
      status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.ASSIGNED, BOOKING_STATUS.IN_PROGRESS] }
    }).session(session);

    if (activeBookings.length > 0) {
      throw new Error('Cannot delete account with active bookings. Cancel them first.');
    }

    // Archive all user data
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.email = `deleted_${user._id}`;  // Anonymize
    user.phone = null;
    await user.save({ session });

    // Anonymize related data
    await Booking.updateMany(
      { userId: req.user.id },
      { userId: null },  // Or archive to separate collection
      { session }
    );

    await Cart.deleteOne({ userId: req.user.id }, { session });

    await session.commitTransaction();
    return sendResponse(res, 200, true, 'Account deleted');
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
```

#### 19.2 **What if service is deleted while in cart?**
```javascript
// Service isActive = false
// But cart still has reference
// Booking can still be created with deleted service!
```

**Fix:**
```javascript
exports.createBooking = async (req, res, next) => {
  const { serviceId, ... } = req.body;

  const service = await Service.findOne({
    _id: serviceId,
    isActive: true  // ← Ensure active
  });

  if (!service) {
    return sendError(res, 404, 'Service not available');
  }

  // Remove from cart if service was deleted
  await Cart.findOneAndUpdate(
    { userId: req.user.id },
    { $pull: { items: { serviceId: { $exists: false } } } }
  );
};
```

#### 19.3 **What if worker cancels accepted booking?**
```javascript
// No logic for worker perspective
// They might accept then disappear
```

**Add:**
```javascript
// models/Booking.js - add field
bookingSchema.add({
  workerCancelledAt: { type: Date, default: null },
  workerCancellationReason: String
});

// routes/workerRoutes.js
router.put('/bookings/:id/decline', 
  authMiddleware, 
  requireRole(['worker']),
  async (req, res, next) => {
    const booking = await Booking.findOne({
      _id: req.params.id,
      workerId: req.user.id,
      status: BOOKING_STATUS.ASSIGNED
    });

    if (!booking) {
      return sendError(res, 404, 'Booking not found');
    }

    booking.status = BOOKING_STATUS.PENDING;
    booking.workerId = null;
    booking.workerCancelledAt = new Date();
    booking.workerCancellationReason = req.body.reason;

    await booking.save();

    // Re-assign to another worker
    await workerAssignmentQueue.add({ bookingId: booking._id });

    return sendResponse(res, 200, true, 'Booking declined', booking);
  }
);
```

#### 19.4 **What if service price changes during busy time?**
Already covered (cart price snapshot handles this).

#### 19.5 **What if two addresses have same default?**
```javascript
// Constraint isn't enforced at DB level
```

**Fix:**
```javascript
addressSchema.add({
  isDefault: {
    type: Boolean,
    default: false,
    sparse: true  // Only one default per user
  }
});

addressSchema.index({ userId: 1, isDefault: 1 }, {
  unique: true,
  partialFilterExpression: { isDefault: true }
});

// In controller - ensure only one default
exports.setDefaultAddress = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Remove default from others
    await Address.updateMany(
      { userId: req.user.id, isDefault: true },
      { isDefault: false },
      { session }
    );

    // Set new default
    const address = await Address.findByIdAndUpdate(
      req.params.id,
      { isDefault: true },
      { new: true, session }
    );

    await session.commitTransaction();
    return sendResponse(res, 200, true, 'Default address updated', address);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
```

---

## Section 20: Overall Architecture Rating

### Rating: **6.5/10** ⚠️ NOT PRODUCTION READY

| Category | Score | Reason |
|----------|-------|--------|
| REST API Design | 7/10 | Good structure but missing versioning, weak response consistency |
| Authentication | 6/10 | JWT ok, but no token rotation, logout broken, weak secrets |
| Authorization | 6/10 | Roles defined but inconsistently enforced, no RLS middleware |
| Database Design | 6/10 | Good schemas, but no transactions (critical), indexes incomplete |
| Booking Logic | 5/10 | No race condition prevention, no idempotency, refund logic missing |
| Payment Security | 3/10 | **CRITICAL** - No Razorpay verification, no webhooks, vulnerable to fraud |
| Error Handling | 6/10 | Central handler good, but no monitoring/tracking |
| Rate Limiting | 6/10 | Basic implementation, missing on many endpoints |
| Scalability | 5/10 | No caching, no queues, not optimized for concurrent loads |
| Security | 5/10 | CORS wide open, no CSRF, XSS risks, no API keys |
| Maintainability | 6/10 | Structure ok, but no services layer, scattered business logic |
| **Average** | **6.5/10** | ✅ Good foundation, ❌ Multiple critical gaps |

### Immediate Actions Required (Before Production)

**CRITICAL (Must Fix):**
1. ✅ Implement Razorpay signature verification
2. ✅ Add database transactions for race conditions
3. ✅ Move refresh tokens to separate collection
4. ✅ Implement token rotation
5. ✅ Add idempotency keys
6. ✅ Implement refund logic
7. ✅ Add payment webhooks

**HIGH PRIORITY (Before 1000+ users):**
8. ✅ Add request/response schema validation (Joi)
9. ✅ Implement proper error monitoring (Sentry)
10. ✅ Add request logging (Morgan)
11. ✅ Set up caching layer (Redis)
12. ✅ Create services/repository layers
13. ✅ Fix authorization enforcement
14. ✅ Implement API versioning
15. ✅ Add brute force protection

**MEDIUM PRIORITY (Before scaling):**
16. ✅ Implement queue system (Bull)
17. ✅ Add request ID tracking
18. ✅ Optimize MongoDB indexes
19. ✅ Set up proper rate limiting
20. ✅ Implement wallet system
21. ✅ Add dispute resolution system

---

## Summary: What You Did Well

1. ✅ **Clean folder structure** - organized and easy to navigate
2. ✅ **Consistent middleware pattern** - auth, validation, error handling
3. ✅ **Good response standardization** - json format consistent
4. ✅ **Proper HTTP status codes** - 201 for creation, 400 for validation, etc.
5. ✅ **Password hashing implemented** - bcryptjs with salt rounds
6. ✅ **Soft deletes pattern** - data preservation
7. ✅ **Price snapshots in cart** - handles price changes well
8. ✅ **Reschedule history tracking** - audit trail
9. ✅ **Rate limiting basics** - IP-based limiting exists

---

## Critical Warnings

🚨 **DO NOT DEPLOY** until you fix:
- Payment verification (Razorpay)
- Database transactions
- Token rotation
- Idempotency
- Authorization enforcement
- Request validation schema

These are not "nice to have" features. They're **minimum viable security** for real money transactions.

---

## Recommended Next Steps

1. **This Week:**
   - Fix Razorpay verification
   - Add transactions to booking/payment flows
   - Move refresh tokens to separate collection

2. **Next Week:**
   - Add Joi validation
   - Implement Sentry monitoring
   - Set up Redis caching
   - Refactor to services layer

3. **Before Production:**
   - Load test with k6 or JMeter
   - Security audit
   - Compliance check (PCI DSS for payments)
   - Disaster recovery plan

---

Generated: February 17, 2026  
Reviewer: Senior Backend Architect
