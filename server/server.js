/**
 * ============================================================
 * NEON KART - SERVIDOR MULTIPLAYER
 * ============================================================
 * Servidor Node.js + Socket.IO que gerencia salas, jogadores,
 * sincronização de posições, voltas e ranking em tempo real.
 *
 * Como rodar:
 *   1) npm install
 *   2) npm start
 *   3) Servidor sobe em http://localhost:3000
 * ============================================================
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// ------------------- CONFIGURAÇÃO BÁSICA -------------------
const app = express();
app.use(cors());

// Servimos os arquivos do cliente direto pelo servidor
// (útil em dev local; no GitHub Pages o cliente é estático)
app.use(express.static(path.join(__dirname, '..', 'client')));

const server = http.createServer(app);

// CORS aberto para permitir o cliente do GitHub Pages se conectar
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// ------------------- ESTADO DAS SALAS -------------------
/**
 * Estrutura de cada sala:
 * {
 *   id: 'sala123',
 *   hostId: socketId,
 *   state: 'lobby' | 'racing' | 'finished',
 *   players: {
 *     [socketId]: { id, nickname, habboNick, x, y, angle, lap, checkpoint, finished, position, color }
 *   },
 *   startTime: timestamp,
 *   maxLaps: 3
 * }
 */
const rooms = {};

// Paleta de cores neon para os carros
const NEON_COLORS = [
  '#ff00ff', // magenta
  '#00ffff', // ciano
  '#ffff00', // amarelo
  '#00ff88', // verde neon
  '#ff0066', // rosa
  '#ff6600', // laranja
  '#8800ff', // roxo
  '#00aaff'  // azul elétrico
];

// ------------------- HELPERS -------------------

/** Cria uma sala nova com ID aleatório */
function createRoom(roomId) {
  rooms[roomId] = {
    id: roomId,
    hostId: null,
    state: 'lobby',
    players: {},
    startTime: null,
    maxLaps: 3
  };
  console.log(`[SALA] Criada: ${roomId}`);
  return rooms[roomId];
}

/** Pega a próxima cor disponível na sala */
function getAvailableColor(room) {
  const usadas = Object.values(room.players).map(p => p.color);
  return NEON_COLORS.find(c => !usadas.includes(c)) || NEON_COLORS[0];
}

/** Retorna lista pública dos jogadores (sem dados sensíveis) */
function getPlayerList(room) {
  return Object.values(room.players).map(p => ({
    id: p.id,
    nickname: p.nickname,
    habboNick: p.habboNick,
    color: p.color,
    isHost: p.id === room.hostId
  }));
}

/** Limpa salas vazias para evitar memory leak */
function cleanRoomIfEmpty(roomId) {
  if (rooms[roomId] && Object.keys(rooms[roomId].players).length === 0) {
    delete rooms[roomId];
    console.log(`[SALA] Removida (vazia): ${roomId}`);
  }
}

