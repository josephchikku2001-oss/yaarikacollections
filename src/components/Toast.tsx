import React, { useEffect } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 bg-[#32080F] text-[#F3E5AB] border border-[#D4AF37] px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-slide-up max-w-sm">
      <div className="w-7 h-7 rounded-full bg-[#D4AF37] text-[#32080F] flex items-center justify-center shrink-0 font-bold">
        <Sparkles className="w-4 h-4" />
      </div>
      <span className="flex-1">{message}</span>
      <button
        onClick={onClose}
        className="text-[#D4AF37] hover:text-white text-xs font-bold px-1"
      >
        ✕
      </button>
    </div>
  );
};
