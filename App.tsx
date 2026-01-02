import React, { useState } from 'react';
import { StarryNightCanvas } from './components/StarryNightCanvas';
import { GuernicaR3F } from './components/guernica/GuernicaR3F';
import { TreeOfLifeCanvas } from './components/TreeOfLifeCanvas';
import LandingHarpScene from './components/landing/LandingHarp';

type ExperienceType = 'landing' | 'starry-night' | 'guernica' | 'tree-of-life';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ExperienceType>('landing');
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);

  // Unified Landing Page
  if (currentView === 'landing') {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-black">
        <LandingHarpScene
          onSelect={(view) => setCurrentView(view)}
        />

        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white pointer-events-none">
          {/* Main Title */}
          <h1 className="text-4xl md:text-6xl font-light mb-4 tracking-[0.3em] text-white/90 drop-shadow-lg text-center">
            INTERACTIVE ART
          </h1>
          <p className="text-gray-500 text-sm tracking-widest mb-16 uppercase">
            Hand Gesture Experiences
          </p>

          <div className="px-6 py-2 text-xs tracking-[0.3em] uppercase text-white/50">
            Move right to rotate · Make a fist to select
          </div>

          {/* Footer */}
          <div className="absolute bottom-8 flex flex-col items-center gap-2 text-gray-600 text-xs tracking-wider pointer-events-auto">
            <div>Use hand gestures to interact with masterpieces</div>
            <a
              className="text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-4"
              href="mailto:bmeyu@hotmail.com"
            >
              Contact me: bmeyu@hotmail.com
            </a>
            <button
              type="button"
              onClick={() => setIsCreditsOpen(true)}
              className="text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-4"
            >
              Credits
            </button>
          </div>
        </div>

        {isCreditsOpen && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/80 p-6 text-left shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-white/90 text-sm tracking-widest uppercase">Credits</h3>
                <button
                  type="button"
                  onClick={() => setIsCreditsOpen(false)}
                  className="text-white/40 hover:text-white/80 transition-colors"
                  aria-label="Close credits"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs leading-relaxed text-white/70">
                <p>
                  Instrument sounds: FluidR3_GM SoundFont (CC BY 3.0) via{' '}
                  <a
                    className="text-cyan-300/90 hover:text-cyan-200 underline underline-offset-4"
                    href="https://github.com/gleitz/midi-js-soundfonts/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    midi-js-soundfonts
                  </a>
                  .
                </p>
                <p>
                  License:{' '}
                  <a
                    className="text-cyan-300/90 hover:text-cyan-200 underline underline-offset-4"
                    href="https://creativecommons.org/licenses/by/3.0/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Creative Commons Attribution 3.0
                  </a>
                  .
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreditsOpen(false)}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs tracking-widest text-white/70 hover:bg-white/10 hover:text-white/90 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Experience Views
  const renderExperience = () => {
    switch (currentView) {
      case 'guernica':
        return <GuernicaR3F onExit={() => setCurrentView('landing')} />;
      case 'tree-of-life':
        return <TreeOfLifeCanvas onExit={() => setCurrentView('landing')} />;
      default:
        return <StarryNightCanvas onExit={() => setCurrentView('landing')} />;
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
