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
    this.isARMode = false;
    this.isPreviewMode = false;
    this.controls = null;
    
    this.init();
  }

  async init() {
    console.log('Initializing WebXR AR Viewer...');
    
    // Get model ID from URL parameters
    this.modelId = this.getUrlParameter('id');
    const autoAR = this.getUrlParameter('ar') === 'true';
    
    if (!this.modelId) {
      console.warn('No model ID provided, entering demo mode');
      this.showDemoMode(autoAR);
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
    await this.loadModelData(autoAR);
    
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

  async loadModelData(autoAR = false) {
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
      
      // Initialize Three.js (always for preview)
      await this.setupThreeJS();
      
      // Load the 3D model
      await this.loadModel(model);
      
      // Start in preview mode first
      await this.startPreviewMode();
      
      // Check WebXR support for AR button
      const webxrSupported = await this.checkWebXRSupport();
      
      // Generate QR code
      this.generateQRCode();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Show main content
      this.showMainContent();
      
      // Auto-start AR if requested and supported
      if (autoAR && webxrSupported) {
        setTimeout(() => {
          this.startAR();
        }, 1000); // Give time for UI to load
      } else if (autoAR && !webxrSupported) {
        this.showMessage('AR not supported on this device - showing 3D preview', 'info');
      }
      
    } catch (error) {
      console.error('Error loading model:', error);
      this.showError('Failed to load model data: ' + error.message);
    }
  }

  async checkWebXRSupport() {
    console.log('Checking WebXR support...');
    
    if (!navigator.xr) {
      console.warn('navigator.xr not available');
      return false;
    }
    
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      console.log('WebXR AR support check result:', supported);
      
      if (!supported) {
        console.warn('WebXR AR not supported on this device');
        return false;
      }
      
      console.log('WebXR AR is supported!');
      
      // Show AR button if supported
      const startARBtn = document.getElementById('startARBtn');
      if (startARBtn) {
        startARBtn.style.display = 'block';
        console.log('AR button shown');
      }
      
      return true;
    } catch (error) {
      console.error('WebXR support check failed:', error);
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
    this.scene.background = new THREE.Color(0xf8f8f8); // Very light gray background for soft preview
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 1, 3);
    this.camera.lookAt(0, 0, 0); // Always look at center initially
    
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
    
    // Create reticle for surface targeting (hidden initially)
    this.createReticle();
    
    // Add orbit controls for preview mode (will be configured after model loads)
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(0, 0, 0); // Always target center
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 1.0; // Slower, more elegant rotation
      this.controls.enablePan = false; // Disable panning to keep focus on product
      this.controls.minDistance = 1; // Minimum zoom distance
      this.controls.maxDistance = 10; // Maximum zoom distance
      this.controls.maxPolarAngle = Math.PI * 0.8; // Prevent camera from going too low
      this.controls.minPolarAngle = Math.PI * 0.1; // Prevent camera from going too high
      this.controls.update(); // Apply initial settings
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Start render loop
    this.renderer.setAnimationLoop((time, frame) => {
      this.onFrame(time, frame);
    });
    
    console.log('Three.js setup complete');
  }

  setupLighting() {
    // Soft ambient light - increased intensity for gentle illumination
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0xf0f0f0, 0.6);
    this.scene.add(ambientLight);
    
    // Soft directional light - reduced intensity and softer shadows
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(5, 8, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.radius = 8; // Softer shadow edges
    directionalLight.shadow.blurSamples = 25; // More blur samples for softer shadows
    this.scene.add(directionalLight);
    
    // Additional soft fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xf8f8ff, 0.2);
    fillLight.position.set(-3, 4, -3);
    this.scene.add(fillLight);
    
    // Create shadow plane (invisible, only receives shadows)
    const shadowGeometry = new THREE.PlaneGeometry(20, 20);
    const shadowMaterial = new THREE.ShadowMaterial({ opacity: 0.15 }); // Very subtle shadows
    this.shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = -1; // Below model in preview
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
            const scale = 2 / maxSize; // Scale to 2 units for better preview
            this.loadedModel.scale.setScalar(scale);
            
            // Force perfect centering - multiple approaches
            // Method 1: Recalculate bounding box after scaling
            box.setFromObject(this.loadedModel);
            const center = box.getCenter(new THREE.Vector3());
            
            // Method 2: Create a group to ensure perfect centering
            const modelGroup = new THREE.Group();
            modelGroup.add(this.loadedModel);
            
            // Method 3: Position the model to counteract the center offset
            this.loadedModel.position.set(-center.x, -center.y, -center.z);
            
            // Method 4: Position the group at origin to guarantee centering
            modelGroup.position.set(0, 0, 0);
            
            // Add the group to scene instead of the model directly
            this.scene.add(modelGroup);
            
            // Store reference to the group for later use
            this.modelGroup = modelGroup;
            
            // Configure orbit controls to center around the origin
            if (this.controls) {
              // Force target to absolute center
              this.controls.target.set(0, 0, 0);
              
              // Position camera at optimal viewing distance
              const scaledSize = box.getSize(new THREE.Vector3());
              const optimalDistance = Math.max(scaledSize.x, scaledSize.y, scaledSize.z) * 1.5;
              this.camera.position.set(
                0, // X centered
                optimalDistance * 0.3, // Slightly above
                optimalDistance * 1.5  // Back for good view
              );
              
              // Force camera to look at absolute center
              this.camera.lookAt(0, 0, 0);
              
              // Update controls with forced centering
              this.controls.target.set(0, 0, 0);
              this.controls.update();
            }
            
            // Store original model for cloning in AR
            window.loadedModel = this.loadedModel.clone();
            
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

  async startPreviewMode() {
    console.log('Starting preview mode');
    this.isPreviewMode = true;
    this.isARMode = false;
    
    // Show preview background
    this.scene.background = new THREE.Color(0xf8f8f8);
    
    // Position shadow mesh for preview
    this.shadowMesh.position.y = -1;
    this.shadowMesh.visible = true;
    
    // Hide reticle
    this.reticle.visible = false;
    
    // Hide stabilization message (only for AR mode)
    document.body.classList.add('stabilized');
    
    // Enable controls if available
    if (this.controls) {
      this.controls.enabled = true;
    }
    
    // Update UI
    this.updateARStatus('3D Preview Mode - Tap "Start AR" for AR experience');
    
    // Show start AR button if WebXR is supported
    const webxrSupported = await this.checkWebXRSupport();
    const startARBtn = document.getElementById('startARBtn');
    if (startARBtn) {
      startARBtn.style.display = webxrSupported ? 'block' : 'none';
    }
  }

  async onSessionStarted(session) {
    console.log('WebXR session started successfully');
    console.log('Session details:', {
      mode: session.mode,
      inputSources: session.inputSources.length,
      visibilityState: session.visibilityState
    });
    
    this.xrSession = session;
    this.isARMode = true;
    this.isPreviewMode = false;
    this.stabilized = false; // Reset stabilization for AR
    
    try {
      // Setup reference spaces
      console.log('Setting up reference spaces...');
      this.localReferenceSpace = await session.requestReferenceSpace('local');
      console.log('Local reference space created');
      
      this.viewerSpace = await session.requestReferenceSpace('viewer');
      console.log('Viewer reference space created');
      
      // Setup hit testing
      console.log('Setting up hit testing...');
      this.hitTestSource = await session.requestHitTestSource({ space: this.viewerSpace });
      console.log('Hit test source created');
      
      // Add select event listener for placing models
      session.addEventListener('select', this.onSelect.bind(this));
      console.log('Select event listener added');
      
      // Remove preview model from scene
      if (this.loadedModel) {
        this.scene.remove(this.loadedModel);
      }
      // Also remove model group if it exists
      if (this.modelGroup) {
        this.scene.remove(this.modelGroup);
      }
      console.log('Preview models removed from scene');
      
      // Clear background for AR
      this.scene.background = null;
      
      // Show stabilization message for AR (remove 'stabilized' class)
      document.body.classList.remove('stabilized');
      
      // Disable orbit controls
      if (this.controls) {
        this.controls.enabled = false;
      }
      
      // Update UI
      this.updateARStatus('AR session active - Look around to find surfaces');
      document.getElementById('startARBtn').style.display = 'none';
      document.getElementById('exitARBtn').style.display = 'block';
      document.getElementById('placeModelBtn').style.display = 'block';
      
      console.log('AR session setup complete');
      
    } catch (error) {
      console.error('Error during AR session setup:', error);
      this.updateARStatus('AR setup failed: ' + error.message);
      await this.exitAR();
    }
  }

  onFrame(time, frame) {
    // Handle AR frame
    if (frame && this.isARMode) {
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
    
    // Handle preview mode
    if (this.isPreviewMode && this.controls) {
      this.controls.update();
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
      this.shadowMesh.visible = true;
      
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
      console.log('Attempting to start AR session...');
      
      // Check if WebXR is available
      if (!navigator.xr) {
        throw new Error('WebXR not available on this device');
      }
      
      // Check AR support specifically
      const arSupported = await navigator.xr.isSessionSupported('immersive-ar');
      if (!arSupported) {
        throw new Error('AR not supported on this device');
      }
      
      console.log('WebXR AR is supported, requesting session...');
      
      // Request AR session with minimal requirements for better compatibility
      const sessionInit = {
        requiredFeatures: ['local'],
        optionalFeatures: ['hit-test', 'dom-overlay', 'anchors'],
      };
      
      // Add DOM overlay for better Samsung compatibility
      const overlay = document.getElementById('arContainer');
      if (overlay) {
        sessionInit.domOverlay = { root: overlay };
      }
      
      console.log('Requesting AR session with features:', sessionInit);
      
      const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
      console.log('AR session created successfully:', session);
      
      // Set the session on the renderer
      await this.renderer.xr.setSession(session);
      console.log('Renderer XR session set');
      
      // Start the session
      await this.onSessionStarted(session);
      
    } catch (error) {
      console.error('Failed to start AR session:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Failed to start AR. ';
      if (error.message.includes('not supported')) {
        errorMessage += 'AR not supported on this device. Try using Chrome on an ARCore-compatible Android device.';
      } else if (error.message.includes('not allowed') || error.name === 'NotAllowedError') {
        errorMessage += 'Camera permission required for AR. Please allow camera access and try again.';
      } else if (error.message.includes('NotFoundError') || error.name === 'NotFoundError') {
        errorMessage += 'No AR-capable camera found on this device.';
      } else if (error.message.includes('SecurityError') || error.name === 'SecurityError') {
        errorMessage += 'AR requires HTTPS or localhost. Please use a secure connection.';
      } else if (error.message.includes('InvalidStateError') || error.name === 'InvalidStateError') {
        errorMessage += 'AR session already active or device busy. Please try again.';
      } else {
        errorMessage += `Error: ${error.message}. Please ensure you're using Chrome on an ARCore-compatible device.`;
      }
      
      this.updateARStatus(errorMessage);
      this.showMessage(errorMessage, 'error');
      
      // Stay in preview mode
      await this.startPreviewMode();
    }
  }

  async exitAR() {
    if (this.xrSession) {
      await this.xrSession.end();
      this.xrSession = null;
      this.stabilized = false;
      document.body.classList.remove('stabilized');
      
      // Clear placed models
      this.placedModels.forEach(model => {
        this.scene.remove(model);
      });
      this.placedModels = [];
      
      // Restore the preview model group
      if (this.modelGroup) {
        this.scene.add(this.modelGroup);
      }
      
      // Return to preview mode
      await this.startPreviewMode();
      
      // Update UI
      document.getElementById('startARBtn').style.display = 'block';
      document.getElementById('exitARBtn').style.display = 'none';
      document.getElementById('placeModelBtn').style.display = 'none';
      
      console.log('AR session ended, returned to preview mode');
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
      // Direct AR launch URL
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
    
    this.updateQRInstructions(type);
  }

  updateQRInstructions(type) {
    const qrInstructions = document.querySelector('.qr-instructions');
    if (qrInstructions) {
      if (type === 'direct') {
        qrInstructions.innerHTML = `
          <i class="fas fa-vr-cardboard"></i>
          <strong>Direct AR Launch:</strong> Scan to automatically start AR experience
        `;
      } else {
        qrInstructions.innerHTML = `
          <i class="fas fa-globe"></i>
          <strong>3D Preview First:</strong> Scan to view model, then tap "Start AR"
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
  async showDemoMode(autoAR = false) {
    console.log('Entering demo mode');
    
    // Setup Three.js for demo
    await this.setupThreeJS();
    
    // Create demo model (cube)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x4a90e2,
      roughness: 0.3,
      metalness: 0.1
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;
    
    // Position cube at origin for proper orbit
    cube.position.set(0, 0, 0);
    
    // Add to scene
    this.scene.add(cube);
    this.loadedModel = cube;
    
    // Configure orbit controls for demo cube
    if (this.controls) {
      // Set the target to the cube's center (at origin)
      this.controls.target.set(0, 0, 0);
      
      // Position camera at optimal viewing distance for cube
      this.camera.position.set(2, 1.5, 2.5);
      
      // Update controls
      this.controls.update();
    }
    
    // Store as loaded model for AR
    window.loadedModel = cube.clone();
    
    // Start preview mode
    await this.startPreviewMode();
    
    // Update UI for demo
    this.updateDemoInfo();
    this.generateDemoQRCode();
    this.setupEventListeners();
    this.showMainContent();
    
    this.showMessage('Demo mode - 3D preview with AR capability', 'info');
    
    // Auto-start AR if requested and supported
    if (autoAR) {
      const webxrSupported = await this.checkWebXRSupport();
      if (webxrSupported) {
        setTimeout(() => {
          this.startAR();
        }, 1000);
      } else {
        this.showMessage('AR not supported - showing 3D preview', 'info');
      }
    }
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