import { io } from 'socket.io-client';

let socket: any = null;

export default defineNuxtPlugin(() => {
  const initSocket = () => {
    if (!socket) {
      socket = io('http://localhost:3000', {  // ← ИЗМЕНИ НА 3000!
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10
      });

      socket.on('connect', () => console.log('✅ Connected:', socket.id));
      socket.on('disconnect', () => console.log('❌ Disconnected'));
      socket.on('error', (err: any) => console.error('Error:', err));
    }
    return socket;
  };

  return {
    provide: {
      socket: initSocket(),
      connectSocket: initSocket
    }
  };
});
