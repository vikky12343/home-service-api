# 🚀 Quick Start Guide

## Get Started in 2 Minutes

### 1. Server Already Running ✅
```
🚀 Server running on http://localhost:5000
✓ MongoDB connected
✓ All modules loaded
```

---

## 📋 Test API Endpoints

### Using Postman (Recommended)
1. Import `POSTMAN_COLLECTION.json`
2. Set variables: `base_url`, `accessToken`, `refreshToken`
3. Test endpoints

### Using PowerShell

#### Step 1: Signup
```powershell
$body = @{
  name="John Doe"
  email="john@example.com"
  phone="9999999999"
  password="Pass123"
  confirmPassword="Pass123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/auth/signup" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"
```

#### Step 2: Login
```powershell
$body = @{
  email="john@example.com"
  password="Pass123"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"

$token = ($response.Content | ConvertFrom-Json).data.accessToken
Write-Host "Token: $token"
```

#### Step 3: Get Profile
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/auth/profile" `
  -Method GET `
  -Headers @{Authorization="Bearer $token"}
```

---

## 📚 API Endpoints Summary

### Authentication (10 endpoints)
```
POST   /api/auth/signup              - Register
POST   /api/auth/login               - Login
GET    /api/auth/profile             - Get profile
PUT    /api/auth/profile             - Update profile
POST   /api/auth/forgot-password     - Reset OTP
POST   /api/auth/verify-otp          - Verify
POST   /api/auth/reset-password      - New password
POST   /api/auth/refresh-token       - Refresh token
POST   /api/auth/logout              - Logout
DELETE /api/auth/account             - Delete account
```

### Services (7 endpoints)
```
GET    /api/services                 - All services
GET    /api/services/:id             - Single service
GET    /api/services/search          - Search
GET    /api/services/categories      - Categories
POST   /api/services                 - Create (Admin)
PUT    /api/services/:id             - Update (Admin)
DELETE /api/services/:id             - Delete (Admin)
```

### Cart (5 endpoints)
```
POST   /api/cart                     - Add item
GET    /api/cart                     - Get cart
PUT    /api/cart/:itemId             - Update item
DELETE /api/cart/:itemId             - Remove item
DELETE /api/cart                     - Clear cart
```

### Addresses (6 endpoints)
```
POST   /api/addresses                - Create
GET    /api/addresses                - Get all
GET    /api/addresses/:id            - Get one
PUT    /api/addresses/:id            - Update
DELETE /api/addresses/:id            - Delete
PUT    /api/addresses/:id/set-default - Set default
```

### Bookings (6 endpoints)
```
POST   /api/bookings                 - Create
GET    /api/bookings                 - Get all
GET    /api/bookings/:id             - Get one
PUT    /api/bookings/:id/cancel      - Cancel
PUT    /api/bookings/:id/reschedule  - Reschedule
PUT    /api/bookings/:id/status      - Status (Admin)
```

### Ratings (4 endpoints)
```
POST   /api/ratings                  - Create
GET    /api/ratings/service/:id      - Service ratings
GET    /api/ratings/user/:id         - User ratings
PUT    /api/ratings/:id              - Update
```

### Notifications (5 endpoints)
```
GET    /api/notifications            - Get all
GET    /api/notifications/unread/count - Unread
PUT    /api/notifications/:id/read   - Mark read
PUT    /api/notifications/mark-all-read - All read
DELETE /api/notifications/:id        - Delete
```

### Payments (4 endpoints)
```
POST   /api/payments/create-order    - Create order
POST   /api/payments/verify          - Verify payment
GET    /api/payments/history         - History
GET    /api/payments/:id             - Get payment
```

**Total: 47 Endpoints** ✅

---

## 🔐 Authentication

All requests need JWT token:

```
Headers:
Authorization: Bearer {accessToken}
```

Get token from login response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

---

## 📁 File Locations

| File | Purpose |
|------|---------|
| [server.js](server.js) | Main server |
| [.env](.env) | Configuration |
| [README.md](README.md) | Setup guide |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Full docs |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Project summary |
| [POSTMAN_COLLECTION.json](POSTMAN_COLLECTION.json) | Postman templates |

---

## 🛠️ Common Tasks

### Add New Service (Admin)
```powershell
$body = @{
  name="Home Cleaning"
  description="Professional cleaning"
  price=300
  duration=120
  category="cleaning"
  discount=10
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/services" `
  -Method POST `
  -Body $body `
  -Headers @{Authorization="Bearer $adminToken"} `
  -ContentType "application/json"
```

### Create Address
```powershell
$body = @{
  fullName="John Doe"
  phone="9999999999"
  houseNo="123"
  area="Downtown"
  city="New York"
  state="NY"
  pincode="100001"
  isDefault=$true
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/addresses" `
  -Method POST `
  -Body $body `
  -Headers @{Authorization="Bearer $token"} `
  -ContentType "application/json"
```

### Get Services with Filter
```
http://localhost:5000/api/services?category=cleaning&minPrice=100&maxPrice=500
```

### Create Booking
```powershell
$body = @{
  serviceId="..."
  addressId="..."
  date="2026-02-20"
  time="10:00 AM"
  notes="Ring bell twice"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/bookings" `
  -Method POST `
  -Body $body `
  -Headers @{Authorization="Bearer $token"} `
  -ContentType "application/json"
```

---

## 🎯 Next Steps

1. **Test APIs** - Use Postman collection
2. **Create Test Data** - Add services, addresses
3. **Test Workflow** - Signup → Login → Browse → Cart → Book
4. **Configure Payment** - Setup Razorpay keys
5. **Deploy** - Push to production

---

## 🐛 Troubleshooting

### Server Not Running?
```powershell
cd c:\Users\vikky.kumar\home-service-api
node server.js
```

### MongoDB Connection Error?
- Check `.env` DATABASE_URL
- Ensure IP is whitelisted on MongoDB Atlas
- Verify connection string format

### Token Expired?
- Use `/api/auth/refresh-token` endpoint
- Pass the `refreshToken` from login

### 404 Error?
- Check endpoint URL spelling
- Ensure Authorization header is set
- Check request method (GET, POST, PUT, DELETE)

---

## 📞 Resources

- **Full Documentation:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Setup Guide:** [README.md](README.md)
- **Project Summary:** [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Postman Collection:** [POSTMAN_COLLECTION.json](POSTMAN_COLLECTION.json)

---

## ✅ Verify Installation

### Check Server Health
```
GET http://localhost:5000/api/health
```

Response:
```json
{
  "status": "Server is running",
  "timestamp": "2026-02-17T10:30:00Z"
}
```

---

## 🎉 You're Ready!

Your Home Service Platform API is fully operational! 🚀

- ✅ Server running on port 5000
- ✅ MongoDB connected
- ✅ 47 endpoints available
- ✅ JWT authentication enabled
- ✅ Rate limiting active
- ✅ Error handling configured

**Start testing now!** 💪
