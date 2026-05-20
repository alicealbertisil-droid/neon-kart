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
      i++;
    });

    // Define meu carro como referência
    this.myCar = this.cars[this.myId];
    if (this.myCar) {
      this.cameras.main.startFollow(this.myCar.sprite, true, 0.1, 0.1);
      this.cameras.main.setZoom(1.0);
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

    // ----- COUNTDOWN -----
    this.startCountdown();

    // ----- LISTENERS DE REDE -----
    this.setupNetwork();
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
    const nameText = this.add.text(x, y - 30,
      playerInfo.nickname + (playerInfo.habboNick ? ` (${playerInfo.habboNick})` : ''),
      {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '12px',
        color: playerInfo.color,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center'
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
  }

  // ----------------------------------------------------------
  // FÍSICA DO MEU CARRO
  // ----------------------------------------------------------
  updateMyCar(dt, time) {
    const C = window.NK_CONFIG.CAR;
    const car = this.myCar;
    const k = this.keys;
    const c = this.cursors;

    const up    = k.W.isDown || c.up.isDown;
    const down  = k.S.isDown || c.down.isDown;
    const left  = k.A.isDown || c.left.isDown;
    const right = k.D.isDown || c.right.isDown;
    const drift = k.SHIFT.isDown;

    car.drifting = drift && (left || right) && Math.abs(car.speed) > 100;

    // Boost ativo?
    const boosting = time < this.boostUntil;
    const maxSpeed = boosting ? C.BOOST_SPEED : C.MAX_SPEED;

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

    // ----- CURVA -----
    // Só pode girar se estiver se movendo (mais realista)
    if (Math.abs(car.speed) > 5) {
      let turnSpeed = Phaser.Math.DegToRad(C.TURN_SPEED);
      // Drift fake: aumenta o ângulo de virada
      if (car.drifting) turnSpeed *= C.DRIFT_MULT;
      // Reduz curva em velocidades muito baixas
      const speedFactor = Math.min(1, Math.abs(car.speed) / 200);
      // Carro vai de ré: inverte direção
      const dir = car.speed >= 0 ? 1 : -1;

      if (left)  car.angle -= turnSpeed * dt * speedFactor * dir;
      if (right) car.angle += turnSpeed * dt * speedFactor * dir;
    }

    // ----- POSIÇÃO -----
    let vx = Math.cos(car.angle) * car.speed * dt;
    let vy = Math.sin(car.angle) * car.speed * dt;

    // Drift: aplica um pequeno deslizamento lateral
    if (car.drifting) {
      vx += Math.cos(car.angle + Math.PI/2) * car.speed * 0.15 * dt * (left ? -1 : 1);
      vy += Math.sin(car.angle + Math.PI/2) * car.speed * 0.15 * dt * (left ? -1 : 1);
    }

    const nextX = car.sprite.x + vx;
    const nextY = car.sprite.y + vy;

    // ----- PENALIDADE FORA DA PISTA -----
    if (!window.NK_Track.isOnTrack(nextX, nextY)) {
      car.speed *= C.OFFTRACK_MULT;
    }

    car.sprite.x = nextX;
    car.sprite.y = nextY;
    car.sprite.setRotation(car.angle);

    // Marcas de drift no chão (opcional, leve)
    if (car.drifting && time % 4 < 1) {
      const skid = this.add.circle(car.sprite.x, car.sprite.y, 3, 0xffffff, 0.5);
      skid.setDepth(1);
      this.tweens.add({ targets: skid, alpha: 0, duration: 1500, onComplete: () => skid.destroy() });
    }
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
