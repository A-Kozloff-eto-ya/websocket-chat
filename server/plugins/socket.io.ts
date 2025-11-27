// server/plugins/socket.io.ts (ИСПРАВЛЕННЫЙ - ПРАВИЛЬНЫЙ UNDO)

import type { NitroApp } from 'nitropack';
import { Server } from 'socket.io';
import { randomUUID } from 'crypto';

interface User {
    id: string;
    username: string;
    room: string;
}

interface ChessMove {
    from: string;
    to: string;
    promotion?: string;
    fen: string;
    san: string;
    timestamp: Date;
    username: string;
}

interface GameState {
    fen: string;
    moves: ChessMove[];
    whitePlayer?: string;
    blackPlayer?: string;
    status: 'waiting' | 'playing' | 'finished';
    currentTurn: 'w' | 'b';
    result?: string;
    winner?: string;
}

interface Message {
    id: string;
    username: string;
    message: string;
    timestamp: Date;
}

interface Room {
    users: Map<string, User>;
    messages: Message[];
    gameState: GameState;
}

const rooms = new Map<string, Room>();
let io: Server;

/**
 * Извлечение текущего игрока из FEN
 * FEN формат: "fen pieces 0" где [1] это 'w' или 'b'
 */
function getCurrentTurnFromFen(fen: string): 'w' | 'b' {
    const parts = fen.split(' ');
    return (parts[1] || 'w') as 'w' | 'b';
}

/**
 * Проверка что текущий игрок имеет право делать ход
 */
