"""
Main entry point for Nokia Snake Game with Gesture Control
Combines the snake game with webcam gesture recognition
source venv/bin/activate -- virtual env terminal ayush for snake game
"""

import cv2
import pygame
import threading
import time
from gesture_controller import GestureController
from snake_game import SnakeGame

class GameManager:
    def __init__(self):
        """Initialize the game manager"""
        self.game = SnakeGame()
        self.gesture_controller = GestureController()
        self.cap = None
        self.running = True
        self.gesture_thread = None
        
        # Gesture state
        self.current_gesture = None
        self.is_speed_boost = False
        self.latest_frame = None   #  store the webcam frame here

    def initialize_camera(self):
        """Initialize the webcam"""
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            print("Error: Could not open webcam")
            return False
        
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        return True
    
    def gesture_detection_loop(self):
        """Gesture detection without GUI (thread safe)"""
        while self.running and self.cap is not None:
            ret, frame = self.cap.read()
            if not ret:
                continue

            frame = cv2.flip(frame, 1)
            gesture, pinch, annotated_frame = self.gesture_controller.detect_gestures(frame)

            # update gesture state
            self.current_gesture = gesture
            self.is_speed_boost = pinch

            # pass frame to main thread for display
            self.latest_frame = annotated_frame

            time.sleep(0.033)  # ~30 FPS
    
    def run(self):
        """Main game loop"""
        if not self.initialize_camera():
            print("Failed to initialize camera. Exiting...")
            return
        
        # Start gesture detection in separate thread
        self.gesture_thread = threading.Thread(target=self.gesture_detection_loop)
        self.gesture_thread.daemon = True
        self.gesture_thread.start()
        
        print("Nokia Snake Game Started!")
        print("Controls:")
        print("- Move your index finger up/down/left/right to control the snake")
        print("- Press ESC in game window to quit")
        print("\nGame Window: Classic Nokia Snake")
        print("Gesture Window: Webcam feed with hand tracking")

        last_update = time.time()

        # Main game loop
        while self.running:
            
            # Show webcam frame in main thread (macOS safe)
            if self.latest_frame is not None:
                cv2.imshow('Nokia Snake - Gesture Control', self.latest_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    self.running = False
                    break

            # Handle pygame events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        self.running = False
            
            # Apply gesture controls
            if self.current_gesture:
                self.game.change_direction(self.current_gesture)
                if self.game.game_over:
                    self.game.handle_restart(self.current_gesture)
            
            self.game.set_speed_boost(self.is_speed_boost)
            
            # Update game speed
            current_time = time.time()
            target_fps = self.game.get_current_speed()
            if current_time - last_update >= 1.0 / target_fps:
                self.game.update()
                last_update = current_time
            
            # Draw game
            self.game.draw()
            self.game.clock.tick(60)
        
        self.cleanup()
    
    def cleanup(self):
        """Clean up resources"""
        print("Cleaning up...")
        self.running = False
        
        if self.cap is not None:
            self.cap.release()

        cv2.destroyAllWindows()
        self.game.quit()
        
        if self.gesture_thread and self.gesture_thread.is_alive():
            self.gesture_thread.join(timeout=1.0)
        
        print("Game closed successfully!")

def main():
    """Main function"""
    try:
        game_manager = GameManager()
        game_manager.run()
    except KeyboardInterrupt:
        print("\nGame interrupted by user")
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
