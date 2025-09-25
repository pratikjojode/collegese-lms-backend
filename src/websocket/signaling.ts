import { Server, Socket } from "socket.io";
import chalk from "chalk";

const ICE_SERVER_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:relay1.expressturn.com:3478",  
      username: "000000002073459740",
      credential: "2OBO78ET1NTRE0/RJpKJiGovpR4="
    }
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
      console.log(chalk.gray(`Room ${roomId} deleted (empty)`));
    }
  };

  const cleanupUserConnections = (userId: string, currentSocketId: string) => {
    roomUsers.forEach((users, roomId) => {
      const userState = users.get(userId);
      if (userState && userState.socketId !== currentSocketId) {
        users.delete(userId);
        console.log(chalk.yellow(`Cleaned up old user state for ${userId} in room ${roomId}`));
      }
    });

    const existingSocketId = userToSocket.get(userId);
    if (existingSocketId && existingSocketId !== currentSocketId) {
      const existingSocket = io.sockets.sockets.get(existingSocketId);
      if (existingSocket) {
        console.log(chalk.yellow(`Disconnecting existing connection for user ${userId}`));
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
        console.warn(chalk.red(`Target socket ${targetSocketId} not found for event ${event}`));
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
        console.warn(chalk.yellow(`Room mismatch: ${fromSocket.id} (${fromRoomId}) -> ${targetSocketId} (${targetRoomId})`));
        return false;
      }

      targetSocket.emit(event, {
        ...payload,
        from: fromSocket.id,
        fromUserId: fromSocket.data.userId
      });

      return true;
    } catch (err) {
      console.error(chalk.red(`Error emitting ${event} to ${targetSocketId}:`, err));
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
    console.log(chalk.green(`Client connected: ${socket.id}`));

    socket.on("join-room", async (payload: JoinRoomPayload) => {
      try {
        const { roomId, userId, userName = "User", role = "student" } = payload;
        
        console.log(chalk.blue(`User ${userId} (${userName}) joining room ${roomId} as ${role}`));

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

        const updatedParticipants = Array.from(roomUserMap.values());

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
          participants: updatedParticipants,
          iceServers: ICE_SERVER_CONFIG.iceServers
        });

        broadcastToRoom(roomId, "participant-count-updated", {
          count: roomUserMap.size,
          reason: "user-joined"
        }, socket.id);

        console.log(chalk.green(`${role} ${userId} (${userName}) joined room ${roomId}`));
        console.log(chalk.blue(`Room ${roomId} now has ${roomUserMap.size} participants`));

      } catch (error) {
        console.error(chalk.red(`Error in join-room for ${payload.roomId}:`, error));
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    socket.on("leave-room", ({ roomId, userId }: { roomId: string; userId?: string }) => {
      try {
        const userIdToRemove = userId || socket.data.userId;
        const userName = socket.data.userName || "User";
        
        console.log(chalk.yellow(`User ${userIdToRemove} (${userName}) leaving room ${roomId}`));

        socket.leave(roomId);
        
        if (userIdToRemove) {
          userToSocket.delete(userIdToRemove);
          removeUserFromRoom(roomId, userIdToRemove);
        }

        const roomUserMap = getRoomUsers(roomId);
        const remainingCount = roomUserMap.size;

        socket.to(roomId).emit("user-left", {
          socketId: socket.id,
          userId: userIdToRemove,
        });

        broadcastToRoom(roomId, "participant-count-updated", {
          count: remainingCount,
          reason: "user-left"
        });

        console.log(chalk.blue(`Room ${roomId} now has ${remainingCount} participants after ${userName} left`));

      } catch (error) {
        console.error(chalk.red(`Error leaving room:`, error));
      }
    });

    socket.on("offer", (data: SignalingMessage) => {
      try {
        const { to, offer } = data;
        if (!to || !offer) {
          console.warn(chalk.yellow(`Invalid offer from ${socket.id}`));
          return;
        }

        const success = safeEmitTo(socket, to, "offer", { offer });
        if (success) {
          console.log(chalk.blue(`Offer: ${socket.data.userId || socket.id} → ${to}`));
        }
      } catch (error) {
        console.error(chalk.red(`Error handling offer:`, error));
      }
    });

    socket.on("answer", (data: SignalingMessage) => {
      try {
        const { to, answer } = data;
        if (!to || !answer) {
          console.warn(chalk.yellow(`Invalid answer from ${socket.id}`));
          return;
        }

        const success = safeEmitTo(socket, to, "answer", { answer });
        if (success) {
          console.log(chalk.green(`Answer: ${socket.data.userId || socket.id} → ${to}`));
        }
      } catch (error) {
        console.error(chalk.red(`Error handling answer:`, error));
      }
    });

    socket.on("ice-candidate", (data: SignalingMessage) => {
      try {
        const { to, candidate } = data;
        if (!to || !candidate) {
          console.warn(chalk.yellow(`Invalid ICE candidate from ${socket.id}`));
          return;
        }

        const success = safeEmitTo(socket, to, "ice-candidate", { candidate });
        if (success) {
          console.log(chalk.cyan(`ICE: ${socket.data.userId || socket.id} → ${to}`));
        }
      } catch (error) {
        console.error(chalk.red(`Error handling ICE candidate:`, error));
      }
    });

    socket.on("toggle-audio", ({ roomId, isMuted, userId }: { roomId: string; isMuted: boolean; userId?: string }) => {
      try {
        const userIdToUpdate = userId || socket.data.userId;
        const roomUserMap = getRoomUsers(roomId);
        const userState = roomUserMap.get(userIdToUpdate);
        
        if (userState) {
          userState.isMuted = isMuted;
          console.log(chalk.magenta(`${userState.userName} ${isMuted ? 'muted' : 'unmuted'} audio in ${roomId}`));
        }

        broadcastToRoom(roomId, "user-toggle-audio", {
          socketId: socket.id,
          userId: userIdToUpdate,
          isMuted
        }, socket.id);

      } catch (error) {
        console.error(chalk.red(`Error handling audio toggle:`, error));
      }
    });

    socket.on("toggle-video", ({ roomId, isVideoOff, userId }: { roomId: string; isVideoOff: boolean; userId?: string }) => {
      try {
        const userIdToUpdate = userId || socket.data.userId;
        const roomUserMap = getRoomUsers(roomId);
        const userState = roomUserMap.get(userIdToUpdate);
        
        if (userState) {
          userState.isVideoOff = isVideoOff;
          console.log(chalk.blue(`${userState.userName} ${isVideoOff ? 'turned off' : 'turned on'} video in ${roomId}`));
        }

        broadcastToRoom(roomId, "user-toggle-video", {
          socketId: socket.id,
          userId: userIdToUpdate,
          isVideoOff
        }, socket.id);

      } catch (error) {
        console.error(chalk.red(`Error handling video toggle:`, error));
      }
    });

    socket.on("toggle-screen-share", ({ roomId, isScreenSharing, userId }: { roomId: string; isScreenSharing: boolean; userId?: string }) => {
      try {
        const userIdToUpdate = userId || socket.data.userId;
        const roomUserMap = getRoomUsers(roomId);
        const userState = roomUserMap.get(userIdToUpdate);
        
        if (userState) {
          userState.isScreenSharing = isScreenSharing;
          console.log(chalk.bgBlue(`${userState.userName} ${isScreenSharing ? 'started' : 'stopped'} screen sharing in ${roomId}`));
        }

        broadcastToRoom(roomId, "user-screen-share-toggle", {
          socketId: socket.id,
          userId: userIdToUpdate,
          isSharing: isScreenSharing
        }, socket.id);

      } catch (error) {
        console.error(chalk.red(`Error handling screen share toggle:`, error));
      }
    });

    socket.on("remove-participant", ({ roomId, participantId, removedBy }) => {
      try {
        console.log(`${removedBy} removing participant ${participantId} from room ${roomId}`);
        
        const targetSocket = io.sockets.sockets.get(participantId);
        if (targetSocket) {
          targetSocket.leave(roomId);
          targetSocket.emit("removed-from-lecture", { removedBy });
          targetSocket.disconnect(true);
        }
        
        socket.to(roomId).emit("participant-removed", {
          socketId: participantId,
          participantId
        });
        
        const roomUserMap = getRoomUsers(roomId);
        const userToRemove = Array.from(roomUserMap.values()).find(u => u.socketId === participantId);
        if (userToRemove) {
          removeUserFromRoom(roomId, userToRemove.userId);
          
          broadcastToRoom(roomId, "participant-count-updated", {
            count: roomUserMap.size,
            reason: "participant-removed"
          });
        }
        
      } catch (error) {
        console.error("Error removing participant:", error);
      }
    });

    socket.on("end-lecture", ({ roomId }) => {
      try {
        console.log(chalk.red(`Ending lecture in room ${roomId}`));
        
        broadcastToRoom(roomId, "lecture-ended", {
          endedBy: socket.data.userId,
          reason: "Teacher ended the lecture"
        });
        
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (roomSockets) {
          roomSockets.forEach(socketId => {
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket && targetSocket.id !== socket.id) {
              targetSocket.leave(roomId);
            }
          });
        }
        
        roomUsers.delete(roomId);
        
      } catch (error) {
        console.error(chalk.red("Error ending lecture:", error));
      }
    });

    socket.on("disconnecting", (reason) => {
      try {
        const userId = socket.data.userId;
        const userName = socket.data.userName || "User";
        const roomId = socket.data.roomId;

        console.log(chalk.yellow(`User ${userId} (${userName}) disconnecting from room ${roomId}: ${reason}`));
        
        if (roomId) {
          socket.to(roomId).emit("user-left", {
            socketId: socket.id,
            userId: userId,
            reason: reason
          });

          if (userId) {
            removeUserFromRoom(roomId, userId);
            
            const roomUserMap = getRoomUsers(roomId);
            broadcastToRoom(roomId, "participant-count-updated", {
              count: roomUserMap.size,
              reason: "user-disconnected"
            });
          }
        }

        if (userId) {
          const mappedSocketId = userToSocket.get(userId);
          if (mappedSocketId === socket.id) {
            userToSocket.delete(userId);
          }
        }

      } catch (error) {
        console.error(chalk.red(`Error during disconnect cleanup for ${socket.id}:`, error));
      }
    });

    socket.on("disconnect", (reason) => {
      try {
        const userId = socket.data.userId;
        const userName = socket.data.userName || "User";
        const roomId = socket.data.roomId;
        
        console.log(chalk.yellow(`Client disconnected: ${socket.id}, User: ${userId} (${userName}), Room: ${roomId}, Reason: ${reason}`));
        
      } catch (error) {
        console.error(chalk.red(`Error on disconnect for ${socket.id}:`, error));
      }
    });

    socket.on("error", (error) => {
      console.log(chalk.red(`Socket error for ${socket.data.userId} (${socket.id}):`, error));
    });
  });

  setInterval(() => {
    try {
      const socketRooms = io.sockets.adapter.rooms;
      const connectedSocketIds = Array.from(io.sockets.sockets.keys());
      
      const activeRooms = Array.from(socketRooms.entries()).filter(([roomId, sockets]) => {
        return sockets.size > 0 && !io.sockets.sockets.has(roomId);
      });

      if (activeRooms.length > 0) {
        console.log(chalk.gray(`Health Check - Active rooms: ${activeRooms.length}, User states tracked: ${roomUsers.size}, Connected sockets: ${connectedSocketIds.length}`));
        
        activeRooms.forEach(([roomId, sockets]) => {
          const userStates = roomUsers.get(roomId);
          const socketCount = sockets.size;
          const userStateCount = userStates?.size || 0;
          
          if (socketCount !== userStateCount) {
            console.log(chalk.yellow(`Room ${roomId} inconsistency: ${socketCount} sockets vs ${userStateCount} user states`));
            
            if (userStates) {
              const socketsInRoom = Array.from(sockets);
              const usersToRemove: string[] = [];
              
              userStates.forEach((userState, userId) => {
                if (!socketsInRoom.includes(userState.socketId)) {
                  console.log(chalk.yellow(`User ${userId} (${userState.socketId}) not in socket room ${roomId}, removing from user states`));
                  usersToRemove.push(userId);
                }
              });
              
              usersToRemove.forEach(userId => {
                userStates.delete(userId);
              });
              
              if (userStates.size === 0) {
                roomUsers.delete(roomId);
                console.log(chalk.gray(`Cleaned up empty room: ${roomId}`));
              }
            }
          }
        });
      }

      const roomsToDelete: string[] = [];
      roomUsers.forEach((users, roomId) => {
        if (users.size === 0) {
          roomsToDelete.push(roomId);
        } else {
          const usersToRemove: string[] = [];
          users.forEach((userState, userId) => {
            if (!io.sockets.sockets.has(userState.socketId)) {
              console.log(chalk.yellow(`Socket ${userState.socketId} for user ${userId} no longer exists, removing from room ${roomId}`));
              usersToRemove.push(userId);
            }
          });
          
          usersToRemove.forEach(userId => {
            users.delete(userId);
          });
          
          if (users.size === 0) {
            roomsToDelete.push(roomId);
          }
        }
      });
      
      roomsToDelete.forEach(roomId => {
        roomUsers.delete(roomId);
        console.log(chalk.gray(`Cleaned up empty room: ${roomId}`));
      });

      const usersToRemoveFromMapping: string[] = [];
      userToSocket.forEach((socketId, userId) => {
        if (!io.sockets.sockets.has(socketId)) {
          usersToRemoveFromMapping.push(userId);
        }
      });
      
      usersToRemoveFromMapping.forEach(userId => {
        userToSocket.delete(userId);
      });

    } catch (error) {
      console.error(chalk.red("Error in periodic cleanup:", error));
    }
  }, 15000);

  console.log(chalk.green("WebRTC signaling server initialized"));
};