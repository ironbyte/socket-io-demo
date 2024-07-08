import express from 'express';
import http from 'http';
import { type Socket } from 'socket.io';
import { type User } from './types';
import Redis from 'ioredis';
import { createIo } from './socket';
import { redisSubscriber, redisClient } from './redis';
import { authenticate } from './middlewares';

const app = express();
const server = http.createServer(app);
const io = createIo(server);

io.on('connection', async (socket: Socket) => {
  console.log(`User with socket id - ${socket.id} connected to "${socket.nsp.name}" namespace: `);
});

const buildsNamespace = io.of('/builds');

buildsNamespace.use(authenticate);

redisSubscriber.subscribe('ch:Builds');

redisSubscriber.on('message', (channel, message) => {
  if (channel === 'ch:Builds') {
    console.log('EMITTING');

    buildsNamespace.to(`build:${5}`).emit('build:status:changed', JSON.parse(message));
  }
});

buildsNamespace.on('connection', async (socket: Socket) => {
  console.log('User connected to builds namespace | Socket ID: ', socket.id);

  const userJson = await redisClient.get(`user:${socket.id}`);
  if (!userJson) return;

  const user: User = JSON.parse(userJson);

  // Handle joining a build room
  socket.on('joinBuild', async (buildId: string) => {
    console.log(`User ${user.id} joining build ${buildId}`);

    // !Join the room for this build
    socket.join(`build:${buildId}`);

    // !Add user to the build's subscribers in Redis
    await redisClient.sadd(`build:${buildId}:subscribers`, socket.id);

    // !Add build to user's list of subscribed builds
    await redisClient.sadd(`user:${user.id}:builds`, buildId);

    console.log(`User ${user.id} joined build ${buildId}`);
  });

  // !Handle leaving a build room
  socket.on('leaveBuild', async (buildId: string) => {
    console.log(`User ${user.id} leaving build ${buildId}`);

    // !Leave the room for this build
    socket.leave(`build:${buildId}`);

    // Remove user from the build's subscribers in Redis
    await redisClient.srem(`build:${buildId}:subscribers`, socket.id);

    // !Remove build from user's list of subscribed builds
    await redisClient.srem(`user:${user.id}:builds`, buildId);

    console.log(`User ${user.id} left build ${buildId}`);
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected from builds namespace:', socket.id);
    const userJson = await redisClient.get(`user:${socket.id}`);
    if (userJson) {
      const user: User = JSON.parse(userJson);
      await redisClient.del(`user:${socket.id}`);

      // !Remove user from all build subscriptions
      const builds = await redisClient.smembers(`user:${user.id}:builds`);
      for (const buildId of builds) {
        await redisClient.srem(`build:${buildId}:subscribers`, socket.id);
      }

      await redisClient.del(`user:${user.id}:builds`);
    }
  });
});

app.get('/', (req, res) => {
  io.emit('api:get:received', {
    data: 'Yo man',
  });

  res.send("The world's ending");
});

const PORT = 7777;

server.listen(PORT, () => {
  console.log(`Express Main API server listening on port ${PORT}`);
});
