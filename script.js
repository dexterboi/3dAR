// Handles loading the events for <model-viewer>'s slotted progress bar
const onProgress = (event) => {
  const progressBar = event.target.querySelector('.progress-bar');
  const updatingBar = event.target.querySelector('.update-bar');
  updatingBar.style.width = `${event.detail.totalProgress * 100}%`;
  if (event.detail.totalProgress === 1) {
    progressBar.classList.add('hide');
    event.target.removeEventListener('progress', onProgress);
  } else {
    progressBar.classList.remove('hide');
  }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  const modelViewer = document.querySelector('model-viewer');
  
  if (modelViewer) {
    modelViewer.addEventListener('progress', onProgress);
    
    // Generate QR Code
    generateQRCode();
    
    // Setup model controls
    setupModelControls();
    
    // Setup copy URL functionality
    setupCopyURL();
  }
});

// Generate QR Code for the current page URL
function generateQRCode() {
  const currentURL = window.location.href;
  const qrContainer = document.getElementById('qrcode');
  
  if (qrContainer && typeof QRCode !== 'undefined') {
    // Clear any existing QR code
    qrContainer.innerHTML = '';
    
    // Generate new QR code
    QRCode.toCanvas(currentURL, {
      width: 200,
      height: 200,
      margin: 2,
      color: {
        dark: '#4a5568',
        light: '#ffffff'
      }
    }, function(error, canvas) {
      if (error) {
        console.error('QR Code generation failed:', error);
        qrContainer.innerHTML = '<p style="color: #e53e3e;">QR Code generation failed</p>';
      } else {
        qrContainer.appendChild(canvas);
        canvas.style.borderRadius = '10px';
      }
    });
  }
}

// Setup model viewer controls
function setupModelControls() {
  const modelViewer = document.querySelector('model-viewer');
  const resetBtn = document.getElementById('resetView');
  const toggleRotationBtn = document.getElementById('toggleRotation');
  
  let isRotating = true;
  
  // Reset view button
  if (resetBtn && modelViewer) {
    resetBtn.addEventListener('click', function() {
      modelViewer.resetTurntableRotation();
      modelViewer.jumpCameraToGoal();
      
      // Add success animation
      resetBtn.classList.add('success-animation');
      setTimeout(() => {
        resetBtn.classList.remove('success-animation');
      }, 300);
    });
  }
  
  // Toggle rotation button
  if (toggleRotationBtn && modelViewer) {
    toggleRotationBtn.addEventListener('click', function() {
      if (isRotating) {
        modelViewer.removeAttribute('auto-rotate');
        toggleRotationBtn.innerHTML = '<i class="fas fa-play"></i> Start Rotation';
        isRotating = false;
      } else {
        modelViewer.setAttribute('auto-rotate', '');
        toggleRotationBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Rotation';
        isRotating = true;
      }
      
      // Add success animation
      toggleRotationBtn.classList.add('success-animation');
      setTimeout(() => {
        toggleRotationBtn.classList.remove('success-animation');
      }, 300);
    });
  }
}

// Setup copy URL functionality
function setupCopyURL() {
  const copyBtn = document.getElementById('copyUrl');
  
  if (copyBtn) {
    copyBtn.addEventListener('click', async function() {
      try {
        await navigator.clipboard.writeText(window.location.href);
        
        // Change button text temporarily
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        copyBtn.classList.add('success-animation');
        
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
          copyBtn.classList.remove('success-animation');
        }, 2000);
        
      } catch (err) {
        console.error('Failed to copy URL:', err);
        
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = window.location.href;
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
          document.execCommand('copy');
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
          copyBtn.classList.add('success-animation');
          
          setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.classList.remove('success-animation');
          }, 2000);
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr);
          copyBtn.innerHTML = '<i class="fas fa-exclamation"></i> Copy Failed';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy URL';
          }, 2000);
        }
        
        document.body.removeChild(textArea);
      }
    });
  }
}

// Handle model viewer events
document.addEventListener('DOMContentLoaded', function() {
  const modelViewer = document.querySelector('model-viewer');
  
  if (modelViewer) {
    // Add loading state
    modelViewer.addEventListener('load', function() {
      console.log('Model loaded successfully');
    });
    
    // Handle AR mode
    modelViewer.addEventListener('ar-status', function(event) {
      if (event.detail.status === 'session-started') {
        console.log('AR session started');
      } else if (event.detail.status === 'not-presenting') {
        console.log('AR session ended');
      }
    });
    
    // Handle errors
    modelViewer.addEventListener('error', function(event) {
      console.error('Model Viewer error:', event.detail);
    });
  }
});

// Regenerate QR code if URL changes (for single page apps)
window.addEventListener('popstate', function() {
  generateQRCode();
});

// Mobile-specific optimizations
if (/Mobi|Android/i.test(navigator.userAgent)) {
  document.addEventListener('DOMContentLoaded', function() {
    // Add mobile-specific class
    document.body.classList.add('mobile-device');
    
    // Optimize for mobile AR
    const modelViewer = document.querySelector('model-viewer');
    if (modelViewer) {
      // Disable auto-rotate on mobile to save battery
      modelViewer.removeAttribute('auto-rotate');
      
      // Update toggle button state
      const toggleBtn = document.getElementById('toggleRotation');
      if (toggleBtn) {
        toggleBtn.innerHTML = '<i class="fas fa-play"></i> Start Rotation';
      }
    }
  });
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(event) {
  if (event.key === 'r' && event.ctrlKey) {
    event.preventDefault();
    const resetBtn = document.getElementById('resetView');
    if (resetBtn) resetBtn.click();
  }
  
  if (event.key === ' ') {
    event.preventDefault();
    const toggleBtn = document.getElementById('toggleRotation');
    if (toggleBtn) toggleBtn.click();
  }
  
  if (event.key === 'c' && event.ctrlKey && event.shiftKey) {
    event.preventDefault();
    const copyBtn = document.getElementById('copyUrl');
    if (copyBtn) copyBtn.click();
  }
}); 