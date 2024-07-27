import { config as conf } from "dotenv";
conf();

const _config = {
  port: process.env.PORT || 5000,
};

export const config = Object.freeze(_config);
