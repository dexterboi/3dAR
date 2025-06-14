// Babylon.js WebXR 3D Model Viewer
class BabylonViewerApp {
  constructor() {
    this.currentModel = null;
    this.modelId = null;
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.meshes = [];
    this.isRotating = true;
    this.isFullscreen = false;
    this.qrImageUrl = null;
    this.xrHelper = null;
    this.isInAR = false;
    
    this.init();
  }

  async init() {
    console.log('Initializing Babylon.js WebXR Viewer...');
    
    // Get model ID from URL parameters
    this.modelId = this.getUrlParameter('id');
    
    if (!this.modelId) {
      // Show demo mode
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
    
    console.log('Babylon.js WebXR Viewer initialized successfully');
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
      
      // Initialize Babylon.js
      await this.initializeBabylon();
      
      // Load the 3D model
      await this.loadModel(model);
      
      // Setup WebXR
      await this.setupWebXR();
      
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

  async initializeBabylon() {
    this.updateLoadingText('Initializing Babylon.js engine...');
    
    const canvas = document.getElementById('babylonCanvas');
    if (!canvas) {
      throw new Error('Canvas element not found');
    }
    
    // Create Babylon.js engine
    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true
    });
    
    // Create scene
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.createDefaultCameraOrLights(true, true, true);
    
    // Setup camera
    this.camera = this.scene.activeCamera;
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.attachControls(canvas, true);
    
    // Enable physics (optional for AR interactions)
    this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), new BABYLON.CannonJSPlugin());
    
    // Add lighting
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), this.scene);
    light.intensity = 0.7;
    
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -1, -1), this.scene);
    dirLight.position = new BABYLON.Vector3(20, 40, 20);
    dirLight.intensity = 0.5;
    
    // Add shadows
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;
    
    // Create ground for AR
    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 10, height: 10}, this.scene);
    ground.receiveShadows = true;
    ground.material = new BABYLON.StandardMaterial("groundMat", this.scene);
    ground.material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
    ground.material.alpha = 0.3;
    ground.setEnabled(false); // Hidden by default, shown in AR
    
    this.ground = ground;
    
    // Start render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
    
    console.log('Babylon.js engine initialized');
  }

  async loadModel(model) {
    try {
      this.updateLoadingText('Loading 3D model...');
      
      // Use the stored file_url directly, or construct it properly
      let modelUrl;
      if (model.file_url) {
        modelUrl = model.file_url;
      } else {
        modelUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/public/${model.file_path}`;
      }
      
      console.log('Loading model from:', modelUrl);
      
      // Test if the URL is accessible
      try {
        const response = await fetch(modelUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        console.log('Model URL is accessible');
      } catch (fetchError) {
        console.error('Model URL test failed:', fetchError);
        throw new Error(`Model file not accessible: ${fetchError.message}`);
      }
      
      // Import the model using Babylon.js
      const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", modelUrl, this.scene);
      
      if (!result.meshes || result.meshes.length === 0) {
        throw new Error('No meshes found in the model file');
      }
      
      this.meshes = result.meshes;
      
      // Process loaded meshes
      let boundingInfo = null;
      result.meshes.forEach((mesh, index) => {
        if (mesh.geometry) {
          // Enable shadows
          this.scene.lights.forEach(light => {
            if (light.getShadowGenerator) {
              const shadowGen = light.getShadowGenerator();
              if (shadowGen) {
                shadowGen.addShadowCaster(mesh);
              }
            }
          });
          
          // Calculate bounding box
          if (!boundingInfo) {
            boundingInfo = mesh.getBoundingInfo();
          } else {
            boundingInfo = BABYLON.BoundingInfo.CreateFromBoundingInfo(boundingInfo, mesh.getBoundingInfo());
          }
        }
      });
      
      // Center and scale the model
      if (boundingInfo) {
        const center = boundingInfo.boundingBox.center;
        const size = boundingInfo.boundingBox.maximum.subtract(boundingInfo.boundingBox.minimum);
        const maxSize = Math.max(size.x, size.y, size.z);
        
        // Move to center
        result.meshes.forEach(mesh => {
          if (mesh.geometry) {
            mesh.position = mesh.position.subtract(center);
          }
        });
        
        // Scale to fit
        const targetSize = 2; // Target size
        const scaleFactor = targetSize / maxSize;
        result.meshes.forEach(mesh => {
          if (mesh.geometry) {
            mesh.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);
          }
        });
        
        // Position camera
        this.camera.setTarget(BABYLON.Vector3.Zero());
        this.camera.position = new BABYLON.Vector3(0, 2, 5);
      }
      
      // Setup auto-rotation
      if (this.isRotating) {
        this.scene.registerBeforeRender(() => {
          if (this.isRotating && !this.isInAR) {
            result.meshes.forEach(mesh => {
              if (mesh.geometry) {
                mesh.rotation.y += 0.01;
              }
            });
          }
        });
      }
      
      console.log('Model loaded successfully:', result.meshes.length, 'meshes');
      
    } catch (error) {
      console.error('Error loading 3D model:', error);
      
      // Show user-friendly error message
      let userMessage = 'Failed to load 3D model. ';
      if (error.message.includes('CORS')) {
        userMessage += 'This may be a cross-origin issue.';
      } else if (error.message.includes('404')) {
        userMessage += 'Model file not found on server.';
      } else if (error.message.includes('timeout')) {
        userMessage += 'Model took too long to load.';
      } else {
        userMessage += error.message;
      }
      
      throw new Error(userMessage);
    }
  }

  async setupWebXR() {
    try {
      this.updateLoadingText('Setting up WebXR...');
      
      // Check WebXR support
      if (!navigator.xr) {
        console.warn('WebXR not supported, AR button will be hidden');
        return;
      }
      
      // Create WebXR experience helper
      this.xrHelper = await this.scene.createDefaultXRExperienceAsync({
        floorMeshes: [this.ground],
        optionalFeatures: true
      });
      
      if (!this.xrHelper.baseExperience) {
        console.warn('WebXR experience could not be created');
        return;
      }
      
      // Show AR button when WebXR is ready
      const arButton = document.getElementById('arButton');
      if (arButton) {
        arButton.style.display = 'flex';
      }
      
      // Setup WebXR event handlers
      this.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
        console.log('WebXR state changed:', state);
        
        switch (state) {
          case BABYLON.WebXRState.IN_XR:
            this.isInAR = true;
            this.onEnterAR();
            break;
          case BABYLON.WebXRState.NOT_IN_XR:
            this.isInAR = false;
            this.onExitAR();
            break;
        }
      });
      
      // Setup hit test for surface placement
      if (this.xrHelper.featuresManager) {
        const hitTest = this.xrHelper.featuresManager.enableFeature(BABYLON.WebXRHitTest, "latest");
        if (hitTest) {
          hitTest.onHitTestResultObservable.add((results) => {
            if (results.length > 0 && this.isInAR) {
              // Show ground plane at hit test position
              const hitResult = results[0];
              this.ground.position = hitResult.position;
              this.ground.setEnabled(true);
            }
          });
        }
      }
      
      console.log('WebXR setup complete');
      
    } catch (error) {
      console.error('WebXR setup failed:', error);
      // Don't throw error, just hide AR button
      const arButton = document.getElementById('arButton');
      if (arButton) {
        arButton.style.display = 'none';
      }
    }
  }

  onEnterAR() {
    console.log('Entered AR mode');
    
    // Show exit AR button
    const arButton = document.getElementById('arButton');
    const exitARButton = document.getElementById('exitARButton');
    
    if (arButton) arButton.style.display = 'none';
    if (exitARButton) exitARButton.style.display = 'flex';
    
    // Enable ground for surface detection
    if (this.ground) {
      this.ground.setEnabled(true);
    }
    
    // Stop auto-rotation in AR
    this.isRotating = false;
    
    this.showMessage('AR mode active - look around to place the model!', 'success');
  }

  onExitAR() {
    console.log('Exited AR mode');
    
    // Show enter AR button
    const arButton = document.getElementById('arButton');
    const exitARButton = document.getElementById('exitARButton');
    
    if (arButton) arButton.style.display = 'flex';
    if (exitARButton) exitARButton.style.display = 'none';
    
    // Hide ground
    if (this.ground) {
      this.ground.setEnabled(false);
    }
    
    // Resume auto-rotation
    this.isRotating = true;
    
    this.showMessage('Exited AR mode', 'info');
  }

  updateModelInfo(model) {
    const titleElement = document.getElementById('modelTitle');
    const descriptionElement = document.getElementById('modelDescription');
    const sizeElement = document.getElementById('modelSize');
    const dateElement = document.getElementById('modelDate');
    
    if (titleElement) titleElement.textContent = model.title;
    if (descriptionElement) descriptionElement.textContent = model.description || 'Interactive 3D model with WebXR AR support via Babylon.js';
    
    // Update model stats
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
    // Create direct AR launch URL
    let modelUrl;
    if (this.currentModel.file_url) {
      modelUrl = this.currentModel.file_url;
    } else {
      modelUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/public/${this.currentModel.file_path}`;
    }
    
    let qrTargetUrl;
    
    if (type === 'direct') {
      // Direct WebXR AR URL
      qrTargetUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${this.modelId}&ar=true`;
    } else {
      // Regular webpage URL
      qrTargetUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${this.modelId}`;
    }
    
    console.log('QR Code Target URL:', qrTargetUrl);
    
    this.qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTargetUrl)}`;
    
    const qrImage = document.getElementById('qrImage');
    if (qrImage) {
      qrImage.src = this.qrImageUrl;
    }
    
    // Update QR instructions based on type
    this.updateQRInstructions(type);
  }

  updateQRInstructions(type) {
    const qrInstructions = document.querySelector('.qr-instructions');
    if (qrInstructions) {
      if (type === 'direct') {
        qrInstructions.innerHTML = `
          <i class="fas fa-vr-cardboard"></i>
          <strong>Direct WebXR AR:</strong> Scan to launch immersive AR experience immediately
        `;
      } else {
        qrInstructions.innerHTML = `
          <i class="fas fa-globe"></i>
          <strong>Webpage First:</strong> Scan to open the model page, then tap "Enter AR" button
        `;
      }
    }
  }

  setupEventListeners() {
    // Control buttons
    const rotateBtn = document.getElementById('rotateBtn');
    const resetBtn = document.getElementById('resetBtn');
    const screenshotBtn = document.getElementById('screenshotBtn');
    
    if (rotateBtn) rotateBtn.addEventListener('click', () => this.toggleRotation());
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetView());
    if (screenshotBtn) screenshotBtn.addEventListener('click', () => this.takeScreenshot());
    
    // Navigation
    const shareBtn = document.getElementById('shareBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    if (shareBtn) shareBtn.addEventListener('click', () => this.shareModel());
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    
    // AR buttons
    const arButton = document.getElementById('arButton');
    const exitARButton = document.getElementById('exitARButton');
    
    if (arButton) arButton.addEventListener('click', () => this.enterAR());
    if (exitARButton) exitARButton.addEventListener('click', () => this.exitAR());
    
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

  async enterAR() {
    try {
      if (this.xrHelper && this.xrHelper.baseExperience) {
        await this.xrHelper.baseExperience.enterXRAsync("immersive-ar", "local-floor");
      }
    } catch (error) {
      console.error('Failed to enter AR:', error);
      this.showMessage('Failed to start AR. Make sure you\'re on a compatible device.', 'error');
    }
  }

  async exitAR() {
    try {
      if (this.xrHelper && this.xrHelper.baseExperience) {
        await this.xrHelper.baseExperience.exitXRAsync();
      }
    } catch (error) {
      console.error('Failed to exit AR:', error);
    }
  }

  setQRType(type) {
    // Update button states
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
    
    // Regenerate QR code based on type
    if (this.currentModel) {
      this.generateQRCode(type);
    } else {
      this.generateDemoQRCode(type);
    }
  }

  // Control methods
  toggleRotation() {
    const btn = document.getElementById('rotateBtn');
    
    if (this.isRotating) {
      this.isRotating = false;
      if (btn) btn.innerHTML = '<i class="fas fa-play"></i><span>Start Rotate</span>';
    } else {
      this.isRotating = true;
      if (btn) btn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Auto Rotate</span>';
    }
  }

  resetView() {
    if (this.camera) {
      this.camera.setTarget(BABYLON.Vector3.Zero());
      this.camera.position = new BABYLON.Vector3(0, 2, 5);
    }
  }

  async takeScreenshot() {
    try {
      if (this.engine) {
        const screenshot = await BABYLON.Tools.ToDataURL(this.engine.getRenderingCanvas());
        
        // Create download link
        const link = document.createElement('a');
        link.download = `${this.currentModel.title}_screenshot.png`;
        link.href = screenshot;
        link.click();
        
        this.showMessage('Screenshot saved!', 'success');
      }
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
          text: `Check out this 3D model with WebXR AR: ${this.currentModel.title}`,
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
      const btn = document.getElementById('fullscreenBtn');
      if (btn) btn.innerHTML = '<i class="fas fa-compress"></i> Exit Fullscreen';
    } else {
      document.exitFullscreen();
      this.isFullscreen = false;
      const btn = document.getElementById('fullscreenBtn');
      if (btn) btn.innerHTML = '<i class="fas fa-expand"></i> Fullscreen';
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

  // Demo mode for testing
  async showDemoMode() {
    const loadingScreen = document.getElementById('loadingScreen');
    const modelContainer = document.getElementById('modelContainer');
    const modelInfo = document.getElementById('modelInfo');
    const arInstructions = document.getElementById('arInstructions');
    const qrSection = document.getElementById('qrSection');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    
    if (modelContainer) {
      modelContainer.style.display = 'block';
      
      // Initialize Babylon.js for demo
      await this.initializeBabylon();
      
      // Create demo model (a simple box)
      const box = BABYLON.MeshBuilder.CreateBox("demoBox", {size: 2}, this.scene);
      box.material = new BABYLON.StandardMaterial("boxMat", this.scene);
      box.material.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.9);
      
      this.meshes = [box];
      
      // Setup WebXR for demo
      await this.setupWebXR();
    }
    
    if (modelInfo) {
      modelInfo.style.display = 'block';
      const titleElement = document.getElementById('modelTitle');
      const descriptionElement = document.getElementById('modelDescription');
      const sizeElement = document.getElementById('modelSize');
      const dateElement = document.getElementById('modelDate');
      
      if (titleElement) titleElement.textContent = 'Demo Mode - Babylon.js Cube';
      if (descriptionElement) descriptionElement.textContent = 'This is a demo of the Babylon.js WebXR viewer. Upload models in the gallery to view your own 3D models here.';
      if (sizeElement) sizeElement.textContent = 'Demo';
      if (dateElement) dateElement.textContent = 'Demo';
    }
    
    if (arInstructions) {
      arInstructions.style.display = 'block';
    }
    
    // Generate QR code for demo
    if (qrSection) {
      qrSection.style.display = 'block';
      this.generateDemoQRCode();
    }
    
    // Setup basic event listeners
    this.setupEventListeners();
    
    this.showMessage('Demo mode active - showing Babylon.js WebXR capabilities', 'info');
  }

  generateDemoQRCode(type = 'direct') {
    let qrTargetUrl;
    
    if (type === 'direct') {
      qrTargetUrl = `${APP_CONFIG.baseUrl}/viewer.html?ar=true`;
    } else {
      qrTargetUrl = `${APP_CONFIG.baseUrl}/viewer.html`;
    }
    
    console.log('Demo QR Code Target URL:', qrTargetUrl);
    
    this.qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTargetUrl)}`;
    
    const qrImage = document.getElementById('qrImage');
    if (qrImage) {
      qrImage.src = this.qrImageUrl;
    }
    
    // Update QR instructions for demo
    const qrInstructions = document.querySelector('.qr-instructions');
    if (qrInstructions) {
      if (type === 'direct') {
        qrInstructions.innerHTML = `
          <i class="fas fa-vr-cardboard"></i>
          <strong>Demo WebXR AR:</strong> Scan to launch demo AR experience immediately
        `;
      } else {
        qrInstructions.innerHTML = `
          <i class="fas fa-globe"></i>
          <strong>Demo Webpage:</strong> Scan to open demo page, then tap "Enter AR" for AR experience
        `;
      }
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
    const arInstructions = document.getElementById('arInstructions');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (modelContainer) modelContainer.style.display = 'block';
    if (qrSection) qrSection.style.display = 'block';
    if (modelInfo) modelInfo.style.display = 'block';
    if (arInstructions) arInstructions.style.display = 'block';
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
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BabylonViewerApp();
});

// Handle mobile-specific optimizations
if (/Mobi|Android/i.test(navigator.userAgent)) {
  document.addEventListener('DOMContentLoaded', () => {
    // Add mobile-specific class
    document.body.classList.add('mobile-device');
    console.log('Mobile device detected - Babylon.js WebXR optimizations enabled');
  });
} 