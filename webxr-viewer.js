// WebXR AR 3D Model Viewer - Following Google's Official WebXR Codelab
// Based on: https://codelabs.developers.google.com/ar-with-webxr

class WebXRViewer {
  constructor() {
    this.currentModel = null;
    this.modelId = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.xrSession = null;
    this.localReferenceSpace = null;
    this.viewerSpace = null;
    this.hitTestSource = null;
    this.reticle = null;
    this.stabilized = false;
    this.placedModels = [];
    this.qrImageUrl = null;
    
    this.init();
  }

  async init() {
    console.log('Initializing WebXR AR Viewer...');
    
    // Get model ID from URL parameters
    this.modelId = this.getUrlParameter('id');
    
    if (!this.modelId) {
      console.warn('No model ID provided, entering demo mode');
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
    
    console.log('WebXR AR Viewer initialized successfully');
  }

  async waitForDatabase() {
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
      
      console.log('Model data loaded:', {
        id: model.id,
        title: model.title,
        file_path: model.file_path,
        file_url: model.file_url,
        file_size: model.file_size
      });
      
      this.currentModel = model;
      
      // Update UI with model data
      this.updateModelInfo(model);
      
      // Check WebXR support
      if (!await this.checkWebXRSupport()) {
        this.showUnsupported();
        return;
      }
      
      // Initialize Three.js and WebXR
      await this.setupThreeJS();
      
      // Load the 3D model
      await this.loadModel(model);
      
      // Generate QR code
      this.generateQRCode();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Show main content
      this.showMainContent();
      
    } catch (error) {
      console.error('Error loading model:', error);
      this.showError('Failed to load model data: ' + error.message);
    }
  }

