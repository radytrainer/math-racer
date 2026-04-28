# Racing Calculator Game

A real-time classroom racing game where two players solve math problems on separate devices while a teacher dashboard visualizes the race live.

## Project Structure

```text
client/   React + Vite frontend
server/   Express + Socket.IO backend
```

## Run Locally

1. Install dependencies:

```bash
npm.cmd run install:all
```

2. Start both apps:

```bash
npm.cmd start
```

3. Open:

- Teacher dashboard: `http://localhost:5173/`
- Player A screen: `http://localhost:5173/player/A`
- Player B screen: `http://localhost:5173/player/B`

## How It Works

1. The teacher opens the dashboard and creates or uses a room code.
2. Player A and Player B join the same room from separate devices.
3. The teacher starts the race.
4. Every correct answer moves the player's racer forward in real time.
5. The first player to reach the finish line wins.

## Features

- Real-time multiplayer sync with Socket.IO
- Room/session-based gameplay
- Countdown before race start
- Difficulty selector
- Animated race lanes
- Live scoreboard and winner banner
- Mobile-friendly player interface

## Notes

- Game state is stored in memory on the server for simplicity.
- If you want persistence later, SQLite can be added around the room results data.
