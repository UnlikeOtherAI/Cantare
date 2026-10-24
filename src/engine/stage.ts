import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  BloomEffect,
  BrightnessContrastEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  BlendFunction
} from "postprocessing";
import { paintBody, placeArtwork, type ArtworkPlacement } from "./decoration";
import { DropletField } from "./droplets";
import { buildEnvironmentScene, kelvinToColor, lightDirection, solidBackdrop, studioBackdrop } from "./environment";
import { getFormat, type CanFormat } from "./formats";
import { latheGeometry } from "./lathe";
import { lidNormalMap, rivetGeometry, tabGeometry } from "./lidDetail";
import { applySurface, finishValues, surfaceSpec } from "./materials";
import { arcAtHeight, arcLengths, buildProfiles, type CanProfiles } from "./profile";
import type { CameraPreset, CanSettings } from "./settings";
import { loadImage } from "./textures";

const GRADE_SHADER = `
uniform float exposure;
uniform float warmth;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * exposure;
  c *= vec3(1.0 + warmth * 0.07, 1.0 + warmth * 0.01, 1.0 - warmth * 0.08);
  outputColor = vec4(c, inputColor.a);
}`;

class GradeEffect extends Effect {
  constructor() {
    super("GradeEffect", GRADE_SHADER, {
      uniforms: new Map<string, THREE.Uniform>([
        ["exposure", new THREE.Uniform(1)],
        ["warmth", new THREE.Uniform(0)]
      ])
    });
  }
}

export interface StageInfo {
  format: CanFormat;
  placement: ArtworkPlacement | null;
  dropCount: number;
}

export interface ExportOptions {
  width: number;
  height: number;
  type: "image/png" | "image/jpeg";
  quality?: number;
}