// ------------------- SOCKET.IO - EVENTOS -------------------
io.on('connection', (socket) => {
  console.log(`[CONEXÃO] ${socket.id}`);

  /**
   * Entrar em uma sala. Se não existir, cria.
   * O primeiro jogador vira host automaticamente.
   */
  socket.on('joinRoom', ({ roomId, nickname, habboNick }) => {
    // Sanitiza inputs
    nickname = (nickname || 'Player').slice(0, 16);
    habboNick = (habboNick || '').slice(0, 16);
    roomId = roomId || 'main';

    // Cria sala se não existir
    if (!rooms[roomId]) createRoom(roomId);
    const room = rooms[roomId];

    // Se a corrida já começou, manda o jogador esperar
    if (room.state === 'racing') {
      socket.emit('roomBusy', { message: 'A corrida já começou! Aguarde a próxima.' });
      return;
    }

    // Limite de 8 jogadores por sala
    if (Object.keys(room.players).length >= 8) {
      socket.emit('roomFull', { message: 'Sala cheia! (máx. 8 jogadores)' });
      return;
    }

    // Adiciona jogador
    room.players[socket.id] = {
      id: socket.id,
      nickname,
      habboNick,
      x: 0, y: 0, angle: 0,
      lap: 0,
      checkpoint: 0,
      finished: false,
      position: 0,
      color: getAvailableColor(room)
    };

    // Primeiro jogador vira host
    if (!room.hostId) {
      room.hostId = socket.id;
      console.log(`[HOST] ${nickname} virou host da sala ${roomId}`);
    }

    socket.join(roomId);
    socket.data.roomId = roomId;

    // Confirma entrada para o jogador
    socket.emit('joinedRoom', {
      roomId,
      playerId: socket.id,
      isHost: room.hostId === socket.id,
      color: room.players[socket.id].color
    });

    // Atualiza todos no lobby
    io.to(roomId).emit('lobbyUpdate', {
      players: getPlayerList(room),
      hostId: room.hostId
    });
  });

  /**
   * Host pediu para iniciar a corrida.
   * Só o host pode disparar isso.
   */
  socket.on('startRace', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return; // só host

    room.state = 'racing';
    room.startTime = Date.now();

    // Define posições iniciais (grid de largada em 2 colunas)
    const playerIds = Object.keys(room.players);
    playerIds.forEach((id, i) => {
      const p = room.players[id];
      const col = i % 2;
      const row = Math.floor(i / 2);
      // Coordenadas iniciais do grid (ajustadas no cliente também)
      p.x = 400 + col * 60;
      p.y = 300 + row * 80;
      p.angle = 0;
      p.lap = 0;
      p.checkpoint = 0;
      p.finished = false;
    });

    io.to(roomId).emit('raceStart', {
      players: room.players,
      maxLaps: room.maxLaps,
      startTime: room.startTime
    });
    console.log(`[CORRIDA] Iniciada na sala ${roomId} com ${playerIds.length} jogadores`);
  });

  /**
   * Cliente envia sua posição/ângulo várias vezes por segundo.
   * Servidor repassa para os outros jogadores da sala.
   */
  socket.on('playerUpdate', (data) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.state !== 'racing') return;
    const p = room.players[socket.id];
    if (!p) return;

    p.x = data.x;
    p.y = data.y;
    p.angle = data.angle;
    p.speed = data.speed;

    // Broadcast aos demais (não inclui o próprio remetente)
    socket.to(roomId).emit('playersState', {
      [socket.id]: { x: p.x, y: p.y, angle: p.angle, speed: p.speed }
    });
  });

  /**
   * Jogador passou por um checkpoint ou completou uma volta.
   * Quem controla isso é o cliente (decisão de simplicidade);
   * em produção o ideal seria validar no servidor.
   */
  socket.on('checkpoint', ({ checkpoint, lap }) => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.state !== 'racing') return;
    const p = room.players[socket.id];
    if (!p || p.finished) return;

    p.checkpoint = checkpoint;
    p.lap = lap;

    // Terminou a corrida?
    if (lap >= room.maxLaps) {
      p.finished = true;
      p.finishTime = Date.now() - room.startTime;
      const finishedCount = Object.values(room.players).filter(x => x.finished).length;
      p.position = finishedCount;

      io.to(roomId).emit('playerFinished', {
        playerId: socket.id,
        nickname: p.nickname,
        position: p.position,
        finishTime: p.finishTime
      });

      // Encerra assim que o primeiro terminar
      if (finishedCount === 1) {
        room.state = 'finished';

        // Terminados primeiro (por posição), depois os demais (por volta/checkpoint)
        const finished   = Object.values(room.players).filter(x => x.finished)
          .sort((a, b) => a.position - b.position);
        const unfinished = Object.values(room.players).filter(x => !x.finished)
          .sort((a, b) => b.lap !== a.lap ? b.lap - a.lap : b.checkpoint - a.checkpoint);

        const ranking = [...finished, ...unfinished].map(x => ({
          nickname:   x.nickname,
          habboNick:  x.habboNick,
          position:   x.position,
          color:      x.color,
          finishTime: x.finishTime || null
        }));

        io.to(roomId).emit('raceFinished', { ranking });
        console.log(`[CORRIDA] Encerrada na sala ${roomId} — vencedor: ${p.nickname}`);

        // Volta para o lobby após 8s
        setTimeout(() => {
          if (rooms[roomId]) {
            rooms[roomId].state = 'lobby';
            io.to(roomId).emit('backToLobby', { players: getPlayerList(rooms[roomId]) });
          }
        }, 8000);
      }
    }

    // Atualiza ranking ao vivo
    broadcastRanking(roomId);
  });

  /**
   * Jogador pegou um boost (informativo, para sincronizar visual)
   */
  socket.on('boostPickup', ({ boostId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    io.to(roomId).emit('boostTaken', { boostId, byId: socket.id });
  });

  /**
   * Host quer voltar ao lobby antes do timer automático (da tela de pódio).
   */
  socket.on('readyToLobby', () => {
    const roomId = socket.data.roomId;
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id || room.state !== 'finished') return;

    room.state = 'lobby';
    Object.values(room.players).forEach(p => {
      p.lap = 0; p.checkpoint = 0; p.finished = false; p.position = 0;
    });
    io.to(roomId).emit('backToLobby', { players: getPlayerList(room) });
    console.log(`[LOBBY] Host voltou ao lobby na sala ${roomId}`);
  });

  /**
   * Desconexão: remove jogador e, se era host, passa o host adiante.
   */
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;
    const room = rooms[roomId];

    delete room.players[socket.id];
    console.log(`[SAIU] ${socket.id} da sala ${roomId}`);

    // Se o host saiu, passa para o próximo jogador
    if (room.hostId === socket.id) {
      const remaining = Object.keys(room.players);
      room.hostId = remaining[0] || null;
      if (room.hostId) {
        io.to(room.hostId).emit('youAreHost');
      }
    }

    io.to(roomId).emit('lobbyUpdate', {
      players: getPlayerList(room),
      hostId: room.hostId
    });

    cleanRoomIfEmpty(roomId);
  });
});

/** Calcula e envia o ranking ao vivo (baseado em volta + checkpoint) */
function broadcastRanking(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const ranking = Object.values(room.players)
    .map(p => ({
      id: p.id,
      nickname: p.nickname,
      lap: p.lap,
      checkpoint: p.checkpoint,
      finished: p.finished,
      position: p.position
    }))
    .sort((a, b) => {
      // Quem terminou vem primeiro, ordenado por posição final
      if (a.finished && b.finished) return a.position - b.position;
      if (a.finished) return -1;
      if (b.finished) return 1;
      // Depois quem está em volta maior; empate -> mais checkpoints
      if (b.lap !== a.lap) return b.lap - a.lap;
      return b.checkpoint - a.checkpoint;
    });
  io.to(roomId).emit('rankingUpdate', { ranking });
}

// ------------------- ROTA RAIZ -------------------
app.get('/health', (req, res) => res.json({ ok: true, rooms: Object.keys(rooms).length }));

server.listen(PORT, () => {
  console.log(`\n🏁 Neon Kart Server rodando na porta ${PORT}`);
  console.log(`   Cliente local:  http://localhost:${PORT}`);
  console.log(`   Health:         http://localhost:${PORT}/health\n`);
});
