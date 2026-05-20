# 🏁 NEON KART

Jogo de corrida arcade multiplayer online inspirado em Mario Kart, com visual **neon futurista** em 2.5D top-down. Roda 100% no navegador.

![Status](https://img.shields.io/badge/status-pronto%20pra%20jogar-ff00ff)
![Tech](https://img.shields.io/badge/phaser-3-00ffff)
![Server](https://img.shields.io/badge/server-socket.io-ffff00)

## ✨ Features

- 🌐 **Multiplayer online por link** — quem entrar no link joga junto automaticamente
- 👑 **Sistema de host** — primeiro jogador a entrar controla o início
- 🎮 **Controles WASD ou setinhas + Shift para drift**
- ⚡ **Boosts neon** espalhados pela pista
- 🏆 **Ranking em tempo real**, contador de voltas, posição
- 🏁 **Linha de chegada** funcional com checkpoints
- 🎵 **Música arcade synthwave** gerada proceduralmente (sem arquivos pesados!)
- 🚦 **Countdown 3-2-1-GO** antes da corrida
- 🎉 **Tela de vitória** com ranking final
- 📱 **Otimizado** para rodar em qualquer máquina

---

## 📁 Estrutura do Projeto

```
neon-kart/
├── client/                    # FRONTEND (publicar no GitHub Pages)
│   ├── index.html             # HTML principal
│   ├── assets/                # (vazio - tudo é gerado por código)
│   └── src/
│       ├── config.js          # Configurações globais
│       ├── style.css          # CSS neon futurista
│       ├── main.js            # Ponto de entrada
│       ├── ui.js              # Manager de UI (lobby, HUD, vitória)
│       ├── scenes/
│       │   ├── TrackScene.js  # Desenho da pista + waypoints
│       │   └── RaceScene.js   # Cena principal de corrida
│       └── utils/
│           ├── audio.js       # Sistema de áudio procedural
│           └── network.js     # Camada de Socket.IO
│
└── server/                    # BACKEND (Node.js)
    ├── package.json
    └── server.js              # Servidor Express + Socket.IO
```

---

## 🚀 Como Rodar

### 1) Servidor (necessário para multiplayer)

```bash
cd server
npm install
npm start
```

O servidor sobe em `http://localhost:3000`.

### 2) Cliente

#### Opção A — Tudo local (mais simples)

Como o servidor já serve os arquivos estáticos do cliente, **basta abrir `http://localhost:3000`** no navegador. Pronto.

#### Opção B — Cliente no GitHub Pages (produção)

1. Hospede o **servidor** em um serviço gratuito como **[Render](https://render.com)**, **[Railway](https://railway.app)** ou **[Glitch](https://glitch.com)**.
2. Edite `client/src/config.js` e troque a linha:
   ```js
   SERVER_URL: 'https://SEU-SERVIDOR-AQUI.onrender.com'
   ```
3. Faça push da pasta `client/` para um repositório no GitHub.
4. Ative GitHub Pages nas configurações do repositório (Settings → Pages → Source: main branch / root).
5. Pronto! Seu jogo está online em `https://seu-user.github.io/seu-repo/`.

> ⚠️ **Importante:** o GitHub Pages serve só arquivos estáticos, por isso o **servidor multiplayer precisa estar em outro lugar**. O cliente conecta nele via WebSocket.

---

## 🎮 Como Jogar

1. Acesse o link do jogo.
2. Digite seu **nickname** e **nick do Habbo**.
3. Clique em **CONECTAR**.
4. Você cai no **lobby da sala**.
5. **Compartilhe o link** com seus amigos (botão "COPIAR LINK").
6. Quando todos estiverem prontos, o **host** clica em **INICIAR CORRIDA**.
7. Countdown 3-2-1-GO e a corrida começa!

### Controles

| Tecla       | Ação                |
|-------------|---------------------|
| `W` / `↑`   | Acelerar            |
| `S` / `↓`   | Frear / Ré          |
| `A` / `←`   | Virar à esquerda    |
| `D` / `→`   | Virar à direita     |
| `Shift`     | Drift (curva fechada)|

### Dicas

- **Não saia da pista!** A velocidade cai pra menos da metade fora dela.
- **Pegue os boosts verdes** — eles te dão uma explosão de velocidade.
- **Use o drift** em curvas fechadas — combina segurar a curva + `Shift`.
- Você precisa cruzar **todos os checkpoints** antes da linha de chegada pra contar a volta.

---

## 🔧 Customização

Tudo que dá pra ajustar está em `client/src/config.js`:

```js
WORLD_WIDTH:  4000,     // Tamanho da pista
MAX_LAPS:     3,        // Número de voltas
CAR.MAX_SPEED: 400,     // Velocidade máxima
CAR.TURN_SPEED: 180,    // Velocidade da curva
COLORS: { ... }         // Paleta de cores
```

E pra mudar o traçado da pista, edite `client/src/scenes/TrackScene.js` (lista `waypoints`).

---

## 🧠 Como funciona o Multiplayer

- O **cliente** envia sua posição (x, y, ângulo, velocidade) para o servidor a cada **50ms**.
- O **servidor** retransmite para todos os outros jogadores da mesma sala.
- Os carros remotos são **interpolados** suavemente para evitar "tremedeira".
- **Voltas e checkpoints** são reportados pelo cliente; o servidor confia (para simplificar).
- Quando todos terminam → tela de vitória → 8 segundos → volta ao lobby automaticamente.

---

## 🎨 Arte & Estética

- **Fontes:** Orbitron (display) + Rajdhani (corpo) — vibes synthwave.
- **Cores:** magenta, ciano, amarelo neon sobre fundo roxo escuro.
- **Som:** tudo gerado por **Web Audio API** (synths procedurais). Zero arquivos.
- **Pista:** desenhada com Phaser Graphics (vetores) — sem texturas externas.

---

## 📦 Tech Stack

- **[Phaser 3](https://phaser.io/)** — Engine 2D
- **[Socket.IO](https://socket.io/)** — Multiplayer em tempo real
- **Express** — Servidor HTTP
- **Web Audio API** — Áudio procedural

---

## 📝 Licença

MIT — use à vontade.

---

Divirta-se! 🏎️💨
