/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text3D, Center } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../../store';
import { GameObject, ObjectType, LANE_WIDTH, SPAWN_DISTANCE, REMOVE_DISTANCE, GameStatus, FLIGHT_Y } from '../../types';
import { audio } from '../System/Audio';

// Geometry Constants
const OBSTACLE_HEIGHT = 1.6;
const OBSTACLE_GEOMETRY = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_GLOW_GEO = new THREE.ConeGeometry(0.9, OBSTACLE_HEIGHT, 6);
const OBSTACLE_RING_GEO = new THREE.RingGeometry(0.6, 0.9, 6);

const GEM_GEOMETRY = new THREE.IcosahedronGeometry(0.3, 0);

// Alien Geometries
const ALIEN_BODY_GEO = new THREE.CylinderGeometry(0.6, 0.3, 0.3, 8);
const ALIEN_DOME_GEO = new THREE.SphereGeometry(0.4, 16, 16, 0, Math.PI * 2, 0, Math.PI/2);
const ALIEN_EYE_GEO = new THREE.SphereGeometry(0.1);

// Missile Geometries
const MISSILE_CORE_GEO = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
const MISSILE_RING_GEO = new THREE.TorusGeometry(0.15, 0.02, 16, 32);

// Existing Powerup Geometries
const CROSS_VERT_GEO = new THREE.BoxGeometry(0.18, 0.5, 0.18);
const CROSS_HORIZ_GEO = new THREE.BoxGeometry(0.5, 0.18, 0.18);
const LIGHTNING_GEO = new THREE.CylinderGeometry(0, 0.3, 0.8, 4);
const SHIELD_PICKUP_GEO = new THREE.SphereGeometry(0.3, 8, 8);
const WINGS_GEO = new THREE.TorusGeometry(0.2, 0.05, 8, 16, Math.PI);
const BLASTER_PICKUP_GEO = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
const MINE_GEO = new THREE.IcosahedronGeometry(0.35, 1);
const LASER_PROJECTILE_GEO = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);

// ─── NEW Power Geometries ───────────────────────────────────────────────────
// Gem Magnet: horseshoe-ish torus + small sphere ends
const MAGNET_ARC_GEO = new THREE.TorusGeometry(0.22, 0.055, 8, 20, Math.PI);
const MAGNET_TIP_GEO = new THREE.SphereGeometry(0.07, 6, 6);

// Shockwave Core: concentric octahedra
const SHOCK_INNER_GEO = new THREE.OctahedronGeometry(0.2, 0);
const SHOCK_OUTER_GEO = new THREE.OctahedronGeometry(0.34, 0);

// Slow Motion: hourglass (two cones tip-to-tip)
const SLOW_CONE_GEO = new THREE.ConeGeometry(0.22, 0.28, 6);

// Jetpack Flight: rocket body cylinder + cone nose + two small nozzle cones
const FLIGHT_BODY_GEO = new THREE.CylinderGeometry(0.1, 0.1, 0.55, 8);
const FLIGHT_NOSE_GEO = new THREE.ConeGeometry(0.1, 0.18, 8);
const FLIGHT_NOZZLE_GEO = new THREE.ConeGeometry(0.08, 0.14, 6);

// Score Multiplier: star-like — use IcosahedronGeometry + torus ring accent
const MULT_STAR_GEO = new THREE.IcosahedronGeometry(0.24, 1);
const MULT_RING_GEO = new THREE.TorusGeometry(0.32, 0.04, 8, 24);
// ────────────────────────────────────────────────────────────────────────────

// Shadow Geometries
const SHADOW_GEM_GEO = new THREE.CircleGeometry(0.6, 32);
const SHADOW_ALIEN_GEO = new THREE.CircleGeometry(0.8, 32);
const SHADOW_MISSILE_GEO = new THREE.PlaneGeometry(0.15, 3);
const SHADOW_DEFAULT_GEO = new THREE.CircleGeometry(0.8, 6);

// Shop Geometries
const SHOP_FRAME_GEO = new THREE.BoxGeometry(1, 7, 1);
const SHOP_BACK_GEO = new THREE.BoxGeometry(1, 5, 1.2);
const SHOP_OUTLINE_GEO = new THREE.BoxGeometry(1, 7.2, 0.8);
const SHOP_FLOOR_GEO = new THREE.PlaneGeometry(1, 4);

const PARTICLE_COUNT = 600;
const MISSILE_SPEED = 30;

const FONT_URL = "/helvetiker_bold.typeface.json";

// Magnet attraction distance
const MAGNET_ATTRACT_RADIUS = 14;

