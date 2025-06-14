// Model Viewer App
class ModelViewerApp {
  constructor() {
    this.currentModel = null;
    this.modelId = null;
    this.isRotating = true;
    this.isFullscreen = false;
    this.qrImageUrl = null;
    
    this.init();
  }

  async init() {
    console.log('Initializing Model Viewer...');
    
    // Get model ID from URL parameters
    this.modelId = this.getUrlParameter('id');
    
    if (!this.modelId) {
      this.showError('No model ID provided');
      return;
    }
    
    // Initialize database immediately
    try {
      const initialized = await modelDB.init();
      if (!initialized) {
        this.showError('Database connection failed');
        return;
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      this.showError('Failed to connect to database');
      return;
    }
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load the model immediately
    await this.loadModel();
    
    console.log('Model viewer initialized successfully');
  }

  getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  setupEventListeners() {
    // Model viewer progress
    document.addEventListener('DOMContentLoaded', () => {
      const modelViewer = document.querySelector('model-viewer');
      if (modelViewer) {
        modelViewer.addEventListener('progress', this.onProgress);
        modelViewer.addEventListener('load', this.onModelLoad.bind(this));
        modelViewer.addEventListener('error', this.onModelError.bind(this));
        
        // AR status events
        modelViewer.addEventListener('ar-status', (event) => {
          console.log('AR Status:', event.detail.status);
          if (event.detail.status === 'session-started') {
            this.showMessage('AR session started! Place your model by tapping.', 'success');
          } else if (event.detail.status === 'not-presenting') {
            console.log('AR session ended');
          } else if (event.detail.status === 'failed') {
            this.showMessage('AR failed to start. Try again or use a different device.', 'error');
          }
        });
      }
    });

    // Control buttons
    const resetBtn = document.getElementById('resetView');
    const toggleRotationBtn = document.getElementById('toggleRotation');
    const screenshotBtn = document.getElementById('takeScreenshot');
    const shareBtn = document.getElementById('shareBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const closeFullscreenBtn = document.getElementById('closeFullscreen');
    const downloadQRBtn = document.getElementById('downloadQR');
    const copyUrlBtn = document.getElementById('copyUrl');

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetView());
    }
    
    if (toggleRotationBtn) {
      toggleRotationBtn.addEventListener('click', () => this.toggleRotation());
    }
    
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => this.takeScreenshot());
    }
    
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareModel());
    }
    
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }
    
    if (closeFullscreenBtn) {
      closeFullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }
    
    if (downloadQRBtn) {
      downloadQRBtn.addEventListener('click', () => this.downloadQR());
    }
    
    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', () => this.copyUrl());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isFullscreen) {
        this.toggleFullscreen();
      }
      if (event.key === 'f' || event.key === 'F') {
        this.toggleFullscreen();
      }
      if (event.key === ' ') {
        event.preventDefault();
        this.toggleRotation();
      }
      if (event.key === 'r' || event.key === 'R') {
        this.resetView();
      }
    });
  }

  async loadModel() {
    try {
      this.showLoading();
      
      // Fetch model from database
      const model = await modelDB.getModelById(this.modelId);
      
      if (!model) {
        this.showError('Model not found');
        return;
      }
      
      this.currentModel = model;
      
      // Update page title
      document.title = `${model.title} - 3D Model Viewer`;
      
      // Load model into viewer
      await this.setupModelViewer(model);
      
      // Update UI with model information
      this.updateModelInfo(model);
      
      // Generate QR code
      this.generateQRCode();
      
      // Show main content
      this.showContent();
      
    } catch (error) {
      console.error('Failed to load model:', error);
      this.showError('Failed to load model: ' + error.message);
    }
  }

  async setupModelViewer(model) {
    const modelViewer = document.querySelector('model-viewer');
    
    if (!modelViewer) {
      throw new Error('Model viewer element not found');
    }
    
    // Set model source
    modelViewer.src = model.file_url;
    
    // Configure AR settings for better compatibility
    modelViewer.setAttribute('ar', '');
    modelViewer.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    modelViewer.setAttribute('ar-scale', 'auto');
    
    // Update page meta for social sharing
    this.updateMetaTags(model);
    
    console.log('Model viewer configured with AR support');
  }

  updateModelInfo(model) {
    // Update title and description
    const titleElement = document.getElementById('modelTitle');
    const descriptionElement = document.getElementById('modelDescription');
    const sizeElement = document.getElementById('modelSize');
    const dateElement = document.getElementById('modelDate');
    const fileSizeElement = document.getElementById('fileSize');
    const tagsElement = document.getElementById('modelTags');
    
    if (titleElement) {
      titleElement.textContent = model.title;
    }
    
    if (descriptionElement) {
      descriptionElement.textContent = model.description || 'No description available';
    }
    
    if (sizeElement) {
      sizeElement.textContent = this.formatFileSize(model.file_size);
    }
    
    if (dateElement) {
      dateElement.textContent = this.formatDate(model.upload_date);
    }
    
    if (fileSizeElement) {
      fileSizeElement.textContent = this.formatFileSize(model.file_size);
    }
    
    if (tagsElement && model.tags) {
      tagsElement.innerHTML = this.formatTags(model.tags);
    }
  }

  updateMetaTags(model) {
    // Update page meta tags for better social sharing
    document.querySelector('meta[name="description"]').content = 
      `View ${model.title} in 3D and AR. ${model.description || ''}`;
    
    // Add Open Graph meta tags
    this.addMetaTag('og:title', model.title);
    this.addMetaTag('og:description', model.description || 'View this 3D model in AR');
    this.addMetaTag('og:url', window.location.href);
    this.addMetaTag('og:type', 'website');
  }

  addMetaTag(property, content) {
    let metaTag = document.querySelector(`meta[property="${property}"]`);
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('property', property);
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', content);
  }

  generateQRCode() {
    const qrContainer = document.getElementById('qrcode');
    const currentURL = window.location.href;
    
    if (!qrContainer) return;
    
    try {
      // Use QR Server API - free and reliable
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentURL)}`;
      
      // Store QR URL for download functionality
      this.qrImageUrl = qrApiUrl;
      
      // Create QR code image
      const qrImage = document.createElement('img');
      qrImage.src = qrApiUrl;
      qrImage.alt = 'QR Code for AR viewing';
      qrImage.style.width = '200px';
      qrImage.style.height = '200px';
      qrImage.style.borderRadius = '10px';
      
      // Add loading placeholder while image loads
      qrContainer.innerHTML = '<div class="qr-loading" style="display: flex; align-items: center; justify-content: center; height: 200px; color: #718096;"><i class="fas fa-spinner fa-spin" style="margin-right: 10px;"></i>Loading QR Code...</div>';
      
      // Handle image load
      qrImage.onload = () => {
        qrContainer.innerHTML = '';
        qrContainer.appendChild(qrImage);
      };
      
      // Handle image error
      qrImage.onerror = () => {
        console.error('QR Code generation failed');
        qrContainer.innerHTML = '<p class="qr-error" style="text-align: center; color: #f56565;">QR Code generation failed</p>';
      };
      
    } catch (error) {
      console.error('QR Code generation failed:', error);
      qrContainer.innerHTML = '<p class="qr-error" style="text-align: center; color: #f56565;">QR Code generation failed</p>';
    }
  }

  // Model viewer event handlers
  onProgress = (event) => {
    const progressBar = event.target.querySelector('.progress-bar');
    const updatingBar = event.target.querySelector('.update-bar');
    
    if (updatingBar) {
      updatingBar.style.width = `${event.detail.totalProgress * 100}%`;
    }
    
    if (event.detail.totalProgress === 1) {
      if (progressBar) {
        progressBar.classList.add('hide');
      }
      event.target.removeEventListener('progress', this.onProgress);
    } else {
      if (progressBar) {
        progressBar.classList.remove('hide');
      }
    }
  };

  onModelLoad() {
    console.log('Model loaded successfully');
    this.showMessage('Model loaded successfully! Tap "View in your space" for AR.', 'success');
  }

  onModelError(event) {
    console.error('Model loading error:', event.detail);
    this.showError('Failed to load 3D model');
  }

  // Control functions
  resetView() {
    const modelViewer = document.querySelector('model-viewer');
    if (modelViewer) {
      modelViewer.resetTurntableRotation();
      modelViewer.jumpCameraToGoal();
      this.showMessage('View reset', 'info');
    }
  }

  toggleRotation() {
    const modelViewer = document.querySelector('model-viewer');
    const toggleBtn = document.getElementById('toggleRotation');
    
    if (!modelViewer || !toggleBtn) return;
    
    if (this.isRotating) {
      modelViewer.removeAttribute('auto-rotate');
      toggleBtn.innerHTML = '<i class="fas fa-play"></i> Start Rotation';
      this.isRotating = false;
    } else {
      modelViewer.setAttribute('auto-rotate', '');
      toggleBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Rotation';
      this.isRotating = true;
    }
  }

  async takeScreenshot() {
    const modelViewer = document.querySelector('model-viewer');
    
    if (!modelViewer) {
      this.showMessage('Model viewer not found', 'error');
      return;
    }
    
    try {
      const screenshot = await modelViewer.toDataURL('image/png');
      
      // Create download link
      const link = document.createElement('a');
      link.download = `${this.currentModel?.title || 'model'}-screenshot.png`;
      link.href = screenshot;
      link.click();
      
      this.showMessage('Screenshot saved!', 'success');
    } catch (error) {
      console.error('Screenshot failed:', error);
      this.showMessage('Screenshot failed', 'error');
    }
  }

  async shareModel() {
    const currentURL = window.location.href;
    const model = this.currentModel;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: model.title,
          text: `Check out this 3D model: ${model.title}`,
          url: currentURL
        });
      } catch (error) {
        console.error('Share failed:', error);
        this.copyUrl();
      }
    } else {
      this.copyUrl();
    }
  }

  toggleFullscreen() {
    const fullscreenModal = document.getElementById('fullscreenModal');
    const fullscreenViewer = document.querySelector('.fullscreen-viewer');
    const fullscreenTitle = document.getElementById('fullscreenTitle');
    const modelViewer = document.querySelector('model-viewer');
    const originalParent = document.querySelector('.model-viewer-section');
    
    if (!fullscreenModal || !modelViewer) return;
    
    if (!this.isFullscreen) {
      // Enter fullscreen
      fullscreenModal.style.display = 'flex';
      fullscreenViewer.appendChild(modelViewer);
      if (fullscreenTitle && this.currentModel) {
        fullscreenTitle.textContent = this.currentModel.title;
      }
      this.isFullscreen = true;
      
      // Update button
      const fullscreenBtn = document.getElementById('fullscreenBtn');
      if (fullscreenBtn) {
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i> Exit Fullscreen';
      }
    } else {
      // Exit fullscreen
      fullscreenModal.style.display = 'none';
      originalParent.insertBefore(modelViewer, originalParent.firstChild);
      this.isFullscreen = false;
      
      // Update button
      const fullscreenBtn = document.getElementById('fullscreenBtn');
      if (fullscreenBtn) {
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i> Fullscreen';
      }
    }
  }

  downloadQR() {
    if (!this.qrImageUrl) {
      this.showMessage('QR code not found', 'error');
      return;
    }
    
    try {
      // Open QR image in new tab for download
      window.open(this.qrImageUrl, '_blank');
      this.showMessage('QR code opened in new tab - right-click to save!', 'success');
    } catch (error) {
      console.error('QR download failed:', error);
      this.showMessage('QR download failed', 'error');
    }
  }

  async copyUrl() {
    const currentURL = window.location.href;
    
    try {
      await navigator.clipboard.writeText(currentURL);
      this.showMessage('URL copied to clipboard!', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      this.showMessage('Failed to copy URL', 'error');
    }
  }

  // UI State Management
  showLoading() {
    document.getElementById('loadingState').style.display = 'flex';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
  }

  showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    
    // Update error message if element exists
    const errorContent = document.querySelector('.error-content p');
    if (errorContent) {
      errorContent.textContent = message;
    }
  }

  showContent() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
  }

  showMessage(message, type = 'info') {
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `status-message ${type}`;
    messageElement.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(messageElement);
    
    // Position message
    messageElement.style.position = 'fixed';
    messageElement.style.top = '20px';
    messageElement.style.right = '20px';
    messageElement.style.zIndex = '1000';
    messageElement.style.background = 'white';
    messageElement.style.padding = '15px 20px';
    messageElement.style.borderRadius = '10px';
    messageElement.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
    messageElement.style.borderLeft = `4px solid ${
      type === 'success' ? '#48bb78' : 
      type === 'error' ? '#f56565' : 
      '#4299e1'
    }`;
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 3000);
  }

  // Utility functions
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatTags(tags) {
    if (!tags || tags.length === 0) return '';
    
    return tags.map(tag => 
      `<span class="tag">${this.escapeHtml(tag)}</span>`
    ).join('');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.viewerApp = new ModelViewerApp();
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