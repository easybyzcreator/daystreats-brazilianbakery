import React from 'react';
import { motion } from 'motion/react';

export default function Footer() {
  return (
    <footer className="w-full py-8 flex flex-col items-center justify-center gap-2 mt-auto">
      <p className="text-[10px] tracking-[0.2em] font-sans font-bold text-black/50 uppercase">
        DESENVOLVIDO POR
      </p>
      <a 
        href="https://www.easybyzcreator.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="group"
      >
        <motion.img 
          src="https://raw.githubusercontent.com/easybyzcreator/imagens/4be0417568b59c5b83bee41cd24a6107c0b6d20e/logo%20easy%20byz%20-%20fundo%20transparente.png" 
          alt="EasyByz Logo" 
          className="h-32 object-contain"
          initial={{ 
            filter: 'brightness(0) opacity(0.8)',
            scale: 0.95
          }}
          whileHover={{ 
            filter: 'brightness(0) opacity(1)',
            scale: 1.05
          }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          referrerPolicy="no-referrer"
        />
      </a>
    </footer>
  );
}
