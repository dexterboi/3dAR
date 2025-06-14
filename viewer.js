// WebXR AR Model Viewer with Hit Test
class WebXRModelViewer {
  constructor() {
    this.currentModel = null;
    this.modelId = null;
    this.isRotating = true;
    this.isFullscreen = false;
    this.qrImageUrl = null;
    
    // WebXR properties
    this.xrSession = null;
    this.xrRefSpace = null;
    this.xrHitTestSource = null;
    this.xrRenderer = null;
    this.xrScene = null;
    this.xrCamera = null;
    this.xrReticle = null;
    this.xrModel = null;
    this.xrCanvas = null;
    this.placedModels = [];
    
    this.init();
  }

  async init() {
    console.log('Initializing WebXR Model Viewer...');
    
    // Get model ID from URL parameters
    this.modelId = this.getUrlParameter('id');
    
    if (!this.modelId) {
      // For testing, show a demo mode
      console.warn('No model ID provided in URL, entering demo mode');
      this.showDemoMode();
      return;
    }
    
    // Wait for database to be available
    await this.waitForDatabase();
    
    // Initialize database
    try {
      const initialized = await window.modelDB.init();
      if (!initialized) {
        this.showError('Database connection failed');
        return;
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      this.showError('Failed to connect to database');
      return;
    }
    
    // Load model data
    await this.loadModelData();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Check WebXR support
    this.checkWebXRSupport();
  }

  async waitForDatabase() {
    // Wait for database to be loaded
    let attempts = 0;
    while (!window.modelDB && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.modelDB) {
      throw new Error('Database not available');
    }
  }

  async loadModelData() {
    try {
      this.updateLoadingText('Loading model data...');
      
      const model = await window.modelDB.getModel(this.modelId);
      if (!model) {
        this.showError('Model not found');
        return;
      }
      
      this.currentModel = model;
      
      // Update UI with model data
      this.updateModelInfo(model);
      
      // Load the 3D model
      await this.loadModel(model);
      
      // Generate QR code
      this.generateQRCode();
      
      // Show main content
      this.showMainContent();
      
    } catch (error) {
      console.error('Error loading model:', error);
      this.showError('Failed to load model data');
    }
  }

  async loadModel(model) {
    try {
      this.updateLoadingText('Loading 3D model...');
      
      const modelViewer = document.getElementById('modelViewer');
      const modelUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/public/models/${model.file_path}`;
      
      modelViewer.src = modelUrl;
      
      // Wait for model to load
      await new Promise((resolve, reject) => {
        modelViewer.addEventListener('load', resolve);
        modelViewer.addEventListener('error', reject);
      });
      
      console.log('Model loaded successfully');
      
    } catch (error) {
      console.error('Error loading 3D model:', error);
      throw error;
    }
  }

  updateModelInfo(model) {
    document.getElementById('modelTitle').textContent = model.title;
    document.getElementById('modelDescription').textContent = model.description || 'Interactive 3D model with AR support';
    
    // Update model stats
    const sizeInMB = (model.file_size / (1024 * 1024)).toFixed(1);
    document.getElementById('modelSize').textContent = `${sizeInMB} MB`;
    
    const uploadDate = new Date(model.created_at).toLocaleDateString();
    document.getElementById('modelDate').textContent = uploadDate;
  }

  generateQRCode() {
    const modelUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${this.modelId}`;
    this.qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(modelUrl)}`;
    
    const qrImage = document.getElementById('qrImage');
    qrImage.src = this.qrImageUrl;
  }

  setupEventListeners() {
    // Control buttons
    document.getElementById('rotateBtn').addEventListener('click', () => this.toggleRotation());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetView());
    document.getElementById('screenshotBtn').addEventListener('click', () => this.takeScreenshot());
    
    // Navigation
    document.getElementById('shareBtn').addEventListener('click', () => this.shareModel());
    document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());
    
    // QR actions
    document.getElementById('copyLinkBtn').addEventListener('click', () => this.copyModelLink());
    document.getElementById('downloadQRBtn').addEventListener('click', () => this.downloadQR());
    
    // WebXR AR button
    document.getElementById('webxr-ar-button').addEventListener('click', () => this.startWebXRAR());
    
    // WebXR UI controls
    document.getElementById('webxr-place-btn').addEventListener('click', () => this.placeModel());
    document.getElementById('webxr-reset-btn').addEventListener('click', () => this.resetAR());
    document.getElementById('webxr-exit-btn').addEventListener('click', () => this.exitWebXRAR());
    
    // Model viewer events
    const modelViewer = document.getElementById('modelViewer');
    modelViewer.addEventListener('ar-status', (event) => {
      console.log('AR Status:', event.detail.status);
    });
  }

  async checkWebXRSupport() {
    if ('xr' in navigator) {
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        if (supported) {
          document.getElementById('webxr-ar-button').style.display = 'block';
          console.log('WebXR AR supported');
        } else {
          console.log('WebXR AR not supported');
        }
      } catch (error) {
        console.log('WebXR not available:', error);
      }
    }
  }

  async startWebXRAR() {
    try {
      console.log('Starting WebXR AR session...');
      
      // Request XR session with hit-test feature
      this.xrSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.getElementById('webxr-ui') }
      });
      
      // Setup WebXR scene
      await this.setupWebXRScene();
      
      // Setup hit test
      await this.setupHitTest();
      
      // Start render loop
      this.xrSession.requestAnimationFrame(this.onXRFrame.bind(this));
      
      // Show WebXR UI
      document.getElementById('webxr-ui').style.display = 'block';
      document.getElementById('webxr-canvas').style.display = 'block';
      
      // Hide regular UI
      document.getElementById('modelContainer').style.display = 'none';
      
      console.log('WebXR AR session started');
      
    } catch (error) {
      console.error('Failed to start WebXR AR:', error);
      alert('Failed to start AR. Please make sure you\'re using a compatible device and browser.');
    }
  }

  async setupWebXRScene() {
    // Get canvas and setup WebGL context
    this.xrCanvas = document.getElementById('webxr-canvas');
    const gl = this.xrCanvas.getContext('webgl', { xrCompatible: true });
    
    // Setup Three.js renderer
    this.xrRenderer = new THREE.WebGLRenderer({ 
      canvas: this.xrCanvas, 
      context: gl,
      alpha: true,
      antialias: true
    });
    this.xrRenderer.setPixelRatio(window.devicePixelRatio);
    this.xrRenderer.setSize(window.innerWidth, window.innerHeight);
    this.xrRenderer.xr.enabled = true;
    this.xrRenderer.xr.setSession(this.xrSession);
    
    // Create scene
    this.xrScene = new THREE.Scene();
    
    // Create camera
    this.xrCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.xrScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.xrScene.add(directionalLight);
    
    // Create reticle (targeting cursor)
    this.createReticle();
    
    // Load 3D model for AR
    await this.loadModelForAR();
  }

  createReticle() {
    const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8
    });
    
    this.xrReticle = new THREE.Mesh(geometry, material);
    this.xrReticle.visible = false;
    this.xrScene.add(this.xrReticle);
  }

  async loadModelForAR() {
    try {
      const loader = new THREE.GLTFLoader();
      const modelUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/public/models/${this.currentModel.file_path}`;
      
      const gltf = await new Promise((resolve, reject) => {
        loader.load(modelUrl, resolve, undefined, reject);
      });
      
      this.xrModel = gltf.scene;
      this.xrModel.scale.set(0.5, 0.5, 0.5); // Scale down for AR
      
      console.log('Model loaded for AR');
      
    } catch (error) {
      console.error('Failed to load model for AR:', error);
    }
  }

