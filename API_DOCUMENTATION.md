# Home Service Platform API Documentation

Complete production-ready REST API for a home service booking platform (like Urban Company/Pronto).

## 🚀 Features

- ✅ User Authentication (JWT with Refresh Tokens)
- ✅ OTP Verification for Password Reset
- ✅ Multiple Addresses Management
- ✅ Services Catalog with Search & Filter
- ✅ Shopping Cart
- ✅ Booking Management
- ✅ Payment Integration (Razorpay ready)
- ✅ Rating & Reviews System
- ✅ Notifications
- ✅ Role-based Authorization
- ✅ Rate Limiting
- ✅ Error Handling
- ✅ MongoDB Indexing

---

## 🔧 Setup Instructions

### 1. Installation

```bash
npm install
```

### 2. Environment Variables

Create `.env` file:

```env
PORT=5000
DATABASE_URL=your_mongodb_connection_string
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key
REFRESH_TOKEN_SECRET=your_refresh_token_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
SMTP_SERVICE=gmail
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### 3. Start Server

```bash
node server.js
```

Server runs on `http://localhost:5000`

---

## 📚 API Endpoints

### 1️⃣ AUTHENTICATION

#### Signup
```
POST /api/auth/signup
```

Body:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9999999999",
  "password": "Pass123",
  "confirmPassword": "Pass123",
  "role": "customer"
}
```

Response:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9999999999",
      "role": "customer"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

#### Login
```
POST /api/auth/login
```

Body:
```json
{
  "email": "john@example.com",
  "password": "Pass123"
}
```

#### Forgot Password
```
POST /api/auth/forgot-password
```

Body:
```json
{
  "email": "john@example.com"
}
```

#### Verify OTP
```
POST /api/auth/verify-otp
```

Body:
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

#### Reset Password
```
POST /api/auth/reset-password
```

Body:
```json
{
  "email": "john@example.com",
  "password": "NewPass123",
  "confirmPassword": "NewPass123"
}
```

#### Refresh Token
```
POST /api/auth/refresh-token
```

Body:
```json
{
  "refreshToken": "eyJhbGc..."
}
```

#### Get Profile
```
GET /api/auth/profile
Headers: Authorization: Bearer {accessToken}
```

#### Update Profile
```
PUT /api/auth/profile
Headers: Authorization: Bearer {accessToken}

Body:
{
  "name": "Jane Doe",
  "profileImage": "image_url"
}
```

#### Logout
```
POST /api/auth/logout
Headers: Authorization: Bearer {accessToken}

Body:
{
  "refreshToken": "eyJhbGc..."
}
```

#### Delete Account
```
DELETE /api/auth/account
Headers: Authorization: Bearer {accessToken}

Body:
{
  "password": "Pass123"
}
```

---

### 2️⃣ ADDRESSES

#### Create Address
```
POST /api/addresses
Headers: Authorization: Bearer {accessToken}

Body:
{
  "fullName": "John Doe",
  "phone": "9999999999",
  "houseNo": "123",
  "area": "Downtown",
  "city": "New York",
  "state": "NY",
  "pincode": "100001",
  "landmark": "Near Park",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "isDefault": true
}
```

#### Get All Addresses
```
GET /api/addresses
Headers: Authorization: Bearer {accessToken}
```

#### Get Address by ID
```
GET /api/addresses/:id
Headers: Authorization: Bearer {accessToken}
```

#### Update Address
```
PUT /api/addresses/:id
Headers: Authorization: Bearer {accessToken}

Body: (same as create)
```

#### Set Default Address
```
PUT /api/addresses/:id/set-default
Headers: Authorization: Bearer {accessToken}
```

#### Delete Address
```
DELETE /api/addresses/:id
Headers: Authorization: Bearer {accessToken}
```

---

### 3️⃣ SERVICES

#### Get All Services
```
GET /api/services?page=1&limit=10&category=cleaning&minPrice=100&maxPrice=500
```

#### Get Service by ID
```
GET /api/services/:id
```

#### Search Services
```
GET /api/services/search?keyword=cleaning&category=cleaning
```

#### Get Categories
```
GET /api/services/categories
```

#### Create Service (Admin Only)
```
POST /api/services
Headers: Authorization: Bearer {adminToken}

