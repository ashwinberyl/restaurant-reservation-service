require('dotenv').config();
const { Sequelize } = require('sequelize');

const env = process.env.NODE_ENV || 'development';

const config = {
    development: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/restaurant_db',
        dialect: 'postgres',
        logging: console.log,
    },
    testing: {
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
    },
    production: {
        url: process.env.DATABASE_URL,
        dialect: 'postgres',
        logging: false,
        // dialectOptions: {
        //     ssl: { rejectUnauthorized: false },
        // },
    },
};

const currentConfig = config[env];

let sequelize;
if (currentConfig.url) {
    sequelize = new Sequelize(currentConfig.url, {
        dialect: currentConfig.dialect,
        logging: currentConfig.logging,
        dialectOptions: currentConfig.dialectOptions,
    });
} else {
    sequelize = new Sequelize({
        dialect: currentConfig.dialect,
        storage: currentConfig.storage,
        logging: currentConfig.logging,
    });
}

module.exports = { sequelize, config: currentConfig };