  async setupHitTest() {
    try {
      // Create reference space
      this.xrRefSpace = await this.xrSession.requestReferenceSpace('local');
      
      // Create viewer reference space for hit testing
      const viewerSpace = await this.xrSession.requestReferenceSpace('viewer');
      
      // Request hit test source
      this.xrHitTestSource = await this.xrSession.requestHitTestSource({ space: viewerSpace });
      
      console.log('Hit test setup complete');
      
    } catch (error) {
      console.error('Failed to setup hit test:', error);
    }
  }

  onXRFrame(time, frame) {
    this.xrSession.requestAnimationFrame(this.onXRFrame.bind(this));
    
    // Get viewer pose
    const pose = frame.getViewerPose(this.xrRefSpace);
    if (!pose) return;
    
    // Perform hit test
    if (this.xrHitTestSource) {
      const hitTestResults = frame.getHitTestResults(this.xrHitTestSource);
      
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const hitPose = hit.getPose(this.xrRefSpace);
        
        if (hitPose) {
          // Show reticle at hit position
          this.xrReticle.visible = true;
          this.xrReticle.position.setFromMatrixPosition(hitPose.transform.matrix);
          this.xrReticle.lookAt(
            this.xrReticle.position.x,
            this.xrReticle.position.y + 1,
            this.xrReticle.position.z
          );
        }
      } else {
        this.xrReticle.visible = false;
      }
    }
    
