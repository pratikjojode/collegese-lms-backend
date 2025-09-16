import { Server, Socket } from "socket.io";
import chalk from "chalk";

const ICE_SERVER_CONFIG = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    },
  ]
};

interface JoinRoomPayload {
  roomId: string;
  userId: string;
  userName?: string;
  role?: string;
}

interface UserState {
  userId: string;
  userName: string;
  socketId: string;
  role: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  joinedAt: string;
}

interface SignalingMessage {
  to: string;
  from?: string;
  fromUserId?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export const initWebRTCSignaling = (io: Server) => {
  const userToSocket = new Map<string, string>();
  const roomUsers = new Map<string, Map<string, UserState>>();

  const getRoomUsers = (roomId: string): Map<string, UserState> => {
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Map());
    }
    return roomUsers.get(roomId)!;
  };

  const removeUserFromRoom = (roomId: string, userId: string) => {
    const users = getRoomUsers(roomId);
    users.delete(userId);
    if (users.size === 0) {
      roomUsers.delete(roomId);
      console.log(chalk.gray(`🗑️  Room ${roomId} deleted (empty)`));
    }
  };

  const cleanupUserConnections = (userId: string, currentSocketId: string) => {
    roomUsers.forEach((users, roomId) => {
      const userState = users.get(userId);
      if (userState && userState.socketId !== currentSocketId) {
        users.delete(userId);
        console.log(chalk.yellow(`🧹 Cleaned up old user state for ${userId} in room ${roomId}`));
      }
    });

    const existingSocketId = userToSocket.get(userId);
    if (existingSocketId && existingSocketId !== currentSocketId) {
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        console.log(chalk.yellow(`🔄 Disconnecting existing connection for user ${userId}`));
        existingSocket.disconnect(true);
      }
    }
    userToSocket.set(userId, currentSocketId);
  };

  const broadcastToRoom = (roomId: string, event: string, data: any, excludeSocketId?: string) => {
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (!roomSockets) return;

    roomSockets.forEach(socketId => {
      if (socketId !== excludeSocketId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(event, data);
        }
      }
    });
  };

  const safeEmitTo = (fromSocket: Socket, targetSocketId: string, event: string, payload: any): boolean => {
    try {
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!targetSocket) {
        console.warn(chalk.red(`❌ Target socket ${targetSocketId} not found for event ${event}`));
        fromSocket.emit("signal-error", {
          message: "Target user not connected",
          to: targetSocketId,
          event,
          timestamp: new Date().toISOString()
        });
        return false;
      }

      const fromRoomId = fromSocket.data.roomId;
      const targetRoomId = targetSocket.data.roomId;

      if (fromRoomId && targetRoomId && fromRoomId !== targetRoomId) {
        console.warn(chalk.yellow(`⚠️  Room mismatch: ${fromSocket.id} (${fromRoomId}) -> ${targetSocketId} (${targetRoomId})`));
        return false;
      }

      targetSocket.emit(event, {
        ...payload,
        from: fromSocket.id,
        fromUserId: fromSocket.data.userId
      });

      return true;
    } catch (err) {
      console.error(chalk.red(`❌ Error emitting ${event} to ${targetSocketId}:`, err));
      fromSocket.emit("signal-error", {
        message: "Failed to deliver signal",
        to: targetSocketId,
        event,
        error: err instanceof Error ? err.message : "Unknown error"
      });
      return false;
    }
  };

  io.on("connection", (socket: Socket) => {
    console.log(chalk.green(`✅ Client connected: ${socket.id}`));
    console.log(chalk.blue(`📍 Origin: ${socket.handshake.headers.origin}`));

    socket.on("join-room", async (payload: JoinRoomPayload) => {
      try {
        const { roomId, userId, userName = "User", role = "student" } = payload;
        
        console.log(chalk.blue(`👤 User ${userId} (${userName}) joining room ${roomId} as ${role}`));

        socket.data.userId = userId;
        socket.data.userName = userName;
        socket.data.role = role;
        socket.data.roomId = roomId;

        cleanupUserConnections(userId, socket.id);

        await socket.join(roomId);

        const roomUserMap = getRoomUsers(roomId);
        const existingParticipants = Array.from(roomUserMap.values());

        const userState: UserState = {
          userId,
          userName,
          socketId: socket.id,
          role,
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
          joinedAt: new Date().toISOString()
        };

        roomUserMap.set(userId, userState);

        socket.to(roomId).emit("user-joined", {
          socketId: socket.id,
          userId,
          userName,
          role,
          userState
        });

        socket.emit("room-joined", {
          roomId,
          participantCount: roomUserMap.size,
          participants: Array.from(roomUserMap.values()),
          iceServers: ICE_SERVER_CONFIG.iceServers
        });

        console.log(chalk.green(`✅ ${role} ${userId} (${userName}) joined room ${roomId}`));
        console.log(chalk.blue(`👥 Room ${roomId} now has ${roomUserMap.size} participants`));

        console.log(chalk.cyan(`📋 Current participants in ${roomId}:`));
        roomUserMap.forEach((user) => {
          console.log(chalk.cyan(`   - ${user.role} ${user.userName} (${user.userId}) [${user.socketId}]`));
        });

      } catch (error) {
        console.error(chalk.red(`❌ Error in join-room for ${payload.roomId}:`, error));
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    socket.on("leave-room", ({ roomId, userId }: { roomId: string; userId?: string }) => {
      try {
        const userIdToRemove = userId || socket.data.userId;
        const userName = socket.data.userName || "User";
        
        console.log(chalk.yellow(`👋 User ${userIdToRemove} (${userName}) leaving room ${roomId}`));

        socket.leave(roomId);
        
        if (userIdToRemove) {
          userToSocket.delete(userIdToRemove);
          removeUserFromRoom(roomId, userIdToRemove);
        }

        socket.to(roomId).emit("user-left", {
          socketId: socket.id,
          userId: userIdToRemove,
        });

        const roomUserMap = getRoomUsers(roomId);
        socket.to(roomId).emit("participants-updated", {
          participants: Array.from(roomUserMap.values())
        });

      } catch (error) {
        console.error(chalk.red(`❌ Error leaving room:`, error));
      }
    });

    socket.on("offer", (data: SignalingMessage) => {
      try {
        const { to, offer } = data;
        if (!to || !offer) {
          console.warn(chalk.yellow(`⚠️  Invalid offer from ${socket.id}`));
          return;
        }

        const success = safeEmitTo(socket, to, "offer", { offer });
        if (success) {
          console.log(chalk.blue(`📞 Offer: ${socket.data.userId || socket.id} → ${to}`));
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error handling offer:`, error));
      }
    });

    socket.on("answer", (data: SignalingMessage) => {
      try {
        const { to, answer } = data;
        if (!to || !answer) {
          console.warn(chalk.yellow(`⚠️  Invalid answer from ${socket.id}`));
          return;
        }

        const success = safeEmitTo(socket, to, "answer", { answer });
        if (success) {
          console.log(chalk.green(`✅ Answer: ${socket.data.userId || socket.id} → ${to}`));
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error handling answer:`, error));
      }
    });

    socket.on("ice-candidate", (data: SignalingMessage) => {
      try {
        const { to, candidate } = data;
        if (!to || !candidate) {
          console.warn(chalk.yellow(`⚠️  Invalid ICE candidate from ${socket.id}`));
          return;
        }

        const success = safeEmitTo(socket, to, "ice-candidate", { candidate });
        if (success) {
          console.log(chalk.cyan(`🧊 ICE: ${socket.data.userId || socket.id} → ${to}`));
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error handling ICE candidate:`, error));
      }
    });

    socket.on("toggle-audio", ({ roomId, isMuted, userId }: { roomId: string; isMuted: boolean; userId?: string }) => {
      try {
        const userIdToUpdate = userId || socket.data.userId;
        const roomUserMap = getRoomUsers(roomId);
        const userState = roomUserMap.get(userIdToUpdate);
        
        if (userState) {
          userState.isMuted = isMuted;
          console.log(chalk.magenta(`🎤 ${userState.userName} ${isMuted ? 'muted' : 'unmuted'} audio in ${roomId}`));
        }

        broadcastToRoom(roomId, "user-toggle-audio", {
          socketId: socket.id,
          userId: userIdToUpdate,
          isMuted
        }, socket.id);

      } catch (error) {
        console.error(chalk.red(`❌ Error handling audio toggle:`, error));
      }
    });

    socket.on("toggle-video", ({ roomId, isVideoOff, userId }: { roomId: string; isVideoOff: boolean; userId?: string }) => {
      try {
        const userIdToUpdate = userId || socket.data.userId;
        const roomUserMap = getRoomUsers(roomId);
        const userState = roomUserMap.get(userIdToUpdate);
        
        if (userState) {
          userState.isVideoOff = isVideoOff;
          console.log(chalk.blue(`📹 ${userState.userName} ${isVideoOff ? 'turned off' : 'turned on'} video in ${roomId}`));
        }

        broadcastToRoom(roomId, "user-toggle-video", {
          socketId: socket.id,
          userId: userIdToUpdate,
          isVideoOff
        }, socket.id);

      } catch (error) {
        console.error(chalk.red(`❌ Error handling video toggle:`, error));
      }
    });

    socket.on("toggle-screen-share", ({ roomId, isScreenSharing, userId }: { roomId: string; isScreenSharing: boolean; userId?: string }) => {
      try {
        const userIdToUpdate = userId || socket.data.userId;
        const roomUserMap = getRoomUsers(roomId);
        const userState = roomUserMap.get(userIdToUpdate);
        
        if (userState) {
          userState.isScreenSharing = isScreenSharing;
          console.log(chalk.bgBlue(`🖥️  ${userState.userName} ${isScreenSharing ? 'started' : 'stopped'} screen sharing in ${roomId}`));
        }

        broadcastToRoom(roomId, "user-screen-share-toggle", {
          socketId: socket.id,
          userId: userIdToUpdate,
          isSharing: isScreenSharing
        }, socket.id);

      } catch (error) {
        console.error(chalk.red(`❌ Error handling screen share toggle:`, error));
      }
    });

    socket.on("debug-room-info", ({ roomId }: { roomId: string }) => {
      try {
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        const roomUserMap = getRoomUsers(roomId);
        
        console.log(chalk.bgMagenta(`🐛 DEBUG - Room ${roomId}:`));
        console.log(chalk.bgMagenta(`   Socket.IO room size: ${roomSockets?.size || 0}`));
        console.log(chalk.bgMagenta(`   User state map size: ${roomUserMap.size}`));
        
        const roomInfo = {
          roomExists: !!roomSockets,
          socketRoomSize: roomSockets?.size || 0,
          userStateSize: roomUserMap.size,
          participants: Array.from(roomUserMap.values()),
          socketsInRoom: Array.from(roomSockets || []).map(id => {
            const s = io.sockets.sockets.get(id);
            return { 
              socketId: id, 
              userId: s?.data.userId, 
              userName: s?.data.userName,
              role: s?.data.role 
            };
          })
        };

        socket.emit("debug-response", { roomInfo });
      } catch (error) {
        console.error(chalk.red("Debug error:", error));
        socket.emit("debug-response", { error: "Debug failed" });
      }
    });

    socket.on("ping", () => {
      socket.emit("pong", { 
        timestamp: Date.now(),
        userId: socket.data.userId,
        userName: socket.data.userName,
        roomId: socket.data.roomId
      });
    });

    socket.on("disconnecting", (reason) => {
      try {
        const userId = socket.data.userId;
        const userName = socket.data.userName || "User";
        const roomId = socket.data.roomId;

        console.log(chalk.yellow(`🔌 User ${userId} (${userName}) disconnecting: ${reason}`));
        
        if (roomId) {
          if (userId) {
            removeUserFromRoom(roomId, userId);
          }

          socket.to(roomId).emit("user-left", {
            socketId: socket.id,
            userId: userId,
          });

          const roomUserMap = getRoomUsers(roomId);
          socket.to(roomId).emit("participants-updated", {
            participants: Array.from(roomUserMap.values())
          });
        }

        if (userId) {
          const mappedSocketId = userToSocket.get(userId);
          if (mappedSocketId === socket.id) {
            userToSocket.delete(userId);
          }
        }

      } catch (error) {
        console.error(chalk.red(`❌ Error during disconnect cleanup:`, error));
      }
    });

    socket.on("disconnect", (reason) => {
      try {
        const userId = socket.data.userId;
        const userName = socket.data.userName || "User";
        console.log(chalk.yellow(`❌ Client disconnected: ${socket.id}, User: ${userId} (${userName}), Reason: ${reason}`));
      } catch (error) {
        console.error(chalk.red("❌ Error on disconnect:", error));
      }
    });

    socket.on("error", (error) => {
      console.log(chalk.red(`🚨 Socket error for ${socket.data.userId} (${socket.id}):`, error));
    });

    socket.on("force-reconnect", ({ roomId }: { roomId: string }) => {
      try {
        broadcastToRoom(roomId, "force-peer-reconnect", {
          from: socket.id,
          userId: socket.data.userId
        }, socket.id);
        
        console.log(chalk.magenta(`🔄 Force reconnect triggered by ${socket.data.userId} in room ${roomId}`));
      } catch (error) {
        console.error(chalk.red(`❌ Error in force reconnect:`, error));
      }
    });
  });

  setInterval(() => {
    try {
      const socketRooms = io.sockets.adapter.rooms;
      const activeRooms = Array.from(socketRooms.entries()).filter(([roomId, sockets]) => {
        return sockets.size > 0 && !io.sockets.sockets.has(roomId);
      });

      if (activeRooms.length > 0) {
        console.log(chalk.gray(`📊 Health Check - Active rooms: ${activeRooms.length}, User states: ${roomUsers.size}`));
        
        activeRooms.forEach(([roomId, sockets]) => {
          const userStates = roomUsers.get(roomId);
          if (sockets.size !== userStates?.size) {
            console.log(chalk.yellow(`⚠️  Room ${roomId} inconsistency: ${sockets.size} sockets vs ${userStates?.size || 0} user states`));
          }
        });

        roomUsers.forEach((users, roomId) => {
          if (users.size === 0) {
            roomUsers.delete(roomId);
            console.log(chalk.gray(`🗑️  Cleaned up empty room: ${roomId}`));
          }
        });
      }

      const totalConnections = io.sockets.sockets.size;
      const totalRooms = activeRooms.length;
      const totalUsers = Array.from(roomUsers.values()).reduce((sum, users) => sum + users.size, 0);

      if (totalConnections > 0) {
        console.log(chalk.gray(`📈 Stats: ${totalConnections} connections, ${totalRooms} rooms, ${totalUsers} active users`));
      }

    } catch (error) {
      console.error(chalk.red("❌ Error in periodic cleanup:", error));
    }
  }, 30000);

  console.log(chalk.green("🚀 WebRTC signaling server initialized"));
};