// --- Particle System ---
const ParticleSystem: React.FC = () => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    const particles = useRef(new Array(PARTICLE_COUNT).fill(0).map(() => ({
        life: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        color: new THREE.Color()
    })));

    const { status } = useStore();

    // Reset particles on game restart/menu
    useEffect(() => {
        if (status === GameStatus.MENU || status === GameStatus.GAME_OVER) {
            particles.current.forEach(p => { p.life = 0; });
        }
    }, [status]);

    useEffect(() => {
        const handleExplosion = (e: CustomEvent) => {
            const { position, color } = e.detail;
            let spawned = 0;
            const burstAmount = 40; 

            for(let i = 0; i < PARTICLE_COUNT; i++) {
                const p = particles.current[i];
                if (p.life <= 0) {
                    p.life = 1.0 + Math.random() * 0.5; 
                    p.pos.set(position[0], position[1], position[2]);
                    
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const speed = 2 + Math.random() * 10;
                    
                    p.vel.set(
                        Math.sin(phi) * Math.cos(theta),
                        Math.sin(phi) * Math.sin(theta),
                        Math.cos(phi)
                    ).multiplyScalar(speed);

                    p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    p.rotVel.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar(5);
                    
                    p.color.set(color);
                    
                    spawned++;
                    if (spawned >= burstAmount) break;
                }
            }
        };
        
        window.addEventListener('particle-burst', handleExplosion as any);
        return () => window.removeEventListener('particle-burst', handleExplosion as any);
    }, []);

    // Cleanup mesh geometry and material on unmount
    useEffect(() => {
        return () => {
            if (mesh.current) {
                mesh.current.geometry?.dispose();
                if (mesh.current.material) {
                    if (Array.isArray(mesh.current.material)) {
                        mesh.current.material.forEach(m => m.dispose());
                    } else {
                        mesh.current.material.dispose();
                    }
                }
            }
        };
    }, []);

    useFrame((state, delta) => {
        if (!mesh.current) return;
        const safeDelta = Math.min(delta, 0.1);

        particles.current.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= safeDelta * 1.5;
                p.pos.addScaledVector(p.vel, safeDelta);
                p.vel.y -= safeDelta * 5; 
                p.vel.multiplyScalar(0.98);

                p.rot.x += p.rotVel.x * safeDelta;
                p.rot.y += p.rotVel.y * safeDelta;
                
                dummy.position.copy(p.pos);
                const scale = Math.max(0, p.life * 0.25);
                dummy.scale.set(scale, scale, scale);
                
                dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
                dummy.updateMatrix();
                
                mesh.current!.setMatrixAt(i, dummy.matrix);
                mesh.current!.setColorAt(i, p.color);
            } else {
                dummy.scale.set(0,0,0);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            }
        });
        
        mesh.current.instanceMatrix.needsUpdate = true;
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
            <octahedronGeometry args={[0.5, 0]} />
            <meshBasicMaterial toneMapped={false} transparent opacity={0.9} />
        </instancedMesh>
    );
};

const getRandomLane = (laneCount: number) => {
    const max = Math.floor(laneCount / 2);
    return Math.floor(Math.random() * (max * 2 + 1)) - max;
};

