/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Heart, Zap, Trophy, MapPin, Diamond, Rocket, ArrowUpCircle, Shield, Activity, PlusCircle, Play, Radio } from 'lucide-react';
import { useStore } from '../../store';
import { GameStatus, ShopItem, RUN_SPEED_BASE } from '../../types';
import { audio } from '../System/Audio';

// Available Shop Items
const SHOP_ITEMS: ShopItem[] = [
    {
        id: 'DOUBLE_JUMP',
        name: 'DOUBLE JUMP',
        description: 'Jump again in mid-air. Essential for high obstacles.',
        cost: 1000,
        icon: ArrowUpCircle,
        oneTime: true
    },
    {
        id: 'MAX_LIFE',
        name: 'MAX LIFE UP',
        description: 'Adds a heart slot and heals you by 1 point.',
        cost: 1500,
        icon: Activity
    },
    {
        id: 'HEAL',
        name: 'REPAIR KIT',
        description: 'Restores 1 Life point instantly.',
        cost: 800,
        icon: PlusCircle
    },
    {
        id: 'SHIELD',
        name: 'ACTIVATE SHIELD',
        description: 'Deploys an invincibility shield bubble for 8s.',
        cost: 1200,
        icon: Shield
    },
    {
        id: 'BLASTER',
        name: 'ACTIVATE BLASTER',
        description: 'Spawns a twin laser drone companion for 10s.',
        cost: 1200,
        icon: Rocket
    }
];

const ShopScreen: React.FC = () => {
    const { 
        score, hasDoubleJump, setStatus,
        collectDoubleJump, collectHealthPack, collectShield, collectBlaster,
        addScore
    } = useStore();
    const [items, setItems] = useState<ShopItem[]>([]);

    useEffect(() => {
        let pool = SHOP_ITEMS.filter(item => {
            if (item.id === 'DOUBLE_JUMP' && hasDoubleJump) return false;
            return true;
        });
        pool = pool.sort(() => 0.5 - Math.random());
        setItems(pool.slice(0, 3));
    }, [hasDoubleJump]);

    const handleBuy = (itemId: string, cost: number) => {
        if (score < cost) return;
        // Deduct cost via negative addScore (bypasses multiplier since mult=1 here)
        addScore(-cost);
        switch (itemId) {
            case 'DOUBLE_JUMP': collectDoubleJump(); break;
            case 'MAX_LIFE':    collectHealthPack(); break;
            case 'HEAL':        collectHealthPack(); break;
            case 'SHIELD':      collectShield(); break;
            case 'BLASTER':     collectBlaster(); break;
        }
    };

    return (
        <div className="absolute inset-0 bg-black/90 z-[100] text-white pointer-events-auto backdrop-blur-md overflow-y-auto">
             <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
                 <h2 className="text-3xl md:text-4xl font-black text-cyan-400 mb-2 font-cyber tracking-widest text-center">CYBER SHOP</h2>
                 <div className="flex items-center text-yellow-400 mb-6 md:mb-8">
                     <span className="text-base md:text-lg mr-2">AVAILABLE CREDITS:</span>
                     <span className="text-xl md:text-2xl font-bold">{score.toLocaleString()}</span>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl w-full mb-8">
                     {items.map(item => {
                          const Icon = item.icon;
                          const canAfford = score >= item.cost;
                          return (
                              <div key={item.id} className="bg-gray-900/80 border border-gray-700 p-4 md:p-6 rounded-xl flex flex-col items-center text-center hover:border-cyan-500 transition-colors">
                                  <div className="bg-gray-800 p-3 md:p-4 rounded-full mb-3 md:mb-4">
                                      <Icon className="w-6 h-6 md:w-8 md:h-8 text-cyan-400" />
                                  </div>
                                  <h3 className="text-lg md:text-xl font-bold mb-2">{item.name}</h3>
                                  <p className="text-gray-400 text-xs md:text-sm mb-4 h-10 md:h-12 flex items-center justify-center">{item.description}</p>
                                  <button 
                                     onClick={() => handleBuy(item.id, item.cost)}
                                     disabled={!canAfford}
                                     className={`px-4 md:px-6 py-2 rounded font-bold w-full text-sm md:text-base ${canAfford ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110' : 'bg-gray-700 cursor-not-allowed opacity-50'}`}
                                  >
                                      {item.cost} GEMS
                                  </button>
                              </div>
                          );
                     })}
                 </div>

                 <button 
                    onClick={() => setStatus(GameStatus.PLAYING)}
                    className="flex items-center px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,0,255,0.4)]"
                 >
                     RESUME MISSION <Play className="ml-2 w-5 h-5" fill="white" />
                 </button>
             </div>
        </div>
    );
};

