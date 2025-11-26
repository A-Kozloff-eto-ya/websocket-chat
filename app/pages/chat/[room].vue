<!-- pages/chat/[room].vue -->
<template>
  <div class="flex h-screen bg-gray-100">
    <!-- Список участников -->
    <div class="w-64 bg-white shadow-lg">
      <div class="p-4 bg-indigo-600 text-white"><h3>Participants ({{ users.length }})</h3></div>
      <div class="p-4">
        <div v-for="user in users" :key="user.id" class="mb-2">{{ user.username }}</div>
      </div>
    </div>

    <!-- Чат -->
    <div class="flex-1 flex flex-col">
      <div class="bg-white p-4 flex justify-between">
        <h1 class="text-xl">Chat Room: {{ $route.params.room }}</h1>
        <button @click="leaveChat" class="px-3 py-1 bg-red-500 text-white rounded">Leave</button>
      </div>
      <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
        <div v-for="msg in messages" :key="msg.id">
          <strong>{{ msg.username }}:</strong> {{ msg.message }} <span class="text-gray-500 text-sm">({{ formatTime(msg.timestamp) }})</span>
        </div>
      </div>
      <form @submit.prevent="sendMessage" class="bg-white p-4 border-t flex">
        <input v-model="newMessage" type="text" placeholder="Type a message" class="flex-1 px-3 py-2 border rounded-md">
        <button type="submit" :disabled="!newMessage.trim()" class="px-4 py-2 bg-indigo-600 text-white rounded-md">Send</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';

interface Message { id: string; username: string; message: string; timestamp: Date }
interface User { id: string; username: string; room: string }

const route = useRoute();
const router = useRouter();
const { $socket } = useNuxtApp()
const messages = ref<Message[]>([]);
const users = ref<User[]>([]);
const newMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const processedJoinEvents = ref<Set<string>>(new Set()); // Отслеживаем уже обработанные события

onMounted(() => {
  if ($socket.disconnected) {
    $socket.connect();
  }

  $socket.off('message-history');
  $socket.off('message-received');
  $socket.off('users-update');
  $socket.off('user-joined');
  $socket.off('user-left');

  processedJoinEvents.value.clear(); // Очищаем список обработанных событий

  const room = route.params.room as string;
  const username = localStorage.getItem('username') || 'Anonymous';

  $socket.emit('join-room', { username, roomCode: room });

  $socket.on('message-history', (history: Message[]) => {
    messages.value = history;
    scrollToBottom();
  });

  $socket.on('message-received', (msg: Message) => {
    messages.value.push(msg);
    scrollToBottom();
  });

  $socket.on('users-update', (list: User[]) => {
    users.value = list;
  });

  $socket.on('user-joined', (msg: string) => {
    // ИСПРАВЛЕНИЕ: дедупликация - проверяем, не обработали ли мы это событие
    // Используем комбинацию сообщения и текущего времени для уникальности
    const eventKey = `${msg}-${Date.now()}`;
    
    // Если событие с таким ключом уже обработано в течение 100ms, пропускаем
    if (processedJoinEvents.value.has(msg)) {
      console.log('Duplicate join event skipped:', msg);
      return;
    }

    processedJoinEvents.value.add(msg);
    
    // Удаляем из set через 100ms (на случай если придет точный дубликат)
    setTimeout(() => {
      processedJoinEvents.value.delete(msg);
    }, 100);

    messages.value.push({ id: Date.now().toString(), username: 'System', message: msg, timestamp: new Date() });
    scrollToBottom();
  });

  $socket.on('user-left', (msg: string) => {
    messages.value.push({ id: Date.now().toString(), username: 'System', message: msg, timestamp: new Date() });
    scrollToBottom();
  });
});

const sendMessage = () => {
  if (!newMessage.value.trim()) return;
  $socket.emit('new-message', newMessage.value.trim());
  newMessage.value = '';
};

const leaveChat = () => {
  $socket.off();
  $socket.disconnect();
  router.push('/join');
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  });
};

const formatTime = (date: Date) => new Date(date).toLocaleTimeString();

onBeforeUnmount(() => {
  $socket.off();
  $socket.disconnect();
});
</script>