export const LevelManager: React.FC = () => {
  const { 
    status, 
    speed, 
    collectGem, 
    laneCount,
    setDistance,
    setStatus,
    addScore,
    tickPowerups,
    isTurboActive,
    isShieldActive,
    isBlasterActive,
    isMagnetActive,
    isFlightActive,
    collectHealthPack,
    collectTurbo,
    collectShield,
    collectBlaster,
    collectDoubleJump,
    collectMagnet,
    collectSlowMo,
    collectFlight,
    collectMultiplier,
    collectShockwave,
    hasDoubleJump
  } = useStore();
  
  const objectsRef = useRef<GameObject[]>([]);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const prevStatus = useRef(status);

  const playerObjRef = useRef<THREE.Object3D | null>(null);
  const distanceTraveled = useRef(0);
  const nextShopDistance = useRef(1500);
  const lastLaserFired = useRef(0);

  // Handle resets
  useEffect(() => {
    const isRestart = status === GameStatus.PLAYING && prevStatus.current === GameStatus.GAME_OVER;
    const isMenuReset = status === GameStatus.MENU;

    if (isMenuReset || isRestart) {
        objectsRef.current = [];
        setRenderTrigger(t => t + 1);
        distanceTraveled.current = 0;
        nextShopDistance.current = 1500;
    }
    
    prevStatus.current = status;
  }, [status]);

  // Shockwave event: blow up all hazards on screen
  useEffect(() => {
    const handleShockwave = () => {
        let changed = false;
        objectsRef.current.forEach(obj => {
            if (!obj.active) return;
            const isHazard = 
                obj.type === ObjectType.OBSTACLE ||
                obj.type === ObjectType.FLOATING_MINE ||
                obj.type === ObjectType.ALIEN ||
                obj.type === ObjectType.MISSILE ||
                obj.type === ObjectType.LASER_GATE ||
                obj.type === ObjectType.METEOR;
            if (isHazard) {
                obj.active = false;
                changed = true;
                // Big particle burst at each target
                window.dispatchEvent(new CustomEvent('particle-burst', {
                    detail: { position: obj.position, color: '#ff6600' }
                }));
            }
        });
        if (changed) {
            audio.playExplosion();
            setRenderTrigger(t => t + 1);
        }
    };
    window.addEventListener('shockwave-fire', handleShockwave);
    return () => window.removeEventListener('shockwave-fire', handleShockwave);
  }, []);

  useFrame((state, delta) => {
    // Find player reference if not found yet
    if (!playerObjRef.current) {
        const group = state.scene.getObjectByName('PlayerGroup');
        if (group && group.children.length > 0) {
            playerObjRef.current = group.children[0];
        }
    }

    if (status !== GameStatus.PLAYING) return;

    const safeDelta = Math.min(delta, 0.05); 
    const dist = speed * safeDelta;
    
    distanceTraveled.current += dist;
    setDistance(Math.floor(distanceTraveled.current));

    tickPowerups(safeDelta);

    let hasChanges = false;
    let playerPos = new THREE.Vector3(0, 0, 0);
    
    if (playerObjRef.current) {
        playerObjRef.current.getWorldPosition(playerPos);
    }

    // 1. Blaster Drone Auto-Firing
    if (isBlasterActive) {
        if (state.clock.elapsedTime - lastLaserFired.current > 0.35) {
             objectsRef.current.push({
                 id: uuidv4(),
                 type: ObjectType.LASER_PROJECTILE,
                 position: [playerPos.x, 1.3, playerPos.z - 2.0],
                 active: true,
                 color: '#00ffcc'
             });
             audio.playLaserFire();
             lastLaserFired.current = state.clock.elapsedTime;
             hasChanges = true;
        }
    }

    // 2. Spawn Cyber Shop Portal
    if (distanceTraveled.current >= nextShopDistance.current) {
         objectsRef.current = objectsRef.current.filter(obj => obj.position[2] > -80);
         objectsRef.current.push({
             id: uuidv4(),
             type: ObjectType.SHOP_PORTAL,
             position: [0, 0, -110], 
             active: true,
         });
         nextShopDistance.current += 1500;
         hasChanges = true;
    }

    // 3. Move & Update Entities
    const currentObjects = objectsRef.current;
    const keptObjects: GameObject[] = [];
    const newSpawns: GameObject[] = [];

    const lasers = currentObjects.filter(o => o.active && o.type === ObjectType.LASER_PROJECTILE);
    const destructibleTargets = currentObjects.filter(o => o.active && 
        (o.type === ObjectType.OBSTACLE || o.type === ObjectType.FLOATING_MINE || o.type === ObjectType.ALIEN || o.type === ObjectType.MISSILE)
    );

    // Laser vs Target collision
    for (const laser of lasers) {
        for (const target of destructibleTargets) {
             const dx = Math.abs(laser.position[0] - target.position[0]);
             const dz = Math.abs(laser.position[2] - target.position[2]);
             if (dx < 0.9 && dz < 2.0) {
                 laser.active = false;
                 target.active = false;
                 hasChanges = true;
                 window.dispatchEvent(new CustomEvent('particle-burst', { 
                     detail: { position: target.position, color: target.color || '#ff0054' } 
                 }));
                 audio.playExplosion();
                 addScore(target.type === ObjectType.ALIEN ? 250 : 120);
             }
        }
    }

    for (const obj of currentObjects) {
        if (!obj.active) {
            hasChanges = true;
            continue;
        }

        let moveAmount = dist;
        
        if (obj.type === ObjectType.LASER_PROJECTILE) {
            obj.position[2] -= (speed + 45) * safeDelta;
            if (obj.position[2] < -SPAWN_DISTANCE) {
                obj.active = false;
                hasChanges = true;
                continue;
            }
        } else {
            if (obj.type === ObjectType.MISSILE) {
                moveAmount += MISSILE_SPEED * safeDelta;
            }
            const prevZ = obj.position[2];
            obj.position[2] += moveAmount;

            // Slide obstacle
            if (obj.isSliding && obj.originalX !== undefined) {
                 obj.position[0] = obj.originalX + Math.sin(state.clock.elapsedTime * 4) * LANE_WIDTH * 0.8;
            }

            // Alien Shooting
            if (obj.type === ObjectType.ALIEN && !obj.hasFired) {
                 if (obj.position[2] > -90) {
                     obj.hasFired = true;
                     newSpawns.push({
                         id: uuidv4(),
                         type: ObjectType.MISSILE,
                         position: [obj.position[0], 1.2, obj.position[2] + 2],
                         active: true,
                         color: '#ff0000'
                     });
                     hasChanges = true;
                     window.dispatchEvent(new CustomEvent('particle-burst', { 
                        detail: { position: obj.position, color: '#ff00aa' } 
                     }));
                 }
            }

            // ── Gem Magnet: pull gems toward player ──────────────────────
            if (isMagnetActive && obj.type === ObjectType.GEM) {
                const dxM = playerPos.x - obj.position[0];
                const dzM = playerPos.z - obj.position[2];
                const dist2D = Math.sqrt(dxM * dxM + dzM * dzM);
                if (dist2D < MAGNET_ATTRACT_RADIUS) {
                    const pullStrength = (1 - dist2D / MAGNET_ATTRACT_RADIUS) * 30 * safeDelta;
                    obj.position[0] += dxM * pullStrength / dist2D;
                    obj.position[2] += dzM * pullStrength / dist2D;
                    hasChanges = true;
                }
            }
            // ────────────────────────────────────────────────────────────

            // Collisions with Player
            const zThreshold = 2.2;
            const inZZone = (prevZ < playerPos.z + zThreshold) && (obj.position[2] > playerPos.z - zThreshold);

            if (inZZone) {
                const dx = Math.abs(obj.position[0] - playerPos.x);
                if (dx < 0.9) {
                     if (obj.type === ObjectType.SHOP_PORTAL) {
                         const dz = Math.abs(obj.position[2] - playerPos.z);
                         if (dz < 2.0) {
                             setStatus(GameStatus.SHOP);
                             obj.active = false;
                             hasChanges = true;
                             continue;
                         }
                     } else {
                         const isDamageSource = obj.type === ObjectType.OBSTACLE || obj.type === ObjectType.ALIEN || obj.type === ObjectType.MISSILE || obj.type === ObjectType.FLOATING_MINE;
                         
                         if (isDamageSource) {
                             if (isTurboActive || isShieldActive) {
                                 obj.active = false;
                                 hasChanges = true;
                                 window.dispatchEvent(new CustomEvent('particle-burst', { 
                                     detail: { position: obj.position, color: obj.color || '#ff0054' } 
                                 }));
                                 audio.playExplosion();
                                 addScore(150);
                                 continue;
                             }

                             const playerBottom = playerPos.y;
                             const playerTop = playerPos.y + 1.6;

                             let objBottom = obj.position[1] - 0.4;
                             let objTop = obj.position[1] + 0.4;

if (obj.type === ObjectType.OBSTACLE) {
                                  // During flight player is at Y=3.5 — completely above ground obstacles
                                  if (isFlightActive) {
                                      keptObjects.push(obj);
                                      continue;
                                  }
                                  objBottom = 0;
                                  objTop = OBSTACLE_HEIGHT;
                              } else if (obj.type === ObjectType.MISSILE) {
                                  objBottom = 0.7;
                                  objTop = 1.7;
                              } else if (obj.type === ObjectType.FLOATING_MINE) {
                                  // During flight player is at Y=3.5 — completely above floating mines
                                  if (isFlightActive) {
                                      keptObjects.push(obj);
                                      continue;
                                  }
                                  objBottom = 1.9;
                                  objTop = 2.5;
                              }

                             const isHit = (playerBottom < objTop) && (playerTop > objBottom);

                             if (isHit) {
                                 window.dispatchEvent(new Event('player-hit'));
                                 obj.active = false;
                                 hasChanges = true;
                                 continue;
                             }
                         } else {
                             // Powerups and Gem Pickups
                             const dy = Math.abs(obj.position[1] - playerPos.y);
                             if (dy < 2.5) {
                                 obj.active = false;
                                 hasChanges = true;

                                 window.dispatchEvent(new CustomEvent('particle-burst', { 
                                     detail: { position: obj.position, color: obj.color || '#ffffff' } 
                                 }));
                                 audio.playPowerup();

                                 if (obj.type === ObjectType.GEM) {
                                     collectGem(obj.points || 50);
                                 } else if (obj.type === ObjectType.HEALTH_PACK) {
                                     collectHealthPack();
                                 } else if (obj.type === ObjectType.TURBO_BOOST) {
                                     collectTurbo();
                                     audio.playTurbo();
                                 } else if (obj.type === ObjectType.SHIELD) {
                                     collectShield();
                                 } else if (obj.type === ObjectType.BLASTER_UPGRADE) {
                                     collectBlaster();
                                 } else if (obj.type === ObjectType.DOUBLE_JUMP_UPGRADE) {
                                     collectDoubleJump();
                                 } else if (obj.type === ObjectType.MAGNET_UPGRADE) {
                                     collectMagnet();
                                 } else if (obj.type === ObjectType.SHOCKWAVE_CHARGE) {
                                     collectShockwave();
                                 } else if (obj.type === ObjectType.SLOW_MO) {
                                     collectSlowMo();
                                 } else if (obj.type === ObjectType.FLIGHT) {
                                     collectFlight();
                                 } else if (obj.type === ObjectType.MULTIPLIER) {
                                     collectMultiplier();
                                 }
                                 continue;
                             }
                         }
                     }
                }
            }

            if (obj.position[2] > REMOVE_DISTANCE) {
                obj.active = false;
                hasChanges = true;
                continue;
            }
        }

        keptObjects.push(obj);
    }

    if (newSpawns.length > 0) {
        keptObjects.push(...newSpawns);
    }

    // 4. Endless Spawning Logic
    let furthestZ = 0;
    const staticObjects = keptObjects.filter(o => o.type !== ObjectType.MISSILE && o.type !== ObjectType.LASER_PROJECTILE);
    
    if (staticObjects.length > 0) {
        furthestZ = Math.min(...staticObjects.map(o => o.position[2]));
    } else {
        furthestZ = -20;
    }

    if (furthestZ > -SPAWN_DISTANCE) {
         const minGap = 14 + (speed * 0.35); 
         const spawnZ = Math.min(furthestZ - minGap, -SPAWN_DISTANCE);
         
         const lane = getRandomLane(laneCount);
         const roll = Math.random();

         if (roll < 0.65) {
             // SPAWN HAZARD
             const obstacleRoll = Math.random();
             if (obstacleRoll < 0.50) {
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.OBSTACLE,
                     position: [lane * LANE_WIDTH, OBSTACLE_HEIGHT / 2, spawnZ],
                     active: true,
                     color: '#ff0054'
                 });
             } else if (obstacleRoll < 0.70) {
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.OBSTACLE,
                     position: [lane * LANE_WIDTH, OBSTACLE_HEIGHT / 2, spawnZ],
                     active: true,
                     color: '#ff9900',
                     isSliding: true,
                     originalX: lane * LANE_WIDTH
                 });
             } else if (obstacleRoll < 0.90) {
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.FLOATING_MINE,
                     position: [lane * LANE_WIDTH, 2.2, spawnZ],
                     active: true,
                     color: '#ff0022'
                 });
             } else {
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.ALIEN,
                     position: [lane * LANE_WIDTH, 1.6, spawnZ],
                     active: true,
                     color: '#9400d3',
                     hasFired: false
                 });
             }
         } else {
             // SPAWN PICKUP
             const pickupRoll = Math.random();
             if (pickupRoll < 0.28) {
                 // Gem
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.GEM,
                     position: [lane * LANE_WIDTH, 1.1, spawnZ],
                     active: true,
                     color: '#00ffff',
                     points: 50
                 });
             } else if (pickupRoll < 0.38) {
                 // Health Pack
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.HEALTH_PACK,
                     position: [lane * LANE_WIDTH, 1.2, spawnZ],
                     active: true,
                     color: '#ff3388'
                 });
             } else if (pickupRoll < 0.48) {
                 // Turbo Boost
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.TURBO_BOOST,
                     position: [lane * LANE_WIDTH, 1.2, spawnZ],
                     active: true,
                     color: '#ffea00'
                 });
             } else if (pickupRoll < 0.56) {
                 // Shield
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.SHIELD,
                     position: [lane * LANE_WIDTH, 1.2, spawnZ],
                     active: true,
                     color: '#ffd700'
                 });
             } else if (pickupRoll < 0.63 && !hasDoubleJump) {
                 // Double Jump
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.DOUBLE_JUMP_UPGRADE,
                     position: [lane * LANE_WIDTH, 1.2, spawnZ],
                     active: true,
                     color: '#2979ff'
                 });
             } else if (pickupRoll < 0.70) {
                 // Blaster
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.BLASTER_UPGRADE,
                     position: [lane * LANE_WIDTH, 1.2, spawnZ],
                     active: true,
                     color: '#00e676'
                 });
             } else if (pickupRoll < 0.76) {
                 // ─── GEM MAGNET ─────────────────────────────────────────
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.MAGNET_UPGRADE,
                     position: [lane * LANE_WIDTH, 1.2, spawnZ],
                     active: true,
                     color: '#ff6ef7'  // vivid magenta
                 });
             } else if (pickupRoll < 0.82) {
                 // ─── SHOCKWAVE CORE ─────────────────────────────────────
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.SHOCKWAVE_CHARGE,
                     position: [lane * LANE_WIDTH, 1.2, spawnZ],
                     active: true,
                     color: '#ff4500'  // deep orange-red
                 });
             } else if (pickupRoll < 0.88) {
                 // ─── SLOW MOTION ─────────────────────────────────────────
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.SLOW_MO,
                     position: [lane * LANE_WIDTH, 1.2, spawnZ],
                     active: true,
                     color: '#00cfff'  // ice blue
                 });
             } else if (pickupRoll < 0.94) {
                 // ─── JETPACK FLIGHT ──────────────────────────────────────
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.FLIGHT,
                     position: [lane * LANE_WIDTH, 1.2, spawnZ],
                     active: true,
                     color: '#c0ff00'  // neon lime
                 });

                 // Spawn a ring of sky gems above (collected while airborne)
                 const ringZ = spawnZ - 8;
                 for (let i = 0; i < 6; i++) {
                     const angle = (i / 6) * Math.PI * 2;
                     const rx = Math.cos(angle) * 1.5;
                     const ry = FLIGHT_Y + Math.sin(angle) * 0.6;
                     keptObjects.push({
                         id: uuidv4(),
                         type: ObjectType.GEM,
                         position: [rx, ry, ringZ],
                         active: true,
                         color: '#c0ff00',
                         points: 150  // sky gems worth more
                     });
                 }
             } else {
                 // ─── SCORE MULTIPLIER ────────────────────────────────────
                 keptObjects.push({
                     id: uuidv4(),
                     type: ObjectType.MULTIPLIER,
                     position: [lane * LANE_WIDTH, 1.2, spawnZ],
                     active: true,
                     color: '#fbbf24'  // golden amber
                 });
             }
         }
         hasChanges = true;
    }

    if (hasChanges) {
        objectsRef.current = keptObjects;
        setRenderTrigger(t => t + 1);
    }
  });

  return (
    <group>
      <ParticleSystem />
      {objectsRef.current.map(obj => {
        if (!obj.active) return null;
        return <GameEntity key={obj.id} data={obj} />;
      })}
    </group>
  );
};