Body:
{
  "name": "Home Cleaning",
  "description": "Professional home cleaning service",
  "price": 300,
  "duration": 120,
  "category": "cleaning",
  "image": "image_url",
  "discount": 10
}
```

#### Update Service (Admin Only)
```
PUT /api/services/:id
Headers: Authorization: Bearer {adminToken}

Body: (same as create)
```

#### Delete Service (Admin Only)
```
DELETE /api/services/:id
Headers: Authorization: Bearer {adminToken}
```

---

### 4️⃣ CART

#### Add to Cart
```
POST /api/cart
Headers: Authorization: Bearer {accessToken}

Body:
{
  "serviceId": "...",
  "quantity": 1,
  "selectedDate": "2026-02-20",
  "selectedTime": "10:00 AM"
}
```

#### Get Cart
```
GET /api/cart
Headers: Authorization: Bearer {accessToken}
```

#### Update Cart Item
```
PUT /api/cart/:itemId
Headers: Authorization: Bearer {accessToken}

Body:
{
  "quantity": 2,
  "selectedDate": "2026-02-21",
  "selectedTime": "02:00 PM"
}
```

#### Remove Item from Cart
```
DELETE /api/cart/:itemId
Headers: Authorization: Bearer {accessToken}
```

#### Clear Cart
```
DELETE /api/cart
Headers: Authorization: Bearer {accessToken}
```

---

### 5️⃣ BOOKINGS

#### Create Booking
```
POST /api/bookings
Headers: Authorization: Bearer {accessToken}

Body:
{
  "serviceId": "...",
  "addressId": "...",
  "date": "2026-02-20",
  "time": "10:00 AM",
  "notes": "Please ring the bell twice"
}
```

#### Get All Bookings
```
GET /api/bookings?page=1&limit=10&status=pending
Headers: Authorization: Bearer {accessToken}
```

#### Get Booking by ID
```
GET /api/bookings/:id
Headers: Authorization: Bearer {accessToken}
```

#### Cancel Booking
```
PUT /api/bookings/:id/cancel
Headers: Authorization: Bearer {accessToken}

Body:
{
  "cancellationReason": "Unable to attend"
}
```

#### Reschedule Booking
```
PUT /api/bookings/:id/reschedule
Headers: Authorization: Bearer {accessToken}

Body:
{
  "newDate": "2026-02-21",
  "newTime": "02:00 PM",
  "reason": "Emergency"
}
```

#### Update Booking Status (Admin/Worker Only)
```
PUT /api/bookings/:id/status
Headers: Authorization: Bearer {adminToken}

Body:
{
  "status": "completed"
}
```

---

### 6️⃣ RATINGS & REVIEWS

#### Create Rating
```
POST /api/ratings
Headers: Authorization: Bearer {accessToken}

Body:
{
  "serviceId": "...",
  "bookingId": "...",
  "rating": 4,
  "review": "Excellent service, very professional"
}
```

#### Get Service Ratings
```
GET /api/ratings/service/:serviceId?page=1&limit=10
```

#### Get User Ratings
```
GET /api/ratings/user/:userId
```

#### Update Rating
```
PUT /api/ratings/:id
Headers: Authorization: Bearer {accessToken}

Body:
{
  "rating": 5,
  "review": "Updated review"
}
```

---

### 7️⃣ NOTIFICATIONS

#### Get Notifications
```
GET /api/notifications?page=1&limit=20&isRead=false
Headers: Authorization: Bearer {accessToken}
```

#### Get Unread Count
```
GET /api/notifications/unread/count
Headers: Authorization: Bearer {accessToken}
```

#### Mark as Read
```
PUT /api/notifications/:id/read
Headers: Authorization: Bearer {accessToken}
```

#### Mark All as Read
```
PUT /api/notifications/mark-all-read
Headers: Authorization: Bearer {accessToken}
```

#### Delete Notification
```
DELETE /api/notifications/:id
Headers: Authorization: Bearer {accessToken}
```

---

### 8️⃣ PAYMENTS

#### Create Payment Order
```
POST /api/payments/create-order
Headers: Authorization: Bearer {accessToken}