/** Owns the WebGL scene for one can and renders it on demand. */
export class CanStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  onInfo: ((info: StageInfo) => void) | null = null;

  private scene = new THREE.Scene();
  private composer: EffectComposer;
  private dof: DepthOfFieldEffect;
  private dofPass: EffectPass;
  private bloom: BloomEffect;
  private grade = new GradeEffect();
  private contrast = new BrightnessContrastEffect();
  private saturation = new HueSaturationEffect();
  private vignette = new VignetteEffect({ offset: 0.32, darkness: 0.3 });
  private noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;

  private spinGroup = new THREE.Group();
  private canGroup = new THREE.Group();
  private lidGroup = new THREE.Group();
  private reflection = new THREE.Group();
  private keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
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
  private format: CanFormat = getFormat("eu-std-440");
  private droplets: DropletField | null = null;
  private placement: ArtworkPlacement | null = null;

  private settings: CanSettings | null = null;
  private artworkImage: HTMLImageElement | null = null;
  private artworkUrl: string | null = null;
  private backgroundImage: HTMLImageElement | null = null;
  private backgroundUrl: string | null = null;
  private backgroundTexture: THREE.Texture | null = null;

  private frames = 2;
  private built = false;
  private disposed = false;
  private pointer: { id: number; x: number; y: number; last: THREE.Vector2 | null } | null = null;
  private raycaster = new THREE.Raycaster();
  private maxTexture: number;

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
    this.controls.addEventListener("change", () => this.invalidate());

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
    this.composer.addPass(new EffectPass(this.camera, this.grade, this.bloom, tone, this.contrast, this.saturation, this.vignette, this.noise));

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

    for (const t of [this.bodyColor, this.bodyOrm]) {
      t.wrapS = THREE.RepeatWrapping;
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }
    this.bodyColor.colorSpace = THREE.SRGBColorSpace;
    this.bodyMaterial.map = this.bodyColor;
    this.bodyMaterial.roughnessMap = this.bodyOrm;
    this.bodyMaterial.metalnessMap = this.bodyOrm;

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    this.renderer.setAnimationLoop(this.tick);
  }

  invalidate(frames = 2) {
    this.frames = Math.max(this.frames, frames);
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.fitBackground(width / height);
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
    if (formatChanged || prev!.body !== next.body || prev!.artwork !== next.artwork || !prev) this.paint(next);
    if (formatChanged || prev!.lid !== next.lid || prev!.lidRotation !== next.lidRotation) this.applyLid(next);
    const backdropChanged = !prev || prev.background.kind !== next.background.kind || prev.background.imageUrl !== next.background.imageUrl;
    if (!prev || prev.lighting !== next.lighting || backdropChanged) this.applyLighting(next);
    if (formatChanged || prev!.water !== next.water) this.applyWater(next, prev);
    if (!prev || prev.effects !== next.effects || formatChanged) this.applyEffects(next);
    if (!prev || prev.background !== next.background) this.applyBackground(next);
    this.spinGroup.rotation.y = THREE.MathUtils.degToRad(next.spin);
    this.rebuildReflection();
    this.emitInfo();
    this.invalidate();
  }

  setCameraPreset(preset: CameraPreset, animate = true) {
    const H = this.format.height;
    const target = new THREE.Vector3(0, H * 0.5, 0);
    const fit = this.fitDistance();
    const angles: Record<CameraPreset, { az: number; polar: number; dist: number; ty: number }> = {
      front: { az: 0, polar: 1.48, dist: fit, ty: H * 0.5 },
      "three-quarter": { az: 0.62, polar: 1.25, dist: fit * 1.02, ty: H * 0.5 },
      top: { az: 0.2, polar: 0.42, dist: fit * 0.92, ty: H * 0.62 },
      hero: { az: -0.35, polar: 1.63, dist: fit * 0.9, ty: H * 0.56 }
    };
    const a = angles[preset];
    target.y = a.ty;
    const end = new THREE.Vector3().setFromSphericalCoords(a.dist, a.polar, a.az).add(target);
    if (!animate) {
      this.controls.target.copy(target);
      this.camera.position.copy(end);
      this.controls.update();
      this.invalidate();
      return;
    }
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startTime = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - startTime) / 650);
      const k = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(startPos, end, k);
      this.controls.target.lerpVectors(startTarget, target, k);
      this.controls.update();
      this.invalidate();
      if (t < 1 && !this.disposed) requestAnimationFrame(step);
    };
    step();
  }

  clearWater() {
    this.droplets?.clear();
    this.invalidate();
    this.emitInfo();
  }

  /** Render at an arbitrary resolution and return the encoded image. */
  async exportImage(options: ExportOptions): Promise<Blob> {
    const max = this.maxExportSize();
    const scale = Math.min(1, max / Math.max(options.width, options.height));
    const width = Math.round(options.width * scale);
    const height = Math.round(options.height * scale);
    const size = this.renderer.getSize(new THREE.Vector2());
    const ratio = this.renderer.getPixelRatio();

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.fitBackground(width / height);
    this.droplets?.render();
    this.composer.render();
    const blob = await new Promise<Blob | null>((resolve) => this.canvas.toBlob(resolve, options.type, options.quality ?? 0.95));

    this.renderer.setPixelRatio(ratio);
    this.resize(size.x, size.y);
    this.composer.render();
    if (!blob) throw new Error("The browser could not encode the image");
    return blob;
  }

  maxExportSize() {
    const gl = this.renderer.getContext();
    const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    return Math.min(8192, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number, dims[0], dims[1]);
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.controls.dispose();
    this.composer.dispose();
    this.pmrem.dispose();
    this.envTarget?.dispose();
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------------------

  private tick = () => {
    if (this.controls.update()) this.frames = Math.max(this.frames, 1);
    if (this.pointer && this.settings?.water.tool === "spray" && this.pointer.last) {
      this.droplets?.spray(this.pointer.last.x, this.pointer.last.y, this.settings.water.brush * 0.5, this.settings.water.size);
    }
    if (this.droplets?.render()) {
      this.frames = Math.max(this.frames, 1);
      this.emitInfo();
    }
    if (this.frames <= 0) return;
    this.frames--;
    this.composer.render();
  };

  private fitDistance() {
    const H = this.format.height;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = Math.max(0.4, this.camera.aspect);
    const vertical = (H * 0.68) / Math.tan(fov / 2);
    const horizontal = (this.format.bodyDiameter * 1.4) / (Math.tan(fov / 2) * aspect);
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
    tab.position.z = 0;
    this.lidGroup.add(lid, tab, rivet);
    for (const mesh of [body, dome, lid, tab, rivet]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    this.bodyMesh = body;

    const bounds = { low: arcAtHeight(profiles.body, this.arcs, 0.8), high: arcAtHeight(profiles.body, this.arcs, landmarks.neckTop - 0.4) };
    const drops = new THREE.Mesh(latheGeometry(profiles.body, { segments, uv: { mode: "arc", vLength: totalArc }, offset: 0.05 }), this.dropMaterial);
    const haze = new THREE.Mesh(latheGeometry(profiles.body, { segments, uv: { mode: "arc", vLength: totalArc }, offset: 0.025 }), this.hazeMaterial);
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

    this.controls.minDistance = H * 0.55;
    this.controls.maxDistance = H * 9;
    this.setCameraPreset("three-quarter", this.built);
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
      const stock = settings.artwork.labelStock === "paper" ? finishValues("matte", false) : finishValues("gloss", false);
      Object.assign(this.labelMaterial, {
        map: this.labelTexture,
        roughness: settings.artwork.labelStock === "paper" ? 0.62 : stock.roughness,
        clearcoat: stock.clearcoat,
        clearcoatRoughness: stock.clearcoatRoughness,
        sheen: settings.artwork.labelStock === "paper" ? 0.25 : 0,
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
    const spec = surfaceSpec(settings.lid);
    applySurface(this.lidMaterial, spec);
    if (!this.lidMaterial.normalMap || this.lidMaterial.userData.formatId !== this.format.id) {
      this.lidMaterial.normalMap?.dispose();
      this.lidMaterial.normalMap = lidNormalMap(this.profiles.landmarks.rimRadius, this.profiles.landmarks.panelRadius);
      this.lidMaterial.normalScale.set(1, 1);
      this.lidMaterial.userData.formatId = this.format.id;
      this.lidMaterial.needsUpdate = true;
    }
    this.lidGroup.rotation.y = THREE.MathUtils.degToRad(settings.lidRotation);
  }

  private applyLighting(settings: CanSettings) {
    const { lighting } = settings;
    const photo = lighting.matchBackground && settings.background.kind === "image" ? this.backgroundImage : null;
    const envScene = buildEnvironmentScene(lighting, photo);
    const next = this.pmrem.fromScene(envScene, 0.015);
    envScene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      (mesh.material as THREE.Material | undefined)?.dispose?.();
    });
    this.envTarget?.dispose();
    this.envTarget = next;
    this.scene.environment = next.texture;
    this.scene.environmentIntensity = 1;

    const dir = lightDirection(lighting.azimuth, lighting.elevation);
    const H = this.format.height;
    this.keyLight.position.copy(dir.multiplyScalar(1500)).add(new THREE.Vector3(0, H * 0.5, 0));
    this.keyLight.target.position.set(0, H * 0.4, 0);
    this.keyLight.color.copy(kelvinToColor(lighting.temperature));
    this.keyLight.intensity = 0.9 * lighting.intensity * (lighting.environment === "daylight" ? 2.2 : 1);
    this.keyLight.shadow.radius = 3 + lighting.softness * 22;
    this.grade.uniforms.get("exposure")!.value = lighting.exposure;
    this.dropCaustic.value = 0.32 * lighting.intensity * (lighting.environment === "noir" ? 0.5 : 1);
  }

  private applyWater(settings: CanSettings, prev: CanSettings | null) {
    const water = settings.water;
    const field = this.droplets;
    if (!field) return;
    if (!prev || prev.water.density !== water.density || prev.water.size !== water.size || prev.water.seed !== water.seed) {
      if (water.density > 0 || prev) field.scatter(water.density, water.size, water.seed);
    }
    this.hazeMaterial.opacity = Math.pow(water.haze, 1.5) * 0.95;
    this.hazeMaterial.visible = water.haze > 0;
    this.controls.enableRotate = water.tool === "none";
    this.canvas.style.cursor = water.tool === "none" ? "grab" : "crosshair";
  }

  private applyEffects(settings: CanSettings) {
    const fx = settings.effects;
    this.dofPass.enabled = fx.depthOfField > 0.001;
    this.dof.bokehScale = fx.depthOfField * 7;
    this.dof.cocMaterial.focusRange = THREE.MathUtils.lerp(260, 40, fx.depthOfField);
    this.dof.target = new THREE.Vector3(0, this.format.height * 0.5, 0);
    this.bloom.intensity = fx.bloom * 1.6;
    this.vignette.darkness = fx.vignette * 0.75;
    this.noise.blendMode.opacity.value = fx.grain * 0.22;
    this.contrast.contrast = fx.contrast * 0.5;
    this.saturation.saturation = fx.saturation * 0.6;
    this.grade.uniforms.get("warmth")!.value = fx.warmth;
    this.ground.material.opacity = fx.shadow * 0.62;
    this.contact.material.opacity = fx.shadow;
    this.ground.visible = this.contact.visible = fx.shadow > 0.001;
  }

  private applyBackground(settings: CanSettings) {
    const bg = settings.background;
    this.backgroundTexture?.dispose();
    this.backgroundTexture = null;
    this.renderer.setClearColor(0x000000, bg.kind === "transparent" ? 0 : 1);
    switch (bg.kind) {
      case "studio":
        this.backgroundTexture = studioBackdrop(bg.color2, bg.color);
        break;
      case "solid":
        this.backgroundTexture = solidBackdrop(bg.color);
        break;
      case "gradient":
        this.backgroundTexture = solidBackdrop(bg.color, bg.color2);
        break;
      case "image":
        if (this.backgroundImage) {
          this.backgroundTexture = new THREE.Texture(this.backgroundImage);
          this.backgroundTexture.colorSpace = THREE.SRGBColorSpace;
          this.backgroundTexture.needsUpdate = true;
        }
        break;
    }
    this.scene.background = this.backgroundTexture;
    this.fitBackground(this.camera.aspect);
  }

  /** Cover-fit image backgrounds to the viewport. */
  private fitBackground(viewAspect: number) {
    const texture = this.backgroundTexture;
    if (!texture) return;
    const image = texture.image as { width: number; height: number } | undefined;
    const imageAspect = image && this.settings?.background.kind === "image" ? image.width / image.height : viewAspect;
    texture.matrixAutoUpdate = false;
    if (imageAspect > viewAspect) {
      const repeat = viewAspect / imageAspect;
      texture.matrix.setUvTransform((1 - repeat) / 2, 0, repeat, 1, 0, 0, 0);
    } else {
      const repeat = imageAspect / viewAspect;
      texture.matrix.setUvTransform(0, (1 - repeat) / 2, 1, repeat, 0, 0, 0);
    }
  }

  /** Mirror the can under the floor for glossy-surface shots, fading with depth. */
  private rebuildReflection() {
    for (const child of [...this.reflection.children]) this.reflection.remove(child);
    const strength = this.settings?.effects.reflection ?? 0;
    if (strength <= 0.001) return;
    const fade = this.format.height * 0.45;
    const clone = this.spinGroup.clone(true);
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
      material.customProgramCacheKey = () => `reflection-${strength.toFixed(2)}`;
      mesh.material = material;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    });
    clone.scale.y = -1;
    this.reflection.add(clone);
  }

  private emitInfo() {
    this.onInfo?.({ format: this.format, placement: this.placement, dropCount: this.droplets?.count ?? 0 });
  }

  private surfacePoint(event: PointerEvent): THREE.Vector2 | null {
    if (!this.bodyMesh) return null;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.bodyMesh, false)[0];
    if (!hit?.uv) return null;
    const totalArc = this.arcs[this.arcs.length - 1];
    return new THREE.Vector2(hit.uv.x * Math.PI * this.format.bodyDiameter, hit.uv.y * totalArc);
  }

  private onPointerDown = (event: PointerEvent) => {
    const tool = this.settings?.water.tool ?? "none";
    if (tool === "none" || !event.isPrimary) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, last: this.surfacePoint(event) };
    this.applyTool(this.pointer.last, null);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    const point = this.surfacePoint(event);
    this.applyTool(point, this.pointer.last);
    this.pointer.last = point;
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.pointer || event.pointerId !== this.pointer.id) return;
    this.pointer = null;
    this.droplets?.endStroke();
  };

  private applyTool(point: THREE.Vector2 | null, previous: THREE.Vector2 | null) {
    const field = this.droplets;
    const water = this.settings?.water;
    if (!field || !water || !point) return;
    const radius = water.brush * 0.5;
    if (water.tool === "spray") field.spray(point.x, point.y, radius, water.size);
    if (water.tool === "spread" && previous) {
      const c = Math.PI * this.format.bodyDiameter;
      let dx = point.x - previous.x;
      dx -= Math.round(dx / c) * c;
      field.spread(point.x, point.y, dx, point.y - previous.y, radius);
    }
    if (water.tool === "wipe") field.wipe(point.x, point.y, radius);
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
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
}
