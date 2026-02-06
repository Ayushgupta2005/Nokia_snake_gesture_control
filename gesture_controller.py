"""
Gesture Recognition Module for Nokia Snake Game
Uses the index finger tip for direction detection
and open-palm detection (for start/restart).
"""

import cv2
import mediapipe as mp
import numpy as np
from typing import Tuple, Optional
from collections import deque
cv2.startWindowThread()


class GestureController:
    def __init__(self):
        """Initialize MediaPipe hands and gesture detection"""
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_face = mp.solutions.face_detection

        # Initialize hands detection
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

        # Initialize face detection
        self.face_detection = self.mp_face.FaceDetection(
            model_selection=0,
            min_detection_confidence=0.5
        )

        # Gesture state tracking (now based on index fingertip, not wrist)
        self.previous_position = None
        self.gesture_threshold = 0.03       #for fingertip small movements
        self.current_direction = None
        self.gesture_cooldown = 0
        self.max_cooldown = 6               # faster response

        # Smoothing buffers
        self.pos_buffer = deque(maxlen=4)        # smooth fingertip motion
        self.direction_buffer = deque(maxlen=3)  # majority vote for final direction
        self.smoothed_pos = None

        # Palm detection buffers
        self.palm_buffer = deque(maxlen=3)
        self.is_open_palm = False               # for starting/restarting game

    # FINGER COUNTING (Used for Open Palm detection )

    def fingers_up(self, hand_landmarks) -> int:
        """Return number of fingers extended (0–5)."""
        tip_ids = [4, 8, 12, 16, 20]
        pip_ids = [3, 6, 10, 14, 18]
        count = 0

        try:
            for i, tip_id in enumerate(tip_ids):
                tip = hand_landmarks.landmark[tip_id]
                pip = hand_landmarks.landmark[pip_ids[i]]

                if i == 0:  # thumb
                    if tip.x < pip.x:
                        count += 1
                else:       # other fingers
                    if tip.y < pip.y:
                        count += 1
        except:
            return 0

        return count

    # MAIN GESTURE DETECTION
    def detect_gestures(self, frame: np.ndarray) -> Tuple[Optional[str], bool, np.ndarray]:
        """Detect direction gestures using ONLY the index fingertip."""

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        hand_results = self.hands.process(rgb_frame)
        face_results = self.face_detection.process(rgb_frame)

        annotated = frame.copy()
        direction = None
        is_pinching = False

        # Draw face box (optional)
        if face_results.detections:
            for det in face_results.detections:
                mp.solutions.drawing_utils.draw_detection(annotated, det)

        # If a hand is detected
        if hand_results.multi_hand_landmarks:
            for hand_landmarks in hand_results.multi_hand_landmarks:

                # Draw landmarks
                self.mp_drawing.draw_landmarks(
                    annotated,
                    hand_landmarks,
                    self.mp_hands.HAND_CONNECTIONS,
                    self.mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2),
                    self.mp_drawing.DrawingSpec(color=(255, 0, 0), thickness=2)
                )


                # INDEX FINGER TIP POSITION (Landmark 8)

                index_tip = hand_landmarks.landmark[
                    self.mp_hands.HandLandmark.INDEX_FINGER_TIP
                ]
                current_pos = np.array([index_tip.x, index_tip.y])

                # Smooth motion using small moving average
                self.pos_buffer.append(current_pos)
                avg_pos = np.mean(np.stack(self.pos_buffer), axis=0)

                if self.smoothed_pos is None:
                    self.smoothed_pos = avg_pos

                # Light exponential smoothing
                alpha = 0.65
                self.smoothed_pos = alpha * avg_pos + (1 - alpha) * self.smoothed_pos

                # DIRECTION BASED ON FINGERTIP MOVEMENT
                if self.previous_position is not None and self.gesture_cooldown <= 0:
                    movement = self.smoothed_pos - self.previous_position

                    if np.linalg.norm(movement) > self.gesture_threshold:
                        # Horizontal vs vertical movement
                        if abs(movement[0]) > abs(movement[1]):
                            candidate = "RIGHT" if movement[0] > 0 else "LEFT"
                        else:
                            candidate = "DOWN" if movement[1] > 0 else "UP"

                        # Majority vote over last 3 frames
                        self.direction_buffer.append(candidate)
                        from collections import Counter
                        most_common, freq = Counter(self.direction_buffer).most_common(1)[0]

                        if freq >= 2 and most_common != self.current_direction:
                            self.current_direction = most_common
                            self.gesture_cooldown = self.max_cooldown

                # OPEN PALM DETECTION 
                fingers = self.fingers_up(hand_landmarks)
                is_palm_now = (fingers >= 4)

                self.palm_buffer.append(is_palm_now)
                self.is_open_palm = sum(self.palm_buffer) >= 2

              # Store smoothed pos for next frame
                
                self.previous_position = np.array(self.smoothed_pos)

                # Debug: draw fingertip
                h, w, _ = annotated.shape
                px, py = int(index_tip.x * w), int(index_tip.y * h)
                cv2.circle(annotated, (px, py), 8, (0, 255, 255), -1)

        else:
            self.is_open_palm = False

        # Cooldown
        if self.gesture_cooldown > 0:
            self.gesture_cooldown -= 1

        # Show direction text
        if self.current_direction:
            cv2.putText(annotated, f"Direction: {self.current_direction}",
                        (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 0), 2)

        return self.current_direction, is_pinching, annotated

    # RESET STATE
    def reset_gesture_state(self):
        self.previous_position = None
        self.current_direction = None
        self.gesture_cooldown = 0
        self.is_open_palm = False
