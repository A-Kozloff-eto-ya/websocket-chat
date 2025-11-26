// server/plugins/socket.io.ts (обновленный)
import type { NitroApp } from 'nitropack';
import { Server } from 'socket.io';
import { randomUUID } from 'crypto';

interface User { id: string; username: string; room: string }
interface Message { id: string; username: string; message: string; timestamp: Date }
interface ChessMove { from: string; to: string; promotion?: string; fen: string; san: string; timestamp: Date; username: string }
interface GameState {
    fen: string;
    moves: ChessMove[];
    whitePlayer?: string;
    blackPlayer?: string;
    status: 'waiting' | 'playing' | 'finished';
    result?: string;
    winner?: string;
}

interface Room {
    users: Map<string, User>;
    messages: Message[];
    gameState: GameState;
    stats: Map<string, any>;
}

const rooms = new Map<string, Room>();
let io: Server;

export default defineNitroPlugin((nitroApp: NitroApp) => {
    console.log('🔧 Socket.IO plugin loading...');

    if (!io) {
        io = new Server(3001, {
            cors: { origin: '*', methods: ['GET', 'POST'] },
            transports: ['websocket', 'polling']
        });

        io.on('connection', (socket) => {
            console.log('✨ Socket connected:', socket.id);

            socket.on('create-room', (username: string) => {
                console.log(`🎮 CREATE-ROOM: username=${username}`);
                const roomCode = randomUUID().slice(0, 8);

                rooms.set(roomCode, {
                    users: new Map(),
                    messages: [],
                    gameState: {
                        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                        moves: [],
                        status: 'waiting'
                    },
                    stats: new Map()
                });

                joinRoom(socket, username, roomCode);
                socket.emit('room-created', roomCode);
                console.log(`✅ Room created: ${roomCode}`);
            });

            socket.on('join-room', ({ username, roomCode }: any) => {
                console.log(`🎮 JOIN-ROOM: username=${username}, roomCode=${roomCode}`);
                if (!rooms.has(roomCode)) {
                    socket.emit('error', 'Room does not exist');
                    return;
                }
                joinRoom(socket, username, roomCode);
            });

            socket.on('new-message', (message: string) => {
                const user = findUserBySocketId(socket.id);
                if (!user) return;
                const room = rooms.get(user.room);
                if (room) {
                    const msg: Message = {
                        id: Date.now().toString(),
                        username: user.username,
                        message,
                        timestamp: new Date()
                    };
                    room.messages.push(msg);
                    if (room.messages.length > 100) room.messages.shift();
                    io.to(user.room).emit('message-received', msg);
                }
            });

            socket.on('chess-move', (data: any) => {
                console.log(`🎯 CHESS-MOVE from ${socket.id}:`, data.san);

                const rooms_array = Array.from(rooms.values());
                for (const room of rooms_array) {
                    const user = room.users.get(socket.id);
                    if (user) {
                        room.gameState.fen = data.fen;
                        room.gameState.moves.push({
                            from: data.from,
                            to: data.to,
                            promotion: data.promotion,
                            fen: data.fen,
                            san: data.san,
                            timestamp: new Date(),
                            username: user.username
                        });

                        io.to(user.room).emit('chess-move-received', {
                            from: data.from,
                            to: data.to,
                            promotion: data.promotion,
                            fen: data.fen,
                            san: data.san,
                            username: user.username,
                            timestamp: new Date()
                        });
                        break;
                    }
                }
            });

            socket.on('chess-start-game', (data: any) => {
                console.log(`🎮 GAME-START: ${data.whitePlayer} vs ${data.blackPlayer}`);

                const rooms_array = Array.from(rooms.values());
                for (const room of rooms_array) {
                    const user = room.users.get(socket.id);
                    if (user) {
                        room.gameState.status = 'playing';
                        room.gameState.whitePlayer = data.whitePlayer;
                        room.gameState.blackPlayer = data.blackPlayer;
                        room.gameState.moves = [];
                        room.gameState.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

                        io.to(user.room).emit('chess-game-started', {
                            whitePlayer: data.whitePlayer,
                            blackPlayer: data.blackPlayer,
                            fen: room.gameState.fen
                        });
                        break;
                    }
                }
            });

            socket.on('chess-undo', () => {
                console.log(`↶ UNDO from ${socket.id}`);

                const rooms_array = Array.from(rooms.values());
                for (const room of rooms_array) {
                    const user = room.users.get(socket.id);
                    if (user && room.gameState.moves.length > 0) {
                        room.gameState.moves.pop();
                        const previousMove = room.gameState.moves[room.gameState.moves.length - 1];
                        room.gameState.fen = previousMove?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

                        io.to(user.room).emit('chess-undo-received', room.gameState.fen);
                        break;
                    }
                }
            });

            socket.on('chess-reset', () => {
                console.log(`↻ RESET from ${socket.id}`);

                const rooms_array = Array.from(rooms.values());
                for (const room of rooms_array) {
                    const user = room.users.get(socket.id);
                    if (user) {
                        room.gameState = {
                            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                            moves: [],
                            status: 'waiting'
                        };

                        io.to(user.room).emit('chess-reset-received');
                        break;
                    }
                }
            });

            socket.on('get-room-state', (roomCode: string) => {
                console.log(`📋 GET-ROOM-STATE: ${roomCode}`);
                const room = rooms.get(roomCode);
                if (room) {
                    socket.emit('users-update', Array.from(room.users.values()));
                    socket.emit('message-history', room.messages);
                    socket.emit('game-state', room.gameState);
                    console.log(`✅ State sent for room ${roomCode}`);
                } else {
                    console.log(`❌ Room not found: ${roomCode}`);
                }
            });

            socket.on('disconnect', () => {
                console.log(`🔌 Disconnected: ${socket.id}`);
                leaveRoom(socket);
            });
        });

        console.log('✅ Socket.IO listening on port 3001');
    }

    function joinRoom(socket: any, username: string, roomCode: string) {
        const room = rooms.get(roomCode)!;
        const user: User = { id: socket.id, username, room: roomCode };
        room.users.set(socket.id, user);
        socket.join(roomCode);

        socket.emit('message-history', room.messages);
        socket.emit('game-state', room.gameState);
        socket.emit('statistics', Array.from(room.stats.entries()));
        io.to(roomCode).emit('users-update', Array.from(room.users.values()));
        io.to(roomCode).except(socket.id).emit('user-joined', `${username} joined`);
        socket.emit('joined', roomCode);

        console.log(`👤 ${username} joined room ${roomCode}`);
    }

    function leaveRoom(socket: any) {
        const user = findUserBySocketId(socket.id);
        if (!user) return;
        const room = rooms.get(user.room);
        if (room) {
            room.users.delete(socket.id);
            io.to(user.room).emit('users-update', Array.from(room.users.values()));
            if (room.users.size === 0) rooms.delete(user.room);
        }
    }

    function findUserBySocketId(socketId: string) {
        for (const room of rooms.values()) {
            const user = room.users.get(socketId);
            if (user) return user;
        }
    }
});