  async checkWebXRSupport() {
    if (!navigator.xr) {
      console.warn('WebXR not supported');
      return false;
    }
    
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      if (!supported) {
        console.warn('WebXR AR not supported');
        return false;
      }
      return true;
    } catch (error) {
      console.warn('WebXR support check failed:', error);
      return false;
    }
  }

  async setupThreeJS() {
    this.updateLoadingText('Setting up Three.js...');
    
    const canvas = document.getElementById('webxr-canvas');
    if (!canvas) {
      throw new Error('Canvas element not found');
    }
    
    // Create scene
    this.scene = new THREE.Scene();
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    
    // Create renderer with WebXR support
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    
    // Enable shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Create lighting
    this.setupLighting();
    
    // Create reticle for surface targeting
    this.createReticle();
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Start render loop
    this.renderer.setAnimationLoop((time, frame) => {
      this.onXRFrame(time, frame);
    });
    
    console.log('Three.js setup complete');
  }

  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.3);
    this.scene.add(ambientLight);
    
    // Directional light with shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    this.scene.add(directionalLight);
    
    // Create shadow plane (invisible, only receives shadows)
    const shadowGeometry = new THREE.PlaneGeometry(20, 20);
    const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.5 });
    this.shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = 10000; // Start far away
    this.shadowMesh.receiveShadow = true;
    this.shadowMesh.name = 'shadowMesh';
    this.scene.add(this.shadowMesh);
  }

  createReticle() {
    // Create a simple ring reticle
    const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.reticle = new THREE.Mesh(geometry, material);
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);
  }

  async loadModel(model) {
    try {
      this.updateLoadingText('Loading 3D model...');
      
      // Get model URL
      let modelUrl;
      if (model.file_url) {
        modelUrl = model.file_url;
      } else {
        modelUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/public/${model.file_path}`;
      }
      
      console.log('Loading model from:', modelUrl);
      
      // Test URL accessibility
      try {
        const response = await fetch(modelUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (fetchError) {
        throw new Error(`Model file not accessible: ${fetchError.message}`);
      }
      
      // Load model using GLTFLoader
      const loader = new THREE.GLTFLoader();
      
      return new Promise((resolve, reject) => {
        loader.load(
          modelUrl,
          (gltf) => {
            console.log('Model loaded successfully');
            
            // Store the loaded model
            this.loadedModel = gltf.scene;
            
            // Setup model properties
            this.loadedModel.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            
            // Scale model to reasonable size
            const box = new THREE.Box3().setFromObject(this.loadedModel);
            const size = box.getSize(new THREE.Vector3());
            const maxSize = Math.max(size.x, size.y, size.z);
            const scale = 1 / maxSize; // Scale to 1 unit
            this.loadedModel.scale.setScalar(scale);
            
            // Store original model for cloning
            window.loadedModel = this.loadedModel;
            
            resolve();
          },
          (progress) => {
            const percent = (progress.loaded / progress.total * 100).toFixed(0);
            this.updateLoadingText(`Loading model... ${percent}%`);
          },
          (error) => {
            console.error('Model loading error:', error);
            reject(new Error('Failed to load 3D model'));
          }
        );
      });
      
    } catch (error) {
      console.error('Error loading 3D model:', error);
      throw new Error(`Failed to load model: ${error.message}`);
    }
  }

  async onSessionStarted(session) {
    console.log('WebXR session started');
    this.xrSession = session;
    
    // Setup reference spaces
    this.localReferenceSpace = await session.requestReferenceSpace('local');
    this.viewerSpace = await session.requestReferenceSpace('viewer');
    
    // Setup hit testing
    this.hitTestSource = await session.requestHitTestSource({ space: this.viewerSpace });
    
    // Add select event listener for placing models
    session.addEventListener('select', this.onSelect.bind(this));
    
    // Update UI
    this.updateARStatus('AR session active - Look around to find surfaces');
    document.getElementById('startARBtn').style.display = 'none';
    document.getElementById('exitARBtn').style.display = 'block';
    document.getElementById('placeModelBtn').style.display = 'block';
  }

  onXRFrame(time, frame) {
    if (frame) {
      // Handle hit testing
      if (this.hitTestSource) {
        const hitTestResults = frame.getHitTestResults(this.hitTestSource);
        
        if (!this.stabilized && hitTestResults.length > 0) {
          this.stabilized = true;
          document.body.classList.add('stabilized');
          this.updateARStatus('Surface detected - Tap to place model');
        }
        
        if (hitTestResults.length > 0) {
          const hitPose = hitTestResults[0].getPose(this.localReferenceSpace);
          
          // Update reticle position
          this.reticle.visible = true;
          this.reticle.matrix.fromArray(hitPose.transform.matrix);
        } else {
          this.reticle.visible = false;
        }
      }
    }
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }

  onSelect() {
    if (this.reticle.visible && window.loadedModel) {
      console.log('Placing model at reticle position');
      
      // Clone the loaded model
      const modelClone = window.loadedModel.clone();
      
      // Position at reticle location
      modelClone.position.setFromMatrixPosition(this.reticle.matrix);
      modelClone.quaternion.setFromRotationMatrix(this.reticle.matrix);
      
      // Add to scene
      this.scene.add(modelClone);
      this.placedModels.push(modelClone);
      
      // Position shadow mesh at the same height
      this.shadowMesh.position.y = modelClone.position.y;
      
      this.updateARStatus(`${this.placedModels.length} model(s) placed`);
      
      // Haptic feedback if available
      if (this.xrSession && this.xrSession.inputSources) {
        for (const inputSource of this.xrSession.inputSources) {
          if (inputSource.haptics && inputSource.haptics.length > 0) {
            inputSource.haptics[0].pulse(0.5, 100);
          }
        }
      }
    }
  }

  async startAR() {
    try {
      this.updateARStatus('Starting AR session...');
      
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local', 'hit-test']
      });
      
      await this.renderer.xr.setSession(session);
      await this.onSessionStarted(session);
      
    } catch (error) {
      console.error('Failed to start AR session:', error);
      this.updateARStatus('Failed to start AR - Check device compatibility');
    }
  }

  async exitAR() {
    if (this.xrSession) {
      await this.xrSession.end();
      this.xrSession = null;
      this.stabilized = false;
      document.body.classList.remove('stabilized');
      
      // Update UI
      document.getElementById('startARBtn').style.display = 'block';
      document.getElementById('exitARBtn').style.display = 'none';
      document.getElementById('placeModelBtn').style.display = 'none';
      this.updateARStatus('Ready for AR');
      
      console.log('AR session ended');
    }
  }

  // UI Methods
  updateModelInfo(model) {
    const titleElement = document.getElementById('modelTitle');
    const descriptionElement = document.getElementById('modelDescription');
    const sizeElement = document.getElementById('modelSize');
    const dateElement = document.getElementById('modelDate');
    
    if (titleElement) titleElement.textContent = model.title;
    if (descriptionElement) descriptionElement.textContent = model.description || 'Interactive 3D model with WebXR AR support';
    
    if (sizeElement) {
      const sizeInMB = (model.file_size / (1024 * 1024)).toFixed(1);
      sizeElement.textContent = `${sizeInMB} MB`;
    }
    
    if (dateElement) {
      const uploadDate = new Date(model.created_at || model.upload_date).toLocaleDateString();
      dateElement.textContent = uploadDate;
    }
  }

  generateQRCode(type = 'direct') {
    let qrTargetUrl;
    
    if (type === 'direct') {
      qrTargetUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${this.modelId}&ar=true`;
    } else {
      qrTargetUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${this.modelId}`;
    }
    
    console.log('QR Code Target URL:', qrTargetUrl);
    
    this.qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTargetUrl)}`;
    
    const qrImage = document.getElementById('qrImage');
    if (qrImage) {
      qrImage.src = this.qrImageUrl;
    }
    
    this.updateQRInstructions(type);
  }

  updateQRInstructions(type) {
    const qrInstructions = document.querySelector('.qr-instructions');
    if (qrInstructions) {
      if (type === 'direct') {
        qrInstructions.innerHTML = `
          <i class="fas fa-vr-cardboard"></i>
          <strong>Direct WebXR AR:</strong> Scan to launch AR experience immediately
        `;
      } else {
        qrInstructions.innerHTML = `
          <i class="fas fa-globe"></i>
          <strong>Webpage First:</strong> Scan to open model page, then tap "Start AR"
        `;
      }
    }
  }

  setupEventListeners() {
    // AR controls
    const startARBtn = document.getElementById('startARBtn');
    const exitARBtn = document.getElementById('exitARBtn');
    const placeModelBtn = document.getElementById('placeModelBtn');
    
    if (startARBtn) startARBtn.addEventListener('click', () => this.startAR());
    if (exitARBtn) exitARBtn.addEventListener('click', () => this.exitAR());
    if (placeModelBtn) placeModelBtn.addEventListener('click', () => {
      // Manual placement trigger (same as select)
      this.onSelect();
    });
    
    // Navigation
    const shareBtn = document.getElementById('shareBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    if (shareBtn) shareBtn.addEventListener('click', () => this.shareModel());
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    
    // QR actions
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const downloadQRBtn = document.getElementById('downloadQRBtn');
    
    if (copyLinkBtn) copyLinkBtn.addEventListener('click', () => this.copyModelLink());
    if (downloadQRBtn) downloadQRBtn.addEventListener('click', () => this.downloadQR());
    
    // QR type selection
    const directARBtn = document.getElementById('directARBtn');
    const webpageBtn = document.getElementById('webpageBtn');
    
    if (directARBtn) directARBtn.addEventListener('click', () => this.setQRType('direct'));
    if (webpageBtn) webpageBtn.addEventListener('click', () => this.setQRType('webpage'));
  }

  setQRType(type) {
    const directARBtn = document.getElementById('directARBtn');
    const webpageBtn = document.getElementById('webpageBtn');
    
    if (directARBtn && webpageBtn) {
      if (type === 'direct') {
        directARBtn.classList.add('active');
        webpageBtn.classList.remove('active');
      } else {
        directARBtn.classList.remove('active');
        webpageBtn.classList.add('active');
      }
    }
    
    if (this.currentModel) {
      this.generateQRCode(type);
    }
  }

  async shareModel() {
    const modelUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${this.modelId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: this.currentModel.title,
          text: `Check out this 3D model with WebXR AR: ${this.currentModel.title}`,
          url: modelUrl
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(modelUrl);
      this.showMessage('Link copied to clipboard!', 'success');
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
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

  // Demo mode
  async showDemoMode() {
    console.log('Entering demo mode');
    
    if (!await this.checkWebXRSupport()) {
      this.showUnsupported();
      return;
    }
    
    // Setup Three.js for demo
    await this.setupThreeJS();
    
    // Create demo model (cube)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x4a90e2 });
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;
    
    // Store as loaded model
    window.loadedModel = cube;
    
    // Update UI for demo
    this.updateDemoInfo();
    this.generateDemoQRCode();
    this.setupEventListeners();
    this.showMainContent();
    
    this.showMessage('Demo mode - WebXR AR with sample cube', 'info');
  }

  updateDemoInfo() {
    const titleElement = document.getElementById('modelTitle');
    const descriptionElement = document.getElementById('modelDescription');
    const sizeElement = document.getElementById('modelSize');
    const dateElement = document.getElementById('modelDate');
    
    if (titleElement) titleElement.textContent = 'Demo - WebXR AR Cube';
    if (descriptionElement) descriptionElement.textContent = 'Demo of WebXR AR capabilities. Upload models in the gallery to view your own 3D models here.';
    if (sizeElement) sizeElement.textContent = 'Demo';
    if (dateElement) dateElement.textContent = 'Demo';
  }

  generateDemoQRCode(type = 'direct') {
    let qrTargetUrl;
    
    if (type === 'direct') {
      qrTargetUrl = `${APP_CONFIG.baseUrl}/viewer.html?ar=true`;
    } else {
      qrTargetUrl = `${APP_CONFIG.baseUrl}/viewer.html`;
    }
    
    this.qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTargetUrl)}`;
    
    const qrImage = document.getElementById('qrImage');
    if (qrImage) {
      qrImage.src = this.qrImageUrl;
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

  updateARStatus(text) {
    const arStatus = document.getElementById('arStatus');
    if (arStatus) {
      arStatus.textContent = text;
    }
  }

  showMainContent() {
    const loadingScreen = document.getElementById('loadingScreen');
    const arContainer = document.getElementById('arContainer');
    const qrSection = document.getElementById('qrSection');
    const modelInfo = document.getElementById('modelInfo');
    const arInstructions = document.getElementById('arInstructions');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (arContainer) arContainer.style.display = 'block';
    if (qrSection) qrSection.style.display = 'block';
    if (modelInfo) modelInfo.style.display = 'block';
    if (arInstructions) arInstructions.style.display = 'block';
  }

  showUnsupported() {
    const loadingScreen = document.getElementById('loadingScreen');
    const unsupportedScreen = document.getElementById('unsupportedScreen');
    const qrSection = document.getElementById('qrSection');
    const modelInfo = document.getElementById('modelInfo');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (unsupportedScreen) unsupportedScreen.style.display = 'flex';
    if (qrSection) qrSection.style.display = 'block';
    if (modelInfo) modelInfo.style.display = 'block';
    
    // Still generate QR for mobile access
    if (this.currentModel) {
      this.generateQRCode();
    } else {
      this.generateDemoQRCode();
    }
    this.setupEventListeners();
  }

  showError(message) {
    const loadingScreen = document.getElementById('loadingScreen');
    const errorScreen = document.getElementById('errorScreen');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (errorMessage) errorMessage.textContent = message;
    if (errorScreen) {
      errorScreen.style.display = 'block';
    } else {
      console.error('Error screen not found, showing alert:', message);
      alert('Error: ' + message);
    }
  }

  showMessage(message, type = 'info') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#339af0'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 10000;
      font-weight: 500;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new WebXRViewer();
});

// Handle mobile-specific optimizations
if (/Mobi|Android/i.test(navigator.userAgent)) {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('mobile-device');
    console.log('Mobile device detected - WebXR AR optimizations enabled');
  });
} 