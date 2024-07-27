import server from "./src/server"
import { config } from "./src/config/config";

const startServer = async () => {
  server.listen(config.port, () => {
    console.log("Listening on port : ", config.port);
  });
};

startServer();