const GameEntity: React.FC<{ data: GameObject }> = React.memo(({ data }) => {
    const groupRef = useRef<THREE.Group>(null);
    const visualRef = useRef<THREE.Group>(null);
    const shadowRef = useRef<THREE.Mesh>(null);
    const { laneCount } = useStore();
    
    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.position.set(data.position[0], 0, data.position[2]);
        }

        if (visualRef.current) {
            const baseHeight = data.position[1];
            
            if (data.type === ObjectType.SHOP_PORTAL) {
                 visualRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.02);
            } else if (data.type === ObjectType.MISSILE) {
                 visualRef.current.rotation.z += delta * 20; 
                 visualRef.current.position.y = baseHeight;
            } else if (data.type === ObjectType.LASER_PROJECTILE) {
                 visualRef.current.position.y = baseHeight;
            } else if (data.type === ObjectType.ALIEN) {
                 visualRef.current.position.y = baseHeight + Math.sin(state.clock.elapsedTime * 3) * 0.2;
                 visualRef.current.rotation.y += delta;
            } else if (data.type === ObjectType.OBSTACLE || data.type === ObjectType.FLOATING_MINE) {
                 visualRef.current.position.y = baseHeight;
                 visualRef.current.rotation.y += delta * (data.type === ObjectType.FLOATING_MINE ? 4 : 0);
            } else {
                // Bobbing items (all pickups)
                visualRef.current.rotation.y += delta * 3;
                const bobOffset = Math.sin(state.clock.elapsedTime * 4 + data.position[0]) * 0.1;
                visualRef.current.position.y = baseHeight + bobOffset;
                
                if (shadowRef.current) {
                    const shadowScale = 1 - bobOffset; 
                    shadowRef.current.scale.setScalar(shadowScale);
                }
            }
        }
    });

    const shadowGeo = useMemo(() => {
        if (data.type === ObjectType.GEM) return SHADOW_GEM_GEO;
        if (data.type === ObjectType.SHOP_PORTAL) return null;
        if (data.type === ObjectType.ALIEN) return SHADOW_ALIEN_GEO;
        if (data.type === ObjectType.MISSILE) return SHADOW_MISSILE_GEO;
        if (data.type === ObjectType.LASER_PROJECTILE) return null;
        return SHADOW_DEFAULT_GEO; 
    }, [data.type]);

    return (
        <group ref={groupRef} position={[data.position[0], 0, data.position[2]]}>
            {data.type !== ObjectType.SHOP_PORTAL && data.type !== ObjectType.LASER_PROJECTILE && shadowGeo && (
                <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} geometry={shadowGeo}>
                    <meshBasicMaterial color="#000000" opacity={0.3} transparent />
                </mesh>
            )}

            <group ref={visualRef} position={[0, data.position[1], 0]}>
                
                {/* --- SHOP PORTAL --- */}
                {data.type === ObjectType.SHOP_PORTAL && (
                    <group>
                         <mesh position={[0, 3, 0]} geometry={SHOP_FRAME_GEO} scale={[laneCount * LANE_WIDTH + 2, 1, 1]}>
                             <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
                         </mesh>
                         <mesh position={[0, 2, 0]} geometry={SHOP_BACK_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
                              <meshBasicMaterial color="#000000" />
                         </mesh>
                         <mesh position={[0, 3, 0]} geometry={SHOP_OUTLINE_GEO} scale={[laneCount * LANE_WIDTH + 2.2, 1, 1]}>
                             <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.3} />
                         </mesh>
                         <Center position={[0, 5, 0.6]}>
                             <Text3D font={FONT_URL} size={1.2} height={0.2}>
                                 CYBER SHOP
                                 <meshBasicMaterial color="#ffff00" />
                             </Text3D>
                         </Center>
                         <mesh position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]} geometry={SHOP_FLOOR_GEO} scale={[laneCount * LANE_WIDTH, 1, 1]}>
                             <meshBasicMaterial color="#00ffff" transparent opacity={0.3} />
                         </mesh>
                    </group>
                )}

                {/* --- OBSTACLE (Spikes) --- */}
                {data.type === ObjectType.OBSTACLE && (
                    <group>
                        <mesh geometry={OBSTACLE_GEOMETRY} castShadow receiveShadow>
                             <meshStandardMaterial 
                                 color="#330011"
                                 roughness={0.3} 
                                 metalness={0.8} 
                                 flatShading={true}
                              />
                        </mesh>
                        <mesh scale={[1.02, 1.02, 1.02]} geometry={OBSTACLE_GLOW_GEO}>
                             <meshBasicMaterial 
                                 color={data.color} 
                                 wireframe 
                                 transparent 
                                 opacity={0.3} 
                              />
                        </mesh>
                        <mesh position={[0, -OBSTACLE_HEIGHT/2 + 0.05, 0]} rotation={[-Math.PI/2,0,0]} geometry={OBSTACLE_RING_GEO}>
                             <meshBasicMaterial color={data.color} transparent opacity={0.4} side={THREE.DoubleSide} />
                        </mesh>
                    </group>
                )}

                {/* --- FLOATING MINE --- */}
                {data.type === ObjectType.FLOATING_MINE && (
                    <group>
                        <mesh geometry={MINE_GEO} castShadow>
                             <meshStandardMaterial color="#3a0005" roughness={0.1} metalness={0.9} />
                        </mesh>
                        <mesh scale={[1.15, 1.15, 1.15]} geometry={MINE_GEO}>
                             <meshBasicMaterial color={data.color} wireframe transparent opacity={0.25} />
                        </mesh>
                        <pointLight intensity={1.5} distance={3} color={data.color} />
                    </group>
                )}

                {/* --- ALIEN --- */}
                {data.type === ObjectType.ALIEN && (
                    <group>
                        <mesh castShadow geometry={ALIEN_BODY_GEO}>
                            <meshStandardMaterial color="#4400cc" metalness={0.8} roughness={0.2} />
                        </mesh>
                        <mesh position={[0, 0.2, 0]} geometry={ALIEN_DOME_GEO}>
                            <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} transparent opacity={0.8} />
                        </mesh>
                        <mesh position={[0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}>
                             <meshBasicMaterial color="#ff00ff" />
                        </mesh>
                        <mesh position={[-0.3, 0, 0.3]} geometry={ALIEN_EYE_GEO}>
                             <meshBasicMaterial color="#ff00ff" />
                        </mesh>
                    </group>
                )}

                {/* --- MISSILE --- */}
                {data.type === ObjectType.MISSILE && (
                    <group rotation={[Math.PI / 2, 0, 0]}>
                        <mesh geometry={MISSILE_CORE_GEO}>
                            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={4} />
                        </mesh>
                        <mesh position={[0, 1.0, 0]} geometry={MISSILE_RING_GEO}>
                            <meshBasicMaterial color="#ffff00" />
                        </mesh>
                        <mesh position={[0, 0, 0]} geometry={MISSILE_RING_GEO}>
                            <meshBasicMaterial color="#ffff00" />
                        </mesh>
                        <mesh position={[0, -1.0, 0]} geometry={MISSILE_RING_GEO}>
                            <meshBasicMaterial color="#ffff00" />
                        </mesh>
                    </group>
                )}

                {/* --- LASER PROJECTILE --- */}
                {data.type === ObjectType.LASER_PROJECTILE && (
                    <group rotation={[Math.PI / 2, 0, 0]}>
                        <mesh geometry={LASER_PROJECTILE_GEO}>
                            <meshBasicMaterial color="#00ffff" />
                        </mesh>
                        <pointLight intensity={3} distance={4} color="#00ffff" />
                    </group>
                )}

                {/* --- GEM --- */}
                {data.type === ObjectType.GEM && (
                    <mesh castShadow geometry={GEM_GEOMETRY}>
                        <meshStandardMaterial 
                            color={data.color} 
                            roughness={0} 
                            metalness={1} 
                            emissive={data.color} 
                            emissiveIntensity={2} 
                        />
                    </mesh>
                )}
                
                {/* --- HEALTH PACK (Cross Symbol) --- */}
                {data.type === ObjectType.HEALTH_PACK && (
                    <group>
                         <mesh castShadow geometry={CROSS_VERT_GEO}>
                             <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1} />
                         </mesh>
                         <mesh castShadow geometry={CROSS_HORIZ_GEO}>
                             <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1} />
                         </mesh>
                         <pointLight intensity={1.5} distance={3} color={data.color} />
                    </group>
                )}

                {/* --- TURBO BOOST (Lightning / Cone) --- */}
                {data.type === ObjectType.TURBO_BOOST && (
                    <group>
                         <mesh castShadow geometry={LIGHTNING_GEO}>
                              <meshStandardMaterial color={data.color} roughness={0.1} metalness={0.9} emissive={data.color} emissiveIntensity={1.5} />
                         </mesh>
                         <mesh castShadow position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]} geometry={LIGHTNING_GEO}>
                              <meshStandardMaterial color={data.color} roughness={0.1} metalness={0.9} emissive={data.color} emissiveIntensity={1.5} />
                         </mesh>
                         <pointLight intensity={2} distance={4} color={data.color} />
                    </group>
                )}

                {/* --- SHIELD (Golden wireframe orb) --- */}
                {data.type === ObjectType.SHIELD && (
                    <group>
                         <mesh castShadow geometry={SHIELD_PICKUP_GEO}>
                              <meshStandardMaterial color={data.color} roughness={0.2} metalness={0.8} />
                         </mesh>
                         <mesh scale={[1.4, 1.4, 1.4]} geometry={SHIELD_PICKUP_GEO}>
                              <meshBasicMaterial color={data.color} wireframe transparent opacity={0.4} />
                         </mesh>
                         <pointLight intensity={2} distance={4} color={data.color} />
                    </group>
                )}

                {/* --- DOUBLE JUMP UPGRADE (Chevron wings) --- */}
                {data.type === ObjectType.DOUBLE_JUMP_UPGRADE && (
                    <group>
                         <mesh castShadow geometry={WINGS_GEO} position={[-0.2, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
                              <meshStandardMaterial color={data.color} roughness={0.2} metalness={0.8} />
                         </mesh>
                         <mesh castShadow geometry={WINGS_GEO} position={[0.2, 0, 0]} rotation={[0, Math.PI, -Math.PI / 4]}>
                              <meshStandardMaterial color={data.color} roughness={0.2} metalness={0.8} />
                         </mesh>
                         <pointLight intensity={1.5} distance={3} color={data.color} />
                    </group>
                )}

                {/* --- BLASTER UPGRADE (Green laser rifle barrel) --- */}
                {data.type === ObjectType.BLASTER_UPGRADE && (
                    <group rotation={[Math.PI / 2, 0, 0]}>
                         <mesh castShadow geometry={BLASTER_PICKUP_GEO} position={[-0.1, 0, 0]}>
                              <meshStandardMaterial color={data.color} roughness={0.1} metalness={0.9} />
                         </mesh>
                         <mesh castShadow geometry={BLASTER_PICKUP_GEO} position={[0.1, 0, 0]}>
                              <meshStandardMaterial color={data.color} roughness={0.1} metalness={0.9} />
                         </mesh>
                         <pointLight intensity={1.5} distance={3} color={data.color} />
                    </group>
                )}

                {/* ─────────────────────────────────────────────────────────── */}
                {/* ──────────── 5 NEW POWER PICKUPS ────────────────────────── */}
                {/* ─────────────────────────────────────────────────────────── */}

                {/* --- GEM MAGNET (Horseshoe magnet) --- */}
                {data.type === ObjectType.MAGNET_UPGRADE && (
                    <group>
                        {/* Arc */}
                        <mesh castShadow geometry={MAGNET_ARC_GEO} rotation={[0, 0, 0]}>
                            <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.2} metalness={0.9} roughness={0.1} />
                        </mesh>
                        {/* Red tip left */}
                        <mesh castShadow geometry={MAGNET_TIP_GEO} position={[-0.22, -0.01, 0]}>
                            <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={2} />
                        </mesh>
                        {/* Blue tip right */}
                        <mesh castShadow geometry={MAGNET_TIP_GEO} position={[0.22, -0.01, 0]}>
                            <meshStandardMaterial color="#2222ff" emissive="#0044ff" emissiveIntensity={2} />
                        </mesh>
                        <pointLight intensity={2.5} distance={4} color={data.color} />
                    </group>
                )}

                {/* --- SHOCKWAVE CORE (Concentric pulsing octahedra) --- */}
                {data.type === ObjectType.SHOCKWAVE_CHARGE && (
                    <group>
                        <mesh castShadow geometry={SHOCK_INNER_GEO}>
                            <meshStandardMaterial color="#ffffff" emissive={data.color} emissiveIntensity={3} metalness={1} roughness={0} />
                        </mesh>
                        <mesh scale={[1.0, 1.0, 1.0]} geometry={SHOCK_OUTER_GEO}>
                            <meshBasicMaterial color={data.color} wireframe transparent opacity={0.55} />
                        </mesh>
                        <pointLight intensity={3} distance={5} color={data.color} />
                    </group>
                )}

                {/* --- SLOW MOTION (Hourglass — two cones tip-to-tip) --- */}
                {data.type === ObjectType.SLOW_MO && (
                    <group>
                        {/* Top cone */}
                        <mesh castShadow geometry={SLOW_CONE_GEO} position={[0, 0.14, 0]}>
                            <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.0} roughness={0.2} metalness={0.7} />
                        </mesh>
                        {/* Bottom cone (flipped) */}
                        <mesh castShadow geometry={SLOW_CONE_GEO} position={[0, -0.14, 0]} rotation={[Math.PI, 0, 0]}>
                            <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.0} roughness={0.2} metalness={0.7} />
                        </mesh>
                        {/* Wireframe overlay */}
                        <mesh geometry={SLOW_CONE_GEO} scale={[1.05, 1.05, 1.05]} position={[0, 0.14, 0]}>
                            <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.25} />
                        </mesh>
                        <pointLight intensity={2} distance={4} color={data.color} />
                    </group>
                )}

                {/* --- JETPACK FLIGHT (Miniature rocket) --- */}
                {data.type === ObjectType.FLIGHT && (
                    <group>
                        {/* Main body */}
                        <mesh castShadow geometry={FLIGHT_BODY_GEO}>
                            <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.9} />
                        </mesh>
                        {/* Nose cone */}
                        <mesh castShadow geometry={FLIGHT_NOSE_GEO} position={[0, 0.365, 0]}>
                            <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={0.8} roughness={0.2} metalness={0.8} />
                        </mesh>
                        {/* Left nozzle */}
                        <mesh castShadow geometry={FLIGHT_NOZZLE_GEO} position={[-0.12, -0.35, 0]} rotation={[Math.PI, 0, 0]}>
                            <meshStandardMaterial color="#ff6600" emissive="#ff3300" emissiveIntensity={2} />
                        </mesh>
                        {/* Right nozzle */}
                        <mesh castShadow geometry={FLIGHT_NOZZLE_GEO} position={[0.12, -0.35, 0]} rotation={[Math.PI, 0, 0]}>
                            <meshStandardMaterial color="#ff6600" emissive="#ff3300" emissiveIntensity={2} />
                        </mesh>
                        <pointLight intensity={2.5} distance={4} color={data.color} />
                        <pointLight intensity={1.5} distance={2} color="#ff6600" position={[0, -0.4, 0]} />
                    </group>
                )}

                {/* --- SCORE MULTIPLIER (Golden star with accent ring) --- */}
                {data.type === ObjectType.MULTIPLIER && (
                    <group>
                        <mesh castShadow geometry={MULT_STAR_GEO}>
                            <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={1.5} roughness={0.1} metalness={0.9} />
                        </mesh>
                        <mesh geometry={MULT_RING_GEO} rotation={[Math.PI / 2, 0, 0]}>
                            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
                        </mesh>
                        {/* "3×" wireframe shell */}
                        <mesh scale={[1.2, 1.2, 1.2]} geometry={MULT_STAR_GEO}>
                            <meshBasicMaterial color={data.color} wireframe transparent opacity={0.2} />
                        </mesh>
                        <pointLight intensity={3} distance={5} color={data.color} />
                    </group>
                )}

            </group>
        </group>
    );
});
