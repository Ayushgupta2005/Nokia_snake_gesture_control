// Main entry point - loads mediapipe hand tracking, reads webcam and runs the game
// everything runs in the browser, no video is sent anywhere

import {
  FilesetResolver,
  HandLandmarker,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
import { GestureController } from "./gesture-controller.js";
import { SnakeGame } from "./snake-game.js";

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const statusText = document.getElementById("status");
const video = document.getElementById("webcam");
const cameraCanvas = document.getElementById("camera-canvas");
const cameraCtx = cameraCanvas.getContext("2d");

const game = new SnakeGame(document.getElementById("game-canvas"));
const gestures = new GestureController();
let handLandmarker = null;
let drawingUtils = null;
let cameraReady = false;
let lastVideoTime = -1;
let lastGameUpdate = 0;
let gameOverAt = 0;

function setStatus(text) {
  statusText.textContent = text;
}

// MEDIAPIPE SETUP
async function createLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await HandLandmarker.createFromOptions(vision, options("GPU"));
  } catch (e) {
    // some devices dont support GPU delegate
    console.warn("GPU not available, using CPU:", e);
    return await HandLandmarker.createFromOptions(vision, options("CPU"));
  }
}

// CAMERA SETUP
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });
  await video.play();
  cameraCanvas.width = video.videoWidth || 640;
  cameraCanvas.height = video.videoHeight || 480;
  cameraReady = true;
}

// hand detection + drawing the mirrored preview
function processVideoFrame(nowMs) {
  if (!cameraReady || !handLandmarker) return;
  if (video.currentTime === lastVideoTime) return; // no new frame yet
  lastVideoTime = video.currentTime;

  const result = handLandmarker.detectForVideo(video, nowMs);

  const w = cameraCanvas.width;
  const h = cameraCanvas.height;
  cameraCtx.save();
  cameraCtx.scale(-1, 1); // mirror
  cameraCtx.translate(-w, 0);
  cameraCtx.drawImage(video, 0, 0, w, h);

  const landmarks = result.landmarks?.[0];
  if (landmarks) {
    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
      color: "#00ff00",
      lineWidth: 2,
    });
    drawingUtils.drawLandmarks(landmarks, { color: "#ff4040", radius: 3 });
    // highlight index fingertip
    const tip = landmarks[8];
    cameraCtx.beginPath();
    cameraCtx.arc(tip.x * w, tip.y * h, 8, 0, Math.PI * 2);
    cameraCtx.fillStyle = "#ffff00";
    cameraCtx.fill();

    gestures.detect(landmarks);
  } else {
    gestures.noHand();
  }
  cameraCtx.restore();

  // show detected direction on the preview
  if (gestures.currentDirection) {
    cameraCtx.font = "bold 24px monospace";
    cameraCtx.fillStyle = "#ffff00";
    cameraCtx.textAlign = "left";
    cameraCtx.textBaseline = "top";
    cameraCtx.fillText("Direction: " + gestures.currentDirection, 10, 10);
  }
}

// gesture -> game
function applyGestures() {
  if (game.state === "playing") {
    if (gestures.currentDirection) game.changeDirection(gestures.currentDirection);
  } else if (gestures.isOpenPalm) {
    // small delay so a lingering palm doesnt instantly skip the game over screen
    if (game.state === "gameover" && performance.now() - gameOverAt < 1200) return;
    gestures.reset();
    game.start();
  }
}

// MAIN LOOP
function mainLoop(nowMs) {
  processVideoFrame(nowMs);
  applyGestures();

  const wasPlaying = game.state === "playing";
  const speed = game.getCurrentSpeed();
  if (nowMs - lastGameUpdate >= 1000 / speed) {
    game.update();
    lastGameUpdate = nowMs;
  }
  if (wasPlaying && game.state === "gameover") gameOverAt = nowMs;

  game.draw();
  requestAnimationFrame(mainLoop);
}

// keyboard fallback for testing / no camera
const KEY_DIRECTIONS = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
};
window.addEventListener("keydown", (e) => {
  const dir = KEY_DIRECTIONS[e.key];
  if (!dir) return;
  e.preventDefault();
  if (game.state === "playing") {
    game.changeDirection(dir);
  } else {
    gestures.reset();
    game.start();
  }
});

// STARTUP
async function boot() {
  requestAnimationFrame(mainLoop); // draw the game screen right away

  try {
    setStatus("Loading hand tracking model...");
    handLandmarker = await createLandmarker();
    drawingUtils = new DrawingUtils(cameraCtx);
  } catch (e) {
    console.error(e);
    setStatus("Could not load hand tracking model - check your internet. Arrow keys still work.");
    return;
  }

  try {
    setStatus("Starting camera...");
    await startCamera();
    setStatus("Ready! Show an open palm to start");
  } catch (e) {
    console.error(e);
    setStatus("Camera not available - you can still play with arrow keys");
  }
}

boot();
