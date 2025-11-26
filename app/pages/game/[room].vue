<template>
  <div class="min-h-screen bg-gray-900 text-white p-4">
    <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Доска -->
      <div class="lg:col-span-2">
        <div class="bg-gray-800 p-4 rounded-lg">
          <h2 class="text-2xl font-bold mb-2">Room: {{ roomCode }}</h2>
          <p class="text-sm text-gray-400 mb-4">Players: {{ users.length }}/2</p>

          <!-- Список игроков -->
          <div class="mb-4 p-3 bg-gray-700 rounded">
            <p class="text-sm font-semibold mb-2">Players</p>
            <div class="flex gap-2">
              <div v-for="user in users" :key="user.id" class="px-3 py-1 bg-blue-600 rounded text-sm">
                {{ user.username }}
              </div>
              <div v-if="users.length < 2" class="px-3 py-1 bg-gray-600 rounded text-sm text-gray-300">
                Waiting for player...
              </div>
            </div>
          </div>

          <!-- Кнопка старта -->
          <div v-if="users.length === 2 && !gameStarted" class="mb-4">
            <button @click="startGame" class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold">
              ▶ Start Game
            </button>
          </div>

          <!-- Статус игры -->
          <div v-if="gameStarted" class="mb-4 p-3 bg-blue-900 rounded">
            <p class="text-sm">Moves: {{ moves.length }}</p>
          </div>

          <!-- Шахматная доска -->
          <div class="bg-gray-700 p-4 rounded mb-4">
            <TheChessboard :board-config="boardConfig" @board-created="onBoardCreated" @move="onMove"
              @checkmate="onCheckmate" @stalemate="onStalemate" @draw="onDraw" @check="onCheck" />
          </div>

          <!-- Кнопки управления -->
          <div v-if="gameStarted" class="flex gap-2">
            <button @click="undoMove" :disabled="moves.length === 0"
              class="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded">
              ↶ Undo
            </button>
            <button @click="resetGame" class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded">
              ↻ Reset
            </button>
          </div>
        </div>
      </div>

      <!-- Боковая панель -->
      <div class="lg:col-span-1 flex flex-col gap-4">
        <!-- История ходов -->
        <div class="bg-gray-800 p-4 rounded-lg">
          <h3 class="text-lg font-bold mb-3">Moves ({{ moves.length }})</h3>
          <div class="bg-gray-700 h-48 overflow-y-auto rounded p-2 text-sm space-y-1">
            <div v-if="moves.length === 0" class="text-gray-500">No moves yet</div>
            <div v-for="(move, i) in moves" :key="i" class="py-1 px-2 bg-gray-600 rounded border-l-2 border-blue-500">
              <span class="font-semibold">{{ i + 1 }}.</span>
              <span class="text-yellow-300">{{ move.san }}</span>
              <span class="text-gray-400 text-xs ml-1">{{ move.username }}</span>
            </div>
          </div>
        </div>

        <!-- Чат -->
        <div class="bg-gray-800 p-4 rounded-lg flex flex-col flex-1">
          <h3 class="text-lg font-bold mb-3">Chat</h3>
          <div ref="chatContainer" class="bg-gray-700 flex-1 overflow-y-auto rounded p-2 mb-2 text-sm space-y-1">
            <div v-if="messages.length === 0" class="text-gray-500">No messages</div>
            <div v-for="msg in messages" :key="msg.id" class="py-1 px-2 bg-gray-600 rounded">
              <span class="font-semibold text-blue-400">{{ msg.username }}:</span>
              <span class="text-gray-100">{{ msg.message }}</span>
            </div>
          </div>
          <div class="flex gap-2">
            <input v-model="messageText" @keyup.enter="sendMessage" type="text" placeholder="Message..."
              class="flex-1 px-3 py-2 bg-gray-600 text-white rounded text-sm placeholder-gray-400 focus:outline-none focus:bg-gray-500" />
            <button @click="sendMessage" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TheChessboard } from 'vue3-chessboard';
import 'vue3-chessboard/style.css';
import { useRoute } from 'vue-router';
import type { BoardApi, BoardConfig, MoveEvent } from 'vue3-chessboard';

const route = useRoute();
const roomCode = ref(route.params.room as string);
const { $socket } = useNuxtApp();

let boardAPI: BoardApi | null = null;

const boardConfig: BoardConfig = {
  coordinates: true,
};

const users = ref<any[]>([]);
const messages = ref<any[]>([]);
const moves = ref<any[]>([]);
const gameStarted = ref(false);
const messageText = ref('');
const currentUsername = ref('');
const chatContainer = ref<HTMLElement | null>(null);

// Tracks moves locally to prevent duplicate processing
const processedMoveIds = new Set<string>();

