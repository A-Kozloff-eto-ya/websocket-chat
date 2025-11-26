// plugins/socket.ts
import { io, type Socket } from "socket.io-client";

export default defineNuxtPlugin(() => {
  let socket: Socket = io("ws://localhost:3001", { autoConnect: false }); // выключаем автоподключение

  return {
    provide: {
      socket,
      connectSocket: () => {
        if (socket.disconnected) socket.connect();
        return socket;
      }
    }
  }
});
