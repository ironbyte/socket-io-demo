import { Server, type Socket } from 'socket.io';
import { type Server as HttpServer } from 'http';

// Credentials will be blocked from being sent to the server by Chrome if the origin is set to '*'
export const createIo = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: 'https://localhost:9000',
      credentials: true,
    },
  });

  return io;
};
