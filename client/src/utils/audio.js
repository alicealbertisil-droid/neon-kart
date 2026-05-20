/**
 * ============================================================
 * NEON KART - SISTEMA DE ÁUDIO
 * ============================================================
 * Geramos os sons proceduralmente com Web Audio API, assim não
 * precisamos hospedar arquivos .mp3/.wav (deixa o projeto leve
 * e funciona perfeito no GitHub Pages).
 *
 * Sons incluídos:
 *   - Música de fundo (loop arcade synthwave)
 *   - SFX de boost, countdown, vitória, click
 *   - Som do motor (frequência muda com velocidade)
 * ============================================================
 */

const NK_Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicNodes = [];
  let engineOsc = null;
  let engineGain = null;
  let musicPlaying = false;

  /** Inicializa o contexto. Deve ser chamado após interação do usuário. */
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.55;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.25;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);
  }

  /** Toca um beep de tom específico (frequência, duração, tipo de onda) */
  function beep(freq, duration = 0.1, type = 'square', vol = 0.4) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  /** Click rápido de UI */
  function click() { beep(800, 0.05, 'square', 0.2); }

  /** Sons do countdown 3-2-1-GO */
  function countdownBeep() { beep(440, 0.18, 'square', 0.5); }
  function goBeep() {
    beep(660, 0.1, 'square', 0.5);
    setTimeout(() => beep(880, 0.3, 'sawtooth', 0.6), 80);
  }

  /** Som de boost */
  function boost() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain); gain.connect(sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  /** Fanfarra de vitória */
  function victory() {
    if (!ctx) return;
    const notes = [523, 659, 784, 1046]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      setTimeout(() => beep(f, 0.25, 'square', 0.5), i * 120);
    });
  }

  /** Som de cruzar a linha de chegada (volta) */
  function lapDone() {
    beep(880, 0.08, 'square', 0.4);
    setTimeout(() => beep(1320, 0.15, 'square', 0.4), 80);
  }

  /** Som do motor: usa um oscillator único que muda de frequência */
  function startEngine() {
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain.gain.value = 0;

    // Filtro passa-baixa para deixar mais "abafado"
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(sfxGain);
    engineOsc.start();
  }
  function setEngineSpeed(speedRatio) {
    if (!engineOsc) return;
    // freq vai de 60 (parado) até 240 (max)
    const freq = 60 + speedRatio * 180;
    engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
    engineGain.gain.setTargetAtTime(0.04 + speedRatio * 0.08, ctx.currentTime, 0.1);
  }
  function stopEngine() {
    if (!engineOsc) return;
    try { engineOsc.stop(); } catch (e) {}
    engineOsc = null;
    engineGain = null;
  }

  /**
   * Música de fundo: loop arcade synthwave.
   * Usamos uma sequência simples com bass + arpeggio.
   */
  function startMusic() {
    if (!ctx || musicPlaying) return;
    musicPlaying = true;

    const bpm = 110;
    const beatDur = 60 / bpm;
    // Em Am: notas usadas
    const bass = [110, 110, 87.3, 87.3, 98, 98, 82.4, 82.4]; // A,A,F,F,G,G,E,E
    const arp  = [220, 261.6, 329.6, 261.6, 196, 246.9, 329.6, 246.9];

    let step = 0;

    function tick() {
      if (!musicPlaying) return;
      const t = ctx.currentTime;

      // BASS
      const b = ctx.createOscillator();
      const bg = ctx.createGain();
      b.type = 'sawtooth';
      b.frequency.value = bass[step % bass.length];
      bg.gain.setValueAtTime(0.2, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + beatDur);
      b.connect(bg); bg.connect(musicGain);
      b.start(t); b.stop(t + beatDur);
      musicNodes.push(b);

      // ARPEGGIO
      const a = ctx.createOscillator();
      const ag = ctx.createGain();
      a.type = 'square';
      a.frequency.value = arp[step % arp.length];
      ag.gain.setValueAtTime(0.08, t);
      ag.gain.exponentialRampToValueAtTime(0.001, t + beatDur * 0.4);
      a.connect(ag); ag.connect(musicGain);
      a.start(t); a.stop(t + beatDur * 0.4);
      musicNodes.push(a);

      // KICK (a cada 2 steps)
      if (step % 2 === 0) {
        const k = ctx.createOscillator();
        const kg = ctx.createGain();
        k.type = 'sine';
        k.frequency.setValueAtTime(120, t);
        k.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        kg.gain.setValueAtTime(0.4, t);
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        k.connect(kg); kg.connect(musicGain);
        k.start(t); k.stop(t + 0.15);
        musicNodes.push(k);
      }

      step++;
      setTimeout(tick, beatDur * 1000);
    }
    tick();
  }
  function stopMusic() {
    musicPlaying = false;
    musicNodes.forEach(n => { try { n.stop(); } catch(e){} });
    musicNodes = [];
  }

  return {
    init, click, beep,
    countdownBeep, goBeep,
    boost, victory, lapDone,
    startEngine, setEngineSpeed, stopEngine,
    startMusic, stopMusic
  };
})();

window.NK_Audio = NK_Audio;
