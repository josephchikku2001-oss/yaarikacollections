import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CategoryType, HeroSlide } from '../types';
import { CONTACT_NUMBERS } from '../utils/whatsapp';
import { BannerStorage, BANNERS_UPDATED_EVENT } from '../services/bannerStorage';

interface HeroProps {
  onShopClick: (category?: CategoryType) => void;
  onSelectCategory?: (category: CategoryType) => void;
}

export const Hero: React.FC<HeroProps> = ({ onShopClick, onSelectCategory }) => {
  const [slides, setSlides] = useState<HeroSlide[]>(() => BannerStorage.getBanners());
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Listen to banner updates from AdminPortal
  useEffect(() => {
    const handleBannersUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<HeroSlide[]>;
      const newSlides = customEvent.detail || BannerStorage.getBanners();
      setSlides(newSlides);
      setCurrentSlide(0);
    };

    window.addEventListener(BANNERS_UPDATED_EVENT, handleBannersUpdated);
    return () => {
      window.removeEventListener(BANNERS_UPDATED_EVENT, handleBannersUpdated);
    };
  }, []);

  // Safe index in case slides are deleted
  const safeSlideIndex = slides.length > 0 ? Math.min(currentSlide, slides.length - 1) : 0;
  const activeSlide = slides.length > 0 ? slides[safeSlideIndex] : null;

  // Auto-advance slide from right to left every 5 seconds if more than 1 slide exists
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [isPaused, slides.length]);

  const handleNext = () => {
    if (slides.length <= 1) return;
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    if (slides.length <= 1) return;
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // Touch Swipe Handlers for Mobile Right-to-Left Gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current || slides.length <= 1) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 45) {
      // Swiped Left -> Move Next
      handleNext();
    } else if (distance < -45) {
      // Swiped Right -> Move Prev
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleSlideAction = (category: CategoryType) => {
    if (onSelectCategory) {
      onSelectCategory(category);
    }
    onShopClick(category);
  };

  return (
    <div 
      className="relative bg-[#FAF7F2] overflow-hidden border-b border-[#E6DEC8]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Carousel Viewport with Right-to-Left Sliding Animation */}
      <div className="relative w-full min-h-[380px] sm:min-h-[440px] md:min-h-[480px] lg:min-h-[520px] flex items-center">
        {activeSlide ? (
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={activeSlide.id}
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -80 }}
              transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
              className="w-full h-full"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-10 md:py-12 flex flex-col-reverse md:flex-row items-center justify-between gap-8 md:gap-12">
                
                {/* Left Text & Action Column */}
                <div className="w-full md:w-1/2 text-left space-y-4 sm:space-y-6 z-10">
                  
                  {/* Category Badge */}
                  {activeSlide.badge && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#4A0E17]/10 text-[#4A0E17] rounded-full text-[11px] font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>{activeSlide.badge}</span>
                    </div>
                  )}

                  {/* Main Headline */}
                  <h2 
                    style={{ fontFamily: 'Georgia, serif' }} 
                    className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] text-[#2B221E] font-extrabold leading-[1.12] tracking-tight"
                  >
                    {activeSlide.title}
                  </h2>

                  {/* Subtitle / Narrative */}
                  <p className="text-[#5C5248] text-sm sm:text-base leading-relaxed max-w-xl">
                    {activeSlide.subtitle}
                  </p>

                  {/* Shop CTA */}
                  <div className="pt-2 flex flex-wrap items-center gap-4">
                    <button
                      onClick={() => handleSlideAction(activeSlide.category)}
                      className="inline-flex items-center gap-2 text-base sm:text-lg font-bold text-[#6B1D2F] hover:text-[#4A0E17] group transition-all"
                    >
                      <span className="border-b-2 border-[#6B1D2F] group-hover:border-[#4A0E17] pb-0.5">
                        {activeSlide.linkText || 'Shop More'}
                      </span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <a
                      href={`https://wa.me/${CONTACT_NUMBERS[0].value}?text=${encodeURIComponent(`Hello Yaarika Collections, I am interested in ${activeSlide.title}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-[#25D366] text-white hover:bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-sm transition-all shadow-sm"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp Inquiry</span>
                    </a>
                  </div>

                  {/* Navigation Dots (if more than 1 slide) */}
                  {slides.length > 1 && (
                    <div className="pt-4 flex items-center gap-2.5">
                      {slides.map((slide, idx) => (
                        <button
                          key={slide.id}
                          onClick={() => setCurrentSlide(idx)}
                          className={`transition-all rounded-full ${
                            idx === safeSlideIndex
                              ? 'w-6 h-3 bg-[#6B1D2F] rounded-full'
                              : 'w-3 h-3 bg-[#D1C7BD] hover:bg-[#A89D92]'
                          }`}
                          aria-label={`Go to slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}

                </div>

                {/* Right Model & Ensembles Visual Column */}
                <div className="w-full md:w-1/2 flex items-center justify-center relative">
                  <div className="relative w-full max-w-lg aspect-[16/10] sm:aspect-[16/9] md:aspect-[4/3] lg:aspect-[16/10] rounded-2xl overflow-hidden shadow-2xl border-2 border-[#D4AF37]/40 bg-[#EDE7DE]">
                    <img
                      src={activeSlide.image}
                      alt={activeSlide.title}
                      className="w-full h-full object-cover object-center"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1000';
                      }}
                    />
                    {/* Subtle luxury gradient shade overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                  </div>
                </div>

              </div>
            </motion.div>
          </AnimatePresence>
        ) : (
          /* Graceful Fallback if all slides are deleted */
          <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
            <span className="px-3 py-1 bg-[#4A0E17]/10 text-[#4A0E17] rounded-full text-xs font-bold uppercase tracking-wider">
              Yaarika Collections
            </span>
            <h2 
              style={{ fontFamily: 'Georgia, serif' }}
              className="text-3xl sm:text-4xl text-[#2B221E] font-bold"
            >
              Exquisite Traditional Wear &amp; Designer Ensembles
            </h2>
            <p className="text-[#5C5248] text-sm max-w-md mx-auto">
              Explore our boutique collection with free shipping across Kerala.
            </p>
            <div className="pt-2">
              <button
                onClick={() => onShopClick('All')}
                className="px-6 py-2.5 gold-gradient-btn font-bold text-xs uppercase tracking-wider rounded shadow-md"
              >
                Browse Catalog
              </button>
            </div>
          </div>
        )}

        {/* Carousel Arrow Controls (shown when there are multiple slides) */}
        {slides.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              aria-label="Previous Slide"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/80 hover:bg-white text-[#4A0E17] border border-[#D4AF37]/50 shadow-md flex items-center justify-center transition-all hover:scale-105 z-30"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={handleNext}
              aria-label="Next Slide"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/80 hover:bg-white text-[#4A0E17] border border-[#D4AF37]/50 shadow-md flex items-center justify-center transition-all hover:scale-105 z-30"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Bottom Trust Highlights Bar */}
      <div className="bg-[#F4EFE6] border-t border-[#E6DEC8] py-3.5 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <div className="px-2">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-[#4A0E17]">All Kerala</p>
            <p className="text-[9px] sm:text-[10px] uppercase text-[#7A6E65] font-semibold mt-0.5">Free Shipping</p>
          </div>
          <div className="px-2 border-x border-[#D4AF37]/30">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-[#4A0E17]">100% Authentic</p>
            <p className="text-[9px] sm:text-[10px] uppercase text-[#7A6E65] font-semibold mt-0.5">Handloom Quality</p>
          </div>
          <div className="px-2">
            <p className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-[#4A0E17]">Inclusive Sizes</p>
            <p className="text-[9px] sm:text-[10px] uppercase text-[#7A6E65] font-semibold mt-0.5">Free Size to 3XL</p>
          </div>
        </div>
      </div>
    </div>
  );
};