    // Render scene
    this.xrRenderer.render(this.xrScene, this.xrCamera);
  }

  placeModel() {
    if (this.xrReticle.visible && this.xrModel) {
      // Clone the model
      const modelClone = this.xrModel.clone();
      
      // Position at reticle location
      modelClone.position.copy(this.xrReticle.position);
      modelClone.rotation.copy(this.xrReticle.rotation);
      
      // Add to scene
      this.xrScene.add(modelClone);
      this.placedModels.push(modelClone);
      
      console.log('Model placed in AR');
      
      // Provide haptic feedback if available
      if (this.xrSession.inputSources) {
        for (const inputSource of this.xrSession.inputSources) {
          if (inputSource.gamepad && inputSource.gamepad.hapticActuators) {
            inputSource.gamepad.hapticActuators[0].pulse(0.5, 100);
          }
        }
      }
    }
  }

  resetAR() {
    // Remove all placed models
    this.placedModels.forEach(model => {
      this.xrScene.remove(model);
    });
    this.placedModels = [];
    
    console.log('AR scene reset');
  }

  async exitWebXRAR() {
    if (this.xrSession) {
      await this.xrSession.end();
      this.xrSession = null;
      
      // Hide WebXR UI
      document.getElementById('webxr-ui').style.display = 'none';
      document.getElementById('webxr-canvas').style.display = 'none';
      
      // Show regular UI
      document.getElementById('modelContainer').style.display = 'block';
      
      console.log('WebXR AR session ended');
    }
  }

  // Regular viewer controls
  toggleRotation() {
    const modelViewer = document.getElementById('modelViewer');
    const btn = document.getElementById('rotateBtn');
    
    if (this.isRotating) {
      modelViewer.removeAttribute('auto-rotate');
      btn.innerHTML = '<i class="fas fa-play"></i><span>Start Rotate</span>';
      this.isRotating = false;
    } else {
      modelViewer.setAttribute('auto-rotate', '');
      btn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Auto Rotate</span>';
      this.isRotating = true;
    }
  }

  resetView() {
    const modelViewer = document.getElementById('modelViewer');
    modelViewer.resetTurntableRotation();
    modelViewer.jumpCameraToGoal();
  }

  async takeScreenshot() {
    try {
      const modelViewer = document.getElementById('modelViewer');
      const screenshot = await modelViewer.toDataURL('image/png');
      
      // Create download link
      const link = document.createElement('a');
      link.download = `${this.currentModel.title}_screenshot.png`;
      link.href = screenshot;
      link.click();
      
      this.showMessage('Screenshot saved!', 'success');
    } catch (error) {
      console.error('Screenshot failed:', error);
      this.showMessage('Screenshot failed', 'error');
    }
  }

  async shareModel() {
    const modelUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${this.modelId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: this.currentModel.title,
          text: `Check out this 3D model: ${this.currentModel.title}`,
          url: modelUrl
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(modelUrl);
      this.showMessage('Link copied to clipboard!', 'success');
    }
  }

  toggleFullscreen() {
    if (!this.isFullscreen) {
      document.documentElement.requestFullscreen();
      this.isFullscreen = true;
      document.getElementById('fullscreenBtn').innerHTML = '<i class="fas fa-compress"></i> Exit Fullscreen';
    } else {
      document.exitFullscreen();
      this.isFullscreen = false;
      document.getElementById('fullscreenBtn').innerHTML = '<i class="fas fa-expand"></i> Fullscreen';
    }
  }

  copyModelLink() {
    const modelUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${this.modelId}`;
    navigator.clipboard.writeText(modelUrl);
    this.showMessage('Link copied to clipboard!', 'success');
  }

  downloadQR() {
    if (this.qrImageUrl) {
      const link = document.createElement('a');
      link.download = `${this.currentModel.title}_QR.png`;
      link.href = this.qrImageUrl;
      link.click();
    }
  }

  // Utility methods
  getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  updateLoadingText(text) {
    const loadingText = document.getElementById('loadingText');
    if (loadingText) {
      loadingText.textContent = text;
    }
  }

  showMainContent() {
    const loadingScreen = document.getElementById('loadingScreen');
    const modelContainer = document.getElementById('modelContainer');
    const qrSection = document.getElementById('qrSection');
    const modelInfo = document.getElementById('modelInfo');
    
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
    
    if (modelContainer) {
      modelContainer.style.display = 'block';
    }
    
    if (qrSection) {
      qrSection.style.display = 'block';
    }
    
    if (modelInfo) {
      modelInfo.style.display = 'block';
    }
  }

  showError(message) {
    const loadingScreen = document.getElementById('loadingScreen');
    const errorScreen = document.getElementById('errorScreen');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
    
    if (errorMessage) {
      errorMessage.textContent = message;
    }
    
    if (errorScreen) {
      errorScreen.style.display = 'block';
    } else {
      // Fallback if error screen doesn't exist
      console.error('Error screen not found, showing alert:', message);
      alert('Error: ' + message);
    }
  }

  showMessage(message, type = 'info') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  showDemoMode() {
    const loadingScreen = document.getElementById('loadingScreen');
    const modelContainer = document.getElementById('modelContainer');
    const qrSection = document.getElementById('qrSection');
    const modelInfo = document.getElementById('modelInfo');
    
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
    
    if (modelContainer) {
      modelContainer.style.display = 'block';
      // Show a demo message in the model viewer
      const modelViewer = document.getElementById('modelViewer');
      if (modelViewer) {
        modelViewer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 40px;">
            <div>
              <i class="fas fa-cube" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.8;"></i>
              <h2 style="margin: 0 0 15px;">Demo Mode</h2>
              <p style="margin: 0 0 20px; opacity: 0.9;">No model ID provided in URL</p>
              <p style="margin: 0; font-size: 0.9rem; opacity: 0.7;">Add ?id=YOUR_MODEL_ID to view a specific model</p>
            </div>
          </div>
        `;
      }
    }
    
    if (modelInfo) {
      modelInfo.style.display = 'block';
      document.getElementById('modelTitle').textContent = 'Demo Mode';
      document.getElementById('modelDescription').textContent = 'This is a demo of the 3D model viewer. Upload models in the gallery to view them here.';
      document.getElementById('modelSize').textContent = 'N/A';
      document.getElementById('modelDate').textContent = 'N/A';
    }
    
    // Hide QR section in demo mode
    if (qrSection) {
      qrSection.style.display = 'none';
    }
    
    // Setup basic event listeners
    this.setupEventListeners();
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new WebXRModelViewer();
});

// Handle mobile-specific optimizations
if (/Mobi|Android/i.test(navigator.userAgent)) {
  document.addEventListener('DOMContentLoaded', () => {
    // Add mobile-specific class
    document.body.classList.add('mobile-device');
    
    // Keep auto-rotate on mobile for better AR experience
    console.log('Mobile device detected - AR optimizations enabled');
  });
} 