<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
    <div class="max-w-md w-full space-y-8">
      <h2 class="text-center text-3xl font-extrabold text-gray-900">Join or Create</h2>
      <div class="flex gap-4 justify-center">
        <button @click="mode = 'chat'" :class="[
          'px-6 py-2 rounded-md font-medium transition',
          mode === 'chat'
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        ]">💬 Chat</button>
        <button @click="mode = 'chess'" :class="[
          'px-6 py-2 rounded-md font-medium transition',
          mode === 'chess'
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        ]">♟️ Chess</button>
      </div>
      <form class="mt-8 space-y-6" @submit.prevent="handleJoin">
        <input v-model="username" type="text" required placeholder="Your nickname"
          class="block w-full px-3 py-2 border rounded-md" />
        <input v-model="roomCode" type="text" placeholder="Room code (optional)"
          class="block w-full px-3 py-2 border rounded-md" />
        <div v-if="error" class="text-red-600 text-sm">{{ error }}</div>
        <button type="submit" :disabled="!username.trim()"
          class="w-full py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50 font-medium">
          {{ roomCode ? 'Join' : 'Create' }} {{ mode === 'chat' ? 'Chat' : 'Chess Game' }}
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
const mode = ref<'chat' | 'chess'>('chat');
const router = useRouter();

const handleJoin = () => {
  if (!username.value.trim()) {
    error.value = 'Nickname is required';
    return;
  }

  localStorage.setItem('username', username.value.trim());

  const { $socket } = useNuxtApp();

  // Убедись, что сокет уже подключен
  if (!$socket.connected) {
    $socket.connect();
  }

  // Отправляй сразу
  if (roomCode.value.trim()) {
    console.log('Emitting join-room');
    $socket.emit('join-room', {
      username: username.value.trim(),
      roomCode: roomCode.value.trim()
    });
  } else {
    console.log('Emitting create-room');
    $socket.emit('create-room', username.value.trim());
  }

  $socket.once('room-created', (code: string) => {
    console.log('Room created:', code);
    const route = mode.value === 'chess' ? `/game/${code}` : `/chat/${code}`;
    router.push(route);
  });

  $socket.once('joined', (code: string) => {
    console.log('Joined room:', code);
    const route = mode.value === 'chess' ? `/game/${code}` : `/chat/${code}`;
    router.push(route);
  });
};


</script>
