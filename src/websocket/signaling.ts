import { Server as SocketIOServer, Socket } from "socket.io";

interface UserState {
  userId: string;
  userName: string;
  socketId: string;
  role: "teacher" | "student";
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  joinedAt: string;
}

interface Room {
  id: string;
  participants: Map<string, UserState>;
  createdAt: string;
  iceServers: RTCConfiguration["iceServers"];
}

const rooms = new Map<string, Room>();

const defaultIceServers: RTCConfiguration["iceServers"] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export const initWebRTCSignaling = (io: SocketIOServer) => {
  io.on("connection", (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join-room", (data: {
      roomId: string;
      userId: string;
      userName: string;
      role: "teacher" | "student";
    }) => {
      try {
        const { roomId, userId, userName, role } = data;
        
        if (!roomId || !userId || !userName) {
          socket.emit("signal-error", { message: "Missing required join data" });
          return;
        }

        if (!rooms.has(roomId)) {
          rooms.set(roomId, {
            id: roomId,
            participants: new Map(),
            createdAt: new Date().toISOString(),
            iceServers: defaultIceServers,
          });
        }

        const room = rooms.get(roomId)!;
        socket.join(roomId);

        const userState: UserState = {
          userId,
          userName,
          socketId: socket.id,
          role,
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
          joinedAt: new Date().toISOString(),
        };

        const existingParticipants = Array.from(room.participants.values());
        room.participants.set(socket.id, userState);

        socket.emit("room-joined", {
          participantCount: room.participants.size,
          participants: Array.from(room.participants.values()),
          iceServers: room.iceServers,
        });

        socket.to(roomId).emit("user-joined", {
          socketId: socket.id,
          userId,
          userName,
          role,
        });

        console.log(`${userName} (${role}) joined room ${roomId}`);
      } catch (error) {
        console.error("Error joining room:", error);
        socket.emit("signal-error", { message: "Failed to join room" });
      }
    });

    socket.on("offer", async (data: {
      to: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      try {
        const { to, offer } = data;
        const targetSocket = io.sockets.sockets.get(to);
        
        if (targetSocket) {
          let senderUser: UserState | undefined;
          for (const room of rooms.values()) {
            const user = room.participants.get(socket.id);
            if (user) {
              senderUser = user;
              break;
            }
          }

          if (senderUser) {
            targetSocket.emit("offer", {
              from: socket.id,
              fromUserId: senderUser.userId,
              offer,
            });
            console.log(`Offer sent from ${socket.id} to ${to}`);
          }
        } else {
          socket.emit("signal-error", { message: "Target peer not found" });
        }
      } catch (error) {
        console.error("Error handling offer:", error);
        socket.emit("signal-error", { message: "Failed to send offer" });
      }
    });

    socket.on("answer", (data: {
      to: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      try {
        const { to, answer } = data;
        const targetSocket = io.sockets.sockets.get(to);
        
        if (targetSocket) {
          let senderUser: UserState | undefined;
          for (const room of rooms.values()) {
            const user = room.participants.get(socket.id);
            if (user) {
              senderUser = user;
              break;
            }
          }

          if (senderUser) {
            targetSocket.emit("answer", {
              from: socket.id,
              fromUserId: senderUser.userId,
              answer,
            });
            console.log(`Answer sent from ${socket.id} to ${to}`);
          }
        } else {
          socket.emit("signal-error", { message: "Target peer not found" });
        }
      } catch (error) {
        console.error("Error handling answer:", error);
        socket.emit("signal-error", { message: "Failed to send answer" });
      }
    });

    socket.on("ice-candidate", (data: {
      to: string;
      candidate: RTCIceCandidateInit;
    }) => {
      try {
        const { to, candidate } = data;
        const targetSocket = io.sockets.sockets.get(to);
        
        if (targetSocket) {
          targetSocket.emit("ice-candidate", {
            from: socket.id,
            candidate,
          });
        }
      } catch (error) {
        console.error("Error handling ICE candidate:", error);
      }
    });

    socket.on("toggle-audio", (data: {
      roomId: string;
      isMuted: boolean;
      userId: string;
    }) => {
      try {
        const { roomId, isMuted, userId } = data;
        const room = rooms.get(roomId);
        
        if (room) {
          const user = room.participants.get(socket.id);
          if (user) {
            user.isMuted = isMuted;
            socket.to(roomId).emit("user-toggle-audio", { userId, isMuted });
          }
        }
      } catch (error) {
        console.error("Error handling audio toggle:", error);
      }
    });

    socket.on("toggle-video", (data: {
      roomId: string;
      isVideoOff: boolean;
      userId: string;
    }) => {
      try {
        const { roomId, isVideoOff, userId } = data;
        const room = rooms.get(roomId);
        
        if (room) {
          const user = room.participants.get(socket.id);
          if (user) {
            user.isVideoOff = isVideoOff;
            socket.to(roomId).emit("user-toggle-video", { userId, isVideoOff });
          }
        }
      } catch (error) {
        console.error("Error handling video toggle:", error);
      }
    });

    socket.on("toggle-screen-share", (data: {
      roomId: string;
      isScreenSharing: boolean;
      userId: string;
    }) => {
      try {
        const { roomId, isScreenSharing, userId } = data;
        const room = rooms.get(roomId);
        
        if (room) {
          const user = room.participants.get(socket.id);
          if (user) {
            user.isScreenSharing = isScreenSharing;
            socket.to(roomId).emit("user-screen-share-toggle", { 
              userId, 
              isSharing: isScreenSharing 
            });
          }
        }
      } catch (error) {
        console.error("Error handling screen share toggle:", error);
      }
    });

    socket.on("remove-participant", (data: {
      roomId: string;
      participantId: string;
      removedBy: string;
    }) => {
      try {
        const { roomId, participantId, removedBy } = data;
        const room = rooms.get(roomId);
        
        if (room) {
          const remover = room.participants.get(socket.id);
          if (remover && remover.role === "teacher") {
            const targetSocket = io.sockets.sockets.get(participantId);
            if (targetSocket) {
              targetSocket.leave(roomId);
              targetSocket.emit("removed-from-room", { roomId, removedBy });
            }
            
            room.participants.delete(participantId);
            socket.to(roomId).emit("participant-removed", { socketId: participantId });
            console.log(`Participant ${participantId} removed from ${roomId}`);
          }
        }
      } catch (error) {
        console.error("Error removing participant:", error);
      }
    });

    socket.on("end-lecture", (data: { roomId: string }) => {
      try {
        const { roomId } = data;
        const room = rooms.get(roomId);
        
        if (room) {
          const user = room.participants.get(socket.id);
          if (user && user.role === "teacher") {
            socket.to(roomId).emit("lecture-ended");
            
            setTimeout(() => {
              io.in(roomId).socketsLeave(roomId);
              rooms.delete(roomId);
              console.log(`Room ${roomId} ended and deleted`);
            }, 2000);
          }
        }
      } catch (error) {
        console.error("Error ending lecture:", error);
      }
    });

    socket.on("leave-room", (data: { roomId: string; userId: string }) => {
      try {
        const { roomId, userId } = data;
        const room = rooms.get(roomId);
        
        if (room) {
          socket.leave(roomId);
          room.participants.delete(socket.id);
          
          socket.to(roomId).emit("user-left", { 
            socketId: socket.id, 
            userId 
          });

          if (room.participants.size === 0) {
            rooms.delete(roomId);
            console.log(`Empty room ${roomId} deleted`);
          }
        }
      } catch (error) {
        console.error("Error leaving room:", error);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      
      for (const [roomId, room] of rooms.entries()) {
        if (room.participants.has(socket.id)) {
          const user = room.participants.get(socket.id);
          room.participants.delete(socket.id);
          
          socket.to(roomId).emit("user-left", { 
            socketId: socket.id, 
            userId: user?.userId 
          });

          if (room.participants.size === 0) {
            rooms.delete(roomId);
            console.log(`Empty room ${roomId} deleted after disconnect`);
          }
          break;
        }
      }
    });

    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      const roomAge = now - new Date(room.createdAt).getTime();
      if (roomAge > 4 * 60 * 60 * 1000 && room.participants.size === 0) {
        rooms.delete(roomId);
        console.log(`Cleaned up old empty room: ${roomId}`);
      }
    }
  }, 30 * 60 * 1000);
};