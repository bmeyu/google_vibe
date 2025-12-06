import React, { useState } from 'react';
import { StarryNightCanvas } from './components/StarryNightCanvas';

const App: React.FC = () => {
  const [started, setStarted] = useState(false);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {!started ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 text-white backdrop-blur-sm transition-opacity duration-700">
          <h1 className="text-5xl font-light mb-8 tracking-widest text-yellow-100 drop-shadow-lg text-center">
            STARRY STRINGS
          </h1>
          <p className="max-w-md text-center text-gray-300 mb-8 leading-relaxed">
            Hold up both hands to create a cosmic string. <br />
            Use your fingers to pluck the string and swirl the stars.
          </p>
          <button
            onClick={() => setStarted(true)}
            className="px-8 py-3 border border-yellow-200/50 rounded-full text-lg hover:bg-yellow-900/30 hover:border-yellow-100 transition-all duration-300 uppercase tracking-widest"
          >
            Enter Experience
          </button>
        </div>
      ) : (
        <StarryNightCanvas />
      )}
    </div>
  );
};

export default App;