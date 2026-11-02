import React, { useState, useEffect } from 'react';
import Menu from './components/Menu';
import Admin from './components/Admin';
import Footer from './components/Footer';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Settings } from './types';
import { Toaster } from 'sonner';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    logo: 'https://raw.githubusercontent.com/easybyzcreator/imagens/f6d6f2e0a2c3796a81101c96241af5ad1a19cefb/logo%20days%20treats.png',
    primaryColor: '#865d39',
    whatsappNumber: '',
    whatsappCountryCode: '+55',
    slug: 'days-treats',
    brandName: 'Day’s Treats',
    slogan: 'Delicious Brazilian bakery items, cakes, and treats.',
    whatsappClosingMessage: 'Obrigada pelo pedido, aguarde que entraremos em contato para confirmação!',
    backgroundImage: 'https://i.ibb.co/X0vYy7L/cakes.png',
    glassColor: 'rgba(255, 255, 255, 0.95)',
    textColor: '#000000',
    language: 'pt',
    currency: 'BRL',
    introEnabled: true,
    introTitle: 'Day’s Treats',
    introSubtitle: 'Handcrafted Brazilian Bakery',
    introDescription: 'Delicious cakes, pastries, savories, and artisanal treats.',
    introButtonText: 'INICIAR MINHA JORNADA',
    introBottomText: '100% ARTESANAL & AFRO-BRASILEIRO',
    selectorEnabled: true,
    selectorTitle: 'Day’s Treats',
    selectorSubtitle: 'Escolha sua experiência',
    catalog1Title: 'Cardápio 1',
    catalog1Image: 'https://i.ibb.co/X0vYy7L/cakes.png',
    catalog1Desc: 'Pratos típicos, acarajé quente e delícias artesanais.',
    catalog1Slogan: '',
    catalog1Active: true,
    catalog2Title: 'Cardápio 2',
    catalog2Image: 'https://i.ibb.co/X0vYy7L/cakes.png',
    catalog2Desc: 'Sucos naturais, cervejas artesanais e doces caseiros.',
    catalog2Slogan: '',
    catalog2Active: true,
    catalog3Title: 'Cardápio 3',
    catalog3Image: '',
    catalog3Desc: '',
    catalog3Slogan: '',
    catalog3Active: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check URL for admin path
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (path === '/admin' || hash === '#/admin' || hash === '#admin') {
      setIsAdmin(true);
    }

    // Load settings for global styles
    const unsub = onSnapshot(doc(db, 'configuracoes', 'geral'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Settings;
        setSettings(prev => ({ ...prev, ...data }));
        setLoading(false);

        // Update Page Title
        if (data.brandName) {
          document.title = data.brandName;
        }

        // Update Theme Color
        const themeColorMeta = document.getElementById('theme-color');
        if (themeColorMeta) {
          themeColorMeta.setAttribute('content', data.primaryColor || '#865d39');
        }

        // Set Glass Color CSS Variable
        const glassColor = data.glassColor || 'rgba(255, 255, 255, 0.4)';
        const finalGlassColor = (glassColor.startsWith('#') && glassColor.length === 7) 
          ? `${glassColor}66` 
          : glassColor;
        document.documentElement.style.setProperty('--glass-color', finalGlassColor);

        // Set Text Color CSS Variable
        if (data.textColor) {
          document.documentElement.style.setProperty('--text-color', data.textColor);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const glassColor = settings?.glassColor || 'rgba(255, 255, 255, 0.4)';
  const finalGlassColor = (glassColor.startsWith('#') && glassColor.length === 7) 
    ? `${glassColor}66` 
    : glassColor;

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#ece6db]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#865d39] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#865d39] font-medium animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <Toaster position="top-center" richColors />
      {/* Background Image */}
      <div 
        className="fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${settings?.backgroundImage || 'https://i.ibb.co/X0vYy7L/cakes.png'}")` }}
      />
      
      {/* Glass Overlay */}
      <div 
        className="fixed inset-0 z-[-1] pointer-events-none" 
        style={{ 
          backgroundColor: finalGlassColor,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)'
        }}
      />

      {/* Content */}
      <div className="relative z-0 flex flex-col min-h-screen">
        {isAdmin ? (
          <Admin settings={settings} setSettings={setSettings} setIsAdmin={setIsAdmin} />
        ) : (
          <>
            <Menu settings={{ ...settings, language: 'en', currency: 'USD' }} />
            <Footer />
          </>
        )}
      </div>
    </div>
  );
}
