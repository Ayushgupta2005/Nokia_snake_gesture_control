// Gesture detection using the index fingertip (same logic as my python version)
// landmarks come from mediapipe HandLandmarker, x is flipped to match the mirrored preview

const INDEX_FINGER_TIP = 8;
const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_PIPS = [3, 6, 10, 14, 18];
const PINKY_MCP = 17;

export class GestureController {
  constructor() {
    this.gestureThreshold = 0.03; // for fingertip small movements
    this.maxCooldown = 6;         // faster response

    // smoothing buffers
    this.posBufferSize = 4;       // smooth fingertip motion
    this.directionBufferSize = 3; // majority vote for final direction
    this.palmBufferSize = 3;

    this.reset();
  }

  reset() {
    this.posBuffer = [];
    this.directionBuffer = [];
    this.palmBuffer = [];
    this.smoothedPos = null;
    this.previousPosition = null;
    this.currentDirection = null;
    this.gestureCooldown = 0;
    this.isOpenPalm = false;
  }

  // FINGER COUNTING (used for open palm detection)
  fingersUp(landmarks) {
    let count = 0;
    const pinkyMcp = landmarks[PINKY_MCP];

    for (let i = 0; i < FINGER_TIPS.length; i++) {
      const tip = landmarks[FINGER_TIPS[i]];
      const pip = landmarks[FINGER_PIPS[i]];

      if (i === 0) {
        // thumb - check distance from pinky side so it works for both hands
        const tipDist = Math.hypot(tip.x - pinkyMcp.x, tip.y - pinkyMcp.y);
        const pipDist = Math.hypot(pip.x - pinkyMcp.x, pip.y - pinkyMcp.y);
        if (tipDist > pipDist) count++;
      } else if (tip.y < pip.y) {
        count++;
      }
    }
    return count;
  }

  // MAIN GESTURE DETECTION
  detect(landmarks) {
    const tip = landmarks[INDEX_FINGER_TIP];
    const currentPos = [1 - tip.x, tip.y]; // flip x for mirror view

    // moving average
    this.posBuffer.push(currentPos);
    if (this.posBuffer.length > this.posBufferSize) this.posBuffer.shift();
    const avgPos = [
      this.posBuffer.reduce((s, p) => s + p[0], 0) / this.posBuffer.length,
      this.posBuffer.reduce((s, p) => s + p[1], 0) / this.posBuffer.length,
    ];

    // light exponential smoothing
    if (this.smoothedPos === null) this.smoothedPos = avgPos;
    const alpha = 0.65;
    this.smoothedPos = [
      alpha * avgPos[0] + (1 - alpha) * this.smoothedPos[0],
      alpha * avgPos[1] + (1 - alpha) * this.smoothedPos[1],
    ];

    // direction based on fingertip movement
    if (this.previousPosition !== null && this.gestureCooldown <= 0) {
      const dx = this.smoothedPos[0] - this.previousPosition[0];
      const dy = this.smoothedPos[1] - this.previousPosition[1];

      if (Math.hypot(dx, dy) > this.gestureThreshold) {
        // horizontal vs vertical movement
        const candidate =
          Math.abs(dx) > Math.abs(dy)
            ? dx > 0 ? "RIGHT" : "LEFT"
            : dy > 0 ? "DOWN" : "UP";

        // majority vote over last 3 frames
        this.directionBuffer.push(candidate);
        if (this.directionBuffer.length > this.directionBufferSize) {
          this.directionBuffer.shift();
        }
        const counts = {};
        for (const d of this.directionBuffer) counts[d] = (counts[d] || 0) + 1;
        const [mostCommon, freq] = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])[0];

        if (freq >= 2 && mostCommon !== this.currentDirection) {
          this.currentDirection = mostCommon;
          this.gestureCooldown = this.maxCooldown;
        }
      }
    }

    // OPEN PALM DETECTION
    const isPalmNow = this.fingersUp(landmarks) >= 4;
    this.palmBuffer.push(isPalmNow);
    if (this.palmBuffer.length > this.palmBufferSize) this.palmBuffer.shift();
    this.isOpenPalm = this.palmBuffer.filter(Boolean).length >= 2;

    this.previousPosition = [...this.smoothedPos];
    if (this.gestureCooldown > 0) this.gestureCooldown--;

    return this.currentDirection;
  }

  // call when no hand detected
  noHand() {
    this.isOpenPalm = false;
    this.palmBuffer = [];
    if (this.gestureCooldown > 0) this.gestureCooldown--;
  }
}
