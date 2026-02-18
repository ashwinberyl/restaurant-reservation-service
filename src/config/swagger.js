const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Restaurant Reservation Service API',
            version: '1.0.0',
            description: 'API for managing restaurant table reservations',
        },
        servers: [
            { url: `http://localhost:${process.env.PORT || 5002}` },
        ],
    },
    apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
