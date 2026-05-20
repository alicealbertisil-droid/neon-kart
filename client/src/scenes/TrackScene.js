/**
 * ============================================================
 * NEON KART - DEFINIÇÃO DA PISTA
 * ============================================================
 * Aqui definimos:
 *   - O trajeto da pista (lista de pontos)
 *   - Os checkpoints (para detectar voltas)
 *   - A linha de chegada
 *   - As posições de boost
 *   - O grid de largada
 *
 * O desenho da pista é feito proceduralmente em Phaser,
 * sem precisar de imagens externas (mais leve!).
 * ============================================================ */

const NK_Track = {

  /**
   * Pontos centrais da pista (em ordem, formando um circuito fechado).
   * O traçado é uma pista futurista grande com curvas largas.
   * Coordenadas no mundo (0 a WORLD_WIDTH x WORLD_HEIGHT).
   */
  waypoints: [
    // Reta de largada (parte de baixo, indo para a direita)
    { x: 600,  y: 2000 },
    { x: 1200, y: 2000 },
    { x: 1800, y: 2000 },
    { x: 2400, y: 2000 },
    { x: 3000, y: 2000 },
    // Curva à direita (sobe)
    { x: 3400, y: 1900 },
    { x: 3600, y: 1700 },
    { x: 3700, y: 1500 },
    { x: 3700, y: 1300 },
    { x: 3700, y: 1100 },
    // Curva no topo direito
    { x: 3600, y: 900 },
    { x: 3400, y: 750 },
    { x: 3100, y: 700 },
    // Reta superior (volta para a esquerda)
    { x: 2700, y: 700 },
    { x: 2300, y: 700 },
    // "S" no meio: desce
    { x: 2000, y: 800 },
    { x: 1900, y: 1000 },
    { x: 2000, y: 1200 },
    // sobe de novo
    { x: 2100, y: 1300 },
    { x: 1900, y: 1400 },
    { x: 1600, y: 1300 },
    // Continua à esquerda
    { x: 1300, y: 1100 },
    { x: 1000, y: 900 },
    { x: 700,  y: 800 },
    // Curva esquerda topo
    { x: 400,  y: 900 },
    { x: 300,  y: 1100 },
    { x: 300,  y: 1300 },
    { x: 300,  y: 1500 },
    { x: 300,  y: 1700 },
    // Curva esquerda inferior
    { x: 400,  y: 1900 },
    // Volta para a reta de largada
    { x: 600,  y: 2000 }
  ],

  /**
   * Linha de chegada: cruza a pista em pontos específicos.
   * Definida por dois pontos (x1,y1)-(x2,y2)
   */
  finishLine: {
    x1: 900, y1: 1880,
    x2: 900, y2: 2120,
    angle: 0 // direção da pista neste ponto (em radianos)
  },

  /**
   * Checkpoints: o jogador precisa passar por todos em ordem
   * antes de cruzar a linha de chegada para validar a volta.
   * Distribuídos ao longo do circuito.
   */
  checkpoints: [
    // [x1,y1, x2,y2]
    [3700, 1400, 3500, 1400],   // CP1 - lateral direita
    [2700, 600,  2700, 800],    // CP2 - reta superior
    [1900, 1100, 2100, 1100],   // CP3 - meio (descida do S)
    [300,  1500, 500,  1500]    // CP4 - lateral esquerda
  ],

  /**
   * Posições dos boosts na pista
   */
  boosts: [
    { id: 1, x: 1500, y: 2000 },
    { id: 2, x: 2700, y: 2000 },
    { id: 3, x: 3700, y: 1300 },
    { id: 4, x: 3100, y: 700 },
    { id: 5, x: 2000, y: 1000 },
    { id: 6, x: 1000, y: 900 },
    { id: 7, x: 300,  y: 1500 }
  ],

  /**
   * Posições do grid de largada (em frente à linha de chegada).
   * 20 posições na mesma linha de largada (x=750), centralizadas na pista
   * (track center y=2000, halfWidth=110, margem de 15px nas bordas).
   */
  startGrid: [
    { x: 750, y: 1905, angle: 0 },
    { x: 750, y: 1915, angle: 0 },
    { x: 750, y: 1925, angle: 0 },
    { x: 750, y: 1935, angle: 0 },
    { x: 750, y: 1945, angle: 0 },
    { x: 750, y: 1955, angle: 0 },
    { x: 750, y: 1965, angle: 0 },
    { x: 750, y: 1975, angle: 0 },
    { x: 750, y: 1985, angle: 0 },
    { x: 750, y: 1995, angle: 0 },
    { x: 750, y: 2005, angle: 0 },
    { x: 750, y: 2015, angle: 0 },
    { x: 750, y: 2025, angle: 0 },
    { x: 750, y: 2035, angle: 0 },
    { x: 750, y: 2045, angle: 0 },
    { x: 750, y: 2055, angle: 0 },
    { x: 750, y: 2065, angle: 0 },
    { x: 750, y: 2075, angle: 0 },
    { x: 750, y: 2085, angle: 0 },
    { x: 750, y: 2095, angle: 0 }
  ],

  /**
   * Desenha a pista no Phaser usando primitivas (Graphics).
   * Não usa nenhuma textura externa.
   *
   * @param {Phaser.Scene} scene
   */
  draw(scene) {
    const cfg = window.NK_CONFIG;
    const W = cfg.WORLD_WIDTH, H = cfg.WORLD_HEIGHT;

    // ----- 1) FUNDO COM GRID NEON -----
    const bg = scene.add.graphics();
    bg.fillGradientStyle(cfg.COLORS.BG_TOP, cfg.COLORS.BG_TOP, cfg.COLORS.BG_BOTTOM, cfg.COLORS.BG_BOTTOM);
    bg.fillRect(0, 0, W, H);

    // Grid futurista
    const grid = scene.add.graphics();
    grid.lineStyle(1, cfg.COLORS.GRID, 0.5);
    for (let x = 0; x <= W; x += 80) {
      grid.moveTo(x, 0); grid.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += 80) {
      grid.moveTo(0, y); grid.lineTo(W, y);
    }
    grid.strokePath();

    // ----- 2) PISTA (asfalto) -----
    // Desenhamos como uma linha grossa ao longo dos waypoints.
    const trackGfx = scene.add.graphics();
    // Sombra externa (glow)
    trackGfx.lineStyle(cfg.TRACK_WIDTH + 30, cfg.COLORS.TRACK_EDGE_OUTER, 0.15);
    trackGfx.beginPath();
    trackGfx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++) {
      trackGfx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    }
    trackGfx.strokePath();

    // Borda externa magenta
    trackGfx.lineStyle(cfg.TRACK_WIDTH + 8, cfg.COLORS.TRACK_EDGE_OUTER, 0.9);
    trackGfx.beginPath();
    trackGfx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++) {
      trackGfx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    }
    trackGfx.strokePath();

    // Asfalto interno
    trackGfx.lineStyle(cfg.TRACK_WIDTH, cfg.COLORS.TRACK, 1);
    trackGfx.beginPath();
    trackGfx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++) {
      trackGfx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    }
    trackGfx.strokePath();

    // Borda interna ciano (linha mais fina dentro)
    trackGfx.lineStyle(cfg.TRACK_WIDTH - 16, cfg.COLORS.TRACK, 1);
    trackGfx.beginPath();
    trackGfx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
    for (let i = 1; i < this.waypoints.length; i++) {
      trackGfx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
    }
    trackGfx.strokePath();

    // ----- 3) LINHA CENTRAL TRACEJADA -----
    const dash = scene.add.graphics();
    dash.lineStyle(4, cfg.COLORS.LINE_DASH, 0.7);
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const segments = Math.floor(dist / 30);
      for (let s = 0; s < segments; s += 2) {
        const t1 = s / segments, t2 = (s + 1) / segments;
        dash.moveTo(a.x + dx * t1, a.y + dy * t1);
        dash.lineTo(a.x + dx * t2, a.y + dy * t2);
      }
    }
    dash.strokePath();

    // ----- 4) LINHA DE CHEGADA (xadrez) -----
    const fl = this.finishLine;
    const finishGfx = scene.add.graphics();
    const cellSize = 16;
    const dx = fl.x2 - fl.x1, dy = fl.y2 - fl.y1;
    const lineLen = Math.hypot(dx, dy);
    const cells = Math.floor(lineLen / cellSize);
    const nx = -dy / lineLen, ny = dx / lineLen; // normal
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < 2; j++) {
        const t = i / cells;
        const cx = fl.x1 + dx * t + nx * (j - 0.5) * cellSize;
        const cy = fl.y1 + dy * t + ny * (j - 0.5) * cellSize;
        const color = (i + j) % 2 === 0 ? cfg.COLORS.FINISH_A : cfg.COLORS.FINISH_B;
        finishGfx.fillStyle(color);
        finishGfx.fillRect(cx - cellSize/2, cy - cellSize/2, cellSize, cellSize);
      }
    }

    // ----- 5) BOOSTS (pads no chão) -----
    this.boostSprites = [];
    this.boosts.forEach(b => {
      const boostGfx = scene.add.graphics();
      boostGfx.x = b.x; boostGfx.y = b.y;

      // base com glow
      boostGfx.fillStyle(cfg.COLORS.BOOST, 0.3);
      boostGfx.fillCircle(0, 0, 40);
      boostGfx.fillStyle(cfg.COLORS.BOOST, 0.6);
      boostGfx.fillCircle(0, 0, 28);
      // seta
      boostGfx.fillStyle(0xffffff, 1);
      boostGfx.beginPath();
      boostGfx.moveTo(-12, 8);
      boostGfx.lineTo(0, -10);
      boostGfx.lineTo(12, 8);
      boostGfx.lineTo(6, 8);
      boostGfx.lineTo(6, 14);
      boostGfx.lineTo(-6, 14);
      boostGfx.lineTo(-6, 8);
      boostGfx.closePath();
      boostGfx.fillPath();

      boostGfx.boostId = b.id;
      boostGfx.boostX = b.x;
      boostGfx.boostY = b.y;
      boostGfx.active = true;

      // animação pulsante
      scene.tweens.add({
        targets: boostGfx,
        scale: { from: 1, to: 1.2 },
        alpha: { from: 1, to: 0.7 },
        duration: 600,
        yoyo: true,
        repeat: -1
      });

      this.boostSprites.push(boostGfx);
    });

    // ----- 6) NEON DE PÓS-PISTA: pontos brilhantes ao longo da pista -----
    const lights = scene.add.graphics();
    for (let i = 0; i < this.waypoints.length; i += 1) {
      const wp = this.waypoints[i];
      const color = i % 2 === 0 ? cfg.COLORS.TRACK_EDGE_OUTER : cfg.COLORS.TRACK_EDGE_INNER;
      lights.fillStyle(color, 0.4);
      lights.fillCircle(wp.x, wp.y - cfg.TRACK_WIDTH/2 - 12, 4);
      lights.fillCircle(wp.x, wp.y + cfg.TRACK_WIDTH/2 + 12, 4);
    }
  },

  /**
   * Checa se um ponto (x,y) está dentro da pista.
   * Faz isso medindo a distância para o segmento mais próximo dos waypoints.
   */
  isOnTrack(x, y) {
    const halfW = window.NK_CONFIG.TRACK_WIDTH / 2;
    let minDist = Infinity;
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const d = distToSegment({x,y}, this.waypoints[i], this.waypoints[i+1]);
      if (d < minDist) minDist = d;
    }
    return minDist <= halfW;
  }
};

/** Helper geométrico: distância de um ponto a um segmento */
function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx*dx + dy*dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

window.NK_Track = NK_Track;
