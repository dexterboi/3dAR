// Google Scene Viewer 3D Model Viewer
class SceneViewerApp {
  constructor() {
    this.currentModel = null;
    this.modelId = null;
    this.isRotating = true;
    this.isFullscreen = false;
    this.qrImageUrl = null;
    this.modelViewer = null;
    
    this.init();
  }

  async init() {
    console.log('Initializing Scene Viewer App...');
    
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
    
    // Setup event listeners
    this.setupEventListeners();
    
    console.log('Scene Viewer App initialized successfully');
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
      
      // Load the 3D model
      await this.loadModel(model);
      
      // Generate QR code
      this.generateQRCode();
      
      // Show main content
      this.showMainContent();
      
    } catch (error) {
      console.error('Error loading model:', error);
      this.showError('Failed to load model data: ' + error.message);
    }
  }

  async loadModel(model) {
    try {
      this.updateLoadingText('Loading 3D model...');
      
      this.modelViewer = document.getElementById('modelViewer');
      
      // Use the stored file_url directly, or construct it properly
      let modelUrl;
      if (model.file_url) {
        modelUrl = model.file_url;
      } else {
        // If no file_url, construct it properly (file_path already includes "models/")
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
      
      // Set the model source
      this.modelViewer.src = modelUrl;
      
      // Wait for model to load
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Model loading timeout (30s)'));
        }, 30000); // 30 second timeout
        
        this.modelViewer.addEventListener('load', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        
        this.modelViewer.addEventListener('error', (event) => {
          clearTimeout(timeout);
          const errorMsg = event.detail?.message || event.detail?.type || 'Unknown model-viewer error';
          reject(new Error(`Model failed to load: ${errorMsg}`));
        }, { once: true });
      });
      
      console.log('Model loaded successfully');
      
    } catch (error) {
      console.error('Error loading 3D model:', error);
      
      // Show user-friendly error message
      let userMessage = 'Failed to load 3D model. ';
      if (error.message.includes('CORS')) {
        userMessage += 'This may be a cross-origin issue. Try accessing the model directly.';
      } else if (error.message.includes('404')) {
        userMessage += 'Model file not found on server.';
      } else if (error.message.includes('timeout')) {
        userMessage += 'Model took too long to load. Check your internet connection.';
      } else {
        userMessage += error.message;
      }
      
      throw new Error(userMessage);
    }
  }

  updateModelInfo(model) {
    const titleElement = document.getElementById('modelTitle');
    const descriptionElement = document.getElementById('modelDescription');
    const sizeElement = document.getElementById('modelSize');
    const dateElement = document.getElementById('modelDate');
    
    if (titleElement) titleElement.textContent = model.title;
    if (descriptionElement) descriptionElement.textContent = model.description || 'Interactive 3D model with AR support via Google Scene Viewer';
    
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

  generateQRCode() {
    const modelUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${this.modelId}`;
    this.qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(modelUrl)}`;
    
    const qrImage = document.getElementById('qrImage');
    if (qrImage) {
      qrImage.src = this.qrImageUrl;
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
    
    // QR actions
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const downloadQRBtn = document.getElementById('downloadQRBtn');
    
    if (copyLinkBtn) copyLinkBtn.addEventListener('click', () => this.copyModelLink());
    if (downloadQRBtn) downloadQRBtn.addEventListener('click', () => this.downloadQR());
    
    // Model viewer events
    if (this.modelViewer) {
      this.modelViewer.addEventListener('ar-status', (event) => {
        console.log('AR Status:', event.detail.status);
        this.handleARStatus(event.detail.status);
      });
      
      this.modelViewer.addEventListener('load', () => {
        console.log('Model viewer loaded successfully');
      });
      
      this.modelViewer.addEventListener('error', (event) => {
        console.error('Model viewer error:', event.detail);
      });
    }
  }

  handleARStatus(status) {
    const arInstructions = document.getElementById('arInstructions');
    
    switch (status) {
      case 'session-started':
        console.log('AR session started');
        if (arInstructions) arInstructions.style.display = 'none';
        break;
      case 'object-placed':
        console.log('AR object placed');
        break;
      case 'failed':
        console.log('AR failed to start');
        if (arInstructions) arInstructions.style.display = 'block';
        break;
    }
  }

  // Control methods
  toggleRotation() {
    if (!this.modelViewer) return;
    
    const btn = document.getElementById('rotateBtn');
    
    if (this.isRotating) {
      this.modelViewer.removeAttribute('auto-rotate');
      if (btn) btn.innerHTML = '<i class="fas fa-play"></i><span>Start Rotate</span>';
      this.isRotating = false;
    } else {
      this.modelViewer.setAttribute('auto-rotate', '');
      if (btn) btn.innerHTML = '<i class="fas fa-sync-alt"></i><span>Auto Rotate</span>';
      this.isRotating = true;
    }
  }

  resetView() {
    if (!this.modelViewer) return;
    
    this.modelViewer.resetTurntableRotation();
    this.modelViewer.jumpCameraToGoal();
  }

  async takeScreenshot() {
    if (!this.modelViewer) return;
    
    try {
      const screenshot = await this.modelViewer.toDataURL('image/png');
      
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
  showDemoMode() {
    const loadingScreen = document.getElementById('loadingScreen');
    const modelContainer = document.getElementById('modelContainer');
    const modelInfo = document.getElementById('modelInfo');
    const arInstructions = document.getElementById('arInstructions');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    
    if (modelContainer) {
      modelContainer.style.display = 'block';
      
      // Set up demo model
      this.modelViewer = document.getElementById('modelViewer');
      if (this.modelViewer) {
        // Use a demo GLB model from the web
        this.modelViewer.src = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';
        this.modelViewer.alt = 'Demo 3D Model';
      }
    }
    
    if (modelInfo) {
      modelInfo.style.display = 'block';
      const titleElement = document.getElementById('modelTitle');
      const descriptionElement = document.getElementById('modelDescription');
      const sizeElement = document.getElementById('modelSize');
      const dateElement = document.getElementById('modelDate');
      
      if (titleElement) titleElement.textContent = 'Demo Mode - Astronaut';
      if (descriptionElement) descriptionElement.textContent = 'This is a demo of the Scene Viewer. Upload models in the gallery to view your own 3D models here.';
      if (sizeElement) sizeElement.textContent = 'Demo';
      if (dateElement) dateElement.textContent = 'Demo';
    }
    
    if (arInstructions) {
      arInstructions.style.display = 'block';
    }
    
    // Setup basic event listeners
    this.setupEventListeners();
    
    this.showMessage('Demo mode active - showing sample 3D model', 'info');
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
  new SceneViewerApp();
});

// Handle mobile-specific optimizations
if (/Mobi|Android/i.test(navigator.userAgent)) {
  document.addEventListener('DOMContentLoaded', () => {
    // Add mobile-specific class
    document.body.classList.add('mobile-device');
    console.log('Mobile device detected - Scene Viewer AR optimizations enabled');
  });
} 