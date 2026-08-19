/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../store';
import { LANE_WIDTH, GameStatus, FLIGHT_Y } from '../../types';
import { audio } from '../System/Audio';

// Physics Constants
const GRAVITY = 50;
const JUMP_FORCE = 16; // Results in ~2.56 height (v^2 / 2g)

// Static Geometries
const TORSO_GEO = new THREE.CylinderGeometry(0.25, 0.15, 0.6, 4);
const JETPACK_GEO = new THREE.BoxGeometry(0.3, 0.4, 0.15);
const GLOW_STRIP_GEO = new THREE.PlaneGeometry(0.05, 0.2);
const HEAD_GEO = new THREE.BoxGeometry(0.25, 0.3, 0.3);
const ARM_GEO = new THREE.BoxGeometry(0.12, 0.6, 0.12);
const JOINT_SPHERE_GEO = new THREE.SphereGeometry(0.07);
const HIPS_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.2);
const LEG_GEO = new THREE.BoxGeometry(0.15, 0.7, 0.15);
const SHADOW_GEO = new THREE.CircleGeometry(0.5, 32);

export const Player: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  
  // Limb Refs for Animation
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  // Drone Ref
  const droneRef = useRef<THREE.Group>(null);

  const { 
    status, 
    laneCount, 
    takeDamage, 
    hasDoubleJump, 
    isShieldActive, 
    isTurboActive, 
    isBlasterActive,
    isFlightActive
  } = useStore();
  
  const [lane, setLane] = React.useState(0);
  const targetX = useRef(0);
  
  // Physics State (using Refs for immediate logic updates)
  const isJumping = useRef(false);
  const velocityY = useRef(0);
  const jumpsPerformed = useRef(0); 
  const spinRotation = useRef(0); // For double jump flip

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const isInvincible = useRef(false);
  const lastDamageTime = useRef(0);
  const wasFlying = useRef(false);

  // Memoized Materials
  const { armorMaterial, jointMaterial, glowMaterial, shadowMaterial } = useMemo(() => {
      let armorColor = '#00aaff'; // Base blue
      let glowColor = '#00ffff';  // Base cyan
      
      if (isTurboActive) {
          armorColor = '#ff3c00'; // Turbo orange-red
          glowColor = '#ffbb00';  // Turbo gold-yellow
      } else if (isShieldActive) {
          armorColor = '#ffd700'; // Shield gold
          glowColor = '#ffffff';  // Shield white
      }
      
      return {
          armorMaterial: new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.3, metalness: 0.8 }),
          jointMaterial: new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.7, metalness: 0.5 }),
          glowMaterial: new THREE.MeshBasicMaterial({ color: glowColor }),
          shadowMaterial: new THREE.MeshBasicMaterial({ color: '#000000', opacity: 0.3, transparent: true })
      };
  }, [isShieldActive, isTurboActive]);

  // --- Reset State on Game Start ---
  useEffect(() => {
      if (status === GameStatus.PLAYING) {
          isJumping.current = false;
          jumpsPerformed.current = 0;
          velocityY.current = 0;
          spinRotation.current = 0;
          wasFlying.current = false;
          setLane(0);
          if (groupRef.current) {
              groupRef.current.position.y = 0;
              groupRef.current.position.x = 0;
          }
          if (bodyRef.current) bodyRef.current.rotation.x = 0;
      }
  }, [status]);
  
  // Safety: Clamp lane if laneCount changes (e.g. restart)
  useEffect(() => {
      const maxLane = Math.floor(laneCount / 2);
      if (Math.abs(lane) > maxLane) {
          setLane(l => Math.max(Math.min(l, maxLane), -maxLane));
      }
  }, [laneCount, lane]);

  // --- Controls (Keyboard & Touch) ---
  const triggerJump = () => {
    if (isFlightActive) return; // No jumping during flight
    
    const maxJumps = hasDoubleJump ? 2 : 1;

    if (!isJumping.current) {
        // First Jump
        audio.playJump(false);
        isJumping.current = true;
        jumpsPerformed.current = 1;
        velocityY.current = JUMP_FORCE;
    } else if (jumpsPerformed.current < maxJumps) {
        // Double Jump (Mid-air)
        audio.playJump(true);
        jumpsPerformed.current += 1;
        velocityY.current = JUMP_FORCE; // Reset velocity upwards
        spinRotation.current = 0; // Start flip
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== GameStatus.PLAYING) return;
      if (isFlightActive) {
        // Only allow lane changes during flight
        const maxLane = Math.floor(laneCount / 2);
        if (e.key === 'ArrowLeft') setLane(l => Math.max(l - 1, -maxLane));
        else if (e.key === 'ArrowRight') setLane(l => Math.min(l + 1, maxLane));
        return;
      }
      const maxLane = Math.floor(laneCount / 2);

      if (e.key === 'ArrowLeft') setLane(l => Math.max(l - 1, -maxLane));
      else if (e.key === 'ArrowRight') setLane(l => Math.min(l + 1, maxLane));
      else if (e.key === 'ArrowUp' || e.key === 'w') triggerJump();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, laneCount, hasDoubleJump, isFlightActive]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
        if (status !== GameStatus.PLAYING) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        const maxLane = Math.floor(laneCount / 2);

        // Swipe Detection
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
             if (deltaX > 0) setLane(l => Math.min(l + 1, maxLane));
             else setLane(l => Math.max(l - 1, -maxLane));
        } else if (!isFlightActive && Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -30) {
             triggerJump();
        }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [status, laneCount, hasDoubleJump, isFlightActive]);

  // --- Animation Loop ---
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    if (status !== GameStatus.PLAYING && status !== GameStatus.SHOP) return;

    const safeDelta = Math.min(delta, 0.05);

    // 1. Horizontal Position
    targetX.current = lane * LANE_WIDTH;
    groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x, 
        targetX.current, 
        safeDelta * 15 
    );

    // Flight Mode Handling
    const targetFlightY = isFlightActive ? FLIGHT_Y : 0;
    const currentlyFlying = isFlightActive;
    
    // Detect flight state transitions
    if (currentlyFlying !== wasFlying.current) {
        wasFlying.current = currentlyFlying;
        // Reset jump state when entering/exiting flight
        isJumping.current = false;
        jumpsPerformed.current = 0;
        velocityY.current = 0;
        if (bodyRef.current) bodyRef.current.rotation.x = 0;
    }

    // 2. Physics (Jump) - Only when not flying
    if (!isFlightActive) {
        if (isJumping.current) {
            // Apply Velocity
            groupRef.current.position.y += velocityY.current * safeDelta;
            // Apply Gravity
            velocityY.current -= GRAVITY * safeDelta;

            // Floor Collision
            if (groupRef.current.position.y <= 0) {
                groupRef.current.position.y = 0;
                isJumping.current = false;
                jumpsPerformed.current = 0;
                velocityY.current = 0;
                // Reset flip
                if (bodyRef.current) bodyRef.current.rotation.x = 0;
            }

            // Double Jump Flip
            if (jumpsPerformed.current === 2 && bodyRef.current) {
                 // Rotate 360 degrees quickly
                 spinRotation.current -= safeDelta * 15;
                 if (spinRotation.current < -Math.PI * 2) spinRotation.current = -Math.PI * 2;
                 bodyRef.current.rotation.x = spinRotation.current;
            }
        }
    } else {
        // Flight mode: smoothly move to/from flight altitude
        groupRef.current.position.y = THREE.MathUtils.lerp(
            groupRef.current.position.y,
            targetFlightY,
            safeDelta * 8
        );
    }

    // Banking Rotation
    const xDiff = targetX.current - groupRef.current.position.x;
    groupRef.current.rotation.z = -xDiff * 0.2; 
    groupRef.current.rotation.x = isJumping.current ? 0.1 : (isFlightActive ? -0.15 : 0.05); 

    // 3. Skeletal Animation
    const time = state.clock.elapsedTime * 25; 
    
    if (!isJumping.current && !isFlightActive) {
        // Running Cycle
        if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time) * 0.7;
        if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.7;
        if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time + Math.PI) * 1.0;
        if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time) * 1.0;
        
        if (bodyRef.current) bodyRef.current.position.y = 1.1 + Math.abs(Math.sin(time)) * 0.1;
    } else if (isFlightActive) {
        // Flight pose - arms back, legs down
        const flightPoseSpeed = safeDelta * 5;
        if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -1.8, flightPoseSpeed);
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -1.8, flightPoseSpeed);
        if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, -0.3, flightPoseSpeed);
        if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.3, flightPoseSpeed);
        
        if (bodyRef.current) bodyRef.current.position.y = 1.1;
    } else {
        // Jumping Pose
        const jumpPoseSpeed = safeDelta * 10;
        if (leftArmRef.current) leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -2.5, jumpPoseSpeed);
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -2.5, jumpPoseSpeed);
        if (leftLegRef.current) leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.5, jumpPoseSpeed);
        if (rightLegRef.current) rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.5, jumpPoseSpeed);
        
        if (bodyRef.current && jumpsPerformed.current !== 2) bodyRef.current.position.y = 1.1; 
    }

    // 4. Dynamic Shadow
    if (shadowRef.current) {
        const height = groupRef.current.position.y;
        const maxHeight = isFlightActive ? FLIGHT_Y : 2.5;
        const scale = Math.max(0.15, 1 - (height / maxHeight) * 0.6);
        const runStretch = (isJumping.current || isFlightActive) ? 1 : 1 + Math.abs(Math.sin(time)) * 0.3;

        shadowRef.current.scale.set(scale, scale, scale * runStretch);
        const material = shadowRef.current.material as THREE.MeshBasicMaterial;
        if (material && !Array.isArray(material)) {
            material.opacity = Math.max(0.05, 0.3 - (height / maxHeight) * 0.25);
        }
    }

    // 5. Blaster Drone Companion Animation
    if (isBlasterActive && droneRef.current) {
        // Drone floats next to the player's head, bobbing dynamically
        droneRef.current.position.y = 1.6 + Math.sin(state.clock.elapsedTime * 6) * 0.12;
        droneRef.current.position.x = 0.8 + Math.cos(state.clock.elapsedTime * 3) * 0.05;
        droneRef.current.position.z = -0.2;
        droneRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }

    // 6. Turbo trail particle sparks
    if (isTurboActive && Math.random() < 0.25) {
        const pWorld = new THREE.Vector3();
        groupRef.current.getWorldPosition(pWorld);
        window.dispatchEvent(new CustomEvent('particle-burst', { 
           detail: { 
               position: [pWorld.x + (Math.random()-0.5)*0.4, pWorld.y + 0.3, pWorld.z + 0.6], 
               color: '#ff6600' 
           } 
        }));
    }

    // 7. Damage Flicker
    const showFlicker = isInvincible.current || isShieldActive || isTurboActive;
    if (showFlicker) {
        if (isInvincible.current && !isShieldActive && !isTurboActive) {
             if (Date.now() - lastDamageTime.current > 1500) {
                 isInvincible.current = false;
                 groupRef.current.visible = true;
             } else {
                 groupRef.current.visible = Math.floor(Date.now() / 50) % 2 === 0;
             }
        } else {
             groupRef.current.visible = true; 
        }
    } else {
        groupRef.current.visible = true;
    }
  });

  // Damage Handler
  useEffect(() => {
     const checkHit = () => {
        if (isInvincible.current || isShieldActive || isTurboActive) return;
        audio.playDamage();
        takeDamage();
        isInvincible.current = true;
        lastDamageTime.current = Date.now();
     };
     window.addEventListener('player-hit', checkHit);
     return () => window.removeEventListener('player-hit', checkHit);
  }, [takeDamage, isShieldActive, isTurboActive]);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <group ref={bodyRef} position={[0, 1.1, 0]}> 
        
        {/* Torso */}
        <mesh castShadow position={[0, 0.2, 0]} geometry={TORSO_GEO} material={armorMaterial} />

        {/* Jetpack */}
        <mesh position={[0, 0.2, -0.2]} geometry={JETPACK_GEO} material={jointMaterial} />
        <mesh position={[-0.08, 0.1, -0.28]} geometry={GLOW_STRIP_GEO} material={glowMaterial} />
        <mesh position={[0.08, 0.1, -0.28]} geometry={GLOW_STRIP_GEO} material={glowMaterial} />

        {/* Head */}
        <group ref={headRef} position={[0, 0.6, 0]}>
            <mesh castShadow geometry={HEAD_GEO} material={armorMaterial} />
        </group>

        {/* Arms */}
        <group position={[0.32, 0.4, 0]}>
            <group ref={rightArmRef}>
                <mesh position={[0, -0.25, 0]} castShadow geometry={ARM_GEO} material={armorMaterial} />
                <mesh position={[0, -0.55, 0]} geometry={JOINT_SPHERE_GEO} material={glowMaterial} />
            </group>
        </group>
        <group position={[-0.32, 0.4, 0]}>
            <group ref={leftArmRef}>
                 <mesh position={[0, -0.25, 0]} castShadow geometry={ARM_GEO} material={armorMaterial} />
                 <mesh position={[0, -0.55, 0]} geometry={JOINT_SPHERE_GEO} material={glowMaterial} />
            </group>
        </group>

        {/* Hips */}
        <mesh position={[0, -0.15, 0]} geometry={HIPS_GEO} material={jointMaterial} />

        {/* Legs */}
        <group position={[0.12, -0.25, 0]}>
            <group ref={rightLegRef}>
                 <mesh position={[0, -0.35, 0]} castShadow geometry={LEG_GEO} material={armorMaterial} />
            </group>
        </group>
        <group position={[-0.12, -0.25, 0]}>
            <group ref={leftLegRef}>
                 <mesh position={[0, -0.35, 0]} castShadow geometry={LEG_GEO} material={armorMaterial} />
            </group>
        </group>

        {/* Drone Companion */}
        {isBlasterActive && (
          <group ref={droneRef} position={[0.8, 0.5, -0.2]}>
             {/* Drone body */}
             <mesh castShadow>
                 <dodecahedronGeometry args={[0.15]} />
                 <meshStandardMaterial color="#00e676" roughness={0.1} metalness={0.9} />
             </mesh>
             {/* Glowing eye */}
             <mesh position={[0, 0, 0.12]}>
                 <sphereGeometry args={[0.04, 8, 8]} />
                 <meshBasicMaterial color="#00ffcc" />
             </mesh>
             {/* Miniature thruster light */}
             <pointLight intensity={2} distance={2} color="#00ffcc" />
          </group>
        )}
      </group>

      {/* Shield Bubble */}
      {isShieldActive && (
         <mesh position={[0, 1.1, 0]}>
             <sphereGeometry args={[1.3, 18, 18]} />
             <meshBasicMaterial 
                 color="#00ffff" 
                 wireframe 
                 transparent 
                 opacity={0.35} 
                 depthWrite={false}
             />
         </mesh>
      )}
      
      <mesh ref={shadowRef} position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} geometry={SHADOW_GEO} material={shadowMaterial} />
    </group>
  );
};