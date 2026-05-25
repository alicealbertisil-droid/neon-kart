/**
 * ============================================================
 * NEON KART - UI MANAGER
 * ============================================================
 * Controla todas as telas HTML (lobby, HUD, vitória).
 * O jogo em si fica em #ui-game (canvas do Phaser).
 * Este arquivo é o "cérebro" da interface fora do canvas.
 * ============================================================
 */

const NK_UI = (() => {

  // ----- Referências para elementos do DOM -----
  const el = {
    lobby:       document.getElementById('ui-lobby'),
    game:        document.getElementById('ui-game'),
    formJoin:    document.getElementById('form-join'),
    waitingRoom: document.getElementById('waiting-room'),
    inputNick:   document.getElementById('input-nickname'),
    inputHabbo:  document.getElementById('input-habbo'),
    btnJoin:     document.getElementById('btn-join'),
    btnStart:    document.getElementById('btn-start-race'),
    btnCopy:     document.getElementById('btn-copy-link'),
    playersList: document.getElementById('players-list'),
    playersCount:document.getElementById('players-count'),
    roomIdDisplay: document.getElementById('room-id-display'),
    hostControls:document.getElementById('host-controls'),
    guestHint:   document.getElementById('guest-hint'),
    hud:         document.getElementById('hud'),
    hudLap:      document.getElementById('hud-lap'),
    hudMaxLap:   document.getElementById('hud-maxlap'),
    hudPos:      document.getElementById('hud-pos'),
    hudRanking:  document.getElementById('hud-ranking'),
    victory:     document.getElementById('victory-screen'),
    podium:      document.getElementById('podium'),
    podiumTimes: document.getElementById('podium-times'),
    finalRanking:document.getElementById('final-ranking'),
    btnPlayAgain:document.getElementById('btn-play-again'),
    victoryWaiting: document.getElementById('victory-waiting')
  };

  // ------------------- HELPERS DE TELA -------------------
  function showLobby() {
    el.lobby.classList.add('active');
    el.game.classList.remove('active');
  }
  function showGame() {
    el.lobby.classList.remove('active');
    el.game.classList.add('active');
    el.hud.classList.remove('hidden');
  }

  // ------------------- LOBBY -------------------

  /** Pega ?room=xxx da URL, se houver. Senão usa 'main' ou gera */
  function getRoomIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'main';
  }

  /** Atualiza a URL para incluir o roomId (para compartilhar) */
  function syncRoomToURL(roomId) {
    const url = new URL(window.location);
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url);
  }

  /** Tela depois de conectar: mostra lobby da sala */
  function showWaitingRoom(roomId, isHost) {
    el.formJoin.classList.add('hidden');
    el.waitingRoom.classList.remove('hidden');
    el.roomIdDisplay.textContent = roomId;
    syncRoomToURL(roomId);
    updateHostControls(isHost);
  }

  /** Mostra/esconde botão de iniciar dependendo se sou host */
  function updateHostControls(isHost) {
    if (isHost) {
      el.hostControls.classList.remove('hidden');
      el.guestHint.classList.add('hidden');
    } else {
      el.hostControls.classList.add('hidden');
      el.guestHint.classList.remove('hidden');
    }
  }

  /** Renderiza lista de jogadores no lobby */
  function renderPlayersList(players, hostId) {
    el.playersList.innerHTML = '';
    el.playersCount.textContent = players.length;
    players.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="dot" style="background:${p.color}; color:${p.color}"></span>
        ${habboAvatarHtml(p.habboNick, { size: 's' })}
        <span class="nick">${escapeHtml(p.nickname)}</span>
        ${p.habboNick ? `<span class="habbo">@ ${escapeHtml(p.habboNick)}</span>` : ''}
        ${p.isHost ? '<span class="crown" title="Host">👑</span>' : ''}
      `;
      el.playersList.appendChild(li);
    });
  }

  // ------------------- HUD -------------------

  /** Atualiza ranking no HUD durante a corrida */
  function renderRanking(ranking, myId) {
    el.hudRanking.innerHTML = '';
    ranking.forEach((p, i) => {
      const li = document.createElement('li');
      const isMe = p.id === myId;
      li.className = (isMe ? 'me ' : '') + (p.finished ? 'finished' : '');
      li.innerHTML = `
        <span class="pos">${i + 1}º</span>
        <span class="nick">${escapeHtml(p.nickname)}</span>
        ${p.finished ? '<span style="margin-left:auto">🏁</span>' : ''}
      `;
      el.hudRanking.appendChild(li);

      if (isMe) {
        el.hudPos.textContent = `${i + 1}º`;
      }
    });
  }

  // ------------------- TELA DE VITÓRIA -------------------

  function fmtTime(ms) {
    if (!ms && ms !== 0) return '';
    const tenths = Math.floor(ms / 100) % 10;
    const secs   = Math.floor(ms / 1000) % 60;
    const mins   = Math.floor(ms / 60000);
    if (mins > 0) return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
    return `${secs}.${tenths}s`;
  }

  function showVictory(ranking, isHost) {
    // Pódio: ordem visual = 2º (esq) | 1º (centro) | 3º (dir)
    el.podium.innerHTML = '';
    const podiumSlots = [
      { idx: 1, cls: 'p2', medal: '🥈' },
      { idx: 0, cls: 'p1', medal: '🥇' },
      { idx: 2, cls: 'p3', medal: '🥉' },
    ];
    podiumSlots.forEach(({ idx, cls, medal }) => {
      const p = ranking[idx];
      if (!p) return;
      const div = document.createElement('div');
      div.className = `podium-place ${cls}`;
      div.innerHTML = `
        <div class="podium-info">
          <div class="podium-crown">${medal}</div>
          ${habboAvatarHtml(p.habboNick, { size: 'l', extraClass: 'podium-avatar' })}
          <div class="podium-nick-text" style="color:${p.color}">${escapeHtml(p.nickname)}</div>
          ${p.habboNick ? `<div class="podium-habbo">@${escapeHtml(p.habboNick)}</div>` : ''}
        </div>
        <div class="podium-block">${idx + 1}</div>
      `;
      el.podium.appendChild(div);
    });

    // Faixa de tempos abaixo do pódio (1º, 2º, 3º)
    el.podiumTimes.innerHTML = '';
    [0, 1, 2].forEach(idx => {
      const p = ranking[idx];
      if (!p) return;
      const div = document.createElement('div');
      div.className = 'podium-time-entry';
      div.innerHTML = `
        <span class="pt-pos" style="color:${p.color}">${idx + 1}º</span>
        <span class="pt-nick">${escapeHtml(p.nickname)}</span>
        <span class="pt-time">${p.finishTime != null ? '⏱ ' + fmtTime(p.finishTime) : '—'}</span>
      `;
      el.podiumTimes.appendChild(div);
    });

    // 4º em diante
    el.finalRanking.innerHTML = '';
    ranking.slice(3).forEach((p, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="medal">${i + 4}º</span>
        ${habboAvatarHtml(p.habboNick, { size: 's' })}
        <span class="nick" style="color:${p.color}">${escapeHtml(p.nickname)}</span>
        ${p.habboNick ? `<span class="habbo">@${escapeHtml(p.habboNick)}</span>` : ''}
        ${p.finishTime != null ? `<span class="finish-time">${fmtTime(p.finishTime)}</span>` : ''}
      `;
      el.finalRanking.appendChild(li);
    });

    // Controles de host vs guest
    if (isHost) {
      el.btnPlayAgain.classList.remove('hidden');
      el.victoryWaiting.classList.add('hidden');
    } else {
      el.btnPlayAgain.classList.add('hidden');
      el.victoryWaiting.classList.remove('hidden');
    }

    el.victory.classList.remove('hidden');
  }

  function hideVictory() {
    el.victory.classList.add('hidden');
    el.btnPlayAgain.classList.add('hidden');
    el.victoryWaiting.classList.add('hidden');
  }

  function updateVictoryControls(isHost) {
    if (el.victory.classList.contains('hidden')) return;
    if (isHost) {
      el.btnPlayAgain.classList.remove('hidden');
      el.victoryWaiting.classList.add('hidden');
    }
  }

  // ------------------- HELPERS -------------------

  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /**
   * Monta o HTML do avatar do Habbo BR (apenas a carinha).
   * Usa a API oficial: habbo-imaging/avatarimage com headonly=1.
   * - Se nick estiver vazio, retorna string vazia.
   * - Se a imagem falhar (nick inválido), o onerror esconde o elemento
   *   pra não aparecer aquele "ícone quebrado" feio.
   *
   * @param {string} habboNick - nick do Habbo (do hotel BR)
   * @param {object} opts - opcional: { size: 's'|'m'|'l', extraClass: string }
   */
  function habboAvatarHtml(habboNick, opts = {}) {
    if (!habboNick) return '';
    const size = opts.size || 'm'; // s=pequeno, m=médio, l=grande
    const cls = 'habbo-avatar' + (opts.extraClass ? ' ' + opts.extraClass : '');
    // encodeURIComponent pra tratar caracteres especiais no nick
    const nick = encodeURIComponent(habboNick);
    const url = `https://www.habbo.com.br/habbo-imaging/avatarimage`
              + `?user=${nick}&direction=2&head_direction=3&gesture=sml`
              + `&size=${size}&headonly=1`;
    // onerror: se a imagem não carregar (nick inexistente), some
    return `<img src="${url}" alt="" class="${cls}" loading="lazy" `
         + `onerror="this.style.display='none'" />`;
  }

  /** Copia o link da sala para a área de transferência */
  function copyShareLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      const old = el.btnCopy.textContent;
      el.btnCopy.textContent = 'COPIADO!';
      setTimeout(() => el.btnCopy.textContent = old, 1500);
    });
  }

  // ------------------- POPUP DE ITEM RECEBIDO -------------------
  const ITEM_INFO = {
    banana:  { emoji: '🍌', name: 'BANANA',     color: '#ffeb3b',
               desc: 'Solta atrás de você' },
    cone:    { emoji: '🚧', name: 'CONE',       color: '#ff6b00',
               desc: 'Solta atrás de você' },
    turbo:   { emoji: '🚀', name: 'TURBO!',     color: '#00ff88',
               desc: 'Boost de velocidade!' },
    escudo:  { emoji: '🛡️', name: 'ESCUDO',    color: '#00ffff',
               desc: 'Proteção por 3 segundos' },
    raio:    { emoji: '⚡', name: 'RAIO',       color: '#ffff00',
               desc: 'Atinge todos os outros!' }
  };

  function showItemPopup(item) {
    const info = ITEM_INFO[item];
    if (!info) return;
    let pop = document.getElementById('item-popup');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'item-popup';
      pop.className = 'item-popup';
      document.body.appendChild(pop);
    }
    pop.innerHTML = `
      <div class="ip-emoji">${info.emoji}</div>
      <div class="ip-text">
        <div class="ip-name" style="color:${info.color};text-shadow:0 0 8px ${info.color}">${info.name}</div>
        <div class="ip-desc">${info.desc}</div>
      </div>
    `;
    pop.classList.remove('hidden');
    pop.classList.remove('ip-show');
    void pop.offsetWidth; // restart animation
    pop.classList.add('ip-show');
    setTimeout(() => {
      pop.classList.add('hidden');
    }, 1800);
  }

  // ------------------- MODAL "MODO DE JOGAR" -------------------
  function showHowToPlay() {
    let modal = document.getElementById('how-to-play');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'how-to-play';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-card">
          <button class="modal-close" aria-label="Fechar">&times;</button>
          <h2 class="modal-title">::: COMO JOGAR :::</h2>

          <div class="modal-section">
            <h3>🎯 OBJETIVO</h3>
            <p>Complete <strong>3 voltas</strong> na pista antes dos outros pilotos!</p>
          </div>

          <div class="modal-section">
            <h3>🕹️ CONTROLES</h3>
            <p><strong>PC:</strong> W/↑ acelera · S/↓ freia/ré · A/← esquerda · D/→ direita</p>
            <p><strong>Mobile:</strong> Use os botões na tela</p>
          </div>

          <div class="modal-section">
            <h3>⚡ NA PISTA</h3>
            <div class="modal-item">
              <span class="mi-icon" style="color:#00ff88">⚡</span>
              <div><strong>Boost (verde):</strong> dá um impulso de velocidade</div>
            </div>
            <div class="modal-item">
              <span class="mi-icon" style="color:#ffeb3b">🍌</span>
              <div><strong>Banana:</strong> se pisar, seu carro gira descontrolado e perde velocidade</div>
            </div>
            <div class="modal-item">
              <span class="mi-icon" style="color:#ff6b00">🚧</span>
              <div><strong>Cone:</strong> se bater, perde velocidade e é empurrado</div>
            </div>
            <div class="modal-item">
              <span class="mi-icon" style="color:#ffd700">❓</span>
              <div><strong>Caixa de item:</strong> dá um poder aleatório (usa automaticamente)</div>
            </div>
          </div>

          <div class="modal-section">
            <h3>🎁 PODERES POSSÍVEIS</h3>
            <div class="modal-item">
              <span class="mi-icon" style="color:#00ff88">🚀</span>
              <div><strong>Turbo:</strong> boost de velocidade extra</div>
            </div>
            <div class="modal-item">
              <span class="mi-icon" style="color:#00ffff">🛡️</span>
              <div><strong>Escudo:</strong> protege por 3 segundos de bananas, cones e raios</div>
            </div>
            <div class="modal-item">
              <span class="mi-icon" style="color:#ffff00">⚡</span>
              <div><strong>Raio (raro!):</strong> deixa <em>todos</em> os outros pilotos lentos por 1 segundo</div>
            </div>
            <div class="modal-item">
              <span class="mi-icon" style="color:#ffeb3b">🍌</span>
              <div><strong>Banana/Cone:</strong> solta um obstáculo atrás do seu carro</div>
            </div>
          </div>

          <div class="modal-section">
            <h3>⚠️ ATENÇÃO</h3>
            <p>Se ficar fora da pista por mais de <strong>2 segundos</strong>, seu carro volta para a largada (sem perder voltas).</p>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      // Fecha ao clicar no X ou fora do card
      modal.querySelector('.modal-close').addEventListener('click', hideHowToPlay);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) hideHowToPlay();
      });
    }
    modal.classList.remove('hidden');
  }
  function hideHowToPlay() {
    const modal = document.getElementById('how-to-play');
    if (modal) modal.classList.add('hidden');
  }

  return {
    el,
    showLobby, showGame,
    showWaitingRoom, updateHostControls,
    renderPlayersList, renderRanking,
    showVictory, hideVictory, updateVictoryControls,
    getRoomIdFromURL, syncRoomToURL,
    copyShareLink,
    showItemPopup,
    showHowToPlay, hideHowToPlay
  };
})();

window.NK_UI = NK_UI;
