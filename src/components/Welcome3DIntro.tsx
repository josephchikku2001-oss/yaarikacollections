import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface Welcome3DIntroProps {
  onEnterCatalog: () => void;
}

export const Welcome3DIntro: React.FC<Welcome3DIntroProps> = ({ onEnterCatalog }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleEnter = () => {
    setIsExiting(true);
    setTimeout(() => {
      onEnterCatalog();
    }, 600);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[#1A0306] overflow-hidden transition-opacity duration-700 px-4 ${isExiting ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'}`}>
      
      {/* Background radial glow & ambient particles */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.15)_0%,transparent_70%)] pointer-events-none"></div>
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>

      <div className="relative z-10 text-center max-w-4xl mx-auto space-y-8 p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-[#2B050B]/90 to-[#120104]/95 border-2 border-[#D4AF37]/50 shadow-[0_0_50px_rgba(212,175,55,0.3)] backdrop-blur-xl animate-fade-in">
        
        {/* Top 3D floating badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#4A0E17]/80 border border-[#D4AF37] text-[#D4AF37] text-xs font-bold uppercase tracking-[0.25em] shadow-lg animate-pulse">
          <Sparkles className="w-4 h-4 text-[#FDE047]" />
          <span>Boutique Grand Opening</span>
          <Sparkles className="w-4 h-4 text-[#FDE047]" />
        </div>

        {/* 3D Embossed Heading */}
        <div className="space-y-3">
          <h1 
            style={{ 
              fontFamily: 'Cinzel, Georgia, serif',
              textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 4px 12px rgba(212,175,55,0.4), 0 0 20px rgba(212,175,55,0.2)'
            }} 
            className="text-4xl sm:text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#FFFDF9] via-[#F3E5AB] to-[#D4AF37] tracking-wider uppercase leading-tight transform hover:scale-[1.02] transition-transform duration-500"
          >
            WELCOME TO <br />
            <span className="text-[#D4AF37] drop-shadow-[0_5px_15px_rgba(212,175,55,0.6)]">YAARIKA COLLECTIONS</span>
          </h1>

          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto my-4 rounded-full"></div>

          <p className="text-sm sm:text-base text-gray-300 font-light max-w-xl mx-auto tracking-wide leading-relaxed">
            Discover exquisite handcrafted Kerala Kasavu sarees, elegant designer co-ord sets, and timeless ethnic ensembles.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-4">
          <button
            onClick={handleEnter}
            className="group relative px-8 py-4 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#C59B27] text-[#2B050B] font-black text-sm uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(212,175,55,0.4)] hover:shadow-[0_15px_40px_rgba(212,175,55,0.7)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 mx-auto border border-white/40 cursor-pointer"
          >
            <span>Enter Boutique Catalog</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
          </button>
        </div>

        <p className="text-[11px] text-gray-400 uppercase tracking-widest pt-2">
          Handloom • Ethnic • Contemporary Boutique
        </p>

      </div>
    </div>
  );
};