export const HUD: React.FC = () => {
  const { 
    score, 
    lives, 
    maxLives, 
    status, 
    restartGame, 
    startGame, 
    gemsCollected, 
    distance, 
    speed,
    isTurboActive,
    isShieldActive,
    isBlasterActive,
    turboTimeLeft,
    shieldTimeLeft,
    blasterTimeLeft,
    shockwaveCharge
  } = useStore();

  const containerClass = "absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-8 z-50";

  if (status === GameStatus.SHOP) {
      return <ShopScreen />;
  }

  if (status === GameStatus.MENU) {
      return (
          <div className="absolute inset-0 flex items-center justify-center z-[100] bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
              <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,255,255,0.2)] border border-white/10 animate-in zoom-in-95 duration-500">
                
                {/* Image Container - Loaded Locally */}
                <div className="relative w-full bg-gray-900">
                     <img 
                      src="/gemini_runner.png" 
                      alt="Cyber Runner Cover" 
                      className="w-full h-auto block"
                     />
                     
                     <div className="absolute inset-0 bg-gradient-to-t from-[#050011] via-black/30 to-transparent"></div>
                     
                     <div className="absolute inset-0 flex flex-col justify-end items-center p-6 pb-8 text-center z-10">
                        <button 
                          onClick={() => { audio.init(); startGame(); }}
                          className="w-full group relative px-6 py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-xl rounded-xl hover:bg-white/20 transition-all shadow-[0_0_20px_rgba(0,255,255,0.2)] hover:shadow-[0_0_30px_rgba(0,255,255,0.4)] hover:border-cyan-400 overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/40 via-purple-500/40 to-pink-500/40 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                            <span className="relative z-10 tracking-widest flex items-center justify-center">
                                INITIALIZE RUN <Play className="ml-2 w-5 h-5 fill-white" />
                            </span>
                        </button>

                        <p className="text-cyan-400/60 text-[10px] md:text-xs font-mono mt-3 tracking-wider">
                            [ ARROWS / SWIPE TO MOVE & JUMP ]
                        </p>
                     </div>
                </div>
              </div>
          </div>
      );
  }

  if (status === GameStatus.GAME_OVER) {
      return (
          <div className="absolute inset-0 bg-black/90 z-[100] text-white pointer-events-auto backdrop-blur-sm overflow-y-auto">
              <div className="flex flex-col items-center justify-center min-h-full py-8 px-4">
                <h1 className="text-4xl md:text-6xl font-black text-white mb-6 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)] font-cyber text-center">GAME OVER</h1>
                
                <div className="grid grid-cols-1 gap-3 md:gap-4 text-center mb-8 w-full max-w-md">
                    <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                        <div className="flex items-center text-cyan-400 text-sm md:text-base"><Diamond className="mr-2 w-4 h-4 md:w-5 md:h-5"/> GEMS COLLECTED</div>
                        <div className="text-xl md:text-2xl font-bold font-mono">{gemsCollected}</div>
                    </div>
                    <div className="bg-gray-900/80 p-3 md:p-4 rounded-lg border border-gray-700 flex items-center justify-between">
                        <div className="flex items-center text-purple-400 text-sm md:text-base"><MapPin className="mr-2 w-4 h-4 md:w-5 md:h-5"/> DISTANCE</div>
                        <div className="text-xl md:text-2xl font-bold font-mono">{Math.floor(distance)} M</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 md:p-4 rounded-lg flex items-center justify-between mt-2">
                        <div className="flex items-center text-white text-sm md:text-base">TOTAL SCORE</div>
                        <div className="text-2xl md:text-3xl font-bold font-cyber text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">{score.toLocaleString()}</div>
                    </div>
                </div>

                <button 
                  onClick={() => { audio.init(); restartGame(); }}
                  className="px-8 md:px-10 py-3 md:py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg md:text-xl rounded hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)]"
                >
                    RUN AGAIN
                </button>
              </div>
          </div>
      );
  }

  return (
    <div className={containerClass}>
        {/* Top Bar */}
        <div className="flex justify-between items-start w-full">
            <div className="flex flex-col">
                <div className="text-3xl md:text-5xl font-bold text-cyan-400 drop-shadow-[0_0_10px_#00ffff] font-cyber">
                    {score.toLocaleString()}
                </div>
            </div>
            
            {/* Infinite scaling Heart indicator */}
            <div className="flex items-center space-x-2">
                {maxLives <= 6 ? (
                    <div className="flex space-x-1 md:space-x-2">
                        {[...Array(maxLives)].map((_, i) => (
                            <Heart 
                                key={i} 
                                className={`w-6 h-6 md:w-8 md:h-8 ${i < lives ? 'text-pink-500 fill-pink-500' : 'text-gray-800 fill-gray-800'} drop-shadow-[0_0_5px_#ff0054]`} 
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center bg-black/60 px-3 py-1.5 rounded-full border border-pink-500/30 backdrop-blur-sm space-x-2">
                        <Heart className="w-6 h-6 md:w-8 md:h-8 text-pink-500 fill-pink-500 animate-pulse drop-shadow-[0_0_5px_#ff0054]" />
                        <span className="text-white font-bold text-sm md:text-lg font-mono">
                            {lives} / {maxLives}
                        </span>
                    </div>
                )}
            </div>
        </div>
        
        {/* Distance Indicator - Center Top */}
        <div className="absolute top-5 left-1/2 transform -translate-x-1/2 text-sm md:text-lg text-purple-300 font-bold tracking-wider font-mono bg-black/60 px-4 py-1.5 rounded-full border border-purple-500/30 backdrop-blur-sm z-50 flex items-center space-x-1.5">
            <MapPin className="w-4 h-4 text-purple-400" />
            <span>{Math.floor(distance)} M</span>
        </div>

        {/* Active Power-Up Timers - Center screen stack */}
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 flex flex-col space-y-2 pointer-events-none items-center">
            {isTurboActive && (
                 <div className="bg-gradient-to-r from-amber-600/90 to-yellow-600/90 text-white font-bold text-xs md:text-sm tracking-widest px-3 py-1 rounded-full border border-yellow-400 shadow-[0_0_10px_orange] flex items-center space-x-1.5 animate-pulse">
                     <Zap className="w-3.5 h-3.5 fill-yellow-300 text-yellow-300" />
                     <span>TURBO MODE: {turboTimeLeft.toFixed(1)}s</span>
                 </div>
            )}
            {isShieldActive && (
                 <div className="bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white font-bold text-xs md:text-sm tracking-widest px-3 py-1 rounded-full border border-cyan-400 shadow-[0_0_10px_cyan] flex items-center space-x-1.5">
                     <Shield className="w-3.5 h-3.5 fill-cyan-300 text-cyan-300" />
                     <span>SHIELD: {shieldTimeLeft.toFixed(1)}s</span>
                 </div>
            )}
            {isBlasterActive && (
                 <div className="bg-gradient-to-r from-emerald-600/90 to-teal-600/90 text-white font-bold text-xs md:text-sm tracking-widest px-3 py-1 rounded-full border border-emerald-400 shadow-[0_0_10px_lime] flex items-center space-x-1.5">
                     <Rocket className="w-3.5 h-3.5 text-emerald-300" />
                     <span>LASER DRONE: {blasterTimeLeft.toFixed(1)}s</span>
                 </div>
            )}
            {shockwaveCharge > 0 && (
                 <div className="bg-gradient-to-r from-orange-600/90 to-red-600/90 text-white font-bold text-xs md:text-sm tracking-widest px-3 py-1 rounded-full border border-orange-400 shadow-[0_0_10px_orange] flex items-center space-x-1.5 animate-pulse">
                     <Radio className="w-3.5 h-3.5 fill-orange-300 text-orange-300" />
                     <span>SHOCKWAVE READY</span>
                 </div>
            )}
        </div>

        {/* Bottom Overlay */}
        <div className="w-full flex justify-end items-end">
             <div className="flex items-center space-x-2 text-cyan-500 opacity-80 bg-black/40 px-3 py-1 rounded-lg backdrop-blur-xs">
                 <Zap className="w-4 h-4 md:w-5 h-5 animate-pulse" />
                 <span className="font-mono text-sm md:text-base">SPEED: {Math.round((speed / RUN_SPEED_BASE) * 100)}%</span>
             </div>
        </div>
    </div>
  );
};
