/**
 * ============================================================
 * NEON KART - CENA DE CORRIDA
 * ============================================================
 * É a cena principal do Phaser. Responsabilidades:
 *   - Desenhar a pista (delega para NK_Track)
 *   - Spawnar o carro do jogador local e os carros remotos
 *   - Processar input (WASD + setas + Shift drift)
 *   - Aplicar física (aceleração, atrito, curva, drift, boost)
 *   - Detectar checkpoints, voltas e linha de chegada
 *   - Sincronizar com servidor via NK_Net
 *   - Renderizar nome dos jogadores sobre os carros
 * ============================================================ */

class RaceScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RaceScene' });
  }

  init(data) {
    // 'data' vem do main.js quando inicia a cena
    this.initialPlayers = data.players;
    this.maxLaps = data.maxLaps;
    this.myId = window.NK_Net.myId;
    this.myColor = data.myColor;
    this.myNickname = data.myNickname;
  }

  create() {
    const cfg = window.NK_CONFIG;

    // Mundo grande para a câmera percorrer
    this.physics.world.setBounds(0, 0, cfg.WORLD_WIDTH, cfg.WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, cfg.WORLD_WIDTH, cfg.WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor('#0a0118');

    // Desenha a pista
    window.NK_Track.draw(this);

    // ----- Cria os carros -----
    this.cars = {};   // mapa playerId -> { sprite, nameText, ... }
    this.remoteTargets = {}; // alvos de interpolação para carros remotos

    const grid = window.NK_Track.startGrid;
    let i = 0;
    Object.values(this.initialPlayers).forEach((p) => {
      const pos = grid[i % grid.length];
      this.createCar(p.id, p, pos.x, pos.y, pos.angle);
      // guarda a posição inicial do MEU carro para o reset por sair da pista
      if (p.id === this.myId) {
        this.mySpawnPos = { x: pos.x, y: pos.y, angle: pos.angle };
      }
      i++;
    });

    // Define meu carro como referência
    this.myCar = this.cars[this.myId];
    if (this.myCar) {
      this.isMobile = !!window.NK_IsMobile;
      // No mobile o landscape é estreito (pouca altura): câmera AINDA MAIS
      // afastada (zoom 0.7) faz ver bem mais pista pela frente.
      // No PC mantemos 1.0.
      const zoom = this.isMobile ? 0.7 : 1.0;
      this.cameras.main.startFollow(this.myCar.sprite, true, 0.1, 0.1);
      this.cameras.main.setZoom(zoom);
    }

    // ----- INPUT -----
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT
    });

    // ----- ESTADO DA CORRIDA -----
    this.raceStarted = false;          // só vira true depois do countdown
    this.myLap = 0;
    this.myNextCheckpoint = 0;         // qual CP é o próximo
    this.passedFinish = false;         // se já cruzou a linha de largada uma vez
    this.boostUntil = 0;               // ms - tempo até quando o boost dura
    this.lastNetSend = 0;
    this.offTrackSince = 0;            // ms - quando começou a ficar fora da pista (0 = está na pista)
    this.bananaSpinUntil = 0;          // ms - tempo até quando o carro está girando pela banana
    this.bananaSpinDir = 1;            // direção do spin (+1 ou -1)

    // ----- ITENS / PODERES -----
    this.currentItem = null;           // item que eu tenho na mão (null se nenhum)
    this.turboUntil = 0;               // ms - tempo até quando o turbo extra dura
    this.shieldUntil = 0;              // ms - tempo até quando o escudo dura
    this.raioUntil = 0;                // ms - tempo até quando estou lento pelo raio
    this.droppedItems = {};            // dropId -> sprite (bananas/cones soltos por jogadores)

    // ----- COUNTDOWN -----
    this.startCountdown();

    // ----- LISTENERS DE REDE -----
    this.setupNetwork();

    // ----- MINIMAPA -----
    this.setupMinimap();
  }

  // ----------------------------------------------------------
  // CRIAÇÃO DE CARRO
  // ----------------------------------------------------------
  createCar(id, playerInfo, x, y, angle) {
    // Carro = container com retângulo colorido + detalhes neon
    const container = this.add.container(x, y);

    const colorHex = playerInfo.color.replace('#', '0x');
    const color = parseInt(colorHex, 16);

    // Sombra
    const shadow = this.add.ellipse(2, 6, 36, 18, 0x000000, 0.4);
    container.add(shadow);

    // Corpo principal
    const body = this.add.rectangle(0, 0, 32, 20, color);
    body.setStrokeStyle(2, 0xffffff, 0.9);
    container.add(body);

    // Faixa central
    const stripe = this.add.rectangle(0, 0, 32, 4, 0xffffff, 0.6);
    container.add(stripe);

    // "Vidro" frontal
    const windshield = this.add.rectangle(6, 0, 8, 14, 0x000000, 0.5);
    container.add(windshield);

    // Brilho neon ao redor
    const glow = this.add.rectangle(0, 0, 40, 28, color, 0.25);
    container.addAt(glow, 0); // atrás de tudo

    container.setSize(32, 20);
    container.setDepth(10);

    // Adiciona física (corpo arcade)
    this.physics.world.enable(container);
    container.body.setSize(32, 20);
    container.body.setCollideWorldBounds(true);

    // Nome do jogador sobre o carro
    // No mobile, usa fonte menor e sem stroke pra economizar performance
    // (text com stroke é caro de renderizar a cada frame)
    const isMobile = !!window.NK_IsMobile;
    const nameText = this.add.text(x, y - 30,
      playerInfo.nickname + (playerInfo.habboNick ? ` (${playerInfo.habboNick})` : ''),
      {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: isMobile ? '11px' : '12px',
        color: playerInfo.color,
        stroke: isMobile ? '' : '#000000',
        strokeThickness: isMobile ? 0 : 3,
        align: 'center',
        // No mobile usa sombra leve em vez de stroke (mais barato)
        ...(isMobile ? {
          shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, fill: true }
        } : {})
      }
    );
    nameText.setOrigin(0.5);
    nameText.setDepth(20);

    this.cars[id] = {
      id,
      sprite: container,
      nameText,
      info: playerInfo,
      // Estado de movimento (para o carro local)
      speed: 0,
      angle: angle,        // em radianos
      drifting: false,
      finished: false
    };

    container.setRotation(angle);

    // Para carros remotos, guardamos um "alvo" para interpolação suave
    if (id !== this.myId) {
      this.remoteTargets[id] = { x, y, angle, speed: 0 };
    }
  }

  // ----------------------------------------------------------
  // COUNTDOWN
  // ----------------------------------------------------------
  startCountdown() {
    const el = document.getElementById('countdown');
    let n = window.NK_CONFIG.COUNTDOWN_SECONDS;

    const step = () => {
      if (n > 0) {
        el.textContent = n;
        el.classList.remove('hidden');
        // reinicia animação
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = 'cd-pop .9s ease-out';
        window.NK_Audio.countdownBeep();
        n--;
        setTimeout(step, 900);
      } else {
        el.textContent = 'GO!';
        el.style.color = 'var(--c-green)';
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = 'cd-pop .9s ease-out';
        window.NK_Audio.goBeep();
        window.NK_Audio.startMusic();
        window.NK_Audio.startEngine();
        this.raceStarted = true;
        setTimeout(() => { el.classList.add('hidden'); el.style.color = ''; }, 900);
      }
    };
    step();
  }

  // ----------------------------------------------------------
  // REDE
  // ----------------------------------------------------------
  setupNetwork() {
    // Recebe atualização de posição dos outros jogadores
    window.NK_Net.on('playersState', (data) => {
      Object.entries(data).forEach(([id, state]) => {
        if (id === this.myId) return;
        if (!this.remoteTargets[id]) return;
        this.remoteTargets[id].x = state.x;
        this.remoteTargets[id].y = state.y;
        this.remoteTargets[id].angle = state.angle;
        this.remoteTargets[id].speed = state.speed || 0;
      });
    });

    // Algum jogador pegou um boost: esconder visualmente por uns segundos
    window.NK_Net.on('boostTaken', ({ boostId }) => {
      this.hideBoost(boostId);
    });

    // ----- EVENTOS DE ITEM -----
    // Eu peguei um item: servidor me responde qual
    window.NK_Net.on('itemReceived', ({ item }) => {
      this.currentItem = item;
      window.NK_UI.showItemPopup(item);
      // Uso AUTOMÁTICO: depois de 600ms (pra mostrar o popup), usa
      this.time.delayedCall(600, () => this.autoUseItem());
    });

    // Caixa "?" sumiu (alguém pegou)
    window.NK_Net.on('itemBoxTaken', ({ boxId }) => {
      this.hideItemBox(boxId);
    });

    // Efeito de item (próprio ou raio)
    window.NK_Net.on('itemEffect', (data) => {
      this.applyItemEffect(data);
    });

    // Alguém soltou banana/cone na pista
    window.NK_Net.on('itemDropped', (data) => {
      this.spawnDroppedItem(data);
    });

    // Confirmação de hit em obstáculo solto (apenas remove visualmente)
    window.NK_Net.on('itemHitConfirmed', ({ dropId }) => {
      this.removeDroppedItem(dropId);
    });
  }

  // ----------------------------------------------------------
  // UPDATE LOOP
  // ----------------------------------------------------------
  update(time, delta) {
    if (!this.myCar) return;
    const dt = delta / 1000; // segundos

    if (this.raceStarted && !this.myCar.finished) {
      this.updateMyCar(dt, time);
      this.checkBoostsAndCheckpoints(time);
    }

    this.updateRemoteCars(dt);
    this.updateNameTags();

    // Envia minha posição a cada UPDATE_INTERVAL ms
    if (this.raceStarted && time - this.lastNetSend > window.NK_CONFIG.NETWORK.UPDATE_INTERVAL) {
      this.lastNetSend = time;
      window.NK_Net.sendUpdate(
        this.myCar.sprite.x,
        this.myCar.sprite.y,
        this.myCar.angle,
        this.myCar.speed
      );
    }

    // Atualiza som do motor pela velocidade
    if (this.raceStarted) {
      const ratio = Math.abs(this.myCar.speed) / window.NK_CONFIG.CAR.MAX_SPEED;
      window.NK_Audio.setEngineSpeed(ratio);
    }

    // Atualiza HUD de velocidade
    const speedKmh = Math.abs(Math.round(this.myCar.speed / 3));
    const fill = document.getElementById('speed-fill');
    const speedTxt = document.getElementById('hud-speed');
    if (fill) fill.style.width = `${(Math.abs(this.myCar.speed)/window.NK_CONFIG.CAR.MAX_SPEED)*100}%`;
    if (speedTxt) speedTxt.textContent = speedKmh;

    // Atualiza visual do escudo (se ativo)
    if (this.shieldGfx) {
      if (time >= this.shieldUntil) {
        this.hideShieldVisual();
      } else {
        this.shieldGfx.clear();
        this.shieldGfx.lineStyle(3, 0x00ffff, 0.8);
        this.shieldGfx.strokeCircle(this.myCar.sprite.x, this.myCar.sprite.y, 26);
        this.shieldGfx.fillStyle(0x00ffff, 0.12);
        this.shieldGfx.fillCircle(this.myCar.sprite.x, this.myCar.sprite.y, 26);
      }
    }

    // Atualiza minimapa (não a cada frame: a cada ~6 frames pra economizar)
    if (!this._miniFrame) this._miniFrame = 0;
    this._miniFrame = (this._miniFrame + 1) % 6;
    if (this._miniFrame === 0) this.updateMinimap();
  }

  // ----------------------------------------------------------
  // FÍSICA DO MEU CARRO
  // ----------------------------------------------------------
  updateMyCar(dt, time) {
    const C = window.NK_CONFIG.CAR;
    const car = this.myCar;
    const k = this.keys;
    const c = this.cursors;

    const t = window.NK_Touch || {};
    const up    = k.W.isDown || c.up.isDown    || !!t.up;
    const down  = k.S.isDown || c.down.isDown  || !!t.down;
    const left  = k.A.isDown || c.left.isDown  || !!t.left;
    const right = k.D.isDown || c.right.isDown || !!t.right;

    car.drifting = false;

    // Boost normal ativo? Turbo extra ativo? Raio? Calcula a velocidade máxima.
    const boosting = time < this.boostUntil;
    const turboing = time < this.turboUntil;
    const raioed   = time < this.raioUntil;
    const I = window.NK_CONFIG.ITEMS;

    let maxSpeed;
    if (turboing)       maxSpeed = I.TURBO.SPEED;        // turbo extra: mais rápido
    else if (boosting)  maxSpeed = C.BOOST_SPEED;        // boost normal
    else                maxSpeed = C.MAX_SPEED;

    // Raio: força velocidade baixa
    if (raioed) {
      const raioCap = C.MAX_SPEED * I.RAIO.SPEED_MULT;
      if (car.speed > raioCap) car.speed = raioCap;
      maxSpeed = Math.min(maxSpeed, raioCap);
    }

    // ----- ACELERAÇÃO / FRENAGEM -----
    if (up) {
      car.speed += C.ACCEL * dt;
    } else if (down) {
      // Se está indo pra frente, freia; se já parado, vai de ré
      if (car.speed > 0) {
        car.speed -= C.BRAKE * dt;
      } else {
        car.speed -= C.ACCEL * dt;
      }
    } else {
      // Atrito natural
      if (car.speed > 0) {
        car.speed -= C.FRICTION * dt;
        if (car.speed < 0) car.speed = 0;
      } else if (car.speed < 0) {
        car.speed += C.FRICTION * dt;
        if (car.speed > 0) car.speed = 0;
      }
    }

    // Limites de velocidade
    car.speed = Phaser.Math.Clamp(car.speed, -C.REVERSE_SPEED, maxSpeed);

    // ----- EFEITO DA BANANA: gira descontrolado e perde velocidade -----
    const bananaActive = time < this.bananaSpinUntil;
    if (bananaActive) {
      const OB = window.NK_CONFIG.OBSTACLES.BANANA;
      // Gira o carro continuamente (descontrolado)
      car.angle += this.bananaSpinDir * Phaser.Math.DegToRad(540) * dt;
      // Trava velocidade no nível baixo
      const bananaCap = C.MAX_SPEED * OB.SPEED_PENALTY;
      if (car.speed > bananaCap) car.speed = bananaCap;
      // Ignora input durante o spin (não pode acelerar nem virar)
      // Move o carro pra frente naturalmente sem aplicar curva manual
      const vxB = Math.cos(car.angle) * car.speed * dt;
      const vyB = Math.sin(car.angle) * car.speed * dt;
      car.sprite.x += vxB;
      car.sprite.y += vyB;
      car.sprite.setRotation(car.angle);
      // Checa obstáculos mesmo durante spin (mas pula colisão de banana pra não re-disparar)
      return;
    }

    // ----- CURVA -----
    // Só pode girar se estiver se movendo (mais realista)
    if (Math.abs(car.speed) > 5) {
      let turnSpeed = Phaser.Math.DegToRad(C.TURN_SPEED);
      // No mobile, curva um pouco mais ágil (compensa imprecisão do toque)
      if (this.isMobile) turnSpeed *= 1.15;
      // Reduz curva em velocidades muito baixas
      const speedFactor = Math.min(1, Math.abs(car.speed) / 200);
      // Mas no mobile, garante um mínimo de virada mesmo em velocidade baixa
      const minFactor = this.isMobile ? 0.45 : 0;
      const finalFactor = Math.max(minFactor, speedFactor);
      // Carro vai de ré: inverte direção
      const dir = car.speed >= 0 ? 1 : -1;

      if (left)  car.angle -= turnSpeed * dt * finalFactor * dir;
      if (right) car.angle += turnSpeed * dt * finalFactor * dir;
    }

    // ----- POSIÇÃO -----
    const vx = Math.cos(car.angle) * car.speed * dt;
    const vy = Math.sin(car.angle) * car.speed * dt;

    const nextX = car.sprite.x + vx;
    const nextY = car.sprite.y + vy;

    // ----- PENALIDADE FORA DA PISTA -----
    // Cap de velocidade (não decay por frame, para evitar efeito areia movediça)
    const onTrack = window.NK_Track.isOnTrack(nextX, nextY);
    if (!onTrack) {
      const cap = C.MAX_SPEED * C.OFFTRACK_MULT;
      if (car.speed > cap) car.speed = cap;

      // Marca o início do tempo fora da pista
      if (this.offTrackSince === 0) {
        this.offTrackSince = time;
      }

      // Quanto tempo está fora?
      const outFor = time - this.offTrackSince;
      const resetMs = window.NK_CONFIG.OFFTRACK_RESET_MS || 3000;

      // Mostra aviso visual com contagem regressiva
      this.showOffTrackWarning(Math.ceil((resetMs - outFor) / 1000));

      // Se passou do limite: volta para a linha de largada
      if (outFor >= resetMs) {
        this.resetToStart();
        return; // sai do update desse frame
      }
    } else {
      // Voltou pra pista: limpa o timer e o aviso
      if (this.offTrackSince !== 0) {
        this.offTrackSince = 0;
        this.hideOffTrackWarning();
      }
    }

    car.sprite.x = nextX;
    car.sprite.y = nextY;
    car.sprite.setRotation(car.angle);
  }

  // ----------------------------------------------------------
  // RESET PARA LINHA DE LARGADA (após ficar muito tempo fora da pista)
  // ----------------------------------------------------------
  resetToStart() {
    const car = this.myCar;
    const spawn = this.mySpawnPos;
    if (!spawn) return;

    car.sprite.x = spawn.x;
    car.sprite.y = spawn.y;
    car.angle = spawn.angle;
    car.sprite.setRotation(spawn.angle);
    car.speed = 0;
    this.offTrackSince = 0;
    this.hideOffTrackWarning();
    // Vibração longa de "puxão" pra avisar que voltou
    if (navigator.vibrate) { try { navigator.vibrate(180); } catch(e){} }

    // NÃO zera voltas nem checkpoints — só reposiciona o carro
    // (assim o jogador não perde o progresso da corrida)
  }

  // ----------------------------------------------------------
  // Aviso visual de "fora da pista" com contagem regressiva
  // ----------------------------------------------------------
  showOffTrackWarning(secondsLeft) {
    let el = document.getElementById('offtrack-warning');
    if (!el) {
      el = document.createElement('div');
      el.id = 'offtrack-warning';
      el.style.cssText = `
        position: absolute;
        top: 18%;
        left: 50%;
        transform: translateX(-50%);
        font-family: 'Orbitron', sans-serif;
        font-weight: 900;
        font-size: clamp(20px, 3.5vw, 38px);
        color: #ff3366;
        text-shadow: 0 0 12px #ff3366;
        letter-spacing: 2px;
        text-align: center;
        z-index: 1000;
        pointer-events: none;
      `;
      const hud = document.getElementById('hud') || document.body;
      hud.appendChild(el);
    }
    el.innerHTML = `⚠ FORA DA PISTA ⚠<br><span style="font-size:0.7em">VOLTANDO EM ${Math.max(0, secondsLeft)}s</span>`;
    el.style.display = 'block';
  }

  hideOffTrackWarning() {
    const el = document.getElementById('offtrack-warning');
    if (el) el.style.display = 'none';
  }

  // ----------------------------------------------------------
  // CARROS REMOTOS (interpolação)
  // ----------------------------------------------------------
  updateRemoteCars(dt) {
    const F = window.NK_CONFIG.NETWORK.INTERP_FACTOR;
    Object.entries(this.remoteTargets).forEach(([id, t]) => {
      const car = this.cars[id];
      if (!car) return;
      // Lerp da posição
      car.sprite.x += (t.x - car.sprite.x) * F;
      car.sprite.y += (t.y - car.sprite.y) * F;

      // Lerp do ângulo (cuidado com a "volta" em 2π)
      let da = t.angle - car.angle;
      while (da >  Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      car.angle += da * F;
      car.sprite.setRotation(car.angle);
    });
  }

  // ----------------------------------------------------------
  // Atualiza posição dos textos com o nome acima dos carros
  // ----------------------------------------------------------
  updateNameTags() {
    Object.values(this.cars).forEach(car => {
      car.nameText.x = car.sprite.x;
      car.nameText.y = car.sprite.y - 28;
    });
  }

  // ----------------------------------------------------------
  // BOOSTS E CHECKPOINTS
  // ----------------------------------------------------------
  checkBoostsAndCheckpoints(time) {
    const car = this.myCar;
    const px = car.sprite.x, py = car.sprite.y;
    // Estou com escudo?
    const shielded = time < this.shieldUntil;

    // ----- CAIXAS DE ITEM ("?") -----
    const I = window.NK_CONFIG.ITEMS;
    if (!this.currentItem) { // só pega se não tem item ainda
      window.NK_Track.itemBoxSprites.forEach(b => {
        if (!b.active) return;
        const d = Math.hypot(b.boxX - px, b.boxY - py);
        if (d < I.PICKUP_RADIUS) {
          // Marca local como inativa (server vai confirmar pra todos)
          b.active = false;
          b.setVisible(false);
          // Avisa o servidor pra sortear o item
          window.NK_Net.sendItemPickup(b.boxId);
          // Vibração curta de "pegou"
          if (navigator.vibrate) { try { navigator.vibrate(40); } catch(e){} }
          // Reaparece em ITEMS.BOX_RESPAWN_MS
          this.time.delayedCall(I.BOX_RESPAWN_MS, () => {
            b.active = true;
            b.setVisible(true);
          });
        }
      });
    }

    // ----- DROPPED ITEMS (bananas/cones soltos por jogadores) -----
    Object.entries(this.droppedItems).forEach(([dropId, drop]) => {
      if (!drop.active) return;
      // Não atinge o próprio dono
      if (drop.ownerId === this.myId) return;
      const d = Math.hypot(drop.x - px, drop.y - py);
      const hitRadius = drop.type === 'banana'
        ? I.BANANA_DROP.RADIUS + 12
        : I.CONE_DROP.RADIUS + 14;
      if (d < hitRadius) {
        // Se eu tenho escudo, ABSORVE o hit e remove o item
        if (shielded) {
          this.flashShieldBlock();
          this.removeDroppedItem(dropId);
          window.NK_Net.sendItemHit(dropId);
          return;
        }
        // Sem escudo: aplica efeito conforme o tipo
        if (drop.type === 'banana') {
          this.bananaSpinUntil = time + window.NK_CONFIG.OBSTACLES.BANANA.SPIN_MS;
          this.bananaSpinDir = Math.random() < 0.5 ? -1 : 1;
          car.speed *= window.NK_CONFIG.OBSTACLES.BANANA.SPEED_PENALTY;
        } else {
          // cone
          car.speed *= window.NK_CONFIG.OBSTACLES.CONE.SPEED_PENALTY;
          const dx = px - drop.x, dy = py - drop.y;
          const len = Math.hypot(dx, dy) || 1;
          car.sprite.x += (dx / len) * window.NK_CONFIG.OBSTACLES.CONE.KNOCKBACK;
          car.sprite.y += (dy / len) * window.NK_CONFIG.OBSTACLES.CONE.KNOCKBACK;
        }
        if (navigator.vibrate) { try { navigator.vibrate(80); } catch(e){} }
        this.removeDroppedItem(dropId);
        window.NK_Net.sendItemHit(dropId);
      }
    });

    // ----- CONES FIXOS (obstáculos sólidos) -----
    const coneCfg = window.NK_CONFIG.OBSTACLES.CONE;
    window.NK_Track.coneSprites.forEach(c => {
      if (time < c.cooldownUntil) return; // ainda em cooldown
      const d = Math.hypot(c.coneX - px, c.coneY - py);
      if (d < coneCfg.RADIUS + 14) { // 14 ~ raio do carro
        if (shielded) {
          this.flashShieldBlock();
          c.cooldownUntil = time + coneCfg.COOLDOWN_MS;
          return;
        }
        // Bateu! Penaliza velocidade
        car.speed *= coneCfg.SPEED_PENALTY;
        // Knockback lateral: empurra perpendicular ao ângulo do carro
        // Direção do empurrão depende de qual lado do cone o carro está
        const dx = px - c.coneX, dy = py - c.coneY;
        const len = Math.hypot(dx, dy) || 1;
        car.sprite.x += (dx / len) * coneCfg.KNOCKBACK;
        car.sprite.y += (dy / len) * coneCfg.KNOCKBACK;
        // Cooldown pra não re-trigger no mesmo frame
        c.cooldownUntil = time + coneCfg.COOLDOWN_MS;
        // Feedback: animação de "tombo"
        this.tweens.add({
          targets: c,
          angle: c.angle === 0 ? 35 : 0,
          duration: 200,
          yoyo: true
        });
        // Som de batida (usa o engine pra "engasgar") + vibração forte
        if (navigator.vibrate) { try { navigator.vibrate(80); } catch(e){} }
        // Camera shake leve (só no desktop — no mobile causava sensação de trava)
        if (!this.isMobile) this.cameras.main.shake(150, 0.008);
      }
    });

    // ----- BANANAS (escorregão) -----
    const banCfg = window.NK_CONFIG.OBSTACLES.BANANA;
    window.NK_Track.bananaSprites.forEach(b => {
      if (!b.active) return;
      const d = Math.hypot(b.bananaX - px, b.bananaY - py);
      if (d < banCfg.RADIUS + 12) {
        if (shielded) {
          this.flashShieldBlock();
          b.active = false;
          b.setVisible(false);
          this.time.delayedCall(banCfg.RESPAWN_MS, () => {
            b.active = true;
            b.setVisible(true);
          });
          return;
        }
        // Pisou! Dispara spin
        b.active = false;
        b.setVisible(false);
        this.bananaSpinUntil = time + banCfg.SPIN_MS;
        // Aleatoriza direção do spin
        this.bananaSpinDir = Math.random() < 0.5 ? -1 : 1;
        // Penaliza velocidade já
        car.speed *= banCfg.SPEED_PENALTY;
        if (navigator.vibrate) { try { navigator.vibrate([60, 50, 60, 50, 60]); } catch(e){} }
        // Camera shake (só no desktop)
        if (!this.isMobile) this.cameras.main.shake(200, 0.012);
        // Banana volta depois de RESPAWN_MS
        this.time.delayedCall(banCfg.RESPAWN_MS, () => {
          b.active = true;
          b.setVisible(true);
        });
      }
    });

    // ----- BOOSTS -----
    window.NK_Track.boostSprites.forEach(b => {
      if (!b.active) return;
      const d = Math.hypot(b.boostX - px, b.boostY - py);
      if (d < 32) {
        b.active = false;
        b.setVisible(false);
        this.boostUntil = time + window.NK_CONFIG.CAR.BOOST_DURATION;
        car.speed = window.NK_CONFIG.CAR.BOOST_SPEED;
        window.NK_Audio.boost();
        // Vibração curta-curta ao pegar boost (só no mobile)
        if (navigator.vibrate) { try { navigator.vibrate([30, 40, 30]); } catch(e){} }
        window.NK_Net.sendBoostPickup(b.boostId);

        // Reaparece em 8s
        this.time.delayedCall(8000, () => {
          b.active = true;
          b.setVisible(true);
        });
      }
    });

    // ----- CHECKPOINTS -----
    const cps = window.NK_Track.checkpoints;
    const next = cps[this.myNextCheckpoint];
    if (next && segmentIntersectsCircle(next[0], next[1], next[2], next[3], px, py, 30)) {
      this.myNextCheckpoint++;
      // ranking parcial
      window.NK_Net.sendCheckpoint(this.myNextCheckpoint, this.myLap);
    }

    // ----- LINHA DE CHEGADA -----
    // Só conta volta se passou por todos os checkpoints
    const fl = window.NK_Track.finishLine;
    const onFinish = segmentIntersectsCircle(fl.x1, fl.y1, fl.x2, fl.y2, px, py, 30);

    if (onFinish && !this.crossingFinish) {
      this.crossingFinish = true;
      // Só conta como volta se completou todos os checkpoints
      if (this.myNextCheckpoint >= cps.length) {
        this.myLap++;
        this.myNextCheckpoint = 0;
        window.NK_Audio.lapDone();
        window.NK_Net.sendCheckpoint(0, this.myLap);

        // Atualiza HUD de voltas
        const lapEl = document.getElementById('hud-lap');
        if (lapEl) lapEl.textContent = Math.min(this.myLap + 1, this.maxLaps);

        if (this.myLap >= this.maxLaps) {
          this.myCar.finished = true;
          window.NK_Audio.victory();
        }
      } else if (!this.passedFinish) {
        // Primeira passagem pela linha (saída do grid) - não conta volta
        this.passedFinish = true;
      }
    } else if (!onFinish) {
      this.crossingFinish = false;
    }
  }

  // ----------------------------------------------------------
  // Esconde um boost (quando outro player pegou)
  // ----------------------------------------------------------
  hideBoost(boostId) {
    const b = window.NK_Track.boostSprites.find(x => x.boostId === boostId);
    if (b && b.active) {
      b.active = false;
      b.setVisible(false);
      this.time.delayedCall(8000, () => {
        b.active = true;
        b.setVisible(true);
      });
    }
  }

  // ----------------------------------------------------------
  // ITENS — uso automático e efeitos
  // ----------------------------------------------------------

  /** Esconde uma caixa "?" (quando alguém pega) */
  hideItemBox(boxId) {
    const b = window.NK_Track.itemBoxSprites.find(x => x.boxId === boxId);
    if (b && b.active) {
      b.active = false;
      b.setVisible(false);
      this.time.delayedCall(window.NK_CONFIG.ITEMS.BOX_RESPAWN_MS, () => {
        b.active = true;
        b.setVisible(true);
      });
    }
  }

  /** Usa o item que tenho na mão (chamado automaticamente após pickup) */
  autoUseItem() {
    if (!this.currentItem) return;
    const item = this.currentItem;
    this.currentItem = null;

    if (item === 'banana' || item === 'cone') {
      // Solta atrás do carro
      const dist = 40;
      const dropX = this.myCar.sprite.x - Math.cos(this.myCar.angle) * dist;
      const dropY = this.myCar.sprite.y - Math.sin(this.myCar.angle) * dist;
      window.NK_Net.sendItemUsed({ item, x: dropX, y: dropY });
    } else {
      window.NK_Net.sendItemUsed({ item });
    }
  }

  /** Aplica efeito de item (vem do servidor) */
  applyItemEffect(data) {
    const time = this.time.now;
    const I = window.NK_CONFIG.ITEMS;

    if (data.item === 'turbo' && data.on === 'self') {
      this.turboUntil = time + I.TURBO.DURATION_MS;
      this.myCar.speed = I.TURBO.SPEED;
      window.NK_Audio.boost && window.NK_Audio.boost();
      if (navigator.vibrate) { try { navigator.vibrate([30, 30, 30]); } catch(e){} }
    }
    else if (data.item === 'escudo' && data.on === 'self') {
      this.shieldUntil = time + I.SHIELD.DURATION_MS;
      this.showShieldVisual();
    }
    else if (data.item === 'raio' && data.on === 'all-except') {
      // Se EU não fui o dono, sou afetado
      if (data.ownerId !== this.myId) {
        // Se eu tenho escudo, bloqueio
        if (time < this.shieldUntil) {
          this.flashShieldBlock();
        } else {
          this.raioUntil = time + I.RAIO.SLOW_MS;
          this.myCar.speed *= I.RAIO.SPEED_MULT;
          if (navigator.vibrate) { try { navigator.vibrate(150); } catch(e){} }
          // Flash branco rápido na tela
          this.flashScreen(0xffffff, 200);
        }
      } else {
        // Sou o dono: dou um flash leve só pra feedback
        this.flashScreen(0xffff00, 150);
      }
    }
  }

  /** Cria sprite de banana/cone solto por jogador (sincronizado pela rede) */
  spawnDroppedItem({ ownerId, item, x, y, dropId }) {
    const I = window.NK_CONFIG.ITEMS;
    const gfx = this.add.graphics();
    gfx.x = x; gfx.y = y;
    gfx.setDepth(5);

    if (item === 'banana') {
      // Reusa visual da banana
      gfx.fillStyle(0x000000, 0.4);
      gfx.fillEllipse(0, 10, 38, 10);
      gfx.fillStyle(0xffeb3b, 1);
      gfx.beginPath();
      gfx.arc(-3, 0, 16, Math.PI * 0.15, Math.PI * 1.05, false);
      gfx.arc(-3, 0, 9, Math.PI * 1.05, Math.PI * 0.15, true);
      gfx.closePath();
      gfx.fillPath();
      gfx.lineStyle(2, 0x8a5a00, 1);
      gfx.beginPath();
      gfx.arc(-3, 0, 16, Math.PI * 0.15, Math.PI * 1.05, false);
      gfx.arc(-3, 0, 9, Math.PI * 1.05, Math.PI * 0.15, true);
      gfx.closePath();
      gfx.strokePath();
    } else {
      // cone
      gfx.fillStyle(0x000000, 0.5);
      gfx.fillEllipse(0, 16, 34, 12);
      gfx.fillStyle(0x1a0530, 1);
      gfx.fillRect(-18, 10, 36, 9);
      gfx.fillStyle(0xff6b00, 1);
      gfx.beginPath();
      gfx.moveTo(-15, 10);
      gfx.lineTo(0, -22);
      gfx.lineTo(15, 10);
      gfx.closePath();
      gfx.fillPath();
      gfx.fillStyle(0xffffff, 0.9);
      gfx.fillRect(-11, -3, 22, 3);
      gfx.fillRect(-13, 3, 26, 3);
    }

    this.droppedItems[dropId] = {
      sprite: gfx, ownerId, type: item, x, y, active: true
    };

    // Some sozinha depois de LIFETIME_MS
    const lifetime = item === 'banana' ? I.BANANA_DROP.LIFETIME_MS : I.CONE_DROP.LIFETIME_MS;
    this.time.delayedCall(lifetime, () => {
      this.removeDroppedItem(dropId);
    });
  }

  /** Remove um item solto */
  removeDroppedItem(dropId) {
    const drop = this.droppedItems[dropId];
    if (!drop) return;
    drop.active = false;
    if (drop.sprite) drop.sprite.destroy();
    delete this.droppedItems[dropId];
  }

  /** Mostra/atualiza o visual de escudo ao redor do carro */
  showShieldVisual() {
    if (this.shieldGfx) return; // já existe
    this.shieldGfx = this.add.graphics();
    this.shieldGfx.setDepth(15);
    // Tween de pulsação
    this.tweens.add({
      targets: this.shieldGfx,
      alpha: { from: 0.9, to: 0.4 },
      duration: 400,
      yoyo: true,
      repeat: -1
    });
  }

  hideShieldVisual() {
    if (this.shieldGfx) {
      this.shieldGfx.destroy();
      this.shieldGfx = null;
    }
  }

  /** Flash rápido pra mostrar que o escudo bloqueou algo */
  flashShieldBlock() {
    if (!this.shieldGfx) return;
    // Pulso rápido
    this.tweens.add({
      targets: this.shieldGfx,
      scale: { from: 1.3, to: 1 },
      duration: 200
    });
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch(e){} }
  }

  /** Flash de cor na tela inteira (efeito visual rápido) */
  flashScreen(color, durationMs) {
    const cam = this.cameras.main;
    cam.flash(durationMs, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
  }

  // ----------------------------------------------------------
  // MINIMAPA — desenha pista pequena no canto inferior direito
  // ----------------------------------------------------------
  setupMinimap() {
    const cfg = window.NK_CONFIG;
    // Dimensões do minimapa (CSS controla posição, aqui só calculamos escala)
    const isMobile = !!window.NK_IsMobile;
    this.miniSize = isMobile ? 110 : 160;
    this.miniScale = this.miniSize / Math.max(cfg.WORLD_WIDTH, cfg.WORLD_HEIGHT);

    // Container fixo na UI (não rola com a câmera)
    this.miniContainer = this.add.container(0, 0);
    this.miniContainer.setScrollFactor(0);
    this.miniContainer.setDepth(100);

    // Fundo do minimapa
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0118, 0.85);
    bg.fillRoundedRect(0, 0, this.miniSize + 8, this.miniSize + 8, 6);
    bg.lineStyle(2, 0x00ffff, 0.7);
    bg.strokeRoundedRect(0, 0, this.miniSize + 8, this.miniSize + 8, 6);
    this.miniContainer.add(bg);

    // Traçado da pista (estático, só desenhamos uma vez)
    const trackMini = this.add.graphics();
    trackMini.lineStyle(4, 0xff00ff, 0.7);
    trackMini.beginPath();
    const wps = window.NK_Track.waypoints;
    const ox = 4, oy = 4; // padding interno
    trackMini.moveTo(ox + wps[0].x * this.miniScale, oy + wps[0].y * this.miniScale);
    for (let i = 1; i < wps.length; i++) {
      trackMini.lineTo(ox + wps[i].x * this.miniScale, oy + wps[i].y * this.miniScale);
    }
    trackMini.strokePath();

    // Linha de chegada (xadrez branco)
    const fl = window.NK_Track.finishLine;
    trackMini.lineStyle(2, 0xffffff, 1);
    trackMini.beginPath();
    trackMini.moveTo(ox + fl.x1 * this.miniScale, oy + fl.y1 * this.miniScale);
    trackMini.lineTo(ox + fl.x2 * this.miniScale, oy + fl.y2 * this.miniScale);
    trackMini.strokePath();

    this.miniContainer.add(trackMini);

    // Camada dinâmica dos jogadores (atualiza no updateMinimap)
    this.miniPlayers = this.add.graphics();
    this.miniContainer.add(this.miniPlayers);

    // Posiciona o container no canto inferior direito
    this.positionMinimap();
    // Reposiciona quando a janela mudar
    this.scale.on('resize', () => this.positionMinimap());
  }

  positionMinimap() {
    if (!this.miniContainer) return;
    const w = this.scale.width;
    const h = this.scale.height;
    const margin = 12;
    this.miniContainer.x = w - this.miniSize - margin - 8;
    this.miniContainer.y = h - this.miniSize - margin - 8;
  }

  updateMinimap() {
    if (!this.miniPlayers) return;
    this.miniPlayers.clear();
    const ox = 4, oy = 4;
    Object.values(this.cars).forEach(car => {
      const x = ox + car.sprite.x * this.miniScale;
      const y = oy + car.sprite.y * this.miniScale;
      const isMe = car.id === this.myId;
      const colorInt = parseInt(car.info.color.replace('#', '0x'), 16);
      if (isMe) {
        // Eu: círculo maior com anel branco pulsante (mais visível)
        this.miniPlayers.fillStyle(0xffffff, 1);
        this.miniPlayers.fillCircle(x, y, 4);
        this.miniPlayers.fillStyle(colorInt, 1);
        this.miniPlayers.fillCircle(x, y, 3);
      } else {
        this.miniPlayers.fillStyle(colorInt, 0.9);
        this.miniPlayers.fillCircle(x, y, 2.5);
      }
    });
  }
}

// ----- Helper: segmento intersecta círculo (jogador) -----
function segmentIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx*dx + dy*dy;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx, py = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) < r;
}

window.RaceScene = RaceScene;
