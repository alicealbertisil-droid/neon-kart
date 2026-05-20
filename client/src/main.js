/**
 * ============================================================
 * NEON KART - MAIN
 * ============================================================
 * Ponto de entrada. Conecta UI, rede e Phaser.
 * Fluxo geral:
 *   1) Tela de login (nick + habbo)
 *   2) Conecta no servidor
 *   3) Entra na sala (vai pra waiting room)
 *   4) Host inicia → Phaser carrega RaceScene
 *   5) Corre, termina, mostra ranking
 *   6) Volta para o lobby
 * ============================================================
 */

(function () {
  let phaserGame = null;
  let raceData = null;       // dados recebidos no evento raceStart
  let myColor = null;
  let myNickname = '';
  let myHabbo = '';

  const $ = (id) => document.getElementById(id);

  function setJoinStatus(msg, isError) {
    const el = $('join-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'join-status' + (msg ? ' visible' : '') + (isError ? ' error' : '');
  }

  // ---------------------------------------------------------
  // Touch controls
  // ---------------------------------------------------------
  window.NK_Touch = { up: false, down: false, left: false, right: false };

  function setupTouchControls() {
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    function bind(id, key) {
      const btn = $(id);
      if (!btn) return;
      const press = (e) => {
        e.preventDefault();
        window.NK_Touch[key] = true;
        btn.classList.add('active');
      };
      const release = (e) => {
        e.preventDefault();
        window.NK_Touch[key] = false;
        btn.classList.remove('active');
      };
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
      // Also support mouse for testing on desktop
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    }

    bind('tc-gas',   'up');
    bind('tc-brake', 'down');
    bind('tc-left',  'left');
    bind('tc-right', 'right');
  }

  function showTouchControls() {
    const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;
    const el = $('touch-controls');
    if (el) el.classList.remove('hidden');
  }

  function hideTouchControls() {
    const el = $('touch-controls');
    if (el) el.classList.add('hidden');
    // Reset all states
    Object.keys(window.NK_Touch).forEach(k => { window.NK_Touch[k] = false; });
  }

  // ---------------------------------------------------------
  // 1) Setup inicial da UI
  // ---------------------------------------------------------
  function init() {
    // Botão de entrar na sala
    $('btn-join').addEventListener('click', onJoinClick);
    // Botão de iniciar corrida (host)
    $('btn-start-race').addEventListener('click', onStartRaceClick);
    // Botão de copiar link
    $('btn-copy-link').addEventListener('click', window.NK_UI.copyShareLink);
    // Botão do pódio: host volta ao lobby
    $('btn-play-again').addEventListener('click', () => {
      window.NK_Audio.click();
      window.NK_Net.sendReadyToLobby();
    });

    // Configura os botões de touch
    setupTouchControls();

    // Pressionar Enter no formulário entra
    $('input-nickname').addEventListener('keydown', e => { if (e.key === 'Enter') onJoinClick(); });
    $('input-habbo').addEventListener('keydown', e => { if (e.key === 'Enter') onJoinClick(); });

    // Persistir nickname no localStorage para não digitar de novo
    const savedNick = localStorage.getItem('nk_nickname');
    const savedHabbo = localStorage.getItem('nk_habbo');
    if (savedNick)  $('input-nickname').value = savedNick;
    if (savedHabbo) $('input-habbo').value = savedHabbo;

    // Feedback de conexão sem alert spam
    window.NK_Net.on('connected', () => {
      setJoinStatus('');
      $('btn-join').disabled = false;
      $('btn-join').textContent = 'CONECTAR ››';
    });
    window.NK_Net.on('connectionError', () => {
      setJoinStatus('Servidor acordando, aguardando... ⏳');
    });
    window.NK_Net.on('reconnectFailed', () => {
      setJoinStatus('Não foi possível conectar. Tente novamente.', true);
      $('btn-join').disabled = false;
      $('btn-join').textContent = 'CONECTAR ››';
    });

    // Registra todos os listeners de jogo
    setupNetworkHandlers();
  }

  // ---------------------------------------------------------
  // 2) Clique no botão "Conectar"
  // ---------------------------------------------------------
  function onJoinClick() {
    const nick = $('input-nickname').value.trim();
    const habbo = $('input-habbo').value.trim();

    if (!nick) {
      $('input-nickname').focus();
      shake($('input-nickname'));
      return;
    }

    myNickname = nick;
    myHabbo = habbo;
    localStorage.setItem('nk_nickname', nick);
    localStorage.setItem('nk_habbo', habbo);

    // Inicializa áudio (precisa de interação do usuário)
    window.NK_Audio.init();
    window.NK_Audio.click();

    $('btn-join').disabled = true;
    $('btn-join').textContent = 'CONECTANDO...';
    setJoinStatus('');

    // Conecta
    window.NK_Net.connect();

    // Aguarda conexão (se já conectado, dispara já)
    if (window.NK_Net.myId) {
      doJoinRoom();
    } else {
      window.NK_Net.once('connected', doJoinRoom);
    }
  }

  function doJoinRoom() {
    const roomId = window.NK_UI.getRoomIdFromURL();
    window.NK_Net.joinRoom(roomId, myNickname, myHabbo);
  }

  // ---------------------------------------------------------
  // 3) Clique em "Iniciar Corrida"
  // ---------------------------------------------------------
  function onStartRaceClick() {
    window.NK_Audio.click();
    window.NK_Net.startRace();
  }

  // ---------------------------------------------------------
  // 4) Handlers de rede
  // ---------------------------------------------------------
  function setupNetworkHandlers() {

    window.NK_Net.on('joinedRoom', (data) => {
      myColor = data.color;
      window.NK_UI.showWaitingRoom(data.roomId, data.isHost);
    });

    window.NK_Net.on('lobbyUpdate', (data) => {
      window.NK_UI.renderPlayersList(data.players, data.hostId);
      // Atualiza se eu virei host
      const me = data.players.find(p => p.id === window.NK_Net.myId);
      if (me) {
        window.NK_UI.updateHostControls(me.isHost);
      }
    });

    window.NK_Net.on('youAreHost', () => {
      window.NK_UI.updateHostControls(true);
      // Se a tela de pódio está aberta, libera o botão para o novo host
      window.NK_UI.updateVictoryControls(true);
    });

    window.NK_Net.on('roomFull', (d) => alert(d.message));
    window.NK_Net.on('roomBusy', (d) => alert(d.message));

    // ----- CORRIDA INICIA! -----
    window.NK_Net.on('raceStart', (data) => {
      raceData = data;
      // Atualiza HUD de voltas
      $('hud-lap').textContent = '1';
      $('hud-maxlap').textContent = data.maxLaps;

      // Esconde tela de vitória se estiver aberta
      window.NK_UI.hideVictory();

      // Muda para a tela do jogo
      window.NK_UI.showGame();
      showTouchControls();

      // Inicializa o Phaser (apenas uma vez!)
      if (!phaserGame) {
        startPhaser();
      }

      // Inicia a cena de corrida
      phaserGame.scene.start('RaceScene', {
        players: data.players,
        maxLaps: data.maxLaps,
        myColor: myColor,
        myNickname: myNickname
      });
    });

    // ----- RANKING AO VIVO -----
    window.NK_Net.on('rankingUpdate', (data) => {
      window.NK_UI.renderRanking(data.ranking, window.NK_Net.myId);
    });

    // ----- ALGUÉM TERMINOU -----
    window.NK_Net.on('playerFinished', (data) => {
      console.log(`${data.nickname} terminou em ${data.position}º`);
    });

    // ----- TODOS TERMINARAM: TELA DE VITÓRIA -----
    window.NK_Net.on('raceFinished', (data) => {
      window.NK_UI.showVictory(data.ranking, window.NK_Net.isHost);
      window.NK_Audio.stopEngine();
      window.NK_Audio.stopMusic();
      hideTouchControls();
    });

    // ----- VOLTA PARA O LOBBY -----
    window.NK_Net.on('backToLobby', (data) => {
      window.NK_UI.hideVictory();
      window.NK_UI.showLobby();
      window.NK_UI.renderPlayersList(data.players, data.players.find(p => p.isHost)?.id);
      // Reseta a cena Phaser para a próxima corrida
      if (phaserGame && phaserGame.scene.isActive('RaceScene')) {
        phaserGame.scene.stop('RaceScene');
      }
      // Esconde HUD e controles touch
      $('hud').classList.add('hidden');
      hideTouchControls();
    });
  }

  // ---------------------------------------------------------
  // 5) Configura e inicia Phaser
  // ---------------------------------------------------------
  function startPhaser() {
    const config = {
      type: Phaser.AUTO,
      parent: 'game-container',
      backgroundColor: '#0a0118',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight
      },
      physics: {
        default: 'arcade',
        arcade: { debug: false, gravity: { x: 0, y: 0 } }
      },
      scene: [window.RaceScene],
      // otimização
      render: {
        pixelArt: false,
        antialias: true,
        roundPixels: false
      }
    };
    phaserGame = new Phaser.Game(config);
    window.phaserGame = phaserGame;
  }

  // ---------------------------------------------------------
  // Helper: animação de "shake" em campos inválidos
  // ---------------------------------------------------------
  function shake(elm) {
    elm.style.animation = 'none';
    void elm.offsetWidth;
    elm.style.animation = 'shake .4s';
  }

  // ---------------------------------------------------------
  // ANIMATION shake (adicionada via JS pq depende do tema)
  // ---------------------------------------------------------
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%      { transform: translateX(-8px); border-color: var(--c-pink); }
      40%      { transform: translateX(8px);  }
      60%      { transform: translateX(-4px); }
      80%      { transform: translateX(4px);  }
    }
  `;
  document.head.appendChild(styleEl);

  // ---------------------------------------------------------
  // GO!
  // ---------------------------------------------------------
  document.addEventListener('DOMContentLoaded', init);
})();
