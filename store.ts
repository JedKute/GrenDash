/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { 
  GameStatus, 
  RUN_SPEED_BASE, 
  TURBO_DURATION, 
  SHIELD_DURATION, 
  BLASTER_DURATION,
  MAGNET_DURATION,
  SLOW_MO_DURATION,
  FLIGHT_DURATION,
  MULTIPLIER_DURATION
} from './types';

interface GameState {
  status: GameStatus;
  score: number;
  lives: number;
  maxLives: number;
  speed: number;
  laneCount: number;
  gemsCollected: number;
  distance: number;
  
  // Power-up States
  hasDoubleJump: boolean;
  isShieldActive: boolean;
  isTurboActive: boolean;
  isBlasterActive: boolean;
  isMagnetActive: boolean;
  isSlowMoActive: boolean;
  isFlightActive: boolean;
  isMultiplierActive: boolean;
  isEnergyBoostActive: boolean; // alias used in App.tsx (turbo FOV effect)

  // Shockwave (one-shot, no timer)
  shockwaveCharge: number; // 0 = none, 1 = ready

  // Timers
  turboTimeLeft: number;
  shieldTimeLeft: number;
  blasterTimeLeft: number;
  magnetTimeLeft: number;
  slowMoTimeLeft: number;
  flightTimeLeft: number;
  multiplierTimeLeft: number;

  // Actions
  startGame: () => void;
  restartGame: () => void;
  takeDamage: () => void;
  addScore: (amount: number) => void;
  collectGem: (value: number) => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  tickPowerups: (delta: number) => void;

  
  // Pickups
  collectHealthPack: () => void;
  collectTurbo: () => void;
  collectShield: () => void;
  collectBlaster: () => void;
  collectDoubleJump: () => void;
  collectMagnet: () => void;
  collectSlowMo: () => void;
  collectFlight: () => void;
  collectMultiplier: () => void;
  collectShockwave: () => void;
  triggerShockwave: () => void;
}

