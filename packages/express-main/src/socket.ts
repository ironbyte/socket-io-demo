import { Server, type Socket } from 'socket.io';
import { type Server as HttpServer } from 'http';

export const createIo = (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  return io;
};
