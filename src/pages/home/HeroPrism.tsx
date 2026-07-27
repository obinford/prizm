import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Hero prism WebGL scene (the only WebGL scene on the site).
 * Glass triangular prism slowly rotating; white beam enters left,
 * five spectrum rays fan out right. Subtle mouse parallax (±6°).
 */

const SPECTRUM = ['#8B5CF6', '#22D3EE', '#2DD4BF', '#FBBF24', '#F472B6']

function Prism() {
  const geo = useMemo(() => new THREE.CylinderGeometry(1.05, 1.05, 1.7, 3, 1), [])
  return (
    <mesh geometry={geo} rotation={[Math.PI / 2, 0, Math.PI / 6]}>
      <meshPhysicalMaterial
        transmission={1}
        thickness={1.4}
        roughness={0.06}
        ior={1.52}
        clearcoat={1}
        clearcoatRoughness={0.08}
        attenuationColor="#a0b8ff"
        attenuationDistance={2.5}
        color="#dfe6ff"
        transparent
      />
    </mesh>
  )
}

function Beam() {
  // White beam entering from the left
  return (
    <group>
      <mesh position={[-3.4, 0.55, 0]} rotation={[0, 0, Math.PI / 2 + 0.16]}>
        <cylinderGeometry args={[0.022, 0.022, 4.6, 8]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[-1.35, 0.28, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

function Rays() {
  // Five additive-blend fan rays exiting right in spectrum hues
  return (
    <group>
      {SPECTRUM.map((c, i) => {
        const spread = (i - 2) * 0.16
        return (
          <mesh
            key={c}
            position={[3.1, 0.28 + spread * 1.9, 0]}
            rotation={[0, 0, Math.PI / 2 - spread]}
          >
            <cylinderGeometry args={[0.016, 0.03, 4.4, 8]} />
            <meshBasicMaterial
              color={c}
              toneMapped={false}
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function SceneRig() {
  const group = useRef<THREE.Group>(null)
  const target = useRef({ x: 0, y: 0 })

  useFrame((state, delta) => {
    if (!group.current) return
    // slow perpetual rotation
    group.current.rotation.y += delta * 0.05
    // mouse parallax ±6° (lerped)
    const px = state.pointer.x
    const py = state.pointer.y
    target.current.x = py * (Math.PI / 30)
    target.current.y = px * (Math.PI / 30)
    group.current.rotation.x += (target.current.x - group.current.rotation.x) * 0.06
    group.current.rotation.z += (target.current.y * 0.4 - group.current.rotation.z) * 0.06
  })

  return (
    <group ref={group}>
      <Prism />
      <Beam />
      <Rays />
    </group>
  )
}

export default function HeroPrism() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 6.4], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.25} />
      <pointLight position={[-4, 3, 4]} intensity={12} color="#ffffff" />
      <pointLight position={[5, -2, 3]} intensity={8} color="#6366F1" />
      <SceneRig />
      <Environment resolution={128}>
        <Lightformer intensity={1.4} position={[0, 4, 2]} scale={[6, 1, 1]} color="#ffffff" />
        <Lightformer intensity={0.9} position={[-5, 0, 1]} scale={[1, 4, 1]} color="#8B5CF6" />
        <Lightformer intensity={0.9} position={[5, 0, 1]} scale={[1, 4, 1]} color="#22D3EE" />
      </Environment>
    </Canvas>
  )
}
