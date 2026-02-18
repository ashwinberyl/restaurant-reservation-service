require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { sequelize } = require('./config/database');
const reservationRoutes = require('./routes/reservations');

const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors());
app.use(express.json());

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/reservations', reservationRoutes);

// The availability route is under /api/tables but handled by reservation service
app.use('/api', reservationRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'reservation-service' });
});

// Sync database & start server
async function startServer() {
    try {
        await sequelize.sync();
        console.log('Database synced successfully');

        if (process.env.NODE_ENV !== 'testing') {
            app.listen(PORT, () => {
                console.log(`Reservation service running on port ${PORT}`);
                console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
            });
        }
    } catch (err) {
        console.error('Failed to start server:', err);
        if (process.env.NODE_ENV !== 'testing') {
            process.exit(1);
        }
    }
}

startServer();

module.exports = app;
