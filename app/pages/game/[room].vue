// pages/game/[room].vue - ПОЛНЫЙ ИСПРАВЛЕННЫЙ ФАЙЛ

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
            <p class="text-sm mt-2">
              Your color: <span class="font-bold">{{ playerColor === 'w' ? '⚪ White' : '⚫ Black' }}</span>
            </p>
            <p class="text-sm mt-1">
              Current turn:
              <span :class="currentTurn === 'w' ? 'text-yellow-300' : 'text-gray-300'" class="font-bold">
                {{ currentTurn === 'w' ? '⚪ White' : '⚫ Black' }}
              </span>
              <span v-if="playerColor === currentTurn" class="ml-2 text-green-400">✓ Your turn!</span>
              <span v-else class="ml-2 text-red-400">⏳ Waiting...</span>
            </p>
          </div>

          <!-- Шахматная доска -->
          <div class="bg-gray-700 p-4 rounded mb-4">
            <div :class="{ 'chessboard-disabled': gameStarted && playerColor !== currentTurn }">
              <TheChessboard :key="boardOrientation" :board-config="boardConfig" @board-created="onBoardCreated"
                @move="onMove" @checkmate="onCheckmate" @stalemate="onStalemate" @draw="onDraw" @check="onCheck" />
            </div>
          </div>

          <!-- Кнопки управления -->
          <div v-if="gameStarted" class="flex gap-2">
            <button @click="undoMove" :disabled="!canUndo"
              :title="!canUndo ? 'You can only undo your own last move' : 'Undo your last move'"
              class="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition">
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
const boardOrientation = ref<'white' | 'black'>('white');
const boardConfig = computed(() => ({
  coordinates: true,
  orientation: boardOrientation.value
}));

const playerColor = ref<'w' | 'b' | null>(null);
const currentTurn = ref<'w' | 'b'>('w');
const users = ref<any[]>([]);
const messages = ref<any[]>([]);
const moves = ref<any[]>([]);
const gameStarted = ref(false);
const messageText = ref('');
const currentUsername = ref('');
const chatContainer = ref<HTMLElement | null>(null);

const onBoardCreated = (api: BoardApi) => {
  console.log('✅ Board API ready');
  boardAPI = api;
};

const onMove = (move: MoveEvent) => {
  if (!gameStarted.value) {
    console.warn('❌ Game not started');
    if (boardAPI) boardAPI.undoLastMove();
    return;
  }

  if (playerColor.value !== currentTurn.value) {
    console.warn(`❌ Not your turn!`);
    if (boardAPI) {
      setTimeout(() => boardAPI?.undoLastMove(), 0);
    }
    return;
  }

  const fen = boardAPI?.getFen() || '';

  const moveData = {
    from: move.from,
    to: move.to,
    promotion: move.promotion || undefined,
    fen: fen,
    san: move.san
  };

  console.log(`📤 Sending move: ${move.san}`);
  $socket.emit('chess-move', moveData);
};

const canUndo = computed(() => {
  // Undo доступен ТОЛЬКО если:
  // 1. Игра идёт
  // 2. Есть ходы
  // 3. Это ТВОЙ ход
  // 4. Это ПОСЛЕДНИЙ ход в истории

  if (!gameStarted.value || moves.value.length === 0) {
    return false;
  }

  const lastMove = moves.value[moves.value.length - 1];
  const isMyLastMove = lastMove.username === currentUsername.value;

  console.log(`🔍 Undo check: lastMove="${lastMove.san}" by "${lastMove.username}", you="${currentUsername.value}", allowed=${isMyLastMove}`);

  return isMyLastMove;
});

