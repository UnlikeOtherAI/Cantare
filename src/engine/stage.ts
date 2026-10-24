import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import {
  BloomEffect,
  BrightnessContrastEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect
} from "postprocessing";
import { paintBody, placeArtwork, type ArtworkPlacement } from "./decoration";
import { DropletField } from "./droplets";
import { buildEnvironmentScene, estimateLight, kelvinToColor, lightDirection, paintBackdrop } from "./environment";
import { getFormat, type CanFormat } from "./formats";
import { latheGeometry } from "./lathe";
import { lidNormalMap, rivetGeometry, tabGeometry } from "./lidDetail";
import { applySurface, finishValues, surfaceSpec } from "./materials";
import { arcAtHeight, arcLengths, buildProfiles, type CanProfiles } from "./profile";
import type { CameraPreset, CanSettings } from "./settings";
import { loadImage } from "./textures";

// Exposure and white balance before tone mapping.
class GradeEffect extends Effect {
  constructor() {
    super(
      "GradeEffect",
      `uniform float exposure;
      uniform float warmth;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb * exposure;
        c *= vec3(1.0 + warmth * 0.07, 1.0 + warmth * 0.01, 1.0 - warmth * 0.08);
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ["exposure", new THREE.Uniform(1)],
          ["warmth", new THREE.Uniform(0)]
        ])
      }
    );
  }
}

// Luminance film grain after tone mapping, with a grain size in output pixels.
class GrainEffect extends Effect {
  constructor() {
    super(
      "GrainEffect",
      `uniform float amount;
      uniform float grainSize;
      uniform vec2 pixels;
      float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec2 cell = floor(uv * pixels / grainSize);
        float n = hash(cell) + hash(cell + 17.13) - 1.0;
        float l = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        float weight = amount * (0.35 + 0.65 * (1.0 - abs(l * 2.0 - 1.0)));
        outputColor = vec4(inputColor.rgb + n * weight * 0.07, inputColor.a);
      }`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ["amount", new THREE.Uniform(0)],
          ["grainSize", new THREE.Uniform(1)],
          ["pixels", new THREE.Uniform(new THREE.Vector2(1, 1))]
        ])
      }
    );
  }
  override setSize(width: number, height: number) {
    (this.uniforms.get("pixels")!.value as THREE.Vector2).set(width, height);
  }
}

export interface StageInfo {
  format: CanFormat;
  placement: ArtworkPlacement | null;
  dropCount: number;
  artworkSize: { width: number; height: number } | null;
}

export interface ViewInfo {
  /** Camera height above the horizon, degrees. */
  elevation: number;
  focalLength: number;
}

export interface ExportOptions {
  width: number;
  height: number;
  type: "image/png" | "image/jpeg";
  quality?: number;
  transparent?: boolean;
}

export type StageInteraction = "orbit" | "water" | "artwork" | "focus";

const SENSOR_HEIGHT = 24;

/** Owns the WebGL scene for one can and renders it on demand. */
export class CanStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  onInfo: ((info: StageInfo) => void) | null = null;
  onView: ((view: ViewInfo) => void) | null = null;
  onFirstFrame: (() => void) | null = null;
  /** Artwork tool drags: rotation in degrees and vertical offset in mm. */
  onArtworkDrag: ((rotation: number, offset: number) => void) | null = null;
  onFocusPicked: ((point: [number, number, number]) => void) | null = null;
  /** Rotation gizmo drags: degrees, Euler XZY so spin stays around the can's own axis. */
  onOrientationDrag: ((orientation: { pitch: number; spin: number; roll: number }) => void) | null = null;

  private scene = new THREE.Scene();
  private composer: EffectComposer;
  private dof: DepthOfFieldEffect;
  private dofPass: EffectPass;
  private bloom: BloomEffect;
  private grade = new GradeEffect();
  private grain = new GrainEffect();
  private contrast = new BrightnessContrastEffect();
  private saturation = new HueSaturationEffect();
  private vignette = new VignetteEffect({ offset: 0.32, darkness: 0.3 });
  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;

  /** The can's pose: tilt and spin about its centre, lifted to rest on the floor. */
  private spinGroup = new THREE.Group();
  private gizmo: TransformControls;
  private gizmoProxy = new THREE.Object3D();
  private gizmoDragging = false;
  private reflectionClone: THREE.Object3D | null = null;
  private canGroup = new THREE.Group();
  private lidGroup = new THREE.Group();
  private reflection = new THREE.Group();
  private keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  private keyDirection = new THREE.Vector3(0, 1, 1);
  private ground: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  private contact: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  private bodyMaterial = new THREE.MeshPhysicalMaterial();
  private domeMaterial = new THREE.MeshPhysicalMaterial({ color: "#d9dbdd", metalness: 1, roughness: 0.3 });
  private lidMaterial = new THREE.MeshPhysicalMaterial();
  private labelMaterial = new THREE.MeshPhysicalMaterial({ roughness: 0.6 });
  private dropMaterial: THREE.MeshPhysicalMaterial;
  private hazeMaterial: THREE.MeshPhysicalMaterial;
  private dropCaustic = { value: 0.35 };
  private bodyCanvases = { color: document.createElement("canvas"), orm: document.createElement("canvas") };
  private bodyColor = new THREE.CanvasTexture(this.bodyCanvases.color);
  private bodyOrm = new THREE.CanvasTexture(this.bodyCanvases.orm);
  private labelTexture: THREE.Texture | null = null;

  private bodyMesh: THREE.Mesh | null = null;
  private labelMesh: THREE.Mesh | null = null;
  private profiles: CanProfiles | null = null;
  private arcs: number[] = [];
  private format: CanFormat = getFormat("eu-std-330");
  private droplets: DropletField | null = null;
  private placement: ArtworkPlacement | null = null;

  private settings: CanSettings | null = null;
  private artworkImage: HTMLImageElement | null = null;
  private artworkUrl: string | null = null;
  private backgroundImage: HTMLImageElement | null = null;
  private backgroundUrl: string | null = null;
  private backgroundTexture: THREE.CanvasTexture | null = null;
  private backgroundAspect = 0;

  private frames = 2;
  private firstFrame = false;
  private disposed = false;
  private built = false;
  private interaction: StageInteraction = "orbit";
  private pointers = new Set<number>();
  private stroke: { id: number; x: number; y: number; last: THREE.Vector2 | null } | null = null;
  private raycaster = new THREE.Raycaster();
  private maxTexture: number;
  private viewSize = new THREE.Vector2(1, 1);
  private insets = { top: 0, bottom: 0 };
  private turntable = false;
  /** Re-frame on resize until the user moves the camera themselves. */
  private autoFrame: CameraPreset | null = "three-quarter";
  private turntableAngle = 0;
  private lastTime = performance.now();
  private lastView = "";

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.maxTexture = this.renderer.capabilities.maxTextureSize;

    this.camera = new THREE.PerspectiveCamera(24, 1, 5, 20000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.08;
    this.controls.maxPolarAngle = 1.66;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.addEventListener("change", () => this.invalidate());
    this.controls.addEventListener("start", () => (this.autoFrame = null));

    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: Math.min(4, this.renderer.capabilities.maxSamples)
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.dof = new DepthOfFieldEffect(this.camera, { focusDistance: 400, focusRange: 80, bokehScale: 0, resolutionScale: 0.75 });
    this.dofPass = new EffectPass(this.camera, this.dof);
    this.dofPass.enabled = false;
    this.composer.addPass(this.dofPass);
    this.bloom = new BloomEffect({ intensity: 0.4, luminanceThreshold: 0.82, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.62 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    this.composer.addPass(new EffectPass(this.camera, this.grade, this.bloom, tone, this.contrast, this.saturation, this.vignette, this.grain));

    this.dropMaterial = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0,
      roughness: 0.03,
      transmission: 1,
      ior: 1.333,
      thickness: 5,
      transparent: true,
      depthWrite: false,
      specularIntensity: 1,
      envMapIntensity: 5,
      bumpScale: 9
    });
    // Drops refract a dark ring at their rim and focus a bright caustic low inside.
    this.dropMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.dropCaustic = this.dropCaustic;
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float dropCaustic;").replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        #ifdef USE_ALPHAMAP
          vec4 dropMask = texture2D(alphaMap, vAlphaMapUv);
          gl_FragColor.rgb *= 1.0 - dropMask.b * 0.78;
          gl_FragColor.rgb += dropMask.r * dropCaustic * vec3(1.0, 0.97, 0.92);
        #endif`
      );
    };
    this.dropMaterial.customProgramCacheKey = () => "cantare-drops";
    this.hazeMaterial = new THREE.MeshPhysicalMaterial({
      color: "#d5dde2",
      metalness: 0,
      roughness: 0.42,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      bumpScale: 1.5
    });

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShadowMaterial({ opacity: 0.5, transparent: true, depthWrite: false }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.renderOrder = -2;
    this.contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: contactTexture(), transparent: true, depthWrite: false, toneMapped: false }));
    this.contact.rotation.x = -Math.PI / 2;
    this.contact.position.y = 0.05;
    this.contact.renderOrder = -1;

    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.0004;
    this.keyLight.shadow.blurSamples = 16;
    this.scene.add(this.keyLight, this.keyLight.target, this.ground, this.contact, this.reflection, this.spinGroup);
    this.spinGroup.add(this.canGroup);

    // Red/green/blue rings: X and Z tilt the can, Y spins it around its own axis.
    this.gizmo = new TransformControls(this.camera, canvas);
    this.gizmo.setMode("rotate");
    this.gizmo.setSpace("local");
    this.gizmo.showE = false;
    this.gizmo.showXYZE = false;
    this.gizmo.size = 2.1;
    this.gizmo.attach(this.gizmoProxy);
    this.gizmo.enabled = false;
    this.gizmo.getHelper().visible = false;
    this.scene.add(this.gizmoProxy, this.gizmo.getHelper());
    this.gizmo.addEventListener("dragging-changed", (event) => {
      this.gizmoDragging = Boolean(event.value);
      this.controls.enabled = !this.gizmoDragging;
    });
    this.gizmo.addEventListener("change", () => this.invalidate());
    this.gizmo.addEventListener("objectChange", () => {
      const e = new THREE.Euler().setFromQuaternion(this.gizmoProxy.quaternion, "XZY");
      const deg = THREE.MathUtils.radToDeg;
      this.onOrientationDrag?.({ pitch: deg(e.x), spin: (((deg(e.y) - this.turntableAngle) % 360) + 360) % 360, roll: deg(e.z) });
    });

    this.bodyMaterial.map = this.bodyColor;
    this.bodyMaterial.roughnessMap = this.bodyOrm;
    this.bodyMaterial.metalnessMap = this.bodyOrm;

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("dblclick", this.onDoubleClick);
    this.renderer.setAnimationLoop(this.tick);
  }

  invalidate(frames = 2) {
    this.frames = Math.max(this.frames, frames);
  }

  resize(width: number, height: number) {
    this.viewSize.set(width, height);
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.applyViewOffset();
    this.refreshBackground();
    if (this.autoFrame && this.built) this.setCameraPreset(this.autoFrame, false);
    this.invalidate();
  }

  /** Space covered by overlays (bottom sheet, HUD) so the can centres in what is visible. */
  setInsets(top: number, bottom: number) {
    if (this.insets.top === top && this.insets.bottom === bottom) return;
    this.insets = { top, bottom };
    this.applyViewOffset();
    if (this.autoFrame && this.built) this.setCameraPreset(this.autoFrame, false);
    this.invalidate();
  }

  setInteraction(mode: StageInteraction) {
    this.interaction = mode;
    const claimed = mode !== "orbit";
    // One pointer goes to the tool; two fingers still orbit and zoom.
    this.controls.mouseButtons.LEFT = claimed ? (null as unknown as THREE.MOUSE) : THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = claimed ? (null as unknown as THREE.TOUCH) : THREE.TOUCH.ROTATE;
    this.canvas.style.cursor = mode === "orbit" ? "grab" : mode === "artwork" ? "ew-resize" : mode === "focus" ? "crosshair" : "none";
  }

  /** Show the rotation gizmo on the can (the Camera tool). */
  setGizmo(on: boolean) {
    this.gizmo.enabled = on;
    this.gizmo.getHelper().visible = on;
    this.invalidate();
  }

  setTurntable(on: boolean) {
    this.turntable = on;
    this.invalidate();
  }

  async apply(next: CanSettings) {
    const prev = this.settings;
    this.settings = next;
    const formatChanged = !prev || prev.formatId !== next.formatId;

    if (next.artwork.url !== this.artworkUrl) {
      this.artworkUrl = next.artwork.url;
      this.artworkImage = next.artwork.url ? await loadImage(next.artwork.url).catch(() => null) : null;
      if (this.settings !== next) return;
      this.labelTexture?.dispose();
      this.labelTexture = null;
    }
    if (next.background.imageUrl !== this.backgroundUrl) {
      this.backgroundUrl = next.background.imageUrl;
      this.backgroundImage = next.background.imageUrl ? await loadImage(next.background.imageUrl).catch(() => null) : null;
      if (this.settings !== next) return;
    }

    if (formatChanged) this.buildCan(next);
    if (formatChanged || prev!.body !== next.body || prev!.artwork !== next.artwork) this.paint(next);
    if (formatChanged || prev!.lid !== next.lid || prev!.lidRotation !== next.lidRotation) this.applyLid(next);
    const photoChanged = !prev || prev.background.kind !== next.background.kind || prev.background.imageUrl !== next.background.imageUrl || prev.background.visible !== next.background.visible;
    if (!prev || prev.lighting !== next.lighting || photoChanged) this.applyLighting(next);
    if (formatChanged || prev!.water !== next.water) this.applyWater(next, prev);
    if (!prev || prev.effects !== next.effects || formatChanged) this.applyEffects(next);
    if (!prev || prev.background !== next.background) {
      this.backgroundAspect = 0;
      this.refreshBackground();
    }
    if (!prev || prev.focalLength !== next.focalLength) this.applyLens(next.focalLength, !!prev);
    this.applyPose();
    this.rebuildReflection();
    this.emitInfo();
    this.invalidate();
  }

  setCameraPreset(preset: CameraPreset, animate = true) {
    const H = this.format.height;
    const fit = this.fitDistance();
    const angles: Record<CameraPreset, { az: number; polar: number; dist: number; ty: number }> = {
      front: { az: 0, polar: 1.5, dist: fit, ty: H * 0.5 },
      "three-quarter": { az: 0.62, polar: 1.3, dist: fit * 1.02, ty: H * 0.5 },
      top: { az: 0.2, polar: 0.5, dist: fit * 0.95, ty: H * 0.6 },
      hero: { az: -0.35, polar: 1.64, dist: fit * 0.92, ty: H * 0.55 }
    };
    const a = angles[preset];
    this.autoFrame = preset;
    // Follow the can when it is lifted or resting tilted.
    const target = new THREE.Vector3(0, a.ty + (this.spinGroup.position.y - H / 2), 0);
    this.moveCamera(new THREE.Vector3().setFromSphericalCoords(a.dist, a.polar, a.az).add(target), target, animate);
  }

  /** Keep the camera's direction but frame the whole can again. */
  frameCan() {
    const target = this.spinGroup.position.clone();
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.moveCamera(target.clone().add(dir.multiplyScalar(this.fitDistance())), target, true);
  }

  /** Camera height above the horizon in degrees, keeping azimuth and distance. */
  setCameraElevation(degrees: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.phi = THREE.MathUtils.clamp(Math.PI / 2 - THREE.MathUtils.degToRad(degrees), this.controls.minPolarAngle, this.controls.maxPolarAngle);
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    this.controls.update();
    this.invalidate();
  }

  clearWater() {
    this.droplets?.clear();
    this.invalidate();
    this.emitInfo();
  }

  /** Scatter afresh with the current settings. */
  rescatter() {
    const water = this.settings?.water;
    if (!water || !this.droplets) return;
    this.droplets.scatter(water.density, water.size, water.seed);
    this.invalidate();
  }

  /** Key light estimated from the current background photo, if there is one. */
  estimateLightFromBackground() {
    return this.backgroundImage ? estimateLight(this.backgroundImage) : null;
  }

  /** Screen-space box of the can (CSS px relative to the canvas). */
  canScreenRect(): { cx: number; cy: number; top: number; bottom: number; halfWidth: number } {
    const H = this.format.height;
    const R = this.format.bodyDiameter / 2;
    const top = this.project(new THREE.Vector3(0, H, 0));
    const bottom = this.project(new THREE.Vector3(0, 0, 0));
    const mid = this.project(new THREE.Vector3(0, H / 2, 0));
    const side = this.project(this.sideways(new THREE.Vector3(0, H / 2, 0), R));
    return { cx: mid.x, cy: mid.y, top: top.y, bottom: bottom.y, halfWidth: Math.abs(side.x - mid.x) };
  }

  /** Label top/bottom edges on screen, at the side of the can facing the camera. */
  labelScreenEdges(): { top: number; bottom: number; left: number; right: number } | null {
    const placement = this.placement;
    if (!placement || this.settings?.artwork.mode !== "label") return null;
    const R = this.format.bodyDiameter / 2;
    const toCamera = this.canGroup.worldToLocal(this.camera.position.clone()).setY(0).normalize().multiplyScalar(R);
    const top = this.project(toCamera.clone().setY(placement.bottom + placement.height));
    const bottom = this.project(toCamera.clone().setY(placement.bottom));
    const mid = this.project(new THREE.Vector3(0, placement.bottom, 0));
    const side = this.project(this.sideways(new THREE.Vector3(0, placement.bottom, 0), R));
    const half = Math.abs(side.x - mid.x);
    return { top: top.y, bottom: bottom.y, left: mid.x - half, right: mid.x + half };
  }

  /** CSS pixels per mm at the can's distance, for sizing the brush cursor. */
  pixelsPerMm(): number {
    const distance = this.camera.position.distanceTo(this.controls.target);
    const visible = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    return this.viewSize.y / visible;
  }

  /** Render at an arbitrary resolution and return the encoded image. */
  async exportImage(options: ExportOptions): Promise<Blob> {
    const max = this.maxExportSize();
    const scale = Math.min(1, max / Math.max(options.width, options.height));
    const width = Math.round(options.width * scale);
    const height = Math.round(options.height * scale);
    const ratio = this.renderer.getPixelRatio();
    const background = this.scene.background;
    const helper = this.gizmo.getHelper();
    const gizmoVisible = helper.visible;
    helper.visible = false;

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    if (options.transparent) {
      this.scene.background = null;
      this.renderer.setClearColor(0x000000, 0);
    } else {
      this.paintBackgroundTexture(width / height);
    }
    this.droplets?.render();
    this.composer.render();
    const blob = await new Promise<Blob | null>((resolve) => this.canvas.toBlob(resolve, options.type, options.quality ?? 0.95));

    this.scene.background = background;
    helper.visible = gizmoVisible;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(ratio);
    this.resize(this.viewSize.x, this.viewSize.y);
    this.backgroundAspect = 0;
    this.refreshBackground();
    this.composer.render();
    if (!blob) throw new Error("The browser could not encode the image");
    return blob;
  }

  maxExportSize() {
    const gl = this.renderer.getContext();
    const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    return Math.min(isMobile() ? 4096 : 8192, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number, dims[0], dims[1]);
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("dblclick", this.onDoubleClick);
    this.controls.dispose();
    this.composer.dispose();
    this.pmrem.dispose();
    this.envTarget?.dispose();
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------------------

  private tick = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (this.controls.update()) this.frames = Math.max(this.frames, 1);
    if (this.turntable && !this.pointers.size) {
      this.turntableAngle = (this.turntableAngle + dt * 18) % 360;
      this.applyPose();
      this.frames = Math.max(this.frames, 1);
    }
    const water = this.settings?.water;
    if (this.stroke?.last && water?.tool === "spray") {
      this.droplets?.spray(this.stroke.last.x, this.stroke.last.y, water.brush * 0.5, water.size, water.flow);
    }
    if (this.droplets?.render()) {
      this.frames = Math.max(this.frames, 1);
      this.emitInfo();
    }
    if (this.frames <= 0) return;
    this.frames--;
    this.orientLights();
    if (this.dofPass.enabled) this.updateFocus();
    this.composer.render();
    this.emitView();
    if (!this.firstFrame) {
      this.firstFrame = true;
      this.onFirstFrame?.();
    }
  };

  private project(point: THREE.Vector3): THREE.Vector2 {
    const p = this.canGroup.localToWorld(point.clone()).project(this.camera);
    return new THREE.Vector2(((p.x + 1) / 2) * this.viewSize.x, ((1 - p.y) / 2) * this.viewSize.y);
  }

  /** A point offset sideways from `at`, perpendicular to the view, in spin-group space. */
  private sideways(at: THREE.Vector3, distance: number) {
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).setY(0).normalize();
    right.applyQuaternion(this.canGroup.getWorldQuaternion(new THREE.Quaternion()).invert());
    return at.clone().add(right.multiplyScalar(distance));
  }

  private cameraAzimuth() {
    const offset = this.camera.position.clone().sub(this.controls.target);
    return Math.atan2(offset.x, offset.z);
  }

  /**
   * Focus on the surface facing the camera, not the can's axis: at shallow apertures the
   * front of the label is a can-radius closer than the centre.
   */
  private updateFocus() {
    const fx = this.settings?.effects;
    if (!fx) return;
    const H = this.format.height;
    if (fx.focus === "point" && fx.focusPoint) {
      this.dof.target = new THREE.Vector3(...fx.focusPoint);
      return;
    }
    const toCamera = this.camera.position.clone().sub(this.spinGroup.position).setY(0).normalize();
    const R = this.format.bodyDiameter / 2;
    const lid = this.canGroup.localToWorld(new THREE.Vector3(0, H, 0));
    this.dof.target = fx.focus === "lid" ? lid.addScaledVector(toCamera, R * 0.3) : this.spinGroup.position.clone().addScaledVector(toCamera, R);
  }

  /** Lights are set relative to the camera; turn them with it. */
  private orientLights() {
    const az = this.cameraAzimuth();
    this.scene.environmentRotation.set(0, az, 0);
    const dir = this.keyDirection.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), az);
    const H = this.format.height;
    this.keyLight.position.copy(dir.multiplyScalar(1500)).add(new THREE.Vector3(0, H * 0.5, 0));
    this.keyLight.target.position.set(0, H * 0.4, 0);
  }

  private emitView() {
    if (!this.onView) return;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const elevation = Math.round(90 - THREE.MathUtils.radToDeg(new THREE.Spherical().setFromVector3(offset).phi));
    const focalLength = Math.round(SENSOR_HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    const key = `${elevation}:${focalLength}`;
    if (key === this.lastView) return;
    this.lastView = key;
    this.onView({ elevation, focalLength });
  }

  private applyViewOffset() {
    const { x: w, y: h } = this.viewSize;
    const shift = (this.insets.bottom - this.insets.top) / 2;
    if (Math.abs(shift) < 1) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, 0, shift, w, h);
    this.camera.updateProjectionMatrix();
  }

  private applyLens(focalLength: number, keepFraming: boolean) {
    const before = this.camera.fov;
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(SENSOR_HEIGHT / 2 / focalLength));
    this.camera.updateProjectionMatrix();
    if (keepFraming && this.built) {
      // Dolly so the can keeps its size on screen, like zooming with your feet.
      const ratio = Math.tan(THREE.MathUtils.degToRad(before) / 2) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
      const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(ratio);
      this.camera.position.copy(this.controls.target).add(offset);
      this.controls.minDistance = this.format.height * 0.4;
      this.controls.maxDistance = this.fitDistance() * 6;
      this.controls.update();
    }
  }

  private moveCamera(position: THREE.Vector3, target: THREE.Vector3, animate: boolean) {
    if (!animate) {
      this.controls.target.copy(target);
      this.camera.position.copy(position);
      this.controls.update();
      this.invalidate();
      return;
    }
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startTime = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - startTime) / 320);
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.position.lerpVectors(startPos, position, k);
      this.controls.target.lerpVectors(startTarget, target, k);
      this.controls.update();
      this.invalidate();
      if (t < 1 && !this.disposed) requestAnimationFrame(step);
    };
    step();
  }

  private fitDistance() {
    const H = this.format.height;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const visibleFraction = Math.max(0.12, 1 - (this.insets.top + this.insets.bottom) / Math.max(1, this.viewSize.y));
    const aspect = Math.max(0.4, this.camera.aspect / visibleFraction);
    const vertical = (H * 0.66) / (Math.tan(fov / 2) * visibleFraction);
    const horizontal = (this.format.bodyDiameter * 1.4) / (Math.tan(fov / 2) * aspect * visibleFraction);
    return Math.max(vertical, horizontal) + this.format.bodyDiameter / 2;
  }

  private buildCan(settings: CanSettings) {
    this.format = getFormat(settings.formatId);
    const profiles = buildProfiles(this.format);
    this.profiles = profiles;
    this.arcs = arcLengths(profiles.body);
    const totalArc = this.arcs[this.arcs.length - 1];
    const circumference = Math.PI * this.format.bodyDiameter;
    const { landmarks } = profiles;

    for (const child of [...this.canGroup.children]) {
      this.canGroup.remove(child);
      child.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    this.labelMesh = null;
    this.lidGroup = new THREE.Group();

    const segments = 288;
    const body = new THREE.Mesh(latheGeometry(profiles.body, { segments, uv: { mode: "arc", vLength: totalArc } }), this.bodyMaterial);
    const dome = new THREE.Mesh(latheGeometry(profiles.dome, { segments: 160, uv: { mode: "planar", planarRadius: landmarks.radius } }), this.domeMaterial);
    const lid = new THREE.Mesh(latheGeometry(profiles.lid, { segments, uv: { mode: "planar", planarRadius: landmarks.rimRadius } }), this.lidMaterial);
    const tabScale = this.format.end === "300" ? 1.12 : this.format.end === "200" ? 0.94 : 1;
    const tab = new THREE.Mesh(tabGeometry(tabScale), this.lidMaterial);
    tab.position.y = landmarks.panelZ + 0.55;
    const rivet = new THREE.Mesh(rivetGeometry(), this.lidMaterial);
    rivet.position.y = landmarks.panelZ + 0.55 + 0.46;
    rivet.position.z = 0.4 * -tabScale;
    this.lidGroup.add(lid, tab, rivet);
    for (const mesh of [body, dome, lid, tab, rivet]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    this.bodyMesh = body;

    const bounds = { low: arcAtHeight(profiles.body, this.arcs, 0.8), high: arcAtHeight(profiles.body, this.arcs, landmarks.neckTop - 0.4) };
    // Water sits outside the thickest label (0.11 mm paper) so labels get wet too.
    const drops = new THREE.Mesh(latheGeometry(profiles.body, { segments, uv: { mode: "arc", vLength: totalArc }, offset: 0.2 }), this.dropMaterial);
    const haze = new THREE.Mesh(latheGeometry(profiles.body, { segments, uv: { mode: "arc", vLength: totalArc }, offset: 0.17 }), this.hazeMaterial);
    drops.renderOrder = 2;
    haze.renderOrder = 1;
    if (!this.droplets) {
      const resolution = this.maxTexture >= 8192 && !isMobile() ? 2048 : 1536;
      this.droplets = new DropletField(circumference, totalArc, bounds, resolution);
    } else {
      this.droplets.reshape(circumference, totalArc, bounds);
    }
    this.dropMaterial.bumpMap = this.droplets.heightTexture;
    this.dropMaterial.thicknessMap = this.droplets.heightTexture;
    this.dropMaterial.alphaMap = this.droplets.coverageTexture;
    this.hazeMaterial.alphaMap = this.droplets.hazeTexture;
    this.hazeMaterial.bumpMap = this.droplets.hazeTexture;
    this.dropMaterial.needsUpdate = true;
    this.hazeMaterial.needsUpdate = true;

    this.canGroup.add(body, dome, this.lidGroup, haze, drops);

    // Shadow camera hugs the can.
    const H = this.format.height;
    const shadowCam = this.keyLight.shadow.camera;
    const extent = Math.max(H, this.format.bodyDiameter) * 1.4;
    shadowCam.left = shadowCam.bottom = -extent;
    shadowCam.right = shadowCam.top = extent;
    shadowCam.near = 1;
    shadowCam.far = 4000;
    shadowCam.updateProjectionMatrix();
    const contactSize = this.format.bodyDiameter * 1.6;
    this.contact.scale.set(contactSize, contactSize, 1);

    if (!this.built) {
      this.applyLens(settings.focalLength, false);
      this.setCameraPreset("three-quarter", false);
    } else {
      this.frameCan();
    }
    this.controls.minDistance = H * 0.4;
    this.controls.maxDistance = this.fitDistance() * 6;
    this.built = true;
  }

  private paint(settings: CanSettings) {
    if (!this.profiles) return;
    const totalArc = this.arcs[this.arcs.length - 1];
    const circumference = Math.PI * this.format.bodyDiameter;
    const base = surfaceSpec(settings.body);
    const image = this.artworkImage;
    const aspect = image ? image.naturalWidth / image.naturalHeight : 1;
    this.placement = image ? placeArtwork(this.format, this.profiles.landmarks, this.profiles.body, this.arcs, aspect, settings.artwork) : null;
    const width = this.maxTexture >= 8192 && !isMobile() ? 4096 : 2048;
    paintBody(
      this.bodyCanvases,
      width,
      totalArc,
      circumference,
      base,
      settings.body.finish,
      image && this.placement ? { image, placement: this.placement, settings: settings.artwork } : null
    );
    // Canvas size may change, so textures are recreated rather than re-uploaded.
    this.bodyColor.dispose();
    this.bodyOrm.dispose();
    this.bodyColor = new THREE.CanvasTexture(this.bodyCanvases.color);
    this.bodyColor.colorSpace = THREE.SRGBColorSpace;
    this.bodyOrm = new THREE.CanvasTexture(this.bodyCanvases.orm);
    for (const t of [this.bodyColor, this.bodyOrm]) {
      t.wrapS = THREE.RepeatWrapping;
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }
    this.bodyMaterial.map = this.bodyColor;
    this.bodyMaterial.roughnessMap = this.bodyOrm;
    this.bodyMaterial.metalnessMap = this.bodyOrm;
    applySurface(this.bodyMaterial, base, true);

    // Label: a separate thin wrap standing just proud of the metal.
    if (this.labelMesh) {
      this.canGroup.remove(this.labelMesh);
      this.labelMesh.geometry.dispose();
      this.labelMesh = null;
    }
    if (image && this.placement && settings.artwork.mode === "label") {
      const R = this.profiles.landmarks.radius + 0.02;
      const z0 = this.placement.bottom;
      const z1 = z0 + this.placement.height;
      const t = settings.artwork.labelStock === "paper" ? 0.11 : 0.06;
      const profile = [
        { r: R, z: z0 },
        { r: R + t * 0.6, z: z0 + 0.01 },
        { r: R + t, z: z0 + 0.05 },
        { r: R + t, z: z1 - 0.05 },
        { r: R + t * 0.6, z: z1 - 0.01 },
        { r: R, z: z1 }
      ];
      const arc = arcLengths(profile);
      const thetaLength = this.placement.wrap * Math.PI * 2;
      const geometry = latheGeometry(profile, {
        segments: Math.max(24, Math.round(288 * this.placement.wrap)),
        uv: { mode: "arc", vLength: arc[arc.length - 1] },
        thetaStart: this.placement.wrap >= 1 ? Math.PI : -thetaLength / 2,
        thetaLength
      });
      if (!this.labelTexture) {
        this.labelTexture = new THREE.Texture(image);
        this.labelTexture.colorSpace = THREE.SRGBColorSpace;
        this.labelTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        this.labelTexture.needsUpdate = true;
      }
      const paper = settings.artwork.labelStock === "paper";
      const stock = paper ? finishValues("matte", false) : finishValues("gloss", false);
      Object.assign(this.labelMaterial, {
        map: this.labelTexture,
        roughness: paper ? 0.62 : stock.roughness,
        clearcoat: stock.clearcoat,
        clearcoatRoughness: stock.clearcoatRoughness,
        sheen: paper ? 0.25 : 0,
        sheenRoughness: 0.8,
        side: THREE.DoubleSide
      });
      this.labelMaterial.needsUpdate = true;
      this.labelMesh = new THREE.Mesh(geometry, this.labelMaterial);
      this.labelMesh.rotation.y = THREE.MathUtils.degToRad(settings.artwork.rotation);
      this.labelMesh.castShadow = true;
      this.labelMesh.receiveShadow = true;
      this.canGroup.add(this.labelMesh);
    }
  }

  private applyLid(settings: CanSettings) {
    if (!this.profiles) return;
    applySurface(this.lidMaterial, surfaceSpec(settings.lid));
    if (!this.lidMaterial.normalMap || this.lidMaterial.userData.formatId !== this.format.id) {
      this.lidMaterial.normalMap?.dispose();
      this.lidMaterial.normalMap = lidNormalMap(this.profiles.landmarks.rimRadius, this.profiles.landmarks.panelRadius);
      this.lidMaterial.userData.formatId = this.format.id;
      this.lidMaterial.needsUpdate = true;
    }
    this.lidGroup.rotation.y = THREE.MathUtils.degToRad(settings.lidRotation);
  }

  private applyLighting(settings: CanSettings) {
    const { lighting, background } = settings;
    const photo = lighting.matchBackground && background.kind === "image" && background.visible ? this.backgroundImage : null;
    const envScene = buildEnvironmentScene(lighting, photo);
    const next = this.pmrem.fromScene(envScene, 0.015);
    envScene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as THREE.MeshBasicMaterial | undefined;
      material?.map?.dispose();
      material?.dispose?.();
    });
    this.envTarget?.dispose();
    this.envTarget = next;
    this.scene.environment = next.texture;

    this.keyDirection = lightDirection(lighting.azimuth, lighting.elevation);
    this.keyLight.color.copy(kelvinToColor(lighting.temperature));
    this.keyLight.intensity = 0.9 * lighting.intensity * (lighting.environment === "daylight" || lighting.environment === "golden" ? 2.2 : 1);
    this.dropCaustic.value = 0.32 * lighting.intensity * (lighting.environment === "hard" ? 1.3 : 1);
    this.applyShadowSoftness();
    this.orientLights();
  }

  private applyShadowSoftness() {
    const softness = (this.settings?.lighting.softness ?? 0.5) * 0.5 + (this.settings?.effects.shadowSoftness ?? 0.5) * 0.5;
    this.keyLight.shadow.radius = 2 + softness * 26;
  }

  private applyWater(settings: CanSettings, prev: CanSettings | null) {
    const water = settings.water;
    const field = this.droplets;
    if (!field) return;
    field.setRuns(water.runs);
    const changed = !prev || prev.water.density !== water.density || prev.water.size !== water.size || prev.water.seed !== water.seed || prev.water.runs !== water.runs;
    if (changed && (water.density > 0 || prev)) field.scatter(water.density, water.size, water.seed);
    this.hazeMaterial.opacity = Math.pow(water.haze, 1.5) * 0.95;
    this.hazeMaterial.visible = water.haze > 0;
  }

  private applyEffects(settings: CanSettings) {
    const fx = settings.effects;
    this.dofPass.enabled = fx.dofEnabled;
    // f/1.4 → very shallow, f/16 → almost everything sharp.
    const shallow = THREE.MathUtils.clamp((16 - fx.aperture) / 14.6, 0, 1);
    this.dof.bokehScale = 1 + shallow * 6;
    this.dof.cocMaterial.focusRange = THREE.MathUtils.lerp(260, 25, shallow);
    this.updateFocus();
    this.bloom.intensity = fx.bloomEnabled ? fx.bloom * 1.6 : 0;
    this.bloom.luminanceMaterial.threshold = 0.4 + fx.bloomThreshold * 0.55;
    this.vignette.darkness = fx.vignetteEnabled ? fx.vignette * 0.75 : 0;
    this.grain.uniforms.get("amount")!.value = fx.grainEnabled ? fx.grain : 0;
    this.grain.uniforms.get("grainSize")!.value = 1 + fx.grainSize * 2.5;
    const grade = fx.gradeEnabled;
    this.grade.uniforms.get("exposure")!.value = grade ? Math.pow(2, fx.exposure) : 1;
    this.grade.uniforms.get("warmth")!.value = grade ? fx.warmth : 0;
    this.contrast.contrast = grade ? fx.contrast * 0.5 : 0;
    this.saturation.saturation = grade ? fx.saturation * (fx.saturation < 0 ? 1 : 0.6) : 0;
    const ground = fx.groundEnabled;
    this.ground.material.opacity = fx.shadow * 0.62;
    this.contact.material.opacity = fx.shadow;
    this.ground.visible = this.contact.visible = ground && fx.shadow > 0.001;
    this.applyShadowSoftness();
  }

  private refreshBackground() {
    const aspect = this.viewSize.x / this.viewSize.y;
    if (Math.abs(aspect - this.backgroundAspect) < 0.01 && this.backgroundTexture) return;
    this.paintBackgroundTexture(aspect);
  }

  private paintBackgroundTexture(aspect: number) {
    const bg = this.settings?.background;
    if (!bg) return;
    const visible = bg.visible ? bg : { ...bg, kind: "studio" as const, color: "#34373c", color2: "#0f1012" };
    const canvas = paintBackdrop(visible, this.backgroundImage, aspect);
    this.backgroundTexture?.dispose();
    this.backgroundTexture = new THREE.CanvasTexture(canvas);
    this.backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.backgroundTexture;
    this.backgroundAspect = aspect;
    this.invalidate();
  }

  /**
   * Tilt and spin about the can's centre (Euler XZY: spin first, around the can's own
   * axis), then lift it so its lowest point rests on the floor, plus any float.
   */
  private applyPose() {
    const s = this.settings;
    if (!s) return;
    const rad = THREE.MathUtils.degToRad;
    const H = this.format.height;
    const R = this.format.bodyDiameter / 2;
    this.canGroup.position.y = -H / 2;
    this.spinGroup.rotation.set(rad(s.tilt.pitch), rad(s.spin + this.turntableAngle), rad(s.tilt.roll), "XZY");
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(this.spinGroup.quaternion);
    const rest = (H / 2) * Math.abs(axis.y) + R * Math.sqrt(Math.max(0, 1 - axis.y * axis.y));
    this.spinGroup.position.set(0, rest + s.lift, 0);
    this.spinGroup.updateMatrixWorld(true);
    // The baked contact shadow only fits an upright can standing on the floor.
    const upright = Math.abs(axis.y) > 0.999 && s.lift < 0.5;
    this.contact.visible = upright && this.ground.visible;
    if (this.reflectionClone) {
      this.reflectionClone.position.copy(this.spinGroup.position);
      this.reflectionClone.quaternion.copy(this.spinGroup.quaternion);
    }
    if (!this.gizmoDragging) {
      this.gizmoProxy.position.copy(this.spinGroup.position);
      this.gizmoProxy.quaternion.copy(this.spinGroup.quaternion);
    }
  }

  /** Mirror the can under the floor for glossy-surface shots, fading with depth. */
  private rebuildReflection() {
    for (const child of [...this.reflection.children]) this.reflection.remove(child);
    this.reflectionClone = null;
    const fx = this.settings?.effects;
    const strength = fx && fx.groundEnabled ? fx.reflection : 0;
    if (strength <= 0.001) return;
    const fade = this.format.height * (0.15 + (1 - (fx?.reflectionFade ?? 0.5)) * 0.6);
    const clone = this.spinGroup.clone(true);
    this.reflectionClone = clone;
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = mesh.material as THREE.MeshPhysicalMaterial;
      if (source === this.dropMaterial || source === this.hazeMaterial) {
        mesh.visible = false;
        return;
      }
      const material = source.clone();
      material.transparent = true;
      material.depthWrite = false;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.reflFade = { value: fade };
        shader.uniforms.reflStrength = { value: strength };
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying float vReflY;")
          .replace("#include <project_vertex>", "#include <project_vertex>\nvReflY = (modelMatrix * vec4(transformed, 1.0)).y;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying float vReflY;\nuniform float reflFade;\nuniform float reflStrength;")
          .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.a *= reflStrength * smoothstep(-reflFade, 0.0, vReflY) * 0.55;");
      };
      material.customProgramCacheKey = () => `reflection-${strength.toFixed(2)}-${fade.toFixed(0)}`;
      mesh.material = material;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    this.reflection.scale.y = -1;
    this.reflection.add(clone);
  }

  private emitInfo() {
    const image = this.artworkImage;
    this.onInfo?.({
      format: this.format,
      placement: this.placement,
      dropCount: this.droplets?.count ?? 0,
      artworkSize: image ? { width: image.naturalWidth, height: image.naturalHeight } : null
    });
  }

  private hit(event: PointerEvent | MouseEvent, objects: THREE.Object3D[]) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(objects, true)[0] ?? null;
  }

  private surfacePoint(event: PointerEvent): THREE.Vector2 | null {
    if (!this.bodyMesh) return null;
    const hit = this.hit(event, [this.bodyMesh]);
    if (!hit?.uv) return null;
    const totalArc = this.arcs[this.arcs.length - 1];
    return new THREE.Vector2(hit.uv.x * Math.PI * this.format.bodyDiameter, hit.uv.y * totalArc);
  }

  private onPointerDown = (event: PointerEvent) => {
    this.pointers.add(event.pointerId);
    if (this.pointers.size > 1) {
      // A second finger hands the stage back to orbit.
      this.endStroke();
      return;
    }
    if (this.interaction === "orbit") return;
    if (this.interaction === "focus") {
      const hit = this.hit(event, [this.canGroup]);
      if (hit) this.onFocusPicked?.([hit.point.x, hit.point.y, hit.point.z]);
      return;
    }
    this.canvas.setPointerCapture(event.pointerId);
    this.stroke = { id: event.pointerId, x: event.clientX, y: event.clientY, last: this.interaction === "water" ? this.surfacePoint(event) : null };
    if (this.interaction === "water") this.applyWaterTool(this.stroke.last, null);
  };

  private onPointerMove = (event: PointerEvent) => {
    const stroke = this.stroke;
    if (!stroke || event.pointerId !== stroke.id) return;
    if (this.interaction === "artwork") {
      const dx = event.clientX - stroke.x;
      const dy = event.clientY - stroke.y;
      stroke.x = event.clientX;
      stroke.y = event.clientY;
      const mm = 1 / this.pixelsPerMm();
      const degPerMm = 360 / (Math.PI * this.format.bodyDiameter);
      this.onArtworkDrag?.(dx * mm * degPerMm, -dy * mm);
      return;
    }
    const point = this.surfacePoint(event);
    this.applyWaterTool(point, stroke.last);
    stroke.last = point;
  };

  private onPointerUp = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    if (this.stroke && event.pointerId === this.stroke.id) this.endStroke();
  };

  private onDoubleClick = () => {
    if (this.interaction === "orbit") this.frameCan();
  };

  private endStroke() {
    if (!this.stroke) return;
    this.stroke = null;
    this.droplets?.endStroke();
  }

  private applyWaterTool(point: THREE.Vector2 | null, previous: THREE.Vector2 | null) {
    const field = this.droplets;
    const water = this.settings?.water;
    if (!field || !water || !point) return;
    const radius = water.brush * 0.5;
    if (water.tool === "spray") field.spray(point.x, point.y, radius, water.size, water.flow);
    if (water.tool === "brush") {
      const c = Math.PI * this.format.bodyDiameter;
      let dx = previous ? point.x - previous.x : 0;
      dx -= Math.round(dx / c) * c;
      const steps = previous ? Math.max(1, Math.ceil(Math.hypot(dx, point.y - previous.y) / Math.max(1, radius * 0.5))) : 1;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        field.brush(previous ? previous.x + dx * t : point.x, previous ? previous.y + (point.y - previous.y) * t : point.y, radius, water.size, water.flow);
      }
    }
    if (water.tool === "erase") field.wipe(point.x, point.y, radius);
  }
}

function contactTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.42, "rgba(0,0,0,0.62)");
  g.addColorStop(0.5, "rgba(0,0,0,0.38)");
  g.addColorStop(0.7, "rgba(0,0,0,0.1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

export function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
}
