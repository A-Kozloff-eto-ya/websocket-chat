<template>
  <div class="min-h-screen flex items-center justify-center bg-[#f7f7ff] py-12 px-4">
    <div class="max-w-md w-full space-y-8">
      <h2 class="text-center text-3xl font-extrabold text-gray-900">Войти или создать игру</h2>
      <form class="mt-8 space-y-6 box-border" @submit.prevent="handleJoin">
        <input v-model="username" type="text" required placeholder="Ваш никнейм"
          class="block w-full px-3 py-2 border rounded-md border-[#1a3678]"/>
        <input v-model="roomCode" type="text" placeholder="Код комнаты (опционально)"
          class="block w-full px-3 py-2 border rounded-md border-[#1a3678]" />
        <div v-if="error" class="text-red-600 text-sm">{{ error }}</div>
        <button type="submit" :disabled="!username.trim()"
          class="w-full py-2 bg-[#1a3678] text-white rounded-md disabled:opacity-50 font-medium">
          {{ roomCode ? 'Войти' : 'Создать' }} {{ roomCode ? 'в игру' : 'игру' }}
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
const mode = ref<'chat' | 'chess'>('chess');
const router = useRouter();

const password = ref<string>('')
const isAuth = ref<boolean>(false)

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

async function checkPassword () {
  const res = await $fetch('/api/submit', {
    method: 'POST',
    body: {
      password: password.value
    },
  })
  if(res) {
    console.log(res)
  }
}
</script>
