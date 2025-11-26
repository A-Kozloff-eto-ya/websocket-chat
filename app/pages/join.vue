<!-- pages/join.vue -->
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
    <div class="max-w-md w-full space-y-8">
      <h2 class="text-center text-3xl font-extrabold text-gray-900">Join or Create Chat</h2>
      <form class="mt-8 space-y-6" @submit.prevent="handleJoin">
        <input v-model="username" type="text" required placeholder="Your nickname"
          class="block w-full px-3 py-2 border rounded-md">
        <input v-model="roomCode" type="text" placeholder="Room code (optional)"
          class="block w-full px-3 py-2 border rounded-md">
        <div v-if="error" class="text-red-600 text-sm">{{ error }}</div>
        <button type="submit" :disabled="!username.trim()" class="w-full py-2 bg-indigo-600 text-white rounded-md">
          {{ roomCode ? 'Join Room' : 'Create Room' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const username = ref('');
const roomCode = ref('');
const error = ref('');
const router = useRouter();
const { $socket } = useNuxtApp()

const handleJoin = () => {
  if (!username.value.trim()) {
    error.value = 'Nickname is required';
    return;
  }

  // Сохраняем никнейм в localStorage
  localStorage.setItem('username', username.value.trim());

  // Убеждаемся что socket подключен
  if ($socket.disconnected) {
    $socket.connect();
  }

  if (roomCode.value.trim()) {
    // Присоединяемся к комнате
    $socket.emit('join-room', {
      username: username.value.trim(),
      roomCode: roomCode.value.trim()
    });
  } else {
    // Создаём новую комнату
    $socket.emit('create-room', username.value.trim());
  }

  // Обрабатываем ошибки
  $socket.once('error', (msg: string) => {
    error.value = msg;
  });

  // Когда создали комнату — переходим
  $socket.once('room-created', (code: string) => {
    router.push(`/chat/${code}`);
  });

  // Когда присоединились к существующей — переходим
  $socket.once('joined', (code: string) => {
    router.push(`/chat/${code}`);
  });
};
</script>