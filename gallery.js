// Gallery App Main JavaScript
class ModelGalleryApp {
  constructor() {
    this.models = [];
    this.filteredModels = [];
    this.uploadedFile = null;
    this.qrCodes = new Map();
    
    this.init();
  }

  async init() {
    console.log('Initializing Model Gallery App...');
    
    // Initialize database immediately
    try {
      const initialized = await modelDB.init();
      if (!initialized) {
        this.showMessage('Database connection failed. Please check your configuration.', 'error');
        return;
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      this.showMessage('Database initialization failed. Please check your Supabase configuration.', 'error');
      return;
    }
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load existing models
    await this.loadModels();
    
    console.log('Gallery app initialized successfully');
  }

  setupEventListeners() {
    // File upload events
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }
    
    if (uploadArea) {
      // Drag and drop events
      uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
      uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
      
      // Click to upload
      uploadArea.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce(() => this.searchModels(), 300));
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchModels();
        }
      });
    }
  }

  // File handling methods
  handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
  }

  handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
  }

  handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  processFile(file) {
    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      this.showMessage(validation.error, 'error');
      return;
    }
    
    this.uploadedFile = file;
    this.showUploadForm(file);
  }

  validateFile(file) {
    // Check file size
    if (file.size > APP_CONFIG.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds ${Math.round(APP_CONFIG.maxFileSize / (1024 * 1024))}MB limit`
      };
    }
    
    // Check file format
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!APP_CONFIG.allowedFormats.includes(fileExt)) {
      return {
        valid: false,
        error: `File format not supported. Allowed formats: ${APP_CONFIG.allowedFormats.join(', ')}`
      };
    }
    
    return { valid: true };
  }

  showUploadForm(file) {
    const uploadArea = document.getElementById('uploadArea');
    const uploadForm = document.getElementById('uploadForm');
    const titleInput = document.getElementById('modelTitle');
    
    if (uploadArea) uploadArea.style.display = 'none';
    if (uploadForm) uploadForm.style.display = 'block';
    
    // Pre-fill title with filename
    if (titleInput) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, '');
    }
  }

  // Upload functionality
  async uploadModel() {
    if (!this.uploadedFile) {
      this.showMessage('No file selected', 'error');
      return;
    }
    
    const title = document.getElementById('modelTitle')?.value?.trim();
    const description = document.getElementById('modelDescription')?.value?.trim();
    const tags = document.getElementById('modelTags')?.value?.trim();
    
    if (!title) {
      this.showMessage('Please enter a model title', 'error');
      return;
    }
    
    const metadata = {
      title,
      description,
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      isPublic: true
    };
    
    try {
      this.showUploadProgress();
      
      // Upload to database
      const uploadedModel = await modelDB.uploadModel(this.uploadedFile, metadata);
      
      this.showMessage('Model uploaded successfully!', 'success');
      this.resetUploadForm();
      
      // Refresh models list
      await this.loadModels();
      
    } catch (error) {
      console.error('Upload error:', error);
      this.showMessage('Upload failed: ' + error.message, 'error');
      this.hideUploadProgress();
    }
  }

  showUploadProgress() {
    const uploadForm = document.getElementById('uploadForm');
    const uploadProgress = document.getElementById('uploadProgress');
    
    if (uploadForm) uploadForm.style.display = 'none';
    if (uploadProgress) uploadProgress.style.display = 'block';
    
    // Simulate progress (Supabase doesn't provide real-time progress)
    let progress = 0;
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.querySelector('.progress-percentage');
    
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 95) progress = 95;
      
      if (progressFill) progressFill.style.width = progress + '%';
      if (progressPercentage) progressPercentage.textContent = Math.round(progress) + '%';
      
      if (progress >= 95) {
        clearInterval(interval);
      }
    }, 200);
  }

  hideUploadProgress() {
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadArea = document.getElementById('uploadArea');
    
    if (uploadProgress) uploadProgress.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
  }

  resetUploadForm() {
    const uploadForm = document.getElementById('uploadForm');
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    // Reset form fields
    ['modelTitle', 'modelDescription', 'modelTags'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.value = '';
    });
    
    // Reset file input
    if (fileInput) fileInput.value = '';
    
    // Reset upload state
    this.uploadedFile = null;
    
    // Show/hide appropriate sections
    if (uploadForm) uploadForm.style.display = 'none';
    if (uploadProgress) uploadProgress.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
  }

  // Model loading and display
  async loadModels() {
    try {
      this.showLoadingSpinner();
      
      const models = await modelDB.getAllModels();
      this.models = models;
      this.filteredModels = models;
      
      this.renderModels();
      this.updateModelCount();
      
    } catch (error) {
      console.error('Failed to load models:', error);
      this.showMessage('Failed to load models: ' + error.message, 'error');
      this.hideLoadingSpinner();
    }
  }

  renderModels() {
    const modelsGrid = document.getElementById('modelsGrid');
    if (!modelsGrid) return;
    
    if (this.filteredModels.length === 0) {
      modelsGrid.innerHTML = this.getEmptyStateHTML();
      return;
    }
    
    const template = document.getElementById('modelCardTemplate');
    if (!template) {
      console.error('Model card template not found');
      return;
    }
    
    modelsGrid.innerHTML = '';
    
    this.filteredModels.forEach(model => {
      const modelCard = this.createModelCard(model, template);
      modelsGrid.appendChild(modelCard);
      
      // Generate QR code for this model (will show loading if QRCode not ready)
      this.generateModelQRCode(model);
    });
  }

  createModelCard(model, template) {
    let cardHTML = template.innerHTML;
    
    // Replace placeholders
    const replacements = {
      '{id}': model.id,
      '{title}': this.escapeHtml(model.title),
      '{description}': this.escapeHtml(model.description || 'No description'),
      '{size}': this.formatFileSize(model.file_size),
      '{date}': this.formatDate(model.upload_date),
      '{tags}': this.formatTags(model.tags || [])
    };
    
    Object.entries(replacements).forEach(([placeholder, value]) => {
      cardHTML = cardHTML.replace(new RegExp(placeholder, 'g'), value);
    });
    
    const cardElement = document.createElement('div');
    cardElement.innerHTML = cardHTML;
    cardElement.classList.add('fade-in');
    
    return cardElement.firstElementChild;
  }

  async generateModelQRCode(model) {
    const qrContainer = document.getElementById(`qr-${model.id}`);
    if (!qrContainer) return;
    
    const modelUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${model.id}`;
    
    try {
      // Clear container first
      qrContainer.innerHTML = '';
      
      // Use QR Server API - free and reliable
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(modelUrl)}`;
      
      // Create QR code image
      const qrImage = document.createElement('img');
      qrImage.src = qrApiUrl;
      qrImage.alt = `QR Code for ${model.title}`;
      qrImage.style.borderRadius = '8px';
      qrImage.style.maxWidth = '100px';
      qrImage.style.maxHeight = '100px';
      
      // Add loading placeholder while image loads
      qrContainer.innerHTML = '<div class="qr-loading" style="display: flex; align-items: center; justify-content: center; height: 100px; color: #718096; font-size: 0.8rem;"><i class="fas fa-spinner fa-spin"></i></div>';
      
      // Handle image load
      qrImage.onload = () => {
        qrContainer.innerHTML = '';
        qrContainer.appendChild(qrImage);
      };
      
      // Handle image error
      qrImage.onerror = () => {
        console.error('QR Code generation failed for model:', model.id);
        qrContainer.innerHTML = '<div class="qr-error" style="text-align: center; color: #f56565; font-size: 0.8rem;">QR Error</div>';
      };
      
      // Store QR code reference for download functionality
      this.qrCodes.set(model.id, { url: modelUrl, qrUrl: qrApiUrl });
      
    } catch (error) {
      console.error('QR Code generation failed for model:', model.id, error);
      qrContainer.innerHTML = '<div class="qr-error" style="text-align: center; color: #f56565; font-size: 0.8rem;">QR Error</div>';
    }
  }

  // Search and filter functionality
  async searchModels() {
    const searchTerm = document.getElementById('searchInput')?.value?.trim();
    
    if (!searchTerm) {
      this.filteredModels = this.models;
    } else {
      try {
        this.filteredModels = await modelDB.searchModels(searchTerm);
      } catch (error) {
        console.error('Search failed:', error);
        this.showMessage('Search failed', 'error');
        return;
      }
    }
    
    this.renderModels();
    this.updateModelCount();
  }

  sortModels() {
    const sortBy = document.getElementById('sortSelect')?.value;
    
    if (!sortBy) return;
    
    this.filteredModels.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.upload_date) - new Date(a.upload_date);
        case 'oldest':
          return new Date(a.upload_date) - new Date(b.upload_date);
        case 'name':
          return a.title.localeCompare(b.title);
        case 'size':
          return b.file_size - a.file_size;
        default:
          return 0;
      }
    });
    
    this.renderModels();
  }

  // Model actions
  viewModel(id) {
    window.open(`viewer.html?id=${id}`, '_blank');
  }

  openAR(id) {
    const modelUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${id}`;
    
    // For mobile devices, open directly
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      window.open(modelUrl, '_blank');
    } else {
      // For desktop, show QR code modal or copy link
      this.copyModelLink(id);
      this.showMessage('Link copied! Open on your mobile device for AR experience.', 'info');
    }
  }

  openEnhancedAR(id) {
    const arUrl = `${APP_CONFIG.baseUrl}/ar-viewer.html?id=${id}`;
    
    // Open enhanced AR viewer
    window.open(arUrl, '_blank');
    this.showMessage('Enhanced AR viewer opened! Better surface placement and tracking.', 'success');
  }

  async editModel(id) {
    // Simple edit functionality - could be expanded to a modal
    const model = this.models.find(m => m.id === id);
    if (!model) return;
    
    const newTitle = prompt('Enter new title:', model.title);
    if (newTitle && newTitle !== model.title) {
      try {
        await modelDB.updateModel(id, { title: newTitle });
        this.showMessage('Model updated successfully', 'success');
        await this.loadModels();
      } catch (error) {
        console.error('Update failed:', error);
        this.showMessage('Update failed: ' + error.message, 'error');
      }
    }
  }

  async deleteModel(id) {
    const model = this.models.find(m => m.id === id);
    if (!model) return;
    
    if (!confirm(`Are you sure you want to delete "${model.title}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await modelDB.deleteModel(id);
      this.showMessage('Model deleted successfully', 'success');
      await this.loadModels();
    } catch (error) {
      console.error('Delete failed:', error);
      this.showMessage('Delete failed: ' + error.message, 'error');
    }
  }

  async copyModelLink(id) {
    const modelUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${id}`;
    
    try {
      await navigator.clipboard.writeText(modelUrl);
      this.showMessage('Model link copied to clipboard!', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      this.showMessage('Failed to copy link', 'error');
    }
  }

  async shareModel(id) {
    const model = this.models.find(m => m.id === id);
    const modelUrl = `${APP_CONFIG.baseUrl}/viewer.html?id=${id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: model.title,
          text: `Check out this 3D model: ${model.title}`,
          url: modelUrl
        });
      } catch (error) {
        console.error('Share failed:', error);
        this.copyModelLink(id);
      }
    } else {
      this.copyModelLink(id);
    }
  }

  downloadQR(id, title) {
    const qrData = this.qrCodes.get(id);
    
    if (!qrData) {
      this.showMessage('QR code not found', 'error');
      return;
    }
    
    try {
      // Create a temporary link to download the QR code image
      const link = document.createElement('a');
      link.href = qrData.qrUrl;
      link.download = `${title}-QR-Code.png`;
      link.target = '_blank';
      
      // For better compatibility, we'll open the QR image in a new tab
      // User can right-click and save it
      window.open(qrData.qrUrl, '_blank');
      
      this.showMessage('QR code opened in new tab - right-click to save!', 'success');
    } catch (error) {
      console.error('QR download failed:', error);
      this.showMessage('QR download failed', 'error');
    }
  }

  // Utility methods
  updateModelCount() {
    const countElement = document.getElementById('modelCount');
    if (countElement) {
      const count = this.filteredModels.length;
      countElement.textContent = `${count} model${count !== 1 ? 's' : ''}`;
    }
  }

  showLoadingSpinner() {
    const modelsGrid = document.getElementById('modelsGrid');
    if (modelsGrid) {
      modelsGrid.innerHTML = `
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Loading models...</p>
        </div>
      `;
    }
  }

  hideLoadingSpinner() {
    // Loading spinner will be replaced when models are rendered
  }

  getEmptyStateHTML() {
    return `
      <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px; color: #718096;">
        <i class="fas fa-cube" style="font-size: 4rem; margin-bottom: 20px; opacity: 0.5;"></i>
        <h3 style="margin: 0 0 10px; color: #4a5568;">No models found</h3>
        <p style="margin: 0;">Upload your first 3D model to get started!</p>
      </div>
    `;
  }

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
      month: 'short',
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

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  showMessage(message, type = 'info') {
    const messagesContainer = document.getElementById('statusMessages');
    if (!messagesContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `status-message ${type}`;
    messageElement.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    messagesContainer.appendChild(messageElement);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 5000);
  }
}

// Global functions for HTML onclick handlers
function cancelUpload() {
  if (window.galleryApp) {
    window.galleryApp.resetUploadForm();
  }
}

function uploadModel() {
  if (window.galleryApp) {
    window.galleryApp.uploadModel();
  }
}

function searchModels() {
  if (window.galleryApp) {
    window.galleryApp.searchModels();
  }
}

function sortModels() {
  if (window.galleryApp) {
    window.galleryApp.sortModels();
  }
}

function viewModel(id) {
  if (window.galleryApp) {
    window.galleryApp.viewModel(id);
  }
}

function openAR(id) {
  if (window.galleryApp) {
    window.galleryApp.openAR(id);
  }
}

function openEnhancedAR(id) {
  if (window.galleryApp) {
    window.galleryApp.openEnhancedAR(id);
  }
}

function editModel(id) {
  if (window.galleryApp) {
    window.galleryApp.editModel(id);
  }
}

function deleteModel(id) {
  if (window.galleryApp) {
    window.galleryApp.deleteModel(id);
  }
}

function copyModelLink(id) {
  if (window.galleryApp) {
    window.galleryApp.copyModelLink(id);
  }
}

function shareModel(id) {
  if (window.galleryApp) {
    window.galleryApp.shareModel(id);
  }
}

function downloadQR(id, title) {
  if (window.galleryApp) {
    window.galleryApp.downloadQR(id, title);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.galleryApp = new ModelGalleryApp();
}); 