const RESET_STATE = {
  score: 0,
  lives: 3,
  maxLives: 3,
  speed: RUN_SPEED_BASE,
  laneCount: 5,
  gemsCollected: 0,
  distance: 0,
  hasDoubleJump: false,
  isShieldActive: false,
  isTurboActive: false,
  isBlasterActive: false,
  isMagnetActive: false,
  isSlowMoActive: false,
  isFlightActive: false,
  isMultiplierActive: false,
  isEnergyBoostActive: false,
  shockwaveCharge: 0,
  turboTimeLeft: 0,
  shieldTimeLeft: 0,
  blasterTimeLeft: 0,
  magnetTimeLeft: 0,
  slowMoTimeLeft: 0,
  flightTimeLeft: 0,
  multiplierTimeLeft: 0,
};

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  ...RESET_STATE,

  startGame: () => set({ status: GameStatus.PLAYING, ...RESET_STATE }),
  restartGame: () => set({ status: GameStatus.PLAYING, ...RESET_STATE }),


  takeDamage: () => {
    const { lives, isShieldActive, isTurboActive, isFlightActive } = get();
    if (isShieldActive || isTurboActive || isFlightActive) return;

    if (lives > 1) {
      set({ lives: lives - 1 });
    } else {
      set({ lives: 0, status: GameStatus.GAME_OVER, speed: 0 });
    }
  },

  addScore: (amount) => set((state) => {
    const mult = state.isMultiplierActive ? 3 : 1;
    return { score: state.score + amount * mult };
  }),
  
  collectGem: (value) => set((state) => {
    const mult = state.isMultiplierActive ? 3 : 1;
    return { 
      score: state.score + value * mult, 
      gemsCollected: state.gemsCollected + 1 
    };
  }),

  setDistance: (dist) => set((state) => {
    let normalSpeed = RUN_SPEED_BASE + dist * 0.008;
    if (state.isSlowMoActive) normalSpeed *= 0.4;
    const currentSpeed = state.isTurboActive ? normalSpeed * 2.2 : normalSpeed;
    return { distance: dist, speed: currentSpeed };
  }),

  tickPowerups: (delta) => set((state) => {
    let { 
      turboTimeLeft, shieldTimeLeft, blasterTimeLeft, magnetTimeLeft,
      slowMoTimeLeft, flightTimeLeft, multiplierTimeLeft,
      isTurboActive, isShieldActive, isBlasterActive, isMagnetActive,
      isSlowMoActive, isFlightActive, isMultiplierActive, distance 
    } = state;

    if (isTurboActive) {
      turboTimeLeft = Math.max(0, turboTimeLeft - delta);
      if (turboTimeLeft <= 0) isTurboActive = false;
    }
    if (isShieldActive) {
      shieldTimeLeft = Math.max(0, shieldTimeLeft - delta);
      if (shieldTimeLeft <= 0) isShieldActive = false;
    }
    if (isBlasterActive) {
      blasterTimeLeft = Math.max(0, blasterTimeLeft - delta);
      if (blasterTimeLeft <= 0) isBlasterActive = false;
    }
    if (isMagnetActive) {
      magnetTimeLeft = Math.max(0, magnetTimeLeft - delta);
      if (magnetTimeLeft <= 0) isMagnetActive = false;
    }
    if (isSlowMoActive) {
      slowMoTimeLeft = Math.max(0, slowMoTimeLeft - delta);
      if (slowMoTimeLeft <= 0) isSlowMoActive = false;
    }
    if (isFlightActive) {
      flightTimeLeft = Math.max(0, flightTimeLeft - delta);
      if (flightTimeLeft <= 0) isFlightActive = false;
    }
    if (isMultiplierActive) {
      multiplierTimeLeft = Math.max(0, multiplierTimeLeft - delta);
      if (multiplierTimeLeft <= 0) isMultiplierActive = false;
    }

    let normalSpeed = RUN_SPEED_BASE + distance * 0.008;
    if (isSlowMoActive) normalSpeed *= 0.4;
    const currentSpeed = isTurboActive ? normalSpeed * 2.2 : normalSpeed;

    return {
      turboTimeLeft, shieldTimeLeft, blasterTimeLeft, magnetTimeLeft,
      slowMoTimeLeft, flightTimeLeft, multiplierTimeLeft,
      isTurboActive, isShieldActive, isBlasterActive, isMagnetActive,
      isSlowMoActive, isFlightActive, isMultiplierActive,
      isEnergyBoostActive: isTurboActive,
      speed: currentSpeed
    };
  }),

  collectHealthPack: () => set((state) => ({
    maxLives: state.maxLives + 1,
    lives: state.lives + 1
  })),

  collectTurbo: () => set((state) => {
    let normalSpeed = RUN_SPEED_BASE + state.distance * 0.008;
    if (state.isSlowMoActive) normalSpeed *= 0.4;
    return { isTurboActive: true, turboTimeLeft: TURBO_DURATION, speed: normalSpeed * 2.2, isEnergyBoostActive: true };
  }),

  collectShield: () => set({ isShieldActive: true, shieldTimeLeft: SHIELD_DURATION }),
  collectBlaster: () => set({ isBlasterActive: true, blasterTimeLeft: BLASTER_DURATION }),
  collectDoubleJump: () => set({ hasDoubleJump: true }),
  collectMagnet: () => set({ isMagnetActive: true, magnetTimeLeft: MAGNET_DURATION }),
  collectSlowMo: () => set({ isSlowMoActive: true, slowMoTimeLeft: SLOW_MO_DURATION }),
  collectFlight: () => set({ isFlightActive: true, flightTimeLeft: FLIGHT_DURATION }),
  collectMultiplier: () => set({ isMultiplierActive: true, multiplierTimeLeft: MULTIPLIER_DURATION }),

  // Shockwave: collect = store a charge, trigger = fire it (dispatches event)
  collectShockwave: () => set({ shockwaveCharge: 1 }),
  triggerShockwave: () => {
    const { shockwaveCharge } = get();
    if (shockwaveCharge <= 0) return;
    set({ shockwaveCharge: 0 });
    window.dispatchEvent(new Event('shockwave-fire'));
  },

  setStatus: (status) => set({ status })
}));
