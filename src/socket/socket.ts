import { Server, Socket } from "socket.io";
import { verifySocketToken } from "./socketMiddleware";

export let users: Map<string, Socket> = new Map();

const socketController = (io: Server) => {
  // socket authentication middleware
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const userAgent = socket.request.headers["user-agent"];
      const decoded = await verifySocketToken(socket);
      (socket as any).decoded = decoded;
      (socket as any).userAgent = userAgent;
      next();
    } catch (error) {
      console.error("Authentication error:", error.message);
      socket.disconnect();
      next(error);
    }
  });

  // Error handling middleware
  io.use((socket: Socket, next: (err?: Error) => void) => {
    socket.on("error", (err: Error) => {
      console.error("Socket Error:", err);
      socket.disconnect(true);
    });
    next();
  });

  io.on("connection", async (socket) => {
    const decoded = (socket as any).decoded;
    if (!decoded || !decoded.username || !decoded.role) {
      console.error("Connection rejected: missing required fields in token");
      socket.disconnect(true);
      return;
    }

    const username = decoded.username;
    const existingUser = users.get(username);

    if (existingUser) {

      users.set(username, socket);
      console.log(`Updated socket for user ${username}`);


      // socket.disconnect(true);
      return;
    } else {
      users.set(username, socket);
    }
    console.log("MAP", users);
    console.log(`Player ${username} entered the platform.`);
  });
};

export default socketController;
