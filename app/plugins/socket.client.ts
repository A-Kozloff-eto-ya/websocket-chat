// plugins/socket.io.client.ts
import { io, type Socket } from 'socket.io-client';

export default defineNuxtPlugin(() => {
  let socket: Socket;

  const getSocketUrl = (): string => {
    if (import.meta.client) {
      // На Vercel и production используем текущий домен
      // Socket.IO автоматически перенаправит на правильный port
      return window.location.origin;
    }
    return 'http://localhost:3000';
  };

  const initSocket = (): Socket => {
    if (!socket || socket.disconnected) {
      const socketUrl = getSocketUrl();

      socket = io(socketUrl, {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        autoConnect: false,
        secure: true,
        rejectUnauthorized: false
      });

      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      socket.on('error', (error: Error) => {
        console.error('Socket error:', error);
      });
    }
    return socket;
  };

  return {
    provide: {
      socket: initSocket(),
      connectSocket: (): Socket => {
        const sock = initSocket();
        if (sock.disconnected) {
          sock.connect();
        }
        return sock;
      }
    }
  };
});