"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import {
  Bounds,
  Center,
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  useProgress,
} from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";
import { Loader2, Maximize2, Minimize2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  computeMeshMetricsFromBufferGeometry,
  type MeshMetrics,
} from "@/lib/mesh-metrics";

const MATERIAL_PRESETS = [
  { id: "studio", label: "Stüdyo", color: "#7dd3fc", metalness: 0.15, roughness: 0.35 },
  { id: "matte", label: "Mat", color: "#a1a1aa", metalness: 0.05, roughness: 0.85 },
  { id: "nylon", label: "Naylon", color: "#f4f4f5", metalness: 0.1, roughness: 0.45 },
  { id: "carbon", label: "Karbon", color: "#27272a", metalness: 0.55, roughness: 0.25 },
  { id: "resin", label: "Reçine", color: "#c4b5fd", metalness: 0.2, roughness: 0.2 },
] as const;

export interface StlViewerProps {
  url: string;
  className?: string;
  showToolbar?: boolean;
  onMetrics?: (metrics: MeshMetrics) => void;
}

class StlViewerErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { error: boolean }
> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("STL viewer:", err, info);
  }

  render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}

function SceneLoader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2 rounded-xl bg-zinc-950/90 px-4 py-3 text-xs text-zinc-300 ring-1 ring-zinc-700/50">
        <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
        STL yükleniyor… {Math.round(progress)}%
      </div>
    </Html>
  );
}

function StlMesh({
  url,
  presetId,
  onMetrics,
}: {
  url: string;
  presetId: (typeof MATERIAL_PRESETS)[number]["id"];
  onMetrics?: (metrics: MeshMetrics) => void;
}) {
  const geometry = useLoader(STLLoader, url);
  const preset = MATERIAL_PRESETS.find((p) => p.id === presetId) ?? MATERIAL_PRESETS[0];

  const prepared = useMemo(() => {
    const g = geometry.clone();
    g.center();
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }, [geometry]);

  useEffect(() => {
    if (!onMetrics) return;
    onMetrics(computeMeshMetricsFromBufferGeometry(prepared));
  }, [prepared, onMetrics]);

  return (
    <Center>
      <mesh geometry={prepared} castShadow receiveShadow>
        <meshStandardMaterial
          color={preset.color}
          metalness={preset.metalness}
          roughness={preset.roughness}
          envMapIntensity={0.9}
        />
      </mesh>
    </Center>
  );
}

function StlScene({
  url,
  presetId,
  onMetrics,
}: {
  url: string;
  presetId: (typeof MATERIAL_PRESETS)[number]["id"];
  onMetrics?: (metrics: MeshMetrics) => void;
}) {
  return (
    <>
      <color attach="background" args={["#0c0c0f"]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
      <Environment preset="studio" />
      <Bounds fit clip observe margin={1.25}>
        <Suspense fallback={<SceneLoader />}>
          <StlMesh url={url} presetId={presetId} onMetrics={onMetrics} />
        </Suspense>
      </Bounds>
      <ContactShadows
        position={[0, -0.08, 0]}
        opacity={0.55}
        scale={12}
        blur={2.5}
        far={4}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial transparent opacity={0.25} />
      </mesh>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.5}
        maxDistance={500}
        maxPolarAngle={Math.PI * 0.48}
      />
    </>
  );
}

export function StlViewer({
  url,
  className,
  showToolbar = true,
  onMetrics,
}: StlViewerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [presetId, setPresetId] = useState<(typeof MATERIAL_PRESETS)[number]["id"]>("studio");
  const [fullscreen, setFullscreen] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const handleMetrics = useCallback(
    (m: MeshMetrics) => {
      setMetricsLoading(false);
      onMetrics?.(m);
    },
    [onMetrics]
  );

  useEffect(() => {
    setMetricsLoading(true);
  }, [url]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-zinc-950/60 text-sm text-zinc-500 ${className ?? "h-[300px]"}`}
      >
        Model URL yok
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className={`stl-viewer-shell relative overflow-hidden rounded-xl bg-[#0c0c0f] ring-1 ring-zinc-800/80 ${className ?? "h-[320px]"}`}
    >
      <StlViewerErrorBoundary
        fallback={
          <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-red-400/90">
            STL yüklenemedi
          </div>
        }
      >
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          camera={{ fov: 42, near: 0.01, far: 2000, position: [2, 1.5, 2.5] }}
          className="!h-full !w-full"
        >
          <StlScene url={url} presetId={presetId} onMetrics={handleMetrics} />
        </Canvas>
      </StlViewerErrorBoundary>

      {metricsLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-zinc-950/40">
          <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
        </div>
      )}

      {showToolbar && (
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-zinc-950/75 p-1 ring-1 ring-zinc-700/40 backdrop-blur-sm">
            <Palette className="mx-1 hidden h-4 w-4 self-center text-zinc-500 sm:block" />
            {MATERIAL_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.label}
                onClick={() => setPresetId(p.id)}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                  presetId === p.id
                    ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 bg-zinc-950/75 ring-1 ring-zinc-700/40 backdrop-blur-sm"
            onClick={toggleFullscreen}
            title={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
