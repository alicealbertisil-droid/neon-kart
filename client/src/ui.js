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
    finalRanking:document.getElementById('final-ranking'),
    backCounter: document.getElementById('back-counter')
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

  function showVictory(ranking) {
    el.finalRanking.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    ranking.forEach((p, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="medal">${medals[i] || `${i+1}º`}</span>
        <span class="nick" style="color:${p.color}">${escapeHtml(p.nickname)}</span>
        ${p.habboNick ? `<span class="habbo">Habbo: ${escapeHtml(p.habboNick)}</span>` : ''}
      `;
      el.finalRanking.appendChild(li);
    });
    el.victory.classList.remove('hidden');

    // Conta regressiva
    let n = 8;
    el.backCounter.textContent = n;
    const intv = setInterval(() => {
      n--;
      el.backCounter.textContent = n;
      if (n <= 0) clearInterval(intv);
    }, 1000);
  }

  function hideVictory() {
    el.victory.classList.add('hidden');
  }

  // ------------------- HELPERS -------------------

  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  return {
    el,
    showLobby, showGame,
    showWaitingRoom, updateHostControls,
    renderPlayersList, renderRanking,
    showVictory, hideVictory,
    getRoomIdFromURL, syncRoomToURL,
    copyShareLink
  };
})();

window.NK_UI = NK_UI;
