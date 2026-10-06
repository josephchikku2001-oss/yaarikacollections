import React from 'react';
import { Truck, ShieldCheck, Phone, MessageCircle } from 'lucide-react';
import yaarikaLogo from '../assets/images/regenerated_image_1787041748700.png';
import { CONTACT_NUMBERS } from '../utils/whatsapp';

interface FooterProps {
  onOpenAdmin?: () => void;
  isAdminSetupComplete?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdmin }) => {
  return (
    <footer className="bg-[#2B050B] text-[#F5EDE0] border-t-2 border-[#D4AF37]/60 pt-10 pb-8 px-6 sm:px-10">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-[#D4AF37]/20">
          
          {/* Brand Info Column */}
          <div className="md:col-span-2 space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-[#D4AF37] overflow-hidden bg-gradient-to-br from-[#1A0307] to-[#3E0912] flex items-center justify-center p-1.5 shadow-lg">
                <img 
                  src={yaarikaLogo} 
                  alt="Yaarika Logo" 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = '/logo.png';
                  }}
                />
              </div>
              <div>
                <h3 style={{ fontFamily: 'Georgia, serif' }} className="text-xl font-black italic tracking-wide text-[#FDE047]">
                  Yaarika Collections
                </h3>
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#D4AF37] font-bold">
                  Boutique Handloom &amp; Designer Wear
                </p>
              </div>
            </div>

            <p className="text-xs text-[#E6DEC8] leading-relaxed max-w-md">
              Celebrating traditional Kerala weaves, authentic Kasavu handlooms, elegant contemporary co-ord sets, and designer churidars handcrafted for festive moments.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <div className="flex items-center gap-1.5 text-xs text-[#D4AF37]">
                <Truck className="w-4 h-4 text-[#FDE047]" />
                <span className="font-semibold">All Kerala Free Shipping</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#D4AF37]">
                <ShieldCheck className="w-4 h-4 text-[#FDE047]" />
                <span className="font-semibold">Quality Verified Handlooms</span>
              </div>
            </div>
          </div>

          {/* WhatsApp Direct Helpdesk Column */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-extrabold text-[#D4AF37] border-b border-[#D4AF37]/30 pb-1">
              Direct Order Desks
            </h4>
            <p className="text-[11px] text-[#E6DEC8]">
              Instant confirmation, custom measurements, and parcel dispatch tracking via WhatsApp.
            </p>
            <div className="space-y-2">
              {CONTACT_NUMBERS.map((contact) => (
                <a
                  key={contact.value}
                  href={`https://wa.me/${contact.value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg bg-black/30 hover:bg-[#25D366]/20 border border-[#D4AF37]/30 hover:border-[#25D366] text-xs font-semibold text-white transition-all group"
                >
                  <MessageCircle className="w-4 h-4 text-[#25D366] group-hover:scale-110 transition-transform shrink-0" />
                  <div className="truncate">
                    <span className="text-[9.5px] uppercase text-[#D4AF37] block leading-none">{contact.label}</span>
                    <span className="text-xs">{contact.display}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links & Service Note */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-extrabold text-[#D4AF37] border-b border-[#D4AF37]/30 pb-1">
              Customer Support
            </h4>
            <div className="space-y-1.5 text-xs text-[#E6DEC8]">
              <p>⏰ Mon - Sat: 9:30 AM - 7:30 PM</p>
              <p className="text-[11px] text-[#D4AF37]/90 pt-1">
                Direct WhatsApp assistance for inquiries, sizing &amp; orders.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Micro Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-[11px] text-[#E6DEC8]/80">
          <p>
            © {new Date().getFullYear()} <strong className="text-[#FDE047]">Yaarika Collections</strong>. All Rights Reserved. Handcrafted in Kerala.
          </p>
          <div className="flex items-center gap-3">
            <a
              href={`https://wa.me/${CONTACT_NUMBERS[0].value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#25D366] hover:underline flex items-center gap-1 font-semibold"
            >
              <Phone className="w-3 h-3" />
              <span>WhatsApp Us</span>
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
};

