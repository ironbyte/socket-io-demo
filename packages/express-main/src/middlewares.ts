import { type Socket } from 'socket.io';
import { jwtDecode } from 'jwt-decode';

import { redisClient } from './redis';

// !This function authenticates a WebSocket connection using a JWT token,
// !verifies the user's identity, and stores the user's information ({ userId, socketId }) in Redis
export const authenticate = async (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token;

  // !In Production, use the provided JWT secret to verify the user's access token
  const decoded = jwtDecode(token);
  const userId = decoded.sub;

  if (!userId) {
    console.error('Authentication failed', socket.handshake);
    return next(new Error('Authentication failed'));
  }
  await redisClient.set(`user:${socket.id}`, JSON.stringify({ id: userId, socketId: socket.id }));

  next();
};
