/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  SHOP = 'SHOP',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum ObjectType {
  OBSTACLE = 'OBSTACLE',
  GEM = 'GEM',
  ALIEN = 'ALIEN',
  MISSILE = 'MISSILE',
  HEALTH_PACK = 'HEALTH_PACK',
  TURBO_BOOST = 'TURBO_BOOST',
  SHIELD = 'SHIELD',
  DOUBLE_JUMP_UPGRADE = 'DOUBLE_JUMP_UPGRADE',
  BLASTER_UPGRADE = 'BLASTER_UPGRADE',
  LASER_PROJECTILE = 'LASER_PROJECTILE',
  FLOATING_MINE = 'FLOATING_MINE',
  MAGNET_UPGRADE = 'MAGNET_UPGRADE',
  SHOCKWAVE_CHARGE = 'SHOCKWAVE_CHARGE',
  SLOW_MO = 'SLOW_MO',
  FLIGHT = 'FLIGHT',
  MULTIPLIER = 'MULTIPLIER',
  LASER_GATE = 'LASER_GATE',
  METEOR = 'METEOR',
  SHOP_PORTAL = 'SHOP_PORTAL',
}

export const TURBO_DURATION = 5.0; // seconds
export const SHIELD_DURATION = 8.0; // seconds
export const BLASTER_DURATION = 10.0; // seconds
export const MAGNET_DURATION = 10.0; // seconds
export const SLOW_MO_DURATION = 8.0; // seconds
export const FLIGHT_DURATION = 6.0; // seconds
export const MULTIPLIER_DURATION = 8.0; // seconds

export interface GameObject {
  id: string;
  type: ObjectType;
  position: [number, number, number]; // x, y, z
  active: boolean;
  value?: string; 
  color?: string;
  targetIndex?: number; 
  points?: number; 
  hasFired?: boolean; 
  isSliding?: boolean;
  originalX?: number;
}

export const LANE_WIDTH = 2.2;
export const JUMP_HEIGHT = 2.5;
export const JUMP_DURATION = 0.6; // seconds
export const RUN_SPEED_BASE = 22.5;
export const SPAWN_DISTANCE = 120;
export const REMOVE_DISTANCE = 20; // Behind player
export const FLIGHT_Y = 3.5;

// Google-ish Neon Colors: Blue, Red, Yellow, Blue, Green, Red
export const GEMINI_COLORS = [
    '#2979ff', // G - Blue
    '#ff1744', // E - Red
    '#ffea00', // M - Yellow
    '#2979ff', // I - Blue
    '#00e676', // N - Green
    '#ff1744', // I - Red
];

export interface ShopItem {
    id: string;
    name: string;
    description: string;
    cost: number;
    icon: any; // Lucide icon component
    oneTime?: boolean; // If true, remove from pool after buying
}
