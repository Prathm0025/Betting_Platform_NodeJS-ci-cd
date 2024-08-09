import { config as conf } from "dotenv";
conf();

const _config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.MONGOURL,
  env: process.env.NODE_ENV,
  jwtSecret: process.env.JWT_SECRET,
  adminApiKey: process.env.ADMIN_API_KEY,
  oddsApi: {
    url: process.env.ODDS_API_URL,
    key: process.env.ODDS_API_KEY
  }
};

export const config = Object.freeze(_config);
