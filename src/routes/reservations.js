const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Reservation = require('../models/Reservation');
const {
    createReservationSchema,
    queryReservationsSchema,
} = require('../validators/reservation');

/**
 * @swagger
 * components:
 *   schemas:
 *     Reservation:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         table_id:
 *           type: integer
 *         customer_name:
 *           type: string
 *         customer_email:
 *           type: string
 *         customer_phone:
 *           type: string
 *         guest_count:
 *           type: integer
 *         reservation_date:
 *           type: string
 *           format: date
 *         slot_start_time:
 *           type: string
 *           example: "18:00"
 *         slot_end_time:
 *           type: string
 *           example: "20:00"
 *         status:
 *           type: string
 *           enum: [confirmed, cancelled]
 *         special_requests:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

// Helper: calculate end time (2-hour slot)
function calculateEndTime(startTime) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = (hours + 2) % 24;
    return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Helper: fetch table info from Table Service
async function fetchTableInfo(tableId) {
    const tableServiceUrl = process.env.TABLE_SERVICE_URL || 'http://localhost:5001';
    try {
        const response = await fetch(`${tableServiceUrl}/api/tables/${tableId}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.table;
    } catch {
        return null;
    }
}

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Book a table
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - table_id
 *               - customer_name
 *               - customer_email
 *               - customer_phone
 *               - guest_count
 *               - reservation_date
 *               - slot_start_time
 *             properties:
 *               table_id:
 *                 type: integer
 *                 example: 1
 *               customer_name:
 *                 type: string
 *                 example: "John Doe"
 *               customer_email:
 *                 type: string
 *                 example: "john@example.com"
 *               customer_phone:
 *                 type: string
 *                 example: "+1234567890"
 *               guest_count:
 *                 type: integer
 *                 example: 3
 *               reservation_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-01"
 *               slot_start_time:
 *                 type: string
 *                 example: "18:00"
 *               special_requests:
 *                 type: string
 *                 example: "Window seat please"
 *     responses:
 *       201:
 *         description: Reservation created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Double-booking conflict
 */
router.post('/', async (req, res) => {
    try {
        // Validate input
        const { error, value } = createReservationSchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                errors: error.details.map((d) => d.message),
            });
        }

        // Fetch table info to validate capacity
        const table = await fetchTableInfo(value.table_id);
        if (!table) {
            return res.status(400).json({ error: `Table ${value.table_id} not found or unavailable` });
        }
        if (!table.is_active) {
            return res.status(400).json({ error: `Table ${value.table_id} is not active` });
        }
        if (value.guest_count > table.seating_capacity) {
            return res.status(400).json({
                error: `Guest count (${value.guest_count}) exceeds table capacity (${table.seating_capacity})`,
            });
        }

        // Calculate end time (fixed 2-hour slot)
        const slotEndTime = calculateEndTime(value.slot_start_time);

        // Check for double-booking
        const existingReservation = await Reservation.findOne({
            where: {
                table_id: value.table_id,
                reservation_date: value.reservation_date,
                slot_start_time: value.slot_start_time,
                status: 'confirmed',
            },
        });
        if (existingReservation) {
            return res.status(409).json({
                error: 'This table is already booked for the requested date and time slot',
            });
        }

        // Create reservation
        const reservation = await Reservation.create({
            ...value,
            slot_end_time: slotEndTime,
            status: 'confirmed',
        });

        return res.status(201).json({
            message: 'Reservation created successfully',
            reservation,
        });
    } catch (err) {
        console.error('Create reservation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/reservations:
 *   get:
 *     summary: List reservations with filters
 *     tags: [Reservations]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: table_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [confirmed, cancelled]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of reservations
 */
router.get('/', async (req, res) => {
    try {
        const { error, value } = queryReservationsSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ errors: error.details.map((d) => d.message) });
        }

        const where = {};
        if (value.date) where.reservation_date = value.date;
        if (value.table_id) where.table_id = value.table_id;
        if (value.status) where.status = value.status;

        const offset = (value.page - 1) * value.limit;
        const { rows, count } = await Reservation.findAndCountAll({
            where,
            order: [['reservation_date', 'ASC'], ['slot_start_time', 'ASC']],
            limit: value.limit,
            offset,
        });

        return res.status(200).json({
            reservations: rows,
            total: count,
            page: value.page,
            totalPages: Math.ceil(count / value.limit),
        });
    } catch (err) {
        console.error('List reservations error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/reservations/{id}:
 *   get:
 *     summary: Get reservation details
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reservation details with table info
 *       404:
 *         description: Reservation not found
 */
router.get('/:id', async (req, res) => {
    try {
        const reservation = await Reservation.findByPk(req.params.id);
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        // Enrich with table info
        const table = await fetchTableInfo(reservation.table_id);

        return res.status(200).json({
            reservation: {
                ...reservation.toJSON(),
                table: table || { id: reservation.table_id, info: 'Table details unavailable' },
            },
        });
    } catch (err) {
        console.error('Get reservation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/reservations/{id}/cancel:
 *   patch:
 *     summary: Cancel a reservation (1hr+ before slot)
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reservation cancelled
 *       400:
 *         description: Cannot cancel within 1 hour of slot
 *       404:
 *         description: Reservation not found
 */
router.patch('/:id/cancel', async (req, res) => {
    try {
        const reservation = await Reservation.findByPk(req.params.id);
        if (!reservation) {
            return res.status(404).json({ error: 'Reservation not found' });
        }

        if (reservation.status === 'cancelled') {
            return res.status(400).json({ error: 'Reservation is already cancelled' });
        }

        // Check 1-hour cancellation rule
        const reservationDateTime = new Date(
            `${reservation.reservation_date}T${reservation.slot_start_time}`
        );
        const now = new Date();
        const diffMs = reservationDateTime - now;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 1) {
            return res.status(400).json({
                error: 'Reservations can only be cancelled at least 1 hour before the reserved time',
            });
        }

        reservation.status = 'cancelled';
        await reservation.save();

        return res.status(200).json({
            message: 'Reservation cancelled successfully',
            reservation,
        });
    } catch (err) {
        console.error('Cancel reservation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /api/tables/{tableId}/availability:
 *   get:
 *     summary: Check table availability for a date
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Availability slots
 *       400:
 *         description: Missing date parameter
 */
router.get('/tables/:tableId/availability', async (req, res) => {
    try {
        const { tableId } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ error: 'date query parameter is required' });
        }

        // Define available time slots (restaurant hours: 10:00 - 22:00, 2hr slots)
        const allSlots = [
            '10:00', '12:00', '14:00', '16:00', '18:00', '20:00',
        ];

        // Find booked slots for this table and date
        const bookedReservations = await Reservation.findAll({
            where: {
                table_id: tableId,
                reservation_date: date,
                status: 'confirmed',
            },
            attributes: ['slot_start_time', 'slot_end_time'],
        });

        const bookedSlotTimes = bookedReservations.map((r) => r.slot_start_time.substring(0, 5));

        const slots = allSlots.map((slot) => ({
            start_time: slot,
            end_time: calculateEndTime(slot),
            available: !bookedSlotTimes.includes(slot),
        }));

        return res.status(200).json({
            table_id: parseInt(tableId),
            date,
            slots,
        });
    } catch (err) {
        console.error('Check availability error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
