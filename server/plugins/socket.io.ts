// server/plugins/socket.io.ts
import type { NitroApp } from 'nitropack';
import { Server as Engine } from 'engine.io';
import { Server } from 'socket.io';
import { randomUUID } from 'crypto';

interface User { id: string; username: string; room: string }
interface Message { id: string; username: string; message: string; timestamp: Date }

const rooms = new Map<string, { users: Map<string, User>; messages: Message[] }>(); // Хранение по комнатам

export default defineNitroPlugin((nitroApp: NitroApp) => {
    const engine = new Engine();
    const io = new Server({ cors: { origin: '*', methods: ['GET', 'POST'] } });
    io.bind(engine);

    io.on('connection', (socket) => {
        console.log('New user connected:', socket.id);

        socket.on('create-room', (username: string) => {
            const roomCode = randomUUID().slice(0, 8); // Генерация кода комнаты
            rooms.set(roomCode, { users: new Map(), messages: [] });
            joinRoom(socket, username, roomCode);
            socket.emit('room-created', roomCode);
        });

        socket.on('join-room', ({ username, roomCode }: { username: string; roomCode: string }) => {
            if (!rooms.has(roomCode)) {
                return socket.emit('error', 'Room does not exist');
            }
            joinRoom(socket, username, roomCode);
        });

        socket.on('new-message', (message: string) => {
            const user = Array.from(rooms.values())
                .flatMap(room => Array.from(room.users.values()))
                .find(u => u.id === socket.id);
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
                if (room.messages.length > 100) room.messages.shift(); // Ограничение истории
                io.to(user.room).emit('message-received', msg); // Broadcast в комнату
            }
        });

        socket.on('disconnect', () => {
            leaveRoom(socket);
        });
    });

    function joinRoom(socket: any, username: string, roomCode: string) {
        const room = rooms.get(roomCode)!;

        // ИСПРАВЛЕНИЕ: удаляем старого пользователя с тем же username если он есть
        for (const [socketId, user] of room.users.entries()) {
            if (user.username === username) {
                room.users.delete(socketId);
                console.log(`Removed old connection for ${username} (${socketId})`);
            }
        }

        const user: User = { id: socket.id, username, room: roomCode };
        room.users.set(socket.id, user);
        socket.join(roomCode);

        socket.emit('message-history', room.messages);
        io.to(roomCode).emit('users-update', Array.from(room.users.values()));

        // Отправляем ТОЛЬКО остальным участникам (кроме пришедшего)
        io.to(roomCode).except(socket.id).emit('user-joined', `${username} joined the chat`);

        socket.emit('joined', roomCode);
    }

    function leaveRoom(socket: any) {
        const user = Array.from(rooms.values())
            .flatMap(room => Array.from(room.users.values()))
            .find(u => u.id === socket.id);
        if (!user) return;

        const room = rooms.get(user.room);
        if (room) {
            room.users.delete(socket.id);
            io.to(user.room).emit('users-update', Array.from(room.users.values()));
            io.to(user.room).emit('user-left', `${user.username} left the chat`);

            if (room.users.size === 0) rooms.delete(user.room);
        }
    }

    nitroApp.router.use('/socket.io/', defineEventHandler({
        handler(event) {
            engine.handleRequest(event.node.req, event.node.res);
            event._handled = true;
        },
        websocket: {
            open(peer) {
                engine.prepare(peer._internal.nodeReq);
                engine.onWebSocket(peer._internal.nodeReq, peer._internal.nodeReq.socket, peer.websocket);
            }
        }
    }));
});