Body:
{
  "bookingId": "...",
  "amount": 300
}
```

#### Verify Payment
```
POST /api/payments/verify
Headers: Authorization: Bearer {accessToken}

Body:
{
  "razorpayOrderId": "order_...",
  "razorpayPaymentId": "pay_...",
  "razorpaySignature": "sig_...",
  "bookingId": "..."
}
```

#### Get Payment History
```
GET /api/payments/history?page=1&limit=10
Headers: Authorization: Bearer {accessToken}
```

#### Get Payment by ID
```
GET /api/payments/:id
Headers: Authorization: Bearer {accessToken}
```

---

## 📊 Database Schema

### User
- name (String)
- email (String, unique)
- phone (String, unique)
- password (String, hashed)
- role (customer, worker, admin)
- profileImage (String)
- isVerified (Boolean)
- isActive (Boolean)
- isDeleted (Boolean)
- refreshTokens (Array)
- lastLogin (Date)
- createdAt, updatedAt

### Address
- userId (ObjectId)
- fullName, phone, houseNo, area, city, state, pincode
- landmark, latitude, longitude
- isDefault (Boolean)
- isDeleted (Boolean)

### Service
- name, description, price, originalPrice
- duration (minutes)
- category
- image
- discount (%)
- isActive (Boolean)
- ratingAverage (1-5)
- totalReviews

### Cart
- userId (ObjectId, unique)
- items (Array of service items with dates/times)
- totalPrice
- updatedAt

### Booking
- userId, workerId, serviceId, addressId
- date, time
- status (pending, assigned, accepted, in_progress, completed, cancelled, rejected, no_show)
- paymentStatus (pending, success, failed, refunded)
- totalAmount
- cancellationReason, cancellationDate
- rescheduleHistory
- notes

### Payment
- bookingId, userId
- amount
- paymentMethod (razorpay, wallet, cod)
- status (pending, success, failed, refunded)
- razorpayOrderId, razorpayPaymentId, razorpaySignature
- refundAmount, refundDate

### Rating
- userId, serviceId, bookingId, workerId
- rating (1-5)
- review
- createdAt

### Notification
- userId
- title, message
- type (booking_confirmed, worker_assigned, service_started, service_completed, payment_success, cancellation, rescheduled)
- isRead, readAt
- createdAt

### OTP
- email
- otp (6 digits)
- expiresAt (10 minutes)
- isUsed (Boolean)

---

## 🔐 Security Features

1. **JWT Authentication** - 30-day access tokens, 90-day refresh tokens
2. **Password Hashing** - bcryptjs with salt rounds
3. **OTP Verification** - 10-minute expiry
4. **Rate Limiting** - 5 requests/15 min for auth, 100 for API
5. **Helmet** - HTTP headers security
6. **CORS** - Cross-origin resource sharing
7. **Role-based Authorization** - Customer, Worker, Admin roles
8. **Soft Delete** - Preserve data integrity
9. **Input Validation** - Middleware validation for all inputs

---

## 📝 Status Codes

- **200** - OK (Success)
- **201** - Created (Resource created)
- **400** - Bad Request (Invalid input)
- **401** - Unauthorized (Authentication failed)
- **403** - Forbidden (Authorization failed)
- **404** - Not Found (Resource not found)
- **500** - Internal Server Error

---

## 🧪 Testing

### Using Postman

1. Create environment variables:
   - `{{base_url}}` = `http://localhost:5000`
   - `{{accessToken}}` = JWT token from login
   - `{{refreshToken}}` = Refresh token

2. Import collection and test all endpoints

### Using cURL

```bash
# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9999999999",
    "password": "Pass123",
    "confirmPassword": "Pass123"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Pass123"
  }'
```

---

## 🚀 Deployment

### Environment Setup

1. Update `.env` for production
2. Use strong JWT secrets
3. Configure MongoDB Atlas
4. Set up Razorpay keys
5. Configure email service

### Scaling Considerations

- Add Redis for session management
- Implement caching layer
- Use message queues for notifications
- Add database replication
- Implement CDN for images

---

## 📞 Support

For issues or questions, contact support or file an issue on GitHub.

---

**Version:** 1.0.0  
**Last Updated:** February 17, 2026
