# AI Hand Snake 🐍🖐️

A modern, browser-based Snake game controlled entirely by your hand gestures using Artificial Intelligence.

## 🎮 How to Play

1.  **Grant Camera Access**: The game requires your webcam to track your hand.
2.  **Raise your Index Finger**: The snake's head follows the tip of your index finger.
3.  **Objective**: Eat apples to grow longer and increase your score.
4.  **Avoid Rocks**: Hitting a grey rock results in Game Over (unless Invincible).

## 🍎 Items & Power-ups

| Item | Color | Effect |
| :--- | :--- | :--- |
| **Normal Apple** | 🔴 Red | +10 Score, Snake Grows. |
| **Gold Apple** | 🟡 Gold | +20 Score (Double Points). |
| **Power Apple** | 🔵 Blue | **Invincible Mode** for 5 seconds. |
| **Rock** | 🪨 Grey | Dangerous obstacle. Spawns every 25s. |

## ⚡ Invincible Mode
When you eat a **Blue Power Apple**:
*   The snake glows with rainbow colors.
*   You can **smash through rocks** to clear the path and gain bonus points (+5).
*   Music/Sound effects change to indicate power-up status.

## 🛠️ Technical Stack

*   **React 18**: UI and State Management.
*   **MediaPipe Hands**: Real-time hand tracking (runs locally in browser via WebAssembly).
*   **Canvas API**: High-performance rendering for the game loop.
*   **Web Audio API**: Synthesized sound effects (no external assets required).
*   **Tailwind CSS**: Styling and layout.

## 🚀 Performance Tips

*   **Lighting**: Ensure your hand is well-lit for the AI to track it accurately.
*   **Background**: A simple background helps the AI distinguish your hand better.
*   **Distance**: Stand about 0.5 - 1 meter away from the camera.

## License

MIT
