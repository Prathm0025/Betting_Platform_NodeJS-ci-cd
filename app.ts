import server, { redisClient } from "./src/server"
import { config } from "./src/config/config";
import connectDB from "./src/config/db";

const startServer = async () => {
  await redisClient.connect();
  console.log("Connected to Redis");

  await connectDB();

  server.listen(config.port, () => {
    console.log("Listening on port : ", config.port);
  });
};

startServer();
