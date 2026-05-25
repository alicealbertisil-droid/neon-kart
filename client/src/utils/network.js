/**
 * ============================================================
 * NEON KART - CAMADA DE REDE
 * ============================================================
 * Encapsula toda a comunicação com o servidor Socket.IO.
 * Usa o padrão de "callbacks registráveis" para o resto do
 * código reagir aos eventos sem se acoplar ao socket.
 *
 * USO:
 *   NK_Net.connect();
 *   NK_Net.on('joinedRoom', dados => { ... });
 *   NK_Net.joinRoom('sala1', 'Lucas', 'Lucas.exe');
 * ============================================================
 */

const NK_Net = (() => {
  let socket = null;
  const listeners = {}; // mapa: eventName -> [callbacks]
  let myId = null;
  let myRoomId = null;
  let isHost = false;

  /** Registra um callback para um evento do servidor */
  function on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  }

  /** Registra um callback que dispara apenas uma vez */
  function once(event, cb) {
    const wrapper = function(data) {
      cb(data);
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(fn => fn !== wrapper);
      }
    };
    on(event, wrapper);
  }

  /** Dispara callbacks registrados */
  function fire(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(cb => cb(data));
  }

  /** Conecta ao servidor */
  function connect() {
    if (socket) return;
    const url = window.NK_CONFIG.SERVER_URL;
    console.log('[NET] Conectando em', url);

    // polling primeiro: permite que o proxy do Render estabeleça a sessão
    // antes de tentar o upgrade para WebSocket
    socket = io(url, {
      transports: ['polling', 'websocket'],
      timeout: 30000,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      myId = socket.id;
      console.log('[NET] Conectado como', myId);
      fire('connected', { id: myId });
    });

    socket.on('connect_error', (err) => {
      console.error('[NET] Erro de conexão:', err.message);
      fire('connectionError', { message: err.message });
    });

    // Disparado após esgotar todas as tentativas de reconexão
    socket.io.on('reconnect_failed', () => {
      socket.disconnect();
      socket = null;
      myId = null;
      fire('reconnectFailed');
    });

    socket.on('disconnect', () => {
      console.log('[NET] Desconectado');
      fire('disconnected');
    });

    // ----- EVENTOS DO SERVIDOR -----
    socket.on('joinedRoom', (data) => {
      myRoomId = data.roomId;
      isHost = data.isHost;
      fire('joinedRoom', data);
    });
    socket.on('lobbyUpdate', (data) => fire('lobbyUpdate', data));
    socket.on('roomFull', (data) => fire('roomFull', data));
    socket.on('roomBusy', (data) => fire('roomBusy', data));
    socket.on('youAreHost', () => { isHost = true; fire('youAreHost'); });
    socket.on('raceStart', (data) => fire('raceStart', data));
    socket.on('playersState', (data) => fire('playersState', data));
    socket.on('rankingUpdate', (data) => fire('rankingUpdate', data));
    socket.on('playerFinished', (data) => fire('playerFinished', data));
    socket.on('raceFinished', (data) => fire('raceFinished', data));
    socket.on('backToLobby', (data) => fire('backToLobby', data));
    socket.on('boostTaken', (data) => fire('boostTaken', data));
    // ----- EVENTOS DE ITEM -----
    socket.on('itemReceived', (data) => fire('itemReceived', data));
    socket.on('itemBoxTaken', (data) => fire('itemBoxTaken', data));
    socket.on('itemEffect', (data) => fire('itemEffect', data));
    socket.on('itemDropped', (data) => fire('itemDropped', data));
    socket.on('itemHitConfirmed', (data) => fire('itemHitConfirmed', data));
  }

  /** Entra ou cria uma sala */
  function joinRoom(roomId, nickname, habboNick) {
    socket.emit('joinRoom', { roomId, nickname, habboNick });
  }

  /** Host inicia a corrida */
  function startRace() {
    socket.emit('startRace');
  }

  /** Envia posição atual do jogador */
  function sendUpdate(x, y, angle, speed) {
    socket.emit('playerUpdate', { x, y, angle, speed });
  }

  /** Avisa que cruzou um checkpoint */
  function sendCheckpoint(checkpoint, lap) {
    socket.emit('checkpoint', { checkpoint, lap });
  }

  /** Avisa que pegou um boost */
  function sendBoostPickup(boostId) {
    socket.emit('boostPickup', { boostId });
  }

  /** Host volta ao lobby a partir do pódio */
  function sendReadyToLobby() {
    socket.emit('readyToLobby');
  }

  /** Jogador encostou numa caixa "?" */
  function sendItemPickup(boxId) {
    socket.emit('itemPickup', { boxId });
  }

  /** Jogador usou o item (uso automático). Para banana/cone, envia posição. */
  function sendItemUsed(data) {
    socket.emit('itemUsed', data || {});
  }

  /** Jogador foi atingido por uma banana/cone solta */
  function sendItemHit(dropId) {
    socket.emit('itemHit', { dropId, victimId: myId });
  }

  return {
    connect, on, once,
    joinRoom, startRace,
    sendUpdate, sendCheckpoint, sendBoostPickup, sendReadyToLobby,
    sendItemPickup, sendItemUsed, sendItemHit,
    get myId()     { return myId; },
    get myRoomId() { return myRoomId; },
    get isHost()   { return isHost; }
  };
})();

window.NK_Net = NK_Net;
