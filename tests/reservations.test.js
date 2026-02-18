process.env.NODE_ENV = 'testing';

const request = require('supertest');
const app = require('../src/index');
const { sequelize } = require('../src/config/database');

beforeAll(async () => {
    await sequelize.sync({ force: true });
});

afterAll(async () => {
    await sequelize.close();
});

beforeEach(async () => {
    await sequelize.sync({ force: true });
});

// Mock fetch for table service calls
const mockTableResponse = (table) => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ table }),
    });
};

const mockTableNotFound = () => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Not found' }),
    });
};

describe('Health Check', () => {
    test('GET /health returns healthy', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('healthy');
    });
});

describe('POST /api/reservations', () => {
    const validReservation = {
        table_id: 1,
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        customer_phone: '+1234567890',
        guest_count: 3,
        reservation_date: '2026-12-25',
        slot_start_time: '18:00',
        special_requests: 'Window seat',
    };

    test('should create a reservation successfully', async () => {
        mockTableResponse({ id: 1, seating_capacity: 4, is_active: true });

        const res = await request(app)
            .post('/api/reservations')
            .send(validReservation);

        expect(res.status).toBe(201);
        expect(res.body.reservation.customer_name).toBe('John Doe');
        expect(res.body.reservation.slot_end_time).toContain('20:00');
        expect(res.body.reservation.status).toBe('confirmed');
    });

    test('should reject when guest count exceeds capacity', async () => {
        mockTableResponse({ id: 1, seating_capacity: 2, is_active: true });

        const res = await request(app)
            .post('/api/reservations')
            .send({ ...validReservation, guest_count: 5 });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('exceeds table capacity');
    });

    test('should reject when table not found', async () => {
        mockTableNotFound();

        const res = await request(app)
            .post('/api/reservations')
            .send(validReservation);

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('not found');
    });

    test('should prevent double-booking', async () => {
        mockTableResponse({ id: 1, seating_capacity: 4, is_active: true });

        await request(app).post('/api/reservations').send(validReservation);
        const res = await request(app).post('/api/reservations').send(validReservation);

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('already booked');
    });

    test('should reject invalid email', async () => {
        const res = await request(app)
            .post('/api/reservations')
            .send({ ...validReservation, customer_email: 'invalid' });

        expect(res.status).toBe(400);
    });

    test('should reject missing required fields', async () => {
        const res = await request(app).post('/api/reservations').send({});
        expect(res.status).toBe(400);
    });

    test('should reject inactive table', async () => {
        mockTableResponse({ id: 1, seating_capacity: 4, is_active: false });

        const res = await request(app)
            .post('/api/reservations')
            .send(validReservation);

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('not active');
    });
});

describe('GET /api/reservations', () => {
    test('should return empty list', async () => {
        const res = await request(app).get('/api/reservations');
        expect(res.status).toBe(200);
        expect(res.body.reservations).toHaveLength(0);
    });

    test('should return reservations with pagination', async () => {
        mockTableResponse({ id: 1, seating_capacity: 4, is_active: true });

        await request(app).post('/api/reservations').send({
            table_id: 1,
            customer_name: 'Jane Doe',
            customer_email: 'jane@example.com',
            customer_phone: '+0987654321',
            guest_count: 2,
            reservation_date: '2026-12-25',
            slot_start_time: '14:00',
        });

        const res = await request(app).get('/api/reservations');
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);
        expect(res.body.reservations[0].customer_name).toBe('Jane Doe');
    });

    test('should filter by date', async () => {
        mockTableResponse({ id: 1, seating_capacity: 4, is_active: true });

        await request(app).post('/api/reservations').send({
            table_id: 1,
            customer_name: 'Test',
            customer_email: 'test@test.com',
            customer_phone: '+1111111111',
            guest_count: 1,
            reservation_date: '2026-12-25',
            slot_start_time: '10:00',
        });

        const res = await request(app).get('/api/reservations?date=2026-12-25');
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);

        const res2 = await request(app).get('/api/reservations?date=2026-12-26');
        expect(res2.status).toBe(200);
        expect(res2.body.total).toBe(0);
    });
});

describe('GET /api/reservations/:id', () => {
    test('should return reservation details', async () => {
        mockTableResponse({ id: 1, seating_capacity: 4, is_active: true });

        const createRes = await request(app).post('/api/reservations').send({
            table_id: 1,
            customer_name: 'Alice',
            customer_email: 'alice@example.com',
            customer_phone: '+5555555555',
            guest_count: 2,
            reservation_date: '2026-12-25',
            slot_start_time: '16:00',
        });

        const id = createRes.body.reservation.id;
        const res = await request(app).get(`/api/reservations/${id}`);
        expect(res.status).toBe(200);
        expect(res.body.reservation.customer_name).toBe('Alice');
        expect(res.body.reservation.table).toBeDefined();
    });

    test('should return 404 for non-existent reservation', async () => {
        const res = await request(app).get('/api/reservations/9999');
        expect(res.status).toBe(404);
    });
});

describe('PATCH /api/reservations/:id/cancel', () => {
    test('should cancel a future reservation', async () => {
        mockTableResponse({ id: 1, seating_capacity: 4, is_active: true });

        const createRes = await request(app).post('/api/reservations').send({
            table_id: 1,
            customer_name: 'Bob',
            customer_email: 'bob@example.com',
            customer_phone: '+3333333333',
            guest_count: 3,
            reservation_date: '2026-12-25',
            slot_start_time: '18:00',
        });

        const id = createRes.body.reservation.id;
        const res = await request(app).patch(`/api/reservations/${id}/cancel`);
        expect(res.status).toBe(200);
        expect(res.body.reservation.status).toBe('cancelled');
    });

    test('should not cancel already cancelled reservation', async () => {
        mockTableResponse({ id: 1, seating_capacity: 4, is_active: true });

        const createRes = await request(app).post('/api/reservations').send({
            table_id: 1,
            customer_name: 'Eve',
            customer_email: 'eve@example.com',
            customer_phone: '+4444444444',
            guest_count: 1,
            reservation_date: '2026-12-25',
            slot_start_time: '20:00',
        });

        const id = createRes.body.reservation.id;
        await request(app).patch(`/api/reservations/${id}/cancel`);
        const res = await request(app).patch(`/api/reservations/${id}/cancel`);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('already cancelled');
    });

    test('should return 404 for non-existent reservation', async () => {
        const res = await request(app).patch('/api/reservations/9999/cancel');
        expect(res.status).toBe(404);
    });
});

describe('GET /api/tables/:tableId/availability', () => {
    test('should return all slots available', async () => {
        const res = await request(app).get('/api/tables/1/availability?date=2026-12-25');
        expect(res.status).toBe(200);
        expect(res.body.slots).toHaveLength(6);
        expect(res.body.slots.every((s) => s.available)).toBe(true);
    });

    test('should show booked slot as unavailable', async () => {
        mockTableResponse({ id: 1, seating_capacity: 4, is_active: true });

        await request(app).post('/api/reservations').send({
            table_id: 1,
            customer_name: 'Test',
            customer_email: 'test@test.com',
            customer_phone: '+1111111111',
            guest_count: 2,
            reservation_date: '2026-12-25',
            slot_start_time: '18:00',
        });

        const res = await request(app).get('/api/tables/1/availability?date=2026-12-25');
        expect(res.status).toBe(200);
        const slot18 = res.body.slots.find((s) => s.start_time === '18:00');
        expect(slot18.available).toBe(false);
    });

    test('should require date parameter', async () => {
        const res = await request(app).get('/api/tables/1/availability');
        expect(res.status).toBe(400);
    });
});
