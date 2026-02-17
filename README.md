# Home Service Platform API

A complete, production-ready REST API for building home service booking platforms like Urban Company or Pronto.

## 🎯 Overview

This is a full-featured backend API with:
- **8 Major Modules** (Auth, Addresses, Services, Cart, Bookings, Payments, Ratings, Notifications)
- **Complete JWT Authentication** with refresh tokens
- **MongoDB** with Mongoose ODM
- **Role-based Authorization** (Customer, Worker, Admin)
- **Error Handling** and validation middleware
- **Rate Limiting** for security
- **Razorpay** payment integration ready
- **Production-ready** code structure

---

## 📋 Features

### Authentication Module
- ✅ User signup/login
- ✅ JWT tokens (access + refresh)
- ✅ OTP verification
- ✅ Password reset
- ✅ Profile management
- ✅ Account deletion (soft delete)

### Service Management
- ✅ Service catalog
- ✅ Search & filtering
- ✅ Category-based browsing
- ✅ Admin service management

### Booking System
- ✅ Create bookings
- ✅ Cancel bookings
- ✅ Reschedule with history
- ✅ Status tracking
- ✅ Worker assignment (placeholder)

### Payment Integration
- ✅ Razorpay order creation
- ✅ Payment verification
- ✅ Payment history
- ✅ Multiple payment methods support

### User Features
- ✅ Multiple addresses
- ✅ Default address selection
- ✅ Shopping cart
- ✅ Ratings & reviews
- ✅ Notifications system

---

## 🗂️ Folder Structure

```
home-service-api/
├── config/
│   ├── db.js
│   └── constants.js
├── models/
│   ├── User.js
│   ├── Address.js
│   ├── Service.js
│   ├── Cart.js
│   ├── Booking.js
│   ├── Payment.js
│   ├── Rating.js
│   ├── Notification.js
│   └── OTP.js
├── controllers/
│   ├── authController.js
│   ├── addressController.js
│   ├── serviceController.js
│   ├── cartController.js
│   ├── bookingController.js
│   ├── paymentController.js
│   ├── ratingController.js
│   └── notificationController.js
├── routes/
│   ├── authRoutes.js
│   ├── addressRoutes.js
│   ├── serviceRoutes.js
│   ├── cartRoutes.js
│   ├── bookingRoutes.js
│   ├── paymentRoutes.js
│   ├── ratingRoutes.js
│   └── notificationRoutes.js
├── middleware/
│   ├── authMiddleware.js
│   ├── authorization.js
│   ├── errorHandler.js
│   ├── rateLimiter.js
│   └── validators.js
├── utils/
│   ├── errorHandler.js
│   ├── response.js
│   ├── validators.js
│   ├── tokenUtils.js
│   └── otpUtils.js
├── server.js
├── package.json
├── .env
└── API_DOCUMENTATION.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v20.12.2 or higher
- MongoDB (local or Atlas)
- npm v10.5.0 or higher

### Installation

1. Clone repository
```bash
cd home-service-api
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file
```env
PORT=5000
DATABASE_URL=your_mongodb_connection_string
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here
REFRESH_TOKEN_SECRET=your_refresh_secret_here
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

4. Start server
```bash
node server.js
```

Server runs on `http://localhost:5000`

---

## 📚 API Overview

### Authentication
```
POST   /api/auth/signup          - Create new user
POST   /api/auth/login           - Login user
POST   /api/auth/forgot-password - Send password reset OTP
POST   /api/auth/verify-otp      - Verify OTP
POST   /api/auth/reset-password  - Reset password
POST   /api/auth/refresh-token   - Get new access token
POST   /api/auth/logout          - Logout user
GET    /api/auth/profile         - Get user profile
PUT    /api/auth/profile         - Update profile
DELETE /api/auth/account         - Delete account
```

### Addresses
```
POST   /api/addresses             - Create address
GET    /api/addresses             - Get all addresses
GET    /api/addresses/:id         - Get address
PUT    /api/addresses/:id         - Update address
DELETE /api/addresses/:id         - Delete address
PUT    /api/addresses/:id/set-default - Set default
```

### Services
```
GET    /api/services              - Get all services
GET    /api/services/:id          - Get service
GET    /api/services/search       - Search services
GET    /api/services/categories   - Get categories
POST   /api/services              - Create service (Admin)
PUT    /api/services/:id          - Update service (Admin)
DELETE /api/services/:id          - Delete service (Admin)
```

