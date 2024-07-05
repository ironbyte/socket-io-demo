import express from 'express';
import http from 'http';
import { type Socket } from 'socket.io';
import { type User } from './types';
import Redis from 'ioredis';
import { createIo } from './socket';

import { authenticate } from './middlewares';

const app = express();
const server = http.createServer(app);
const io = createIo(server);
const redis = new Redis();

io.on('connection', async (socket: Socket) => {
  console.log(`User with socket id - ${socket.id} connected to "${socket.nsp.name}" namespace: `);
});

const buildsNamespace = io.of('/builds');

buildsNamespace.use(authenticate);

buildsNamespace.on('connection', async (socket: Socket) => {
  console.log('User connected to builds namespace | Socket ID: ', socket.id);

  const userJson = await redis.get(`user:${socket.id}`);
  if (!userJson) return;

  const user: User = JSON.parse(userJson);

  // Handle joining a build room
  socket.on('joinBuild', async (buildId: string) => {
    console.log(`User ${user.id} joining build ${buildId}`);

    // !Join the room for this build
    socket.join(`build:${buildId}`);

    // !Add user to the build's subscribers in Redis
    await redis.sadd(`build:${buildId}:subscribers`, socket.id);

    // !Add build to user's list of subscribed builds
    await redis.sadd(`user:${user.id}:builds`, buildId);

    console.log(`User ${user.id} joined build ${buildId}`);
  });

  // !Handle leaving a build room
  socket.on('leaveBuild', async (buildId: string) => {
    console.log(`User ${user.id} leaving build ${buildId}`);

    // !Leave the room for this build
    socket.leave(`build:${buildId}`);

    // Remove user from the build's subscribers in Redis
    await redis.srem(`build:${buildId}:subscribers`, socket.id);

    // !Remove build from user's list of subscribed builds
    await redis.srem(`user:${user.id}:builds`, buildId);

    console.log(`User ${user.id} left build ${buildId}`);
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected from builds namespace:', socket.id);
    const userJson = await redis.get(`user:${socket.id}`);
    if (userJson) {
      const user: User = JSON.parse(userJson);
      await redis.del(`user:${socket.id}`);

      // !Remove user from all build subscriptions
      const builds = await redis.smembers(`user:${user.id}:builds`);
      for (const buildId of builds) {
        await redis.srem(`build:${buildId}:subscribers`, socket.id);
      }

      await redis.del(`user:${user.id}:builds`);
    }
  });
});

app.get('/', (req, res) => {
  io.emit('Yo!', {
    data: 7777,
  });

  res.send("The world's ending");
});

app.post('/build/:id/status', express.json(), async (req, res) => {
  const buildId = req.params.id;
  const newStatus = req.body.status;

  // Update build status in Redis (if needed)
  // await redis.hset(`build:${buildId}`, 'status', newStatus);

  // Emit status change to all subscribers in the build's room
  buildsNamespace.to(`build:${buildId}`).emit('build:status:changed', {
    buildId,
    newStatus,
    timestamp: Date.now(),
  });

  res.status(200).json({ message: 'Status updated' });
});

const PORT = 7777;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
