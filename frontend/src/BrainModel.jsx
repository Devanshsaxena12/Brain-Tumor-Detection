import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Center, View } from '@react-three/drei';
import * as THREE from 'three';


export default function BrainModel({ diagnosis, tumorLocation, onHotspotClick, phase, renderMode, isSpatialExpanded }) {
  const pointsRef = useRef();
  const groupRef = useRef();
  const headGroupRef = useRef();
  const brainOffsetRef = useRef(new THREE.Vector3(0, 0, 0));
  const splitXRef = useRef(0);
  const particleCount = 120000;
  
  // 1. Dynamic Tumor Positioning Logic
  const tumorCoords = useMemo(() => {
    if (!tumorLocation || diagnosis === 'No Tumor') return null;
    
    const tx = (tumorLocation.x - 0.5) * 5.2; // Map 0-1 to brain width
    const ty = (0.5 - tumorLocation.y) * 3.6; // Map 0-1 to brain height (inverted Y)
    
    // Heuristic for depth (Z-axis) based on pathology
    let tz = 0;
    if (diagnosis === 'Pituitary') tz = 0.8;
    else if (diagnosis === 'Meningioma') tz = -2.2;
    else if (diagnosis === 'Glioma') tz = 0.5;
    
    return [tx, ty, tz];
  }, [tumorLocation, diagnosis]);

  const tumorLightPos = useMemo(() => {
    return tumorCoords || null;
  }, [tumorCoords]);

  // 2. Main Brain Points Generation
  const { currentPositions, targetPositions, chaosPositions, colors, baseColors } = useMemo(() => {
    const cp = new Float32Array(particleCount * 3);
    const tp = new Float32Array(particleCount * 3);
    const currP = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const baseColors = new Float32Array(particleCount * 3); 
    const baseColorBrain = new THREE.Color('#00f2ff'); 
    const targetColor = new THREE.Color('#ff3366');

    for (let i = 0; i < particleCount; i++) {
       const isCerebellum = i >= 100000;
       let tx, ty, tz, r;
       const theta = Math.random() * Math.PI * 2;
       const phi = Math.acos(Math.random() * 2 - 1);

       if (isCerebellum) {
           r = Math.pow(Math.random(), 1/4); 
           tx = r * Math.sin(phi) * Math.cos(theta) * 2.2; 
           ty = r * Math.sin(phi) * Math.sin(theta) * 1.2 - 2.2; 
           tz = r * Math.cos(phi) * 1.8 - 2.0; 
           const wrinkle = 1.0 + 0.03 * Math.sin(theta * 50) * Math.cos(phi * 50);
           tx *= wrinkle; ty *= wrinkle; tz *= wrinkle;
       } else {
           r = Math.pow(Math.random(), 1/12); 
           tx = r * Math.sin(phi) * Math.cos(theta);
           ty = r * Math.sin(phi) * Math.sin(theta); 
           tz = r * Math.cos(phi); 
           if (Math.abs(tx) < 0.2) { tx = tx > 0 ? tx + 0.2 : tx - 0.2; }
           let widthTaper = tz > 0 ? (2.2 - tz * 0.4) : 2.6; 
           if (ty < 0 && Math.abs(tz) < 1.0) { widthTaper += 0.4; } 
           tx *= widthTaper;
           ty *= 1.8; 
           tz *= 3.0; 
           const wrinkle = 1.0 + 0.04 * Math.sin(theta * 20) * Math.cos(phi * 30);
           tx *= wrinkle; ty *= wrinkle; tz *= wrinkle;
           const tilt = 0.12; 
           const tempY = ty * Math.cos(tilt) - tz * Math.sin(tilt);
           const tempZ = ty * Math.sin(tilt) + tz * Math.cos(tilt);
           ty = tempY; tz = tempZ;
       }
       
       tp[i * 3] = tx;
       tp[i * 3 + 1] = ty;
       tp[i * 3 + 2] = tz;
       const spread = 60.0;
       cp[i * 3] = (Math.random() - 0.5) * spread; 
       cp[i * 3 + 1] = (Math.random() - 0.5) * spread;
       cp[i * 3 + 2] = (Math.random() - 0.5) * spread;
       currP[i * 3] = (Math.random() - 0.5) * 0.1;
       currP[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
       currP[i * 3 + 2] = (Math.random() - 0.5) * 0.1;

       let activeBaseColor = baseColorBrain.clone();
       const lighting = isCerebellum ? 0.18 + Math.random() * 0.15 : 0.25 + Math.random() * 0.35;
       activeBaseColor.multiplyScalar(lighting);
       baseColors[i * 3] = activeBaseColor.r;
       baseColors[i * 3 + 1] = activeBaseColor.g;
       baseColors[i * 3 + 2] = activeBaseColor.b;

       let c = activeBaseColor.clone();
       const dist = Math.sqrt(tx*tx + ty*ty + tz*tz);
       if (diagnosis === 'Meningioma') {
           if (dist > 2.2) { c = targetColor.clone(); c.multiplyScalar(0.8 + Math.random() * 0.5); }
       } else if (diagnosis === 'Pituitary') {
           if (dist < 1.0 && ty < -0.4 && tz > 0) { c = targetColor.clone(); c.multiplyScalar(1.2 + Math.random() * 0.5); }
       } else if (diagnosis === 'Glioma') {
           if (tx > 0.4 && ty > 0.2 && tz < 1.0 && dist > 1.0 && dist < 2.0) { c = targetColor.clone(); c.multiplyScalar(0.8 + Math.random() * 0.5); }
       }
       colors[i * 3] = c.r;
       colors[i * 3 + 1] = c.g;
       colors[i * 3 + 2] = c.b;
    }
    return { currentPositions: currP, targetPositions: tp, chaosPositions: cp, colors, baseColors };
  }, [diagnosis]);

  // 3. Dedicated Tumor Dots Generation
  const tumorParticles = useMemo(() => {
    const count = 1500;
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const red = new THREE.Color('#ff0033'); // Bright Clinical Red

    if (tumorCoords) {
      for (let i = 0; i < count; i++) {
        const r = Math.pow(Math.random(), 0.5) * 0.5; // Dense core
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        pos[i * 3] = tumorCoords[0] + r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = tumorCoords[1] + r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = tumorCoords[2] + r * Math.cos(phi);
        cols[i * 3] = red.r;
        cols[i * 3 + 1] = red.g;
        cols[i * 3 + 2] = red.b;
      }
    }
    return { positions: pos, colors: cols };
  }, [tumorCoords]);

  const tumorPointsRef = useRef();

  useFrame((state, delta) => {
    if (!pointsRef.current || !groupRef.current) return;
    const positions = pointsRef.current.geometry.attributes.position.array;
    const colorAttr = pointsRef.current.geometry.attributes.color.array;
    const lerpFactor = (phase === 'forming' || phase === 'docked') ? 3.0 * delta : 4.5 * delta;

    const targetYOffset = 0.0;
    brainOffsetRef.current.y = THREE.MathUtils.lerp(brainOffsetRef.current.y, targetYOffset, 3.0 * delta);

    const targetXSplit = isSpatialExpanded ? 4.5 : 0.0;
    splitXRef.current = THREE.MathUtils.lerp(splitXRef.current, targetXSplit, 2.5 * delta);

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const tx = (phase === 'dispersed' ? chaosPositions[i3] : targetPositions[i3]) + splitXRef.current;
        const ty = (phase === 'dispersed' ? chaosPositions[i3+1] : targetPositions[i3+1]) + brainOffsetRef.current.y;
        const tz = phase === 'dispersed' ? chaosPositions[i3+2] : targetPositions[i3+2];
        positions[i3] = THREE.MathUtils.lerp(positions[i3], tx, lerpFactor);
        positions[i3+1] = THREE.MathUtils.lerp(positions[i3+1], ty, lerpFactor);
        positions[i3+2] = THREE.MathUtils.lerp(positions[i3+2], tz, lerpFactor);
        const cr = (phase === 'docked' && diagnosis) ? colors[i3] : baseColors[i3];
        const cg = (phase === 'docked' && diagnosis) ? colors[i3+1] : baseColors[i3+1];
        const cb = (phase === 'docked' && diagnosis) ? colors[i3+2] : baseColors[i3+2];
        colorAttr[i3] = THREE.MathUtils.lerp(colorAttr[i3], cr, lerpFactor * 2);
        colorAttr[i3+1] = THREE.MathUtils.lerp(colorAttr[i3+1], cg, lerpFactor * 2);
        colorAttr[i3+2] = THREE.MathUtils.lerp(colorAttr[i3+2], cb, lerpFactor * 2);
    }
    
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.geometry.attributes.color.needsUpdate = true;

    // Handle Tumor Dots Animation
    if (tumorPointsRef.current && tumorCoords) {
        const tPos = tumorPointsRef.current.geometry.attributes.position.array;
        for (let i = 0; i < 1500; i++) {
            const i3 = i * 3;
            // Sync with brain movement
            tPos[i3] = THREE.MathUtils.lerp(tPos[i3], tumorParticles.positions[i3] + splitXRef.current, lerpFactor * 1.5);
            tPos[i3+1] = THREE.MathUtils.lerp(tPos[i3+1], tumorParticles.positions[i3+1] + brainOffsetRef.current.y, lerpFactor * 1.5);
            tPos[i3+2] = THREE.MathUtils.lerp(tPos[i3+2], tumorParticles.positions[i3+2], lerpFactor * 1.5);
        }
        tumorPointsRef.current.geometry.attributes.position.needsUpdate = true;
        // Pulse Effect
        const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 6) * 0.15;
        tumorPointsRef.current.scale.set(pulse, pulse, pulse);
    }

    if (!isSpatialExpanded) {
      if (phase === 'forming') groupRef.current.rotation.y += delta * 6.0;
      else if (phase === 'dispersed') groupRef.current.rotation.y += delta * 1.5;
      else groupRef.current.rotation.y += delta * 0.3;

      const scalePulse = 1.0 + Math.sin(state.clock.elapsedTime * 2.5) * 0.012;
      groupRef.current.scale.set(scalePulse, scalePulse, scalePulse);
    } else {
      groupRef.current.scale.set(1, 1, 1);
    }
  });

  const BrainPoints = () => (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={currentPositions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={particleCount} array={baseColors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.010} vertexColors={true} transparent={true} opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );

  const TumorPoints = () => {
    if (!tumorCoords || phase !== 'docked') return null;
    return (
        <points 
            ref={tumorPointsRef}
            onClick={(e) => {
                e.stopPropagation();
                if (onHotspotClick && tumorLocation) {
                    onHotspotClick(tumorLocation);
                }
            }}
            onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={1500} array={tumorParticles.positions} itemSize={3} />
                <bufferAttribute attach="attributes-color" count={1500} array={tumorParticles.colors} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.065} vertexColors={true} transparent={true} opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </points>
    );
  };

  return (
    <group ref={groupRef}>
      <ambientLight intensity={1.5} />
      <pointLight position={[5, 10, 5]} intensity={1.5} />
      <pointLight position={[-5, -10, -5]} intensity={1.0} color="#00f2ff" />
      
      {tumorLightPos && phase === 'docked' && (
         <pointLight position={tumorLightPos} color="#ff0033" intensity={40.0} distance={8.0} decay={1.5} />
      )}
      
      <BrainPoints />
      <TumorPoints />

      <OrbitControls enableZoom={true} enablePan={false} enableRotate={true} autoRotate={false} minDistance={2} maxDistance={15} />
    </group>
  );
}
