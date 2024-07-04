import express from "express";
import http from "http";
import { Server, type Socket } from "socket.io";
import { jwtDecode } from "jwt-decode";
import { type User, type Build } from "./types";

// "DB"
const users: Map<string, User> = new Map();
const builds: Map<string, Build> = new Map();
const userBuilds: Map<string, Set<string>> = new Map();

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Function to get all socket IDs subscribed to a project
function getProjectSubscribers(projectId: string): string[] {
  const subscriberSocketIds: string[] = [];
  userBuilds.forEach((projects, userId) => {
    if (projects.has(projectId)) {
      const user = Array.from(users.values()).find((u) => u.id === userId);
      if (user) {
        subscriberSocketIds.push(user.socketId);
      }
    }
  });
  return subscriberSocketIds;
}

const authenticate = (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth.token;
  const decoded = jwtDecode(token);
  const userId = decoded.sub;

  if (!userId) {
    console.error("Authentication failed", socket.handshake);

    return next(new Error("Authentication failed"));
  }

  users.set(socket.id, { id: userId, socketId: socket.id });
  userBuilds.set(userId, new Set());

  next();
};

io.use(authenticate);

io.on("connection", (socket: Socket) => {
  console.log("User connected: ", socket.id);

  const user = users.get(socket.id);
  if (!user) return;

  const userBuildIds = ["1", "2", "3"];

  userBuildIds.forEach((buildId) => {
    if (!builds.has(buildId)) {
      builds.set(buildId, { id: buildId });
    }

    userBuilds.get(user.id)?.add(buildId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      userBuilds.delete(user.id);
    }
  });
});

app.get("/", (req, res) => {
  io.emit("Yo, what's up bro?", {
    data: 7777,
  });

  res.send("Yo man!");
});

app.post("/build/:id/status", express.json(), (req, res) => {
  const buildId = req.params.id;
  const newStatus = req.body.status;

  console.log(builds);

  if (!builds.has(buildId)) {
    builds.set(buildId, { id: buildId });
  }

  const build = builds.get(buildId);

  const subscribers = getProjectSubscribers(buildId);

  // Emit status change to all subscribers
  subscribers.forEach((socketId) => {
    io.to(socketId).emit("projectStatusChange", {
      buildId,
      newStatus,
      timestamp: Date.now(),
    });
  });

  res.status(200).json({ message: "Status updated" });
});

const PORT = 7777;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
