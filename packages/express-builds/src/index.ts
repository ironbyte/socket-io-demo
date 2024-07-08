import express from 'express';
import { redis } from './redis';

export const CHANNEL = 'ch:Builds';

const app = express();

app.post('/build/:id/status', express.json(), async (req, res) => {
  const buildId = req.params.id;
  const newStatus = req.body.status;

  const eventPayload = {
    event: 'build:status-updated',
    payload: {
      buildId,
      newStatus,
      timeCreated: new Date(),
    },
  };

  // !Publish builds API event to the Builds channel
  redis.publish(CHANNEL, JSON.stringify(eventPayload));
  console.log(`Published Builds API event to ${CHANNEL} channel`);

  return res.status(200).json({ message: 'Status updated' });
});

const PORT = 8888;

app.listen(PORT, () => {
  console.log(`Express Builds API server listening on port ${PORT}`);
});
