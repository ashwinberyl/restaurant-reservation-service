const Joi = require('joi');

const createReservationSchema = Joi.object({
    table_id: Joi.number().integer().positive().required(),
    customer_name: Joi.string().min(1).max(100).required(),
    customer_email: Joi.string().email().required(),
    customer_phone: Joi.string().min(7).max(20).required(),
    guest_count: Joi.number().integer().min(1).max(20).required(),
    reservation_date: Joi.date().iso().min('now').required()
        .messages({ 'date.min': 'Reservation date must be today or in the future' }),
    slot_start_time: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .required()
        .messages({ 'string.pattern.base': 'slot_start_time must be in HH:MM format' }),
    special_requests: Joi.string().max(500).allow('', null),
});

const queryReservationsSchema = Joi.object({
    date: Joi.date().iso(),
    table_id: Joi.number().integer().positive(),
    status: Joi.string().valid('confirmed', 'cancelled'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
});

module.exports = { createReservationSchema, queryReservationsSchema };
