const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const env = process.env.NODE_ENV || 'development';

// Use STRING for SQLite (testing), ENUM for Postgres
const statusType = env === 'testing'
    ? DataTypes.STRING(20)
    : DataTypes.ENUM('confirmed', 'cancelled');

const Reservation = sequelize.define('Reservation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    table_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    customer_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    customer_email: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    customer_phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    guest_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    reservation_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    slot_start_time: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    slot_end_time: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    status: {
        type: statusType,
        defaultValue: 'confirmed',
        allowNull: false,
    },
    special_requests: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'reservations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Reservation;
