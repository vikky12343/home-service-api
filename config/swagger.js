const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Home Service API',
      version: '1.0.0',
      description: 'Complete API documentation for Home Service platform',
      contact: {
        name: 'API Support',
        email: 'support@homeservice.com'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:5000',
        description: process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['customer', 'provider'] },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Service: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            basePrice: { type: 'number' },
            provider: { type: 'string' },
            ratings: { type: 'number' },
            totalReviews: { type: 'number' }
          }
        },
        Booking: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            service: { type: 'string' },
            customer: { type: 'string' },
            provider: { type: 'string' },
            scheduledDate: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'completed', 'cancelled'] },
            totalPrice: { type: 'number' }
          }
        }
      }
    }
  },
  apis: [
    './routes/authRoutes.js',
    './routes/addressRoutes.js',
    './routes/serviceRoutes.js',
    './routes/cartRoutes.js',
    './routes/bookingRoutes.js',
    './routes/ratingRoutes.js',
    './routes/notificationRoutes.js',
    './routes/paymentRoutes.js'
  ]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = swaggerSpec;
