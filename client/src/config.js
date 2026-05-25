/**
 * ============================================================
 * NEON KART - CONFIGURAÇÕES GLOBAIS
 * ============================================================
 * Tudo que pode ser ajustado fica aqui: dimensões da pista,
 * física do carro, número de voltas, endereço do servidor etc.
 *
 * Para mudar o servidor multiplayer em produção, ajuste
 * SERVER_URL para a URL pública (ex: Render, Railway, Glitch).
 * ============================================================
 */

const NK_CONFIG = {
  /* ----- SERVIDOR ----- */
  // Em desenvolvimento (local), use http://localhost:3000
  // Em produção (GitHub Pages), coloque a URL do seu servidor hospedado.
  // Exemplo: 'https://meu-neon-kart.onrender.com'
  SERVER_URL:
    window.location.hostname === "localhost"
      ? "http://localhost:3000"
      : "https://neon-kart.onrender.com",

  /* ----- PISTA ----- */
  WORLD_WIDTH: 6000, // largura total do mundo do jogo (px) - AUMENTADA
  WORLD_HEIGHT: 3600, // altura total - AUMENTADA
  TRACK_WIDTH: 280, // espessura da pista (px) - mais larga p/ acomodar maior escala

  /* ----- PENALIDADE FORA DA PISTA ----- */
  OFFTRACK_RESET_MS: 3000, // tempo (ms) fora da pista antes de voltar pra largada

  /* ----- CORRIDA ----- */
  MAX_LAPS: 3,
  COUNTDOWN_SECONDS: 3,

  /* ----- FÍSICA DO CARRO ----- */
  CAR: {
    MAX_SPEED: 400, // velocidade máxima em pixels/segundo
    ACCEL: 600, // aceleração
    BRAKE: 800, // desaceleração ao frear
    REVERSE_SPEED: 150, // velocidade da ré
    FRICTION: 300, // perda natural de velocidade
    TURN_SPEED: 180, // velocidade da curva (graus/segundo)
    DRIFT_MULT: 1.6, // multiplicador da curva durante drift
    OFFTRACK_MULT: 0.55, // velocidade máxima fora da pista (fração de MAX_SPEED)
    BOOST_SPEED: 650, // velocidade durante boost
    BOOST_DURATION: 1500, // ms
    SIZE: 28, // tamanho do carro (px)
  },

  /* ----- REDE ----- */
  NETWORK: {
    UPDATE_INTERVAL: 50, // envia posição a cada 50ms (~20 FPS de rede)
    INTERP_FACTOR: 0.2, // suavização da interpolação dos outros carros
  },

  /* ----- VISUAL ----- */
  COLORS: {
    BG_TOP: 0x0a0118,
    BG_BOTTOM: 0x150030,
    TRACK: 0x2a0a4a,
    TRACK_EDGE_OUTER: 0xff00ff, // magenta
    TRACK_EDGE_INNER: 0x00ffff, // ciano
    LINE_DASH: 0xffff00, // amarelo
    FINISH_A: 0xffffff,
    FINISH_B: 0x000000,
    GRID: 0x2a0a4a,
    BOOST: 0x00ff88,
  },
};

// Exporta global (não usamos módulos ES porque GitHub Pages serve estático)
window.NK_CONFIG = NK_CONFIG;