function isPlayersTurn(username: string, room: Room): boolean {
    const gameState = room.gameState;

    if (gameState.status !== 'playing') {
        return false;
    }

    const currentTurn = gameState.currentTurn;

    if (currentTurn === 'w' && gameState.whitePlayer === username) {
        return true;
    }

    if (currentTurn === 'b' && gameState.blackPlayer === username) {
        return true;
    }

    return false;
}

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
                        status: 'waiting',
                        currentTurn: 'w'
                    }
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

            socket.on('chess-start-game', (data: any) => {
                console.log(`🎮 GAME-START: ${data.whitePlayer} vs ${data.blackPlayer}`);

                const rooms_array = Array.from(rooms.values());
                for (const room of rooms_array) {
                    const user = room.users.get(socket.id);
                    if (user) {
                        room.gameState = {
                            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                            moves: [],
                            status: 'playing',
                            whitePlayer: data.whitePlayer,
                            blackPlayer: data.blackPlayer,
                            currentTurn: 'w'
                        };

                        io.to(user.room).emit('chess-game-started', {
                            whitePlayer: data.whitePlayer,
                            blackPlayer: data.blackPlayer,
                            fen: room.gameState.fen,
                            currentTurn: room.gameState.currentTurn
                        });

                        console.log(`✅ Game started in room ${user.room}`);
                        break;
                    }
                }
            });

            socket.on('chess-move', (data: any) => {
                console.log(`🎯 CHESS-MOVE from ${socket.id}: ${data.san}`);

                const rooms_array = Array.from(rooms.values());
                for (const room of rooms_array) {
                    const user = room.users.get(socket.id);
                    if (!user) continue;

                    if (room.gameState.status !== 'playing') {
                        socket.emit('error', 'Game is not active');
                        console.log('❌ Game not active');
                        return;
                    }

                    if (!isPlayersTurn(user.username, room)) {
                        socket.emit('error', 'Not your turn');
                        console.log(`❌ Not ${user.username}'s turn, current: ${room.gameState.currentTurn}`);
                        return;
                    }

                    if (!data.fen || data.fen.length < 20) {
                        socket.emit('error', 'Invalid FEN');
                        console.log('❌ Invalid FEN');
                        return;
                    }

                    const moveRecord: ChessMove = {
                        from: data.from,
                        to: data.to,
                        promotion: data.promotion,
                        fen: data.fen,
                        san: data.san,
                        timestamp: new Date(),
                        username: user.username
                    };

                    room.gameState.moves.push(moveRecord);
                    room.gameState.fen = data.fen;

                    // ✅ ВЫЧИСЛИ ОЧЕРЕДЬ ИЗ НОВОГО FEN (после хода)
                    room.gameState.currentTurn = getCurrentTurnFromFen(data.fen);

                    console.log(
                        `✅ Move saved. Next turn: ${room.gameState.currentTurn === 'w' ? '⚪ White' : '⚫ Black'}`
                    );

                    io.to(user.room).emit('chess-move-received', {
                        from: data.from,
                        to: data.to,
                        promotion: data.promotion,
                        fen: data.fen,
                        san: data.san,
                        username: user.username,
                        timestamp: moveRecord.timestamp,
                        currentTurn: room.gameState.currentTurn
                    });

                    break;
                }
            });

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // UNDO - ИСПРАВЛЕННАЯ ЛОГИКА
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

            socket.on('chess-undo', () => {
                console.log(`↶ UNDO from ${socket.id}`);

                const rooms_array = Array.from(rooms.values());
                for (const room of rooms_array) {
                    const user = room.users.get(socket.id);
                    if (!user) {
                        console.log(`  ├─ Socket ${socket.id} not in this room`);
                        continue;
                    }

                    console.log(`  ├─ Found user: ${user.username} in room ${user.room}`);
                    console.log(`  ├─ Room users count: ${room.users.size}`);
                    console.log(`  ├─ Moves count BEFORE: ${room.gameState.moves.length}`);

                    if (room.gameState.moves.length === 0) {
                        socket.emit('error', 'No moves to undo');
                        console.log(`  ├─ ERROR: No moves to undo`);
                        return;
                    }

                    // ✅ ПРОВЕРЯЕМ ЧТО ПОСЛЕДНИЙ ХОД - ЭТО ХОД ТЕКУЩЕГО ИГРОКА
                    const lastMove = room.gameState.moves[room.gameState.moves.length - 1];
                    console.log(`  ├─ Last move: ${lastMove.san} by ${lastMove.username}`);
                    console.log(`  ├─ Current player: ${user.username}`);

                    if (lastMove.username !== user.username) {
                        socket.emit('error', 'Can only undo your own moves');
                        console.log(`  ├─ ERROR: ${user.username} trying to undo ${lastMove.username}'s move`);
                        return;
                    }

                    // ✅ УДАЛЯЕМ ТОЛЬКО ПОСЛЕДНИЙ ХОД (твой ход)
                    // НЕ трогаем ход противника!
                    const undoneMove = room.gameState.moves.pop();
                    console.log(`  ├─ Removed move: ${undoneMove?.san} by ${undoneMove?.username}`);

                    // ✅ ВЫЧИСЛЯЕМ FEN ДЛЯ ВОССТАНОВЛЕНИЯ
                    let fenToRestore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

                    if (room.gameState.moves.length > 0) {
                        fenToRestore = room.gameState.moves[room.gameState.moves.length - 1].fen;
                        console.log(`  ├─ Restoring FEN from previous move: ${fenToRestore.substring(0, 30)}...`);
                    } else {
                        console.log(`  ├─ No moves left, restoring initial position`);
                    }

                    room.gameState.fen = fenToRestore;
                    room.gameState.currentTurn = getCurrentTurnFromFen(fenToRestore);

                    console.log(`  ├─ FINAL STATE:`);
                    console.log(`  │  ├─ Moves count AFTER: ${room.gameState.moves.length}`);
                    console.log(`  │  ├─ Removed: 1 move ✅`);
                    console.log(`  │  ├─ CurrentTurn: ${room.gameState.currentTurn === 'w' ? '⚪ White' : '⚫ Black'}`);
                    console.log(`  │  └─ FEN: ${fenToRestore.substring(0, 40)}...`);

                    const payload = {
                        fen: fenToRestore,
                        currentTurn: room.gameState.currentTurn,
                        moves: room.gameState.moves,
                        removedCount: 1  // Всегда удаляем только 1 ход!
                    };

                    console.log(`  ├─ 📡 Broadcasting to room ${user.room}...`);
                    io.to(user.room).emit('chess-undo-received', payload);

                    console.log(`✅ Undo complete - 1 move removed`);
                    break;
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
                            status: 'waiting',
                            currentTurn: 'w'
                        };

                        io.to(user.room).emit('chess-reset-received', {
                            fen: room.gameState.fen,
                            currentTurn: room.gameState.currentTurn
                        });

                        console.log(`✅ Game reset in room ${user.room}`);
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
                    socket.emit('game-state', {
                        fen: room.gameState.fen,
                        moves: room.gameState.moves,
                        status: room.gameState.status,
                        whitePlayer: room.gameState.whitePlayer,
                        blackPlayer: room.gameState.blackPlayer,
                        currentTurn: room.gameState.currentTurn
                    });
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

        socket.emit('users-update', Array.from(room.users.values()));
        socket.emit('message-history', room.messages);
        socket.emit('game-state', {
            fen: room.gameState.fen,
            moves: room.gameState.moves,
            status: room.gameState.status,
            whitePlayer: room.gameState.whitePlayer,
            blackPlayer: room.gameState.blackPlayer,
            currentTurn: room.gameState.currentTurn
        });

        const usersList = Array.from(room.users.values());
        io.to(roomCode).emit('users-update', usersList);
        io.to(roomCode).except(socket.id).emit('user-joined', `${username} joined`);

        socket.emit('joined', roomCode);
        console.log(`👤 ${username} joined room ${roomCode}, total users: ${room.users.size}`);
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