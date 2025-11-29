import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Point, GameState, Rock, Apple, AppleType } from '../types';

// --- CONFIGURATION ---
const INITIAL_SNAKE_LENGTH = 20;
const APPLE_RADIUS = 12;
const HEAD_RADIUS = 16;
const BODY_RADIUS = 12;
const ROCK_RADIUS_MIN = 20;
const ROCK_RADIUS_MAX = 40;
const ROCK_LIFETIME_MS = 30000;
const ROCK_SPAWN_INTERVAL_MS = 25000;
const INVINCIBLE_DURATION_MS = 5000;

const GROWTH_PER_APPLE = 8;
const GROWTH_SPEED = 0.2;

// Probability weights
const CHANCE_DOUBLE = 0.15;    // 15% chance
const CHANCE_INVINCIBLE = 0.08; // 8% chance

// --- UTILS ---
const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

const generateRockVertices = (radius: number, steps: number = 8) => {
  const vertices: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (Math.PI * 2 * i) / steps;
    const r = radius * (0.7 + Math.random() * 0.4); 
    vertices.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return vertices;
};

const HandSnake: React.FC = () => {
  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0); 
  const audioCtxRef = useRef<AudioContext | null>(null);

  // --- STATE ---
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    isGameOver: false,
    isPlaying: false,
    highScore: 0,
    isInvincible: false
  });
  const [isLoading, setIsLoading] = useState(true);

  // --- GAME LOGIC REFS ---
  const snakeRef = useRef<Point[]>([]); 
  const appleRef = useRef<Apple>({ x: -100, y: -100, type: 'normal' }); 
  const rocksRef = useRef<Rock[]>([]);
  
  const lastRockSpawnTime = useRef<number>(0);
  const invincibleUntilRef = useRef<number>(0);
  
  // Movement Refs
  const targetPosRef = useRef<Point | null>(null);
  const currentHeadPosRef = useRef<Point | null>(null);

  // Stats Refs
  const scoreRef = useRef(0);
  const snakeLengthRef = useRef(INITIAL_SNAKE_LENGTH);
  const targetLengthRef = useRef(INITIAL_SNAKE_LENGTH);
  
  // Loop State Sync
  const gameStatusRef = useRef({ isPlaying: false, isGameOver: false });

  useEffect(() => {
    gameStatusRef.current.isPlaying = gameState.isPlaying;
    gameStatusRef.current.isGameOver = gameState.isGameOver;
  }, [gameState.isPlaying, gameState.isGameOver]);

  // --- AUDIO SYSTEM ---
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
  };

  const playSound = (type: 'eat' | 'die' | 'powerup' | 'smash') => {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      switch (type) {
        case 'eat':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.2);
          osc.start();
          osc.stop(now + 0.2);
          break;
        case 'powerup':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.linearRampToValueAtTime(800, now + 0.3);
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.4);
          osc.start();
          osc.stop(now + 0.4);
          break;
        case 'smash':
          osc.type = 'square';
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.25);
          osc.start();
          osc.stop(now + 0.25);
          break;
        case 'die':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.5);
          osc.start();
          osc.stop(now + 0.5);
          break;
      }
    } catch (e) { console.warn("Audio error", e); }
  };

  // --- ENTITY MANAGEMENT ---

  const spawnApple = (width: number, height: number) => {
    const padding = 50;
    let safePos = { x: -100, y: -100 };
    let attempts = 0;

    while (attempts < 10) {
      const x = padding + Math.random() * (width - padding * 2);
      const y = padding + Math.random() * (height - padding * 2);
      
      // Check rock collision
      const collidesWithRock = rocksRef.current.some(r => {
        const d = Math.sqrt((x - r.x) ** 2 + (y - r.y) ** 2);
        return d < r.radius + APPLE_RADIUS + 10;
      });

      if (!collidesWithRock) {
        safePos = { x, y };
        break;
      }
      attempts++;
    }

    if (safePos.x === -100) {
       safePos = { 
         x: padding + Math.random() * (width - padding * 2), 
         y: padding + Math.random() * (height - padding * 2) 
       };
    }

    // Determine Type
    const rand = Math.random();
    let type: AppleType = 'normal';
    if (rand < CHANCE_INVINCIBLE) type = 'invincible';
    else if (rand < CHANCE_INVINCIBLE + CHANCE_DOUBLE) type = 'double';

    appleRef.current = { ...safePos, type };
  };

  const spawnRock = (width: number, height: number, snakeHead: Point | null) => {
    const padding = 40;
    const radius = ROCK_RADIUS_MIN + Math.random() * (ROCK_RADIUS_MAX - ROCK_RADIUS_MIN);
    
    // Simple retry logic for placement
    for (let i = 0; i < 5; i++) {
      const x = padding + Math.random() * (width - padding * 2);
      const y = padding + Math.random() * (height - padding * 2);
      
      const distToApple = Math.hypot(x - appleRef.current.x, y - appleRef.current.y);
      const distToSnake = snakeHead ? Math.hypot(x - snakeHead.x, y - snakeHead.y) : 9999;

      if (distToApple > (radius + APPLE_RADIUS + 20) && distToSnake > 150) {
        rocksRef.current.push({
          id: Date.now() + Math.random(),
          x, y, radius,
          spawnedAt: Date.now(),
          vertices: generateRockVertices(radius)
        });
        break;
      }
    }
  };

  // --- MAIN LOOP ---
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const now = Date.now();

    ctx.clearRect(0, 0, width, height);

    if (gameStatusRef.current.isPlaying && !gameStatusRef.current.isGameOver) {
      
      // 1. Invincibility Status
      const isInvincible = now < invincibleUntilRef.current;
      // Sync UI state occasionally (not every frame to save renders, but good enough here)
      if (isInvincible !== gameState.isInvincible) {
        setGameState(prev => ({ ...prev, isInvincible }));
      }

      // 2. Rock Spawning & Cleanup
      rocksRef.current = rocksRef.current.filter(r => now - r.spawnedAt < ROCK_LIFETIME_MS);
      if (now - lastRockSpawnTime.current > ROCK_SPAWN_INTERVAL_MS) {
        spawnRock(width, height, currentHeadPosRef.current);
        lastRockSpawnTime.current = now;
      }

      // 3. Snake Movement (Adaptive Lerp)
      if (targetPosRef.current) {
        if (!currentHeadPosRef.current) {
          currentHeadPosRef.current = { ...targetPosRef.current };
        } else {
          const dx = targetPosRef.current.x - currentHeadPosRef.current.x;
          const dy = targetPosRef.current.y - currentHeadPosRef.current.y;
          const dist = Math.hypot(dx, dy);

          let smooth = 0.15;
          if (dist > 100) smooth = 0.5;
          else if (dist > 50) smooth = 0.3;

          currentHeadPosRef.current.x = lerp(currentHeadPosRef.current.x, targetPosRef.current.x, smooth);
          currentHeadPosRef.current.y = lerp(currentHeadPosRef.current.y, targetPosRef.current.y, smooth);
        }
      }

      const head = currentHeadPosRef.current;

      if (head) {
        // Growth logic
        if (snakeLengthRef.current < targetLengthRef.current) {
            snakeLengthRef.current = Math.min(snakeLengthRef.current + GROWTH_SPEED, targetLengthRef.current);
        }

        // --- COLLISIONS ---

        // A. Rocks
        const hitRockIndex = rocksRef.current.findIndex(r => {
           const dist = Math.hypot(head.x - r.x, head.y - r.y);
           return dist < HEAD_RADIUS + r.radius - 5;
        });

        if (hitRockIndex !== -1) {
          if (isInvincible) {
            // Smash the rock!
            rocksRef.current.splice(hitRockIndex, 1);
            scoreRef.current += 5; // Bonus for smashing
            setGameState(prev => ({ ...prev, score: scoreRef.current }));
            playSound('smash');
          } else {
            // Game Over
            playSound('die');
            setGameState(prev => ({ ...prev, isGameOver: true }));
            gameStatusRef.current.isGameOver = true;
          }
        }

        if (!gameStatusRef.current.isGameOver) {
          // B. Update Body
          snakeRef.current.unshift({ x: head.x, y: head.y });
          while (snakeRef.current.length > Math.floor(snakeLengthRef.current)) {
            snakeRef.current.pop();
          }

          // C. Apple
          const distToApple = Math.hypot(head.x - appleRef.current.x, head.y - appleRef.current.y);
          if (distToApple < HEAD_RADIUS + APPLE_RADIUS) {
            const type = appleRef.current.type;
            
            // Score Logic
            let points = 10;
            if (type === 'double') points = 20;
            if (type === 'invincible') points = 10;
            scoreRef.current += points;

            // Effect Logic
            if (type === 'invincible') {
              invincibleUntilRef.current = now + INVINCIBLE_DURATION_MS;
              playSound('powerup');
            } else {
              playSound('eat');
            }

            targetLengthRef.current += GROWTH_PER_APPLE;
            setGameState(prev => ({ ...prev, score: scoreRef.current }));
            spawnApple(width, height);
          }
        }
      }
    }

    // --- DRAWING ---
    drawGame(ctx, now);

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState.isInvincible]); // Dependency needed for invincible state sync? Actually ref usage handles logic, state handles UI

  // Separate draw function for cleanliness
  const drawGame = (ctx: CanvasRenderingContext2D, now: number) => {
    // 1. Draw Rocks
    rocksRef.current.forEach(rock => {
      const age = now - rock.spawnedAt;
      let alpha = age > ROCK_LIFETIME_MS - 2000 ? (ROCK_LIFETIME_MS - age) / 2000 : 1;
      
      ctx.save();
      ctx.translate(rock.x, rock.y);
      ctx.globalAlpha = alpha;
      
      // Rock Body
      ctx.beginPath();
      rock.vertices.forEach((v, i) => i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y));
      ctx.closePath();
      
      const grad = ctx.createRadialGradient(-rock.radius/3, -rock.radius/3, 1, 0, 0, rock.radius);
      grad.addColorStop(0, '#9ca3af');
      grad.addColorStop(1, '#374151');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1f2937';
      ctx.stroke();
      
      ctx.restore();
    });

    // 2. Draw Apple
    const apple = appleRef.current;
    if (apple.x >= 0) {
       ctx.save();
       ctx.translate(apple.x, apple.y);
       
       let color = '#ef4444'; // Red (Normal)
       let glow = '#fca5a5';
       
       if (apple.type === 'double') {
         color = '#fbbf24'; // Gold
         glow = '#fde047';
       } else if (apple.type === 'invincible') {
         color = '#3b82f6'; // Blue
         glow = '#93c5fd';
         // Pulse effect
         const scale = 1 + Math.sin(now / 100) * 0.1;
         ctx.scale(scale, scale);
       }

       ctx.shadowBlur = 15;
       ctx.shadowColor = glow;
       
       ctx.beginPath();
       ctx.fillStyle = color;
       ctx.arc(0, 0, APPLE_RADIUS, 0, Math.PI * 2);
       ctx.fill();
       
       // Icons/Decor
       ctx.fillStyle = 'rgba(255,255,255,0.6)';
       ctx.font = '10px Arial';
       ctx.textAlign = 'center';
       ctx.textBaseline = 'middle';
       ctx.shadowBlur = 0;
       
       if (apple.type === 'double') ctx.fillText('x2', 0, 1);
       else if (apple.type === 'invincible') ctx.fillText('★', 0, 1);
       
       ctx.restore();
    }

    // 3. Draw Snake
    const snake = snakeRef.current;
    if (snake.length > 0) {
      const isInvincible = now < invincibleUntilRef.current;
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Loop backwards to draw tail first
      for (let i = snake.length - 1; i >= 0; i--) {
        const seg = snake[i];
        const isHead = i === 0;
        const ratio = 1 - (i / snake.length);
        const radius = isHead ? HEAD_RADIUS : Math.max(4, BODY_RADIUS * ratio);
        
        ctx.beginPath();
        
        if (gameStatusRef.current.isGameOver) {
           ctx.fillStyle = '#ef4444'; 
        } else if (isInvincible) {
           // Rainbow Effect
           const hue = (now / 5 + i * 10) % 360;
           ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
           ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
           ctx.shadowBlur = 10;
        } else {
           // Standard Green Gradient
           const hue = (140 + (i * 2)) % 360; 
           ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
           ctx.shadowBlur = 0;
        }

        ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Face details (only on head)
        if (isHead) {
           ctx.shadowBlur = 0;
           ctx.fillStyle = 'white';
           
           // Calculate looking direction
           const dx = apple.x - seg.x;
           const dy = apple.y - seg.y;
           const angle = Math.atan2(dy, dx);
           const lookX = Math.cos(angle) * 3;
           const lookY = Math.sin(angle) * 3;

           // Eyes
           ctx.beginPath();
           ctx.arc(seg.x - 5 + lookX * 0.5, seg.y - 5 + lookY * 0.5, 5, 0, Math.PI * 2);
           ctx.arc(seg.x + 5 + lookX * 0.5, seg.y - 5 + lookY * 0.5, 5, 0, Math.PI * 2);
           ctx.fill();
           
           // Pupils
           ctx.fillStyle = 'black';
           if (gameStatusRef.current.isGameOver) {
             // Dead Eyes X X
             ctx.lineWidth = 2;
             ctx.strokeStyle = 'black';
             [-1, 1].forEach(side => {
                 const cx = seg.x + side * 5;
                 const cy = seg.y - 5;
                 ctx.beginPath();
                 ctx.moveTo(cx - 2, cy - 2); ctx.lineTo(cx + 2, cy + 2);
                 ctx.moveTo(cx + 2, cy - 2); ctx.lineTo(cx - 2, cy + 2);
                 ctx.stroke();
             });
           } else {
             ctx.beginPath();
             ctx.arc(seg.x - 5 + lookX, seg.y - 5 + lookY, 2.5, 0, Math.PI * 2);
             ctx.arc(seg.x + 5 + lookX, seg.y - 5 + lookY, 2.5, 0, Math.PI * 2);
             ctx.fill();
           }
        }
      }
    }
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameLoop]);

  // --- MEDIAPIPE SETUP ---
  const handleResults = useCallback((results: any) => {
    if (!canvasRef.current || !results.multiHandLandmarks?.length) return;
    const indexTip = results.multiHandLandmarks[0][8];
    targetPosRef.current = {
      x: indexTip.x * canvasRef.current.width,
      y: indexTip.y * canvasRef.current.height
    };
  }, []);

  useEffect(() => {
    let camera: any = null;
    let hands: any = null;
    let isMounted = true;

    const initMediaPipe = async () => {
      if (!videoRef.current || !canvasRef.current) return;
      try {
        hands = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.4,
          minTrackingConfidence: 0.4,
        });
        hands.onResults(handleResults);

        if (videoRef.current) {
          camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (isMounted && videoRef.current && hands) {
                await hands.send({ image: videoRef.current });
              }
            },
            width: 1280, height: 720,
          });
          await camera.start();
          if (isMounted) setIsLoading(false);
        }
      } catch (e) { console.error("MediaPipe Error", e); }
    };

    initMediaPipe();
    return () => { isMounted = false; camera?.stop(); hands?.close(); audioCtxRef.current?.close(); };
  }, [handleResults]);

  // Canvas Resize Handler
  useEffect(() => {
    const handleResize = () => {
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth || 640;
        canvasRef.current.height = videoRef.current.videoHeight || 480;
      }
    };
    const interval = setInterval(handleResize, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- CONTROLS ---
  const startGame = () => {
    initAudio();
    scoreRef.current = 0;
    snakeLengthRef.current = INITIAL_SNAKE_LENGTH;
    targetLengthRef.current = INITIAL_SNAKE_LENGTH;
    snakeRef.current = [];
    currentHeadPosRef.current = null;
    rocksRef.current = [];
    lastRockSpawnTime.current = Date.now();
    invincibleUntilRef.current = 0;
    
    if (canvasRef.current) spawnApple(canvasRef.current.width, canvasRef.current.height);
    
    setGameState({
      score: 0,
      isGameOver: false,
      isPlaying: true,
      highScore: gameState.highScore,
      isInvincible: false
    });
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto select-none">
      <div className="game-container bg-black border-2 border-gray-700 rounded-2xl overflow-hidden shadow-2xl shadow-green-900/50">
        <video ref={videoRef} className="game-layer opacity-60" playsInline muted />
        <canvas ref={canvasRef} className="game-layer" />

        {/* --- UI OVERLAY --- */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 flex flex-col justify-between p-6">
            
            <div className="flex justify-between items-start">
               {/* SCORE */}
               <div className="bg-gray-900/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-lg">
                 <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Score</p>
                 <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 font-mono">
                    {gameState.score.toString().padStart(3, '0')}
                 </p>
               </div>

               {/* INVINCIBLE STATUS */}
               {gameState.isInvincible && (
                  <div className="bg-blue-600/30 backdrop-blur-md px-6 py-2 rounded-full border border-blue-400/50 animate-pulse">
                     <span className="text-blue-200 font-bold tracking-wider">⚡ INVINCIBLE MODE ⚡</span>
                  </div>
               )}
               
               {isLoading && (
                   <div className="bg-yellow-500/20 text-yellow-300 px-6 py-2 rounded-full backdrop-blur-md border border-yellow-500/30 animate-pulse font-medium">
                       Initializing Vision...
                   </div>
               )}
            </div>

            {/* START / GAME OVER SCREEN */}
            {(!gameState.isPlaying || gameState.isGameOver) && !isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md pointer-events-auto transition-all">
                  <div className="text-center">
                    <h2 className="text-6xl font-black text-white mb-4 drop-shadow-[0_0_25px_rgba(74,222,128,0.5)]">
                        {gameState.isGameOver ? "GAME OVER" : "HAND SNAKE"}
                    </h2>
                    <p className="text-gray-200 mb-6 text-xl">
                        {gameState.isGameOver 
                          ? `Final Score: ${gameState.score}` 
                          : "Control the snake with your Index Finger"}
                    </p>
                    
                    <button 
                        onClick={startGame}
                        className="px-10 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full transition-all hover:scale-105 shadow-lg shadow-green-500/30"
                    >
                        {gameState.isGameOver ? "PLAY AGAIN" : "START GAME"}
                    </button>
                  </div>
              </div>
            )}
        </div>
      </div>
      
      {/* Instructions */}
      <div className="mt-6 flex justify-center gap-6 text-sm text-gray-400">
         <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 block"></span> Normal Apple (+10)
         </div>
         <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-400 block"></span> Gold Apple (x2 Score)
         </div>
         <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 block"></span> Blue Apple (Invincible)
         </div>
         <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-600 block"></span> Rock (Avoid or Smash)
         </div>
      </div>
    </div>
  );
};

export default HandSnake;