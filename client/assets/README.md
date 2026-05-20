# Assets

Esta pasta está aqui para futuras expansões.

**O jogo atualmente NÃO usa arquivos externos** (imagens ou áudio) — tudo é gerado proceduralmente:

- 🎨 **Gráficos:** desenhados com Phaser Graphics (vetores) em `src/scenes/TrackScene.js`
- 🔊 **Áudio:** sintetizado com Web Audio API em `src/utils/audio.js`

Isso torna o jogo **muito leve** (~50KB de código, sem assets) e fácil de hospedar no GitHub Pages.

## Se quiser adicionar imagens/sons

1. Coloque arquivos aqui (ex: `assets/audio/music.mp3`, `assets/sprites/car.png`)
2. Carregue na `preload()` da `RaceScene`:
   ```js
   this.load.audio('music', 'assets/audio/music.mp3');
   this.load.image('car', 'assets/sprites/car.png');
   ```
