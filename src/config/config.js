"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const _config = {
    port: process.env.PORT || 5000,
    databaseUrl: process.env.MONGOURL,
    env: process.env.NODE_ENV,
    jwtSecret: process.env.JWT_SECRET,
    oddsApiKey: process.env.ODDS_API_KEY,
    adminApiKey: process.env.ADMIN_API_KEY
};
exports.config = Object.freeze(_config);