onMounted(() => {
  currentUsername.value = localStorage.getItem('username') || 'Anonymous';
  console.log('🎮 Game component mounted, room:', roomCode.value);

  $socket.on('users-update', (usersList: any[]) => {
    console.log('👥 Users update:', usersList.length, 'players');
    users.value = usersList || [];

    // ✅ Когда оба игрока подключены, определи цвет
    if (usersList.length === 2 && !playerColor.value) {
      const whitePlayer = usersList[0].username;
      const blackPlayer = usersList[1].username;

      if (currentUsername.value === whitePlayer) {
        playerColor.value = 'w';
        boardOrientation.value = 'white';
        console.log('⚪ Determined: You are WHITE');
      } else {
        playerColor.value = 'b';
        boardOrientation.value = 'black';
        console.log('⚫ Determined: You are BLACK');
      }
    }
  });

  $socket.once('message-history', (history: any[]) => {
    console.log('💬 Message history:', history.length, 'messages');
    messages.value = history || [];
    nextTick(() => scrollChatToBottom());
  });

  $socket.on('message-received', (msg: any) => {
    console.log('💬 New message from', msg.username);
    messages.value.push(msg);
    nextTick(() => scrollChatToBottom());
  });

  $socket.once('game-state', (state: any) => {
    console.log('🎮 Game state received');
    if (state && state.moves) {
      moves.value = state.moves;
      currentTurn.value = state.currentTurn || 'w';

      if (state.status === 'playing' && boardAPI) {
        gameStarted.value = true;
        console.log('🔄 Replaying', state.moves.length, 'moves from FEN:', state.fen);
        boardAPI.setPosition(state.fen);

        // ✅ ДОБАВЬ ЗДЕСЬ:
        // Определи свой цвет по первому ходу или по позиции в комнате
        if (state.whitePlayer) {
          if (currentUsername.value === state.whitePlayer) {
            playerColor.value = 'w';
            boardOrientation.value = 'white';
            console.log('⚪ You are WHITE');
          } else {
            playerColor.value = 'b';
            boardOrientation.value = 'black';
            console.log('⚫ You are BLACK');
          }
        }
      }
    }
  });

  $socket.on('chess-game-started', (data: any) => {
    console.log('▶️ Game started:', data.whitePlayer, 'vs', data.blackPlayer);
    gameStarted.value = true;
    moves.value = [];
    currentTurn.value = data.currentTurn || 'w';

    if (currentUsername.value === data.whitePlayer) {
      playerColor.value = 'w';
      boardOrientation.value = 'white';
      console.log('⚪ You are WHITE');
      console.log('🔄 Board orientation set to: white');
    } else {
      playerColor.value = 'b';
      boardOrientation.value = 'black';
      console.log('⚫ You are BLACK');
      console.log('🔄 Board orientation set to: black');  // ← ДОБАВЬ ЭТО
    }

    if (boardAPI) {
      boardAPI.resetBoard();
      if (data.fen) {
        nextTick(() => boardAPI?.setPosition(data.fen));
      }
    }
  });

  $socket.on('chess-move-received', (move: any) => {
    console.log('🎯 Move received:', move.san, 'by', move.username);

    moves.value.push({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      fen: move.fen,
      san: move.san,
      username: move.username,
      timestamp: new Date(move.timestamp)
    });

    if (boardAPI && move.fen) {
      boardAPI.setPosition(move.fen);
    }

    if (move.currentTurn !== undefined) {
      currentTurn.value = move.currentTurn;
      console.log(
        `↔️ Turn synced to: ${currentTurn.value === 'w' ? '⚪ White' : '⚫ Black'}`
      );
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ UNDO - С ПОЛНЫМ ЛОГИРОВАНИЕМ И ПРАВИЛЬНЫМ ПОРЯДКОМ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  $socket.on('chess-undo-received', (data: any) => {
    console.log('↶ Undo received from server', {
      removedCount: data.removedCount,
      newMovesCount: data.moves.length,
      newTurn: data.currentTurn,
      newFen: data.fen
    });

    // ✅ ШАГ 1: ОБНОВЛЯЕМ ЛОКАЛЬНОЕ СОСТОЯНИЕ
    const oldMovesCount = moves.value.length;
    moves.value = data.moves || [];

    console.log(`  ├─ Updated moves: ${oldMovesCount} → ${moves.value.length}`);

    // ✅ ШАГ 2: ОБНОВЛЯЕМ ОЧЕРЕДЬ
    const oldTurn = currentTurn.value;
    currentTurn.value = data.currentTurn;

    console.log(`  ├─ Updated turn: ${oldTurn} → ${currentTurn.value}`);

    // ✅ ШАГ 3: ОБНОВЛЯЕМ ДОСКУ (ПОСЛЕДНЕЕ!)
    if (boardAPI && data.fen) {
      console.log(`  ├─ 🔄 Setting board to: ${data.fen.substring(0, 30)}...`);
      boardAPI.setPosition(data.fen);
      console.log(`  └─ ✅ Board updated`);
    }
  });

  $socket.on('chess-reset-received', (data: any) => {
    console.log('↻ Reset received');

    moves.value = [];
    currentTurn.value = data.currentTurn || 'w';
    gameStarted.value = false;

    if (boardAPI) {
      if (data.fen) {
        boardAPI.setPosition(data.fen);
      } else {
        boardAPI.resetBoard();
      }
    }
  });

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

  setTimeout(() => {
    console.log('📋 Requesting room state for:', roomCode.value);
    $socket.emit('get-room-state', roomCode.value);
  }, 500);
});

const onCheckmate = (isMated: string) => {
  const winner = isMated === 'b' ? '⚪ White' : '⚫ Black';
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
  if (!canUndo.value) {
    console.warn('❌ Cannot undo: Not your last move!');
    return;
  }

  console.log('↶ Undo move');
  $socket.emit('chess-undo');
};

const resetGame = () => {
  console.log('↻ Reset game');
  $socket.emit('chess-reset');
};

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

onUnmounted(() => {
  console.log('Game component unmounted');
  $socket.off('users-update');
  $socket.off('message-received');
  $socket.off('chess-game-started');
  $socket.off('chess-move-received');
  $socket.off('chess-undo-received');
  $socket.off('chess-reset-received');
  $socket.off('user-joined');
});
</script>

<style>
.chessboard-disabled {
  pointer-events: none;
}
</style>