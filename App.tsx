import React from 'react';
import HandSnake from './components/HandSnake';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <header className="mb-6 text-center">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
          AI Hand Snake
        </h1>
        <p className="text-gray-400 mt-2">
          Control the snake with your <span className="font-bold text-green-400">Index Finger</span>.
        </p>
      </header>

      <main className="w-full flex justify-center">
        <HandSnake />
      </main>

      <footer className="mt-8 text-gray-500 text-sm">
        Powered by MediaPipe & React
      </footer>
    </div>
  );
};

export default App;