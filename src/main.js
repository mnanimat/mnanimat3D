import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// TOAST NOTIFICATION UTILITY
export function toast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast-message';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// STUDIO APPLICATION STATE & SCENE SETUP
class MNAnimatStudio {
  constructor() {
    this.canvas = document.getElementById('three-canvas');
    this.container = document.getElementById('viewport-container');

    // Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1120');

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(8, 6, 12);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Controls
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.05;

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.scene.add(this.transformControls.getHelper());

    // Selection & History State
    this.selectedObject = null;
    this.objects = [];

    // CAD Sketch State
    this.isCadActive = false;
    this.cadSketchPoints = [];
    this.cadLineMesh = null;
    this.cadHistory = [[]];
    this.cadRedoStack = [];

    // Sculpting State
    this.isSculptActive = false;
    this.sculptRadius = 1.2;
    this.sculptStrength = 0.15;

    // Measurements & Angles Visibility
    this.showDimensions = true;
    this.showAngles = true;

    // Animation Keyframes
    this.keyframes = []; // [{ frame, objectName, pos, rot, scale }]
    this.currentFrame = 0;
    this.maxFrames = 100;
    this.isPlaying = false;
    this.animTimer = null;

    // Raycaster for Picking & Drawing
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.initLightingAndGrid();
    this.initDefaultScene();
    this.initEventListeners();
    this.initOnboardingLegalGate();
    this.animate();
  }

  initLightingAndGrid() {
    // Grid Helper
    const grid = new THREE.GridHelper(20, 20, 0x0284c7, 0x1e293b);
    grid.position.y = 0;
    this.scene.add(grid);

    // Ambient Light
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    // Main Directional Sun Light
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(10, 15, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    this.scene.add(sun);

    // Secondary Fill Light
    const fill = new THREE.DirectionalLight(0x38bdf8, 0.4);
    fill.position.set(-10, 10, -8);
    this.scene.add(fill);
  }

  initDefaultScene() {
    // Add default cube
    this.createPrimitive('cube', 'Cubo Principal');
  }

  createPrimitive(type, customName = null) {
    let geometry, material;
    const name = customName || `${type.charAt(0).toUpperCase() + type.slice(1)}_${this.objects.length + 1}`;

    const defaultMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.3,
      metalness: 0.2
    });

    switch (type) {
      case 'cube':
        geometry = new THREE.BoxGeometry(2, 2, 2);
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(1.2, 32, 32);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(1, 1, 2.5, 32);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(1.2, 2.5, 32);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(1.2, 0.4, 24, 48);
        break;
      case 'plane':
        geometry = new THREE.PlaneGeometry(4, 4);
        break;
      case 'pointlight': {
        const light = new THREE.PointLight(0xfef08a, 2, 20);
        light.position.set(0, 4, 0);
        light.name = name;
        const helper = new THREE.PointLightHelper(light, 0.5);
        this.scene.add(light);
        this.scene.add(helper);
        this.selectObject(light);
        toast(`💡 Luz Ponto criada!`);
        return light;
      }
      case 'directionallight': {
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 8, 5);
        light.name = name;
        this.scene.add(light);
        this.selectObject(light);
        toast(`☀️ Luz direcional criada!`);
        return light;
      }
      case 'spotlight': {
        const light = new THREE.SpotLight(0xa855f7, 3, 25, Math.PI / 4);
        light.position.set(0, 6, 0);
        light.name = name;
        this.scene.add(light);
        this.selectObject(light);
        toast(`🔦 Spotlight criada!`);
        return light;
      }
      case 'camera': {
        const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        cam.position.set(0, 2, 5);
        cam.name = name;
        const helper = new THREE.CameraHelper(cam);
        this.scene.add(cam);
        this.scene.add(helper);
        this.selectObject(cam);
        toast(`📷 Câmera 3D criada!`);
        return cam;
      }
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    const mesh = new THREE.Mesh(geometry, defaultMat);
    mesh.position.set(0, type === 'plane' ? 0.01 : 1, 0);
    if (type === 'plane') mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;

