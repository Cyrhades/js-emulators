import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Box } from "lucide-react";

interface AtariCartridgeViewerProps {
  modelPath?: string;
  textureDir?: string;
  customCoverUrl?: string;
  gameTitle?: string;
}

// Bounding box of green label region in model_BaseColor.png (2048x2048)
const LABEL_REGION = {
  x: 919,
  y: 75,
  width: 661,
  height: 790,
};

export const AtariCartridgeViewer: React.FC<AtariCartridgeViewerProps> = ({
  modelPath = "/emulators/atari2600/Cartridge/model_0.obj",
  textureDir = "/emulators/atari2600/Cartridge/",
  customCoverUrl,
  gameTitle = "ATARI 2600",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dynamicTextureRef = useRef<THREE.CanvasTexture | null>(null);

  // Helper to render fallback red label (#7B0E21) with white text onto a canvas context
  const renderFallbackLabel = (tempCtx: CanvasRenderingContext2D, title: string) => {
    tempCtx.save();
    const centerX = LABEL_REGION.x + LABEL_REGION.width / 2;
    const centerY = LABEL_REGION.y + LABEL_REGION.height / 2;
    tempCtx.translate(centerX, centerY);
    tempCtx.scale(1, -1); // Un-mirror orientation for UV mapping

    const width = LABEL_REGION.width;
    const height = LABEL_REGION.height;
    const halfW = width / 2;
    const halfH = height / 2;

    // 1. Retro Atari red background (#7B0E21)
    tempCtx.fillStyle = "#7B0E21";
    tempCtx.fillRect(-halfW, -halfH, width, height);

    // 2. Retro gold border accent
    tempCtx.strokeStyle = "rgba(245, 158, 11, 0.85)";
    tempCtx.lineWidth = 12;
    tempCtx.strokeRect(-halfW + 16, -halfH + 16, width - 32, height - 32);

    // Inner subtle dark border
    tempCtx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    tempCtx.lineWidth = 4;
    tempCtx.strokeRect(-halfW + 28, -halfH + 28, width - 56, height - 56);

    // 3. White bold game title text
    tempCtx.fillStyle = "#FFFFFF";
    tempCtx.textAlign = "center";
    tempCtx.textBaseline = "middle";
    tempCtx.font = "900 46px 'Outfit', 'Inter', 'Segoe UI', sans-serif";

    // Text wrapping
    const cleanTitle = (title || "ATARI 2600").toUpperCase();
    const words = cleanTitle.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = tempCtx.measureText(testLine);
      if (metrics.width > width - 70 && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = 56;
    const startY = -((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, idx) => {
      // Subtle text shadow for depth
      tempCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
      tempCtx.fillText(line, 2, startY + idx * lineHeight + 2);

      tempCtx.fillStyle = "#FFFFFF";
      tempCtx.fillText(line, 0, startY + idx * lineHeight);
    });

    tempCtx.restore();
  };

  // Chroma-key green pixel mask blending: cover/fallback never overflows outside green label
  const updateTextureWithCover = (coverUrl?: string, title?: string) => {
    const baseImg = baseImageRef.current;
    const material = materialRef.current;
    if (!baseImg || !material) return;

    if (!offscreenCanvasRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 2048;
      canvas.height = 2048;
      offscreenCanvasRef.current = canvas;
    }

    const canvas = offscreenCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const applyTextureToMaterial = () => {
      if (!dynamicTextureRef.current) {
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        dynamicTextureRef.current = tex;
      } else {
        dynamicTextureRef.current.needsUpdate = true;
      }
      material.map = dynamicTextureRef.current;
      material.needsUpdate = true;
    };

    const processMasking = (tempCanvas: HTMLCanvasElement) => {
      ctx.clearRect(0, 0, 2048, 2048);
      ctx.drawImage(baseImg, 0, 0, 2048, 2048);

      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      const baseData = ctx.getImageData(0, 0, 2048, 2048);
      const coverData = tempCtx.getImageData(0, 0, 2048, 2048);

      const minX = Math.max(0, LABEL_REGION.x - 10);
      const maxX = Math.min(2047, LABEL_REGION.x + LABEL_REGION.width + 10);
      const minY = Math.max(0, LABEL_REGION.y - 10);
      const maxY = Math.min(2047, LABEL_REGION.y + LABEL_REGION.height + 10);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = (y * 2048 + x) * 4;
          const r = baseData.data[idx];
          const g = baseData.data[idx + 1];
          const b = baseData.data[idx + 2];

          // Replace ONLY green pixels of the label
          if (g > 80 && g > r + 25 && g > b + 25) {
            baseData.data[idx] = coverData.data[idx];
            baseData.data[idx + 1] = coverData.data[idx + 1];
            baseData.data[idx + 2] = coverData.data[idx + 2];
            baseData.data[idx + 3] = coverData.data[idx + 3];
          }
        }
      }

      ctx.putImageData(baseData, 0, 0);
      applyTextureToMaterial();
    };

    if (coverUrl) {
      const coverImg = new Image();
      coverImg.crossOrigin = "anonymous";
      coverImg.src = coverUrl;
      coverImg.onload = () => {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 2048;
        tempCanvas.height = 2048;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.save();
          const centerX = LABEL_REGION.x + LABEL_REGION.width / 2;
          const centerY = LABEL_REGION.y + LABEL_REGION.height / 2;
          tempCtx.translate(centerX, centerY);
          tempCtx.scale(1, -1);
          tempCtx.drawImage(
            coverImg,
            -LABEL_REGION.width / 2,
            -LABEL_REGION.height / 2,
            LABEL_REGION.width,
            LABEL_REGION.height
          );
          tempCtx.restore();
          processMasking(tempCanvas);
        }
      };
      coverImg.onerror = () => {
        // Fallback to #7B0E21 red label with white text
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 2048;
        tempCanvas.height = 2048;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          renderFallbackLabel(tempCtx, title || gameTitle);
          processMasking(tempCanvas);
        }
      };
    } else {
      // Fallback when no coverUrl is provided: render #7B0E21 red label with white text
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 2048;
      tempCanvas.height = 2048;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        renderFallbackLabel(tempCtx, title || gameTitle);
        processMasking(tempCanvas);
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    setIsLoading(true);
    setLoadError(null);

    let animationFrameId: number;

    // 1. Setup Scene, Camera, Renderer
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 280;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;

    // 2. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 1.0;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.minDistance = 1.5;
    controls.maxDistance = 10;
    controlsRef.current = controls;

    // 3. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight1.position.set(5, 8, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x4080ff, 1.2);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x00e5ff, 2, 10);
    pointLight.position.set(0, 2, 3);
    scene.add(pointLight);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // 4. Load Textures
    const textureLoader = new THREE.TextureLoader();
    const basePath = textureDir.endsWith("/") ? textureDir : `${textureDir}/`;

    const loadTexture = (filename: string): Promise<THREE.Texture> => {
      return new Promise((resolve, reject) => {
        textureLoader.load(
          `${basePath}${filename}`,
          (tex) => resolve(tex),
          undefined,
          (err) => reject(err)
        );
      });
    };

    // Preload BaseColor HTML Image for dynamic label blending
    const baseImg = new Image();
    baseImg.crossOrigin = "anonymous";
    baseImg.src = `${basePath}model_BaseColor.png`;
    baseImg.onload = () => {
      baseImageRef.current = baseImg;
      updateTextureWithCover(customCoverUrl, gameTitle);
    };

    Promise.all([
      loadTexture("model_BaseColor.png").catch(() => null),
      loadTexture("model_Normal.png").catch(() => null),
      loadTexture("model_Roughness.png").catch(() => null),
      loadTexture("model_Metallic.png").catch(() => null),
    ])
      .then(([baseColor, normalMap, roughnessMap, metalnessMap]) => {
        const material = new THREE.MeshStandardMaterial({
          roughness: 0.5,
          metalness: 0.5,
        });
        materialRef.current = material;

        if (baseColor) {
          baseColor.colorSpace = THREE.SRGBColorSpace;
          material.map = baseColor;
        }
        if (normalMap) {
          material.normalMap = normalMap;
          material.normalScale.set(1, 1);
        }
        if (roughnessMap) {
          material.roughnessMap = roughnessMap;
        }
        if (metalnessMap) {
          material.metalnessMap = metalnessMap;
        }

        // 5. Load OBJ Model
        const objLoader = new OBJLoader();
        objLoader.load(
          modelPath,
          (obj) => {
            // Center geometry vertices directly at (0, 0, 0) so the pivot point is exact
            obj.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.geometry.center();
                mesh.material = material;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
              }
            });

            // Compute size for scaling
            const box = new THREE.Box3().setFromObject(obj);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.4 / (maxDim || 1);

            obj.scale.set(scale, scale, scale);
            obj.position.set(0, 0, 0);

            // Front-facing orientation (standing vertically with label facing camera)
            obj.rotation.set(0, -Math.PI / 2, 0);

            modelGroup.position.set(0, 0, 0);
            modelGroup.rotation.set(0, 0, 0);
            modelGroup.add(obj);

            setIsLoading(false);

            // Apply custom cover or red fallback label if ready
            if (baseImageRef.current) {
              updateTextureWithCover(customCoverUrl, gameTitle);
            }
          },
          undefined,
          (err) => {
            console.error("Error loading OBJ model:", err);
            setLoadError("Impossible de charger le modèle 3D");
            setIsLoading(false);
          }
        );
      })
      .catch((err) => {
        console.error("Error loading textures:", err);
        setLoadError("Erreur d'obtention des textures");
        setIsLoading(false);
      });

    // 6. Render loop
    const renderScene = () => {
      animationFrameId = requestAnimationFrame(renderScene);

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    renderScene();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const newW = container.clientWidth || 400;
      const newH = container.clientHeight || 280;

      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [modelPath, textureDir]);

  // Update dynamic cartridge label whenever customCoverUrl or gameTitle changes
  useEffect(() => {
    updateTextureWithCover(customCoverUrl, gameTitle);
  }, [customCoverUrl, gameTitle]);

  return (
    <div className="cartridge-3d-container" ref={containerRef}>
      <div className="cartridge-3d-header">
        <span className="cartridge-3d-title">
          <Box size={14} className="title-icon" /> CARTOUCHE 3D
        </span>
      </div>

      <div className="cartridge-3d-viewport">
        {isLoading && (
          <div className="cartridge-3d-loading">
            <div className="spinner" />
            <span>Chargement 3D...</span>
          </div>
        )}

        {loadError && (
          <div className="cartridge-3d-error">
            <span>{loadError}</span>
          </div>
        )}

        <canvas ref={canvasRef} className="cartridge-3d-canvas" />
      </div>

      <div className="cartridge-3d-hint">Pivotez à la souris</div>
    </div>
  );
};