onMounted(() => {
  console.log(boardAPI)

  currentUsername.value = localStorage.getItem('username') || 'Anonymous';
  console.log('🎮 Game component mounted, room:', roomCode.value);

  // ============ SOCKET LISTENERS ============

  // Обновления пользователей
  $socket.on('users-update', (usersList: any[]) => {
    console.log('👥 Users update:', usersList.length, 'players');
    users.value = usersList || [];
  });

  // История сообщений при входе
  $socket.on('message-history', (history: any[]) => {
    console.log('💬 Message history:', history.length, 'messages');
    messages.value = history || [];
    nextTick(() => scrollChatToBottom());
  });

  // Новые сообщения
  $socket.on('message-received', (msg: any) => {
    console.log('💬 New message from', msg.username);
    messages.value.push(msg);
    nextTick(() => scrollChatToBottom());
  });

  // Состояние игры при входе
  $socket.on('game-state', (state: any) => {
    console.log('🎮 Game state received:', { status: state.status, moves: state.moves?.length || 0 });
    if (state) {
      moves.value = state.moves || [];

      // Если уже есть ходы, воспроизведём их все
      if (state.moves && state.moves.length > 0 && boardAPI) {
        console.log('🔄 Replaying', state.moves.length, 'moves');
        replayMoves(state.moves);
      }

      if (state.status === 'playing') {
        gameStarted.value = true;
      }
    }
  });

  // Старт игры
  $socket.on('chess-game-started', (data: any) => {
    console.log('▶️ Game started:', data.whitePlayer, 'vs', data.blackPlayer);
    gameStarted.value = true;
    moves.value = [];
    processedMoveIds.clear();
    if (boardAPI) {
      boardAPI.resetBoard();
    }
  });

  // Ходы других игроков
  $socket.on('chess-move-received', (move: any) => {
    const moveId = `${move.from}${move.to}${move.promotion || ''}`;

    if (processedMoveIds.has(moveId)) {
      console.log('⏭️  Move already processed, skipping:', move.san);
      return;
    }

    console.log('🎯 Move received:', move.san, 'by', move.username);
    processedMoveIds.add(moveId);
    moves.value.push(move);

    if (boardAPI && move.fen) {
      boardAPI.setPosition(move.fen); // <-- это публичный метод, так и надо!
    }
  });

  // Отмена хода
  $socket.on('chess-undo-received', () => {
    console.log('↶ Undo received');
    if (boardAPI) {
      boardAPI.undoLastMove();
    }
    moves.value.pop();
    processedMoveIds.clear(); // Очищаем, так как ходы изменились
  });

  // Сброс доски
  $socket.on('chess-reset-received', () => {
    console.log('↻ Reset received');
    if (boardAPI) {
      boardAPI.resetBoard();
    }
    moves.value = [];
    gameStarted.value = false;
    processedMoveIds.clear();
  });

  // Присоединение пользователя
  $socket.on('user-joined', (msg: string) => {
    console.log('👋', msg);
    messages.value.push({
      id: Date.now().toString(),
      username: 'System',
      message: msg,
      timestamp: new Date()
    });
    nextTick(() => scrollChatToBottom());
  });
});

// ============ BOARD EVENTS ============

const onBoardCreated = (api: BoardApi) => {
  console.log('✅ Board API ready');
  boardAPI = api;
};

const onMove = (move: MoveEvent) => {
  if (!gameStarted.value) return;

  const moveData = {
    from: move.from,
    to: move.to,
    promotion: move.promotion || undefined,
    fen: boardAPI?.getFen() || '', // <-- всегда getFen
    san: move.san
  };

  moves.value.push({ ...moveData, username: currentUsername.value, timestamp: new Date() });
  $socket.emit('chess-move', moveData);
};

const onCheckmate = (isMated: string) => {
  const winner = isMated === 'w' ? '⚪ White' : '⚫ Black';
  console.log('🏁 Checkmate!', winner, 'wins');
  messages.value.push({
    id: Date.now().toString(),
    username: 'System',
    message: `🏁 Checkmate! ${winner} wins!`,
    timestamp: new Date()
  });
  gameStarted.value = false;
  nextTick(() => scrollChatToBottom());
};

const onStalemate = () => {
  console.log('🤝 Stalemate!');
  messages.value.push({
    id: Date.now().toString(),
    username: 'System',
    message: '🤝 Stalemate! Draw!',
    timestamp: new Date()
  });
  gameStarted.value = false;
  nextTick(() => scrollChatToBottom());
};

const onDraw = () => {
  console.log('📊 Draw!');
  messages.value.push({
    id: Date.now().toString(),
    username: 'System',
    message: '📊 Draw agreed!',
    timestamp: new Date()
  });
  gameStarted.value = false;
  nextTick(() => scrollChatToBottom());
};

const onCheck = (isInCheck: string) => {
  const player = isInCheck === 'w' ? '⚪ White' : '⚫ Black';
  console.log('⚠️ Check!', player, 'is in check');
};

// ============ GAME CONTROLS ============

const startGame = () => {
  if (users.value.length < 2) {
    console.warn('❌ Not enough players');
    return;
  }

  const whitePlayer = users.value[0].username;
  const blackPlayer = users.value[1].username;

  console.log('🎮 Starting game:', whitePlayer, '(white) vs', blackPlayer, '(black)');
  $socket.emit('chess-start-game', { whitePlayer, blackPlayer });
};

const undoMove = () => {
  console.log('↶ Undo move');
  $socket.emit('chess-undo');
};

const resetGame = () => {
  console.log('↻ Reset game');
  $socket.emit('chess-reset');
};

// ============ CHAT ============

const sendMessage = () => {
  if (!messageText.value.trim()) return;

  console.log('📤 Sending message');
  $socket.emit('new-message', messageText.value);
  messageText.value = '';
};

const scrollChatToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

// ============ HELPERS ============

const replayMoves = (movesToReplay: any[]) => {
  if (!boardAPI) return;

  boardAPI.resetBoard();

  for (const move of movesToReplay) {
    try {
      boardAPI.move({ from: move.from, to: move.to, promotion: move.promotion });  // ← boardAPI.move()
      const moveId = `${move.from}${move.to}${move.promotion || ''}`;
      processedMoveIds.add(moveId);
    } catch (error) {
      console.error('Error replaying move:', move.san, error);
    }
  }
};

onUnmounted(() => {
  console.log('Game component unmounted');
});
</script>
