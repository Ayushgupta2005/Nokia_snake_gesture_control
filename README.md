# 🐍 Nokia Snake - Gesture Control

Classic Nokia snake game that you play with your hand. Your webcam tracks your index finger and the snake follows it - no keyboard needed.

**🎮 Try it live:** <https://ayushgupta2005.github.io/Nokia_snake_gesture_control/>

Everything runs in your browser (MediaPipe hand tracking via WASM), so no video ever leaves your device.

## How to play

1. Allow camera access
2. Show an **open palm** ✋ to start / restart
3. Move your **index finger** ☝️ up / down / left / right to steer the snake
4. Eat the fruit, don't bite yourself. Walls wrap around
5. No camera? Arrow keys work too

## How it works

Raw hand landmarks are too jittery to control a game directly, so the fingertip position goes through a small pipeline first:

- moving average + exponential smoothing on the index fingertip (landmark 8)
- movement threshold → classify into UP / DOWN / LEFT / RIGHT
- majority vote over the last 3 frames + cooldown, so the snake doesn't get false turns
- open palm = counting extended fingers, used for start/restart

There are two versions with the same logic:

- **Web** (`web/`) - JavaScript + MediaPipe HandLandmarker + canvas, this is the live demo
- **Desktop** (`main.py`) - Python + OpenCV + MediaPipe + Pygame, camera runs on a separate thread so the game stays at 60 FPS

## Run locally

Web version (no build step):

```bash
cd web
python3 -m http.server 8000   # then open http://localhost:8000
```

Desktop version:

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py
```

## Deploy

Pushing to `main` auto deploys `web/` to GitHub Pages (see `.github/workflows/deploy-pages.yml`). One time setup: repo **Settings → Pages → Source → GitHub Actions**.
