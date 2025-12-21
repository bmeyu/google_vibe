import React, { useState } from 'react';
import { StarryNightCanvas } from './components/StarryNightCanvas';
import { GuernicaR3F } from './components/guernica/GuernicaR3F';
import { TreeOfLifeCanvas } from './components/TreeOfLifeCanvas';

type ExperienceType = 'landing' | 'starry-night' | 'guernica' | 'tree-of-life';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ExperienceType>('landing');

  // Unified Landing Page
  if (currentView === 'landing') {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-black">
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white">
          {/* Main Title */}
          <h1 className="text-4xl md:text-6xl font-light mb-4 tracking-[0.3em] text-white/90 drop-shadow-lg text-center">
            INTERACTIVE ART
          </h1>
          <p className="text-gray-500 text-sm tracking-widest mb-16 uppercase">
            Hand Gesture Experiences
          </p>

          {/* Three Experience Cards */}
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 px-4">
            {/* Van Gogh Card */}
            <button
              onClick={() => setCurrentView('starry-night')}
              className="group relative w-64 h-52 rounded-2xl overflow-hidden border border-yellow-500/30 hover:border-yellow-400/60 transition-all duration-500 hover:scale-105"
            >
              {/* Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center opacity-60 group-hover:opacity-80 transition-opacity duration-500"
                style={{ backgroundImage: 'url(https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Starry_Night_Over_the_Rhone.jpg/800px-Starry_Night_Over_the_Rhone.jpg)' }}
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                <h2 className="text-xl font-light text-yellow-100 tracking-wider mb-1">
                  STARRY STRINGS
                </h2>
                <p className="text-gray-400 text-[10px] leading-relaxed">
                  Van Gogh · Starry Night Over the Rhône
                </p>
                <p className="text-gray-500 text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  Pluck cosmic strings to create music
                </p>
              </div>
              {/* Glow Effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(255,200,100,0.3)]" />
              </div>
            </button>

            {/* Klimt Card */}
            <button
              onClick={() => setCurrentView('tree-of-life')}
              className="group relative w-64 h-52 rounded-2xl overflow-hidden border border-amber-500/30 hover:border-amber-400/60 transition-all duration-500 hover:scale-105"
            >
              {/* Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center opacity-60 group-hover:opacity-80 transition-opacity duration-500"
                style={{ backgroundImage: 'url(/images/TreeOfLife.png)' }}
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                <h2 className="text-xl font-light text-amber-100 tracking-wider mb-1">
                  TREE OF LIFE
                </h2>
                <p className="text-gray-400 text-[10px] leading-relaxed">
                  Klimt · Tree of Life
                </p>
                <p className="text-gray-500 text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  Pluck golden strings to awaken spirals
                </p>
              </div>
              {/* Glow Effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(212,168,75,0.3)]" />
              </div>
            </button>

            {/* Picasso Card */}
            <button
              onClick={() => setCurrentView('guernica')}
              className="group relative w-64 h-52 rounded-2xl overflow-hidden border border-cyan-500/30 hover:border-cyan-400/60 transition-all duration-500 hover:scale-105"
            >
              {/* Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center opacity-60 group-hover:opacity-80 transition-opacity duration-500 grayscale"
                style={{ backgroundImage: 'url(/images/Guernica.png)' }}
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                <h2 className="text-xl font-mono text-gray-200 tracking-wider mb-1">
                  GUERNICA SHATTERED
                </h2>
                <p className="text-gray-400 text-[10px] leading-relaxed">
                  Picasso · Guernica 1937
                </p>
                <p className="text-gray-500 text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  Air drum to shatter the painting
                </p>
              </div>
              {/* Glow Effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,255,255,0.2)]" />
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="absolute bottom-8 text-gray-600 text-xs tracking-wider">
            Use hand gestures to interact with masterpieces
          </div>
        </div>
      </div>
    );
  }

  // Experience Views
  const renderExperience = () => {
    switch (currentView) {
      case 'guernica':
        return <GuernicaR3F />;
      case 'tree-of-life':
        return <TreeOfLifeCanvas />;
      default:
        return <StarryNightCanvas />;
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {renderExperience()}

      {/* Back Button */}
      <button
        onClick={() => setCurrentView('landing')}
        className="absolute bottom-8 left-6 z-50 px-4 py-2 bg-black/40 backdrop-blur-sm border border-white/20 rounded-full text-white/60 text-xs tracking-wider hover:bg-black/60 hover:text-white/90 hover:border-white/40 transition-all duration-300"
      >
        ← Back
      </button>
    </div>
  );
};

export default App;