    this.scene.add(mesh);
    this.objects.push(mesh);
    this.selectObject(mesh);
    toast(`📦 ${name} adicionado ao cenário!`);
    return mesh;
  }

  applyMaterialPreset(preset) {
    if (!this.selectedObject || !this.selectedObject.isMesh) {
      toast('⚠️ Selecione um objeto 3D para aplicar o material.');
      return;
    }

    let mat;
    switch (preset) {
      case 'gold':
        mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.15, metalness: 0.9 });
        break;
      case 'metal':
        mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2, metalness: 0.85 });
        break;
      case 'plastic':
        mat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4, metalness: 0.05 });
        break;
      case 'glass':
        mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, opacity: 1, transparent: true, roughness: 0.05, ior: 1.5 });
        break;
      case 'neon':
        mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        break;
      case 'wood':
        mat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8, metalness: 0.0 });
        break;
      default:
        mat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
    }

    this.selectedObject.material = mat;
    this.updateInspectorUI();
    toast(`🎨 Material '${preset}' aplicado a ${this.selectedObject.name}`);
  }

  selectObject(obj) {
    this.selectedObject = obj;
    if (obj && (obj.isMesh || obj.isLight || obj.isCamera)) {
      this.transformControls.attach(obj);
    } else {
      this.transformControls.detach();
    }
    this.updateInspectorUI();
  }

  deleteSelectedObject() {
    if (!this.selectedObject) return;
    const name = this.selectedObject.name;
    this.transformControls.detach();
    this.scene.remove(this.selectedObject);
    if (this.selectedObject.geometry) this.selectedObject.geometry.dispose();
    this.objects = this.objects.filter(o => o !== this.selectedObject);
    this.selectedObject = null;
    this.updateInspectorUI();
    toast(`🗑️ ${name} removido.`);
  }

  updateInspectorUI() {
    const nameInput = document.getElementById('prop-object-name');
    const px = document.getElementById('prop-pos-x');
    const py = document.getElementById('prop-pos-y');
    const pz = document.getElementById('prop-pos-z');
    const rx = document.getElementById('prop-rot-x');
    const ry = document.getElementById('prop-rot-y');
    const rz = document.getElementById('prop-rot-z');
    const sx = document.getElementById('prop-scale-x');
    const sy = document.getElementById('prop-scale-y');
    const sz = document.getElementById('prop-scale-z');
    const colInput = document.getElementById('prop-material-color');
    const wireCheck = document.getElementById('prop-wireframe-toggle');

    if (!this.selectedObject) {
      if (nameInput) nameInput.value = 'Nenhum Selecionado';
      return;
    }

    if (nameInput) nameInput.value = this.selectedObject.name || 'Objeto';
    if (px) px.value = this.selectedObject.position.x.toFixed(2);
    if (py) py.value = this.selectedObject.position.y.toFixed(2);
    if (pz) pz.value = this.selectedObject.position.z.toFixed(2);

    if (rx) rx.value = (this.selectedObject.rotation.x * 180 / Math.PI).toFixed(0);
    if (ry) ry.value = (this.selectedObject.rotation.y * 180 / Math.PI).toFixed(0);
    if (rz) rz.value = (this.selectedObject.rotation.z * 180 / Math.PI).toFixed(0);

    if (sx) sx.value = this.selectedObject.scale.x.toFixed(2);
    if (sy) sy.value = this.selectedObject.scale.y.toFixed(2);
    if (sz) sz.value = this.selectedObject.scale.z.toFixed(2);

    if (this.selectedObject.material && colInput) {
      if (this.selectedObject.material.color) {
        colInput.value = '#' + this.selectedObject.material.color.getHexString();
      }
      if (wireCheck) {
        wireCheck.checked = !!this.selectedObject.material.wireframe;
      }
    }
  }

  // CAD SKETCHER METHODS
  toggleCadMode() {
    this.isCadActive = !this.isCadActive;
    const bar = document.getElementById('v3-cad-floating-constraints');
    const btn = document.getElementById('btn-toggle-cad-mode');

    if (this.isCadActive) {
      if (bar) bar.style.display = 'flex';
      if (btn) btn.classList.add('active');
      this.orbit.enabled = false;
      toast('✏️ Modo Esboço CAD Ativado. Clique no chão/espaço para colocar pontos.');
    } else {
      if (bar) bar.style.display = 'none';
      if (btn) btn.classList.remove('active');
      this.orbit.enabled = true;
      toast('⏹️ Modo Esboço CAD Desativado.');
    }
  }

  saveCadState() {
    this.cadHistory.push(this.cadSketchPoints.map(p => p.clone()));
    if (this.cadHistory.length > 50) this.cadHistory.shift();
    this.cadRedoStack = [];
  }

  undoCad() {
    if (this.cadHistory.length > 1) {
      const current = this.cadHistory.pop();
      this.cadRedoStack.push(current);
      const prev = this.cadHistory[this.cadHistory.length - 1];
      this.cadSketchPoints = prev.map(p => p.clone());
      this.updateCadMesh();
      toast('↩️ Esboço CAD Desfeito (Ctrl+Z)');
    }
  }

  redoCad() {
    if (this.cadRedoStack.length > 0) {
      const restored = this.cadRedoStack.pop();
      this.cadHistory.push(restored);
      this.cadSketchPoints = restored.map(p => p.clone());
      this.updateCadMesh();
      toast('↪️ Esboço CAD Refeito (Ctrl+Y)');
    }
  }

  updateCadMesh() {
    if (this.cadLineMesh) {
      this.scene.remove(this.cadLineMesh);
      if (this.cadLineMesh.geometry) this.cadLineMesh.geometry.dispose();
    }

    if (this.cadSketchPoints.length < 2) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(this.cadSketchPoints);
    const material = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 });
    this.cadLineMesh = new THREE.Line(geometry, material);
    this.scene.add(this.cadLineMesh);
  }

  extrudeCadSketch() {
    if (this.cadSketchPoints.length < 3) {
      toast('⚠️ Desenhe pelo menos 3 pontos no esboço CAD para extruir um sólido.');
      return;
    }

    const shape = new THREE.Shape();
    shape.moveTo(this.cadSketchPoints[0].x, this.cadSketchPoints[0].z);
    for (let i = 1; i < this.cadSketchPoints.length; i++) {
      shape.lineTo(this.cadSketchPoints[i].x, this.cadSketchPoints[i].z);
    }
    shape.closePath();

    const extrudeSettings = { depth: 2, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.1, bevelThickness: 0.1 };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.2 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0;
    mesh.name = `Extrusao_CAD_${this.objects.length + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);
    this.objects.push(mesh);
    this.selectObject(mesh);

    // Clear CAD Sketch
    this.cadSketchPoints = [];
    this.updateCadMesh();
    this.toggleCadMode();
    toast('🧱 Modelo CAD 3D extruído com sucesso!');
  }

  // REAL-TIME 3D MEASUREMENT & ANGLE OVERLAY
  update3DMeasurementOverlay() {
    const container = document.getElementById('v3-3d-measurements-overlay');
    if (!container) return;

    if (!this.showDimensions && !this.showAngles) {
      container.innerHTML = '';
      return;
    }

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    const projectToScreen = (v3) => {
      const temp = v3.clone().project(this.camera);
      return {
        x: (temp.x * 0.5 + 0.5) * width,
        y: (-(temp.y * 0.5) + 0.5) * height,
        visible: temp.z < 1.0
      };
    };

    let html = '';

    // 1. CAD Sketch Lines & Angles
    if (this.cadSketchPoints.length >= 2) {
      for (let i = 0; i < this.cadSketchPoints.length - 1; i++) {
        const p1 = this.cadSketchPoints[i];
        const p2 = this.cadSketchPoints[i + 1];
        const distM = p1.distanceTo(p2);
        const distMM = Math.round(distM * 1000);

        if (this.showDimensions) {
          const mid = p1.clone().add(p2).multiplyScalar(0.5);
          const scr = projectToScreen(mid);
          if (scr.visible && scr.x > 10 && scr.x < width - 10 && scr.y > 10 && scr.y < height - 10) {
            html += `<div class="v3-measure-badge" style="left:${scr.x.toFixed(1)}px;top:${scr.y.toFixed(1)}px;">📏 L${i + 1}: ${distMM}mm (${distM.toFixed(2)}m)</div>`;
          }
        }

        if (this.showAngles && i > 0) {
          const p0 = this.cadSketchPoints[i - 1];
          const v1 = p0.clone().sub(p1).normalize();
          const v2 = p2.clone().sub(p1).normalize();
          const dot = Math.min(Math.max(v1.dot(v2), -1.0), 1.0);
          const angleDeg = Math.acos(dot) * (180 / Math.PI);
          const scr = projectToScreen(p1);
          if (scr.visible && scr.x > 10 && scr.x < width - 10 && scr.y > 10 && scr.y < height - 10) {
            html += `<div class="v3-angle-badge" style="left:${scr.x.toFixed(1)}px;top:${scr.y.toFixed(1)}px;">📐 ∠${angleDeg.toFixed(1)}°</div>`;
          }
        }
      }
    }

    // 2. Selected Mesh Dimensions & Rotation Angles
    if (this.selectedObject && this.selectedObject.isMesh) {
      const box = new THREE.Box3().setFromObject(this.selectedObject);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scr = projectToScreen(center);

      if (scr.visible && scr.x > 10 && scr.x < width - 10 && scr.y > 10 && scr.y < height - 10) {
        if (this.showDimensions) {
          html += `<div class="v3-measure-badge" style="left:${scr.x.toFixed(1)}px;top:${(scr.y - 28).toFixed(1)}px;background:rgba(2,132,199,0.95);color:#fff;border-color:#38bdf8;">📏 ${this.selectedObject.name}: X=${size.x.toFixed(2)}m × Y=${size.y.toFixed(2)}m × Z=${size.z.toFixed(2)}m</div>`;
        }
        if (this.showAngles) {
          const rx = (this.selectedObject.rotation.x * 180 / Math.PI).toFixed(1);
          const ry = (this.selectedObject.rotation.y * 180 / Math.PI).toFixed(1);
          const rz = (this.selectedObject.rotation.z * 180 / Math.PI).toFixed(1);
          html += `<div class="v3-angle-badge" style="left:${scr.x.toFixed(1)}px;top:${(scr.y + 20).toFixed(1)}px;">📐 Rotação: X:${rx}° Y:${ry}° Z:${rz}°</div>`;
        }
      }
    }

    container.innerHTML = html;
  }

  // EXPORT / SAVE / LOAD
  exportGLTF() {
    const exporter = new GLTFExporter();
    exporter.parse(
      this.scene,
      (gltf) => {
        const output = JSON.stringify(gltf, null, 2);
        const blob = new Blob([output], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mnanimat3d_scene_${Date.now()}.gltf`;
        link.click();
        toast('💾 Exportação GLTF concluída com sucesso!');
      },
      (error) => {
        console.error('Error exporting GLTF', error);
        toast('❌ Erro ao exportar GLTF.');
      },
      { binary: false }
    );
  }

  saveProjectJSON() {
    const data = {
      version: '3.5.0',
      timestamp: Date.now(),
      objects: this.objects.map(obj => ({
        name: obj.name,
        type: obj.geometry?.type || 'Mesh',
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        color: '#' + (obj.material?.color?.getHexString() || '38bdf8')
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `mnanimat3d_project_${Date.now()}.json`;
    link.click();
    toast('💾 Projeto salvo em formato JSON!');
  }

  loadProjectJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.objects && Array.isArray(data.objects)) {
          // Clear scene objects
          this.objects.forEach(obj => this.scene.remove(obj));
          this.objects = [];

          data.objects.forEach(item => {
            const mesh = this.createPrimitive('cube', item.name);
            mesh.position.set(...item.position);
            mesh.rotation.set(...item.rotation);
            mesh.scale.set(...item.scale);
            if (mesh.material) mesh.material.color.set(item.color || '#38bdf8');
          });

          toast('📂 Projeto carregado com sucesso!');
        }
      } catch (err) {
        toast('❌ Arquivo de projeto JSON inválido.');
      }
    };
    reader.readAsText(file);
  }

  // KEYFRAME ANIMATION
  addKeyframe() {
    if (!this.selectedObject) {
      toast('⚠️ Selecione um objeto para adicionar Keyframe.');
      return;
    }

    this.keyframes.push({
      frame: this.currentFrame,
      objectName: this.selectedObject.name,
      pos: this.selectedObject.position.clone(),
      rot: this.selectedObject.rotation.clone(),
      scale: this.selectedObject.scale.clone()
    });

    toast(`🔑 Keyframe salvo no Frame ${this.currentFrame} para ${this.selectedObject.name}!`);
  }

  playAnimation() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    this.animTimer = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % (this.maxFrames + 1);
      const txt = document.getElementById('txt-current-frame');
      const bar = document.getElementById('timeline-scrubber-bar');

      if (txt) txt.textContent = `Frame: ${this.currentFrame} / ${this.maxFrames}`;
      if (bar) bar.style.left = `${(this.currentFrame / this.maxFrames) * 100}%`;

      // Interpolate object transforms matching current keyframes
      this.keyframes.forEach(kf => {
        if (kf.frame === this.currentFrame) {
          const obj = this.scene.getObjectByName(kf.objectName);
          if (obj) {
            obj.position.copy(kf.pos);
            obj.rotation.copy(kf.rot);
            obj.scale.copy(kf.scale);
            this.updateInspectorUI();
          }
        }
      });
    }, 1000 / 30);

    toast('▶ Reproduzindo animação...');
  }

  pauseAnimation() {
    this.isPlaying = false;
    if (this.animTimer) clearInterval(this.animTimer);
    toast('⏸ Animação pausada.');
  }

  // ONBOARDING & LGPD COMPLIANCE
  initOnboardingLegalGate() {
    const onboardingGate = document.getElementById('onboarding-legal-gate');
    const countrySelect = document.getElementById('onboarding-country-select');
    const ageInput = document.getElementById('onboarding-user-age');
    const ageNotice = document.getElementById('onboarding-age-notice');
    const chkTerms = document.getElementById('onboarding-chk-terms');
    const chkAge = document.getElementById('onboarding-chk-age');
    const btnAcceptEnter = document.getElementById('onboarding-btn-accept-and-enter');

    const hasAccepted = localStorage.getItem('mn_compliance_v1') === 'true';
    if (onboardingGate && !hasAccepted) {
      onboardingGate.classList.remove('hidden');
    }

    const updateAgeNotice = () => {
      if (!ageNotice || !ageInput) return;
      const age = parseInt(ageInput.value || '0', 10);
      const country = countrySelect?.value || 'BR';

      if (isNaN(age) || age <= 0) {
        ageNotice.style.color = '#ef4444';
        ageNotice.innerHTML = '❌ Idade inválida. Digite sua idade real em anos.';
        return;
      }

      if (age < 18) {
        ageNotice.style.color = '#f59e0b';
        if (country === 'BR') {
          ageNotice.innerHTML = `⚠️ <strong>Usuário Menor de Idade (${age} anos):</strong> Segundo a LGPD (Lei nº 13.709/2018) e o ECA (Lei 8.069/90), o uso por menores requer autorização ou supervisão dos pais/responsáveis.`;
        } else {
          ageNotice.innerHTML = `⚠️ <strong>Minor User (${age} years old):</strong> Compliant with COPPA & GDPR. Parent or legal guardian permission required.`;
        }
      } else {
        ageNotice.style.color = '#34d399';
        ageNotice.innerHTML = `✓ <strong>Usuário Maior de Idade (${age} anos):</strong> Plena capacidade civil para utilizar o estúdio MNAnimat3D e aceitar a Licença MIT.`;
      }

      validateForm();
    };

    const validateForm = () => {
      if (!btnAcceptEnter) return;
      const age = parseInt(ageInput?.value || '0', 10);
      const validAge = !isNaN(age) && age > 0 && age <= 120;
      const termsChecked = chkTerms?.checked || false;
      const ageChecked = chkAge?.checked || false;

      if (validAge && termsChecked && ageChecked) {
        btnAcceptEnter.disabled = false;
        btnAcceptEnter.style.background = '#0284c7';
        btnAcceptEnter.style.color = '#ffffff';
        btnAcceptEnter.style.cursor = 'pointer';
      } else {
        btnAcceptEnter.disabled = true;
        btnAcceptEnter.style.background = '#334155';
        btnAcceptEnter.style.color = '#94a3b8';
        btnAcceptEnter.style.cursor = 'not-allowed';
      }
    };

    ageInput?.addEventListener('input', updateAgeNotice);
    countrySelect?.addEventListener('change', updateAgeNotice);
    chkTerms?.addEventListener('change', validateForm);
    chkAge?.addEventListener('change', validateForm);

    btnAcceptEnter?.addEventListener('click', () => {
      const age = ageInput?.value || '18';
      const country = countrySelect?.value || 'BR';
      localStorage.setItem('mn_compliance_v1', 'true');
      localStorage.setItem('mn_user_age', age);
      localStorage.setItem('mn_user_country', country);
      onboardingGate?.classList.add('hidden');
      toast(`⚖️ Termos e LGPD aceitos! Bem-vindo ao MNAnimat3D Studio.`);
    });

    // Legal terms modal toggle
    const legalModal = document.getElementById('legal-modal');
    document.querySelectorAll('#open-legal-btn, #onboarding-btn-open-full-legal').forEach(btn => {
      btn.addEventListener('click', () => {
        legalModal?.classList.remove('hidden');
      });
    });
    document.getElementById('close-legal-modal')?.addEventListener('click', () => {
      legalModal?.classList.add('hidden');
    });

    updateAgeNotice();
  }

  initEventListeners() {
    // Window Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    });

    // Primitive creation buttons
    document.querySelectorAll('[data-create]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.getAttribute('data-create');
        this.createPrimitive(type);
      });
    });

    // Material preset buttons
    document.querySelectorAll('[data-mat]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = e.currentTarget.getAttribute('data-mat');
        this.applyMaterialPreset(preset);
      });
    });

    // CAD Sketch Buttons
    document.getElementById('btn-toggle-cad-mode')?.addEventListener('click', () => this.toggleCadMode());
    document.getElementById('btn-extrude-cad-sketch')?.addEventListener('click', () => this.extrudeCadSketch());
    document.getElementById('v3-cad-undo-btn')?.addEventListener('click', () => this.undoCad());
    document.getElementById('v3-cad-redo-btn')?.addEventListener('click', () => this.redoCad());

    // Measurement Toggles
    document.getElementById('v3-cad-toggle-measures-btn')?.addEventListener('click', () => {
      this.showDimensions = !this.showDimensions;
      toast(this.showDimensions ? '📏 Exibição de Medidas Ativada' : '📏 Medidas Ocultas');
    });
    document.getElementById('v3-cad-toggle-angles-btn')?.addEventListener('click', () => {
      this.showAngles = !this.showAngles;
      toast(this.showAngles ? '📐 Exibição de Ângulos Ativada' : '📐 Ângulos Ocultos');
    });

    // Canvas click for Raycasting & CAD Drawing
    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isCadActive) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const point = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(plane, point)) {
          this.saveCadState();
          this.cadSketchPoints.push(point.clone());
          this.updateCadMesh();
          toast(`📍 Ponto CAD adicionado: X:${point.x.toFixed(1)}, Z:${point.z.toFixed(1)}`);
        }
        return;
      }

      // Pick Object
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.objects, true);
      if (intersects.length > 0) {
        this.selectObject(intersects[0].object);
      }
    });

    // TransformControls drag listener to update Inspector
    this.transformControls.addEventListener('change', () => this.updateInspectorUI());

    // Inspector Inputs
    document.getElementById('prop-pos-x')?.addEventListener('input', (e) => { if (this.selectedObject) this.selectedObject.position.x = parseFloat(e.target.value) || 0; });
    document.getElementById('prop-pos-y')?.addEventListener('input', (e) => { if (this.selectedObject) this.selectedObject.position.y = parseFloat(e.target.value) || 0; });
    document.getElementById('prop-pos-z')?.addEventListener('input', (e) => { if (this.selectedObject) this.selectedObject.position.z = parseFloat(e.target.value) || 0; });

    document.getElementById('prop-material-color')?.addEventListener('input', (e) => {
      if (this.selectedObject && this.selectedObject.material) {
        this.selectedObject.material.color.set(e.target.value);
      }
    });

    document.getElementById('prop-wireframe-toggle')?.addEventListener('change', (e) => {
      if (this.selectedObject && this.selectedObject.material) {
        this.selectedObject.material.wireframe = e.target.checked;
      }
    });

    document.getElementById('btn-delete-object')?.addEventListener('click', () => this.deleteSelectedObject());

    // Export & Save / Load Actions
    document.getElementById('btn-export-gltf')?.addEventListener('click', () => this.exportGLTF());
    document.getElementById('btn-save-project')?.addEventListener('click', () => this.saveProjectJSON());
    document.getElementById('btn-load-project')?.addEventListener('click', () => document.getElementById('input-project-load')?.click());
    document.getElementById('input-project-load')?.addEventListener('change', (e) => {
      if (e.target.files.length > 0) this.loadProjectJSON(e.target.files[0]);
    });

    // Animation Timeline Actions
    document.getElementById('btn-add-keyframe')?.addEventListener('click', () => this.addKeyframe());
    document.getElementById('btn-anim-play')?.addEventListener('click', () => this.playAnimation());
    document.getElementById('btn-anim-pause')?.addEventListener('click', () => this.pauseAnimation());
    document.getElementById('btn-clear-anim')?.addEventListener('click', () => {
      this.keyframes = [];
      toast('🗑️ Animações e Keyframes limpos.');
    });

    // Scrubber click
    document.getElementById('timeline-scrubber-track')?.addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.currentFrame = Math.round(pct * this.maxFrames);
      document.getElementById('txt-current-frame').textContent = `Frame: ${this.currentFrame} / ${this.maxFrames}`;
      document.getElementById('timeline-scrubber-bar').style.left = `${pct * 100}%`;
    });

    // Keybindings: Ctrl+Z / Ctrl+Y
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undoCad();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redoCad();
      }
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.orbit.update();
    this.update3DMeasurementOverlay();
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate Studio on Page Load
window.addEventListener('DOMContentLoaded', () => {
  window.studioApp = new MNAnimatStudio();
});