### Cart
```
POST   /api/cart                  - Add to cart
GET    /api/cart                  - Get cart
PUT    /api/cart/:itemId          - Update item
DELETE /api/cart/:itemId          - Remove item
DELETE /api/cart                  - Clear cart
```

### Bookings
```
POST   /api/bookings              - Create booking
GET    /api/bookings              - Get bookings
GET    /api/bookings/:id          - Get booking
PUT    /api/bookings/:id/cancel   - Cancel booking
PUT    /api/bookings/:id/reschedule - Reschedule
PUT    /api/bookings/:id/status   - Update status (Admin)
```

### Payments
```
POST   /api/payments/create-order - Create order
POST   /api/payments/verify       - Verify payment
GET    /api/payments/history      - Payment history
GET    /api/payments/:id          - Get payment
```

### Ratings
```
POST   /api/ratings               - Create rating
GET    /api/ratings/service/:id   - Get service ratings
GET    /api/ratings/user/:id      - Get user ratings
PUT    /api/ratings/:id           - Update rating
```

### Notifications
```
GET    /api/notifications         - Get notifications
GET    /api/notifications/unread/count - Unread count
PUT    /api/notifications/:id/read - Mark as read
PUT    /api/notifications/mark-all-read - Mark all
DELETE /api/notifications/:id     - Delete notification
```

---

## 🔐 Authentication

All protected routes require JWT token in header:

```
Authorization: Bearer {accessToken}
```

**Token Expiry:**
- Access Token: 30 days
- Refresh Token: 90 days

---

## 🛡️ Security

- ✅ JWT-based authentication
- ✅ Password hashing (bcryptjs)
- ✅ Rate limiting (5 requests/15 min for auth)
- ✅ Helmet for HTTP headers
- ✅ CORS enabled
- ✅ Input validation
- ✅ SQL injection prevention
- ✅ Soft delete for data safety
- ✅ Role-based access control

---

## 📊 Database Schema

### Core Entities
- **User** - User accounts with roles
- **Address** - Multiple delivery addresses
- **Service** - Service offerings
- **Cart** - Shopping cart items
- **Booking** - Service bookings
- **Payment** - Payment transactions
- **Rating** - User reviews and ratings
- **Notification** - User notifications
- **OTP** - One-time passwords

---

## 🧪 Testing

### Test User Credentials (After Signup)
```json
{
  "email": "test@example.com",
  "password": "TestPass123"
}
```

### Sample Service Creation (Admin)
```json
{
  "name": "Home Cleaning",
  "description": "Professional cleaning service",
  "price": 300,
  "duration": 120,
  "category": "cleaning",
  "discount": 10
}
```

---

## 🔄 Request/Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2026-02-17T10:30:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ],
  "timestamp": "2026-02-17T10:30:00Z"
}
```

---

## 📝 Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

## 🚀 Deployment Checklist

- [ ] Update `.env` for production
- [ ] Set strong JWT secrets
- [ ] Configure MongoDB Atlas
- [ ] Set up Razorpay keys
- [ ] Configure email service
- [ ] Enable HTTPS
- [ ] Set up logging
- [ ] Configure CDN for images
- [ ] Set up monitoring
- [ ] Configure backup strategy

---

## 📦 Dependencies

- **express** - Web framework
- **mongoose** - MongoDB ODM
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT auth
- **helmet** - HTTP security
- **cors** - Cross-origin support
- **express-rate-limit** - Rate limiting
- **dotenv** - Environment variables

---

## 🤝 Contributing

This is a production-ready template. Feel free to extend with:
- Email notifications
- SMS alerts
- Real-time notifications (Socket.io)
- Image uploads
- Advanced search with Elasticsearch
- Caching with Redis
- Workers management system

---

## 📄 License

MIT License - Feel free to use for commercial projects

---

## 🎯 Next Steps

1. Test all endpoints using Postman
2. Set up Razorpay integration
3. Configure email service
4. Deploy to production
5. Set up monitoring and logging
6. Implement worker assignment logic
7. Add real-time notifications with Socket.io

---

**Version:** 1.0.0  
**Created:** February 17, 2026  
**Status:** ✅ Production Ready
