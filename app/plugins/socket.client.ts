// plugins/socket.io.client.ts
import { io, type Socket } from 'socket.io-client';

export default defineNuxtPlugin(() => {
  let socket: Socket;

  const getSocketUrl = (): string => {
    if (import.meta.env.DEV) {
      // Локально подключаемся к http://localhost:3000
      return 'http://localhost:3001';
    }
    // На продакшене к origin (Railway-домен)
    return window.location.origin;
  };

  const initSocket = (): Socket => {
    if (!socket || socket.disconnected) {
      socket = io(getSocketUrl(), {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socket.on('connect', () => console.log('✅ Socket connected:', socket.id));
      socket.on('connect_error', (e) => console.error('❌ Socket connection error:', e.message));
      socket.on('disconnect', (reason) => console.log('🔌 Socket disconnected:', reason));
    }
    return socket;
  };

  return {
    provide: {
      socket: initSocket(),
      connectSocket: () => {
        const s = initSocket();
        s.connect();
        return s;
      }
    }
  };
});
