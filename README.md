# 3D Model Viewer & AR Website

A modern web application for viewing 3D models with AR functionality and QR code generation for easy mobile access.

## Features

### 🎯 3D Model Viewing
- Interactive 3D model display using Google's Model Viewer
- Camera controls for rotation, zoom, and pan
- Auto-rotation with pause/play controls
- Reset view functionality
- Loading progress indicator

### 📱 AR Experience
- Full AR support for iOS (Quick Look) and Android (Scene Viewer)
- WebXR compatibility for supported browsers
- Mobile-optimized AR controls
- Visual AR guidance with hand prompts

### 🔗 QR Code Generation
- Automatic QR code generation for current page URL
- Easy mobile access - just scan and view
- Copy URL functionality for sharing
- Mobile-responsive design

## How to Use

### Desktop/Laptop
1. Open `index.html` in your web browser
2. Interact with the 3D model using mouse controls
3. Use the control buttons to reset view or toggle rotation

### Mobile AR Experience
1. **Option 1**: Scan the QR code with your mobile device
2. **Option 2**: Copy and share the URL to access on mobile
3. On mobile, tap "View in your space" button
4. Follow the AR prompts to place the model in your environment

## Browser Compatibility

### Desktop
- ✅ Chrome 67+
- ✅ Firefox 70+
- ✅ Safari 12.1+
- ✅ Edge 79+

### Mobile AR Support
- ✅ **iOS**: Safari 12+ (Quick Look AR)
- ✅ **Android**: Chrome 67+ (Scene Viewer)
- ✅ **WebXR**: Chrome 79+, Edge 79+

## File Structure

```
├── index.html          # Main HTML file with enhanced UI
├── script.js           # JavaScript with QR code generation
├── styles.css          # Modern CSS styling
├── extracted_models/   # Original Model Viewer export
│   ├── Jug_Pulmo_plus.glb    # 3D model file
│   ├── poster.webp           # Model preview image
│   ├── ar_hand_prompt.png    # AR guidance image
│   └── ar_icon.png           # AR button icon
└── README.md          # This file
```

## Features Breakdown

### 🎮 Interactive Controls
- **Mouse/Touch**: Rotate, zoom, pan the model
- **Reset View**: Return to default camera position
- **Toggle Rotation**: Start/stop auto-rotation
- **Copy URL**: Share the model with others

### 📲 Mobile Optimization
- Responsive design for all screen sizes
- Touch-optimized controls
- Battery-saving features (auto-rotation disabled on mobile)
- Optimized AR experience

### 🌐 Sharing & Access
- QR code automatically generated for current URL
- One-click URL copying
- Mobile-friendly sharing options
- No server required - works with any web server

## Keyboard Shortcuts

- **Ctrl + R**: Reset view
- **Spacebar**: Toggle rotation
- **Ctrl + Shift + C**: Copy URL

## Technical Details

- **Model Format**: GLB (GL Transmission Format)
- **AR Technology**: Model Viewer by Google
- **QR Generation**: QRCode.js library
- **Icons**: Font Awesome 6
- **No Backend Required**: Pure frontend solution

## Setup Instructions

1. Extract all files to your web server directory
2. Ensure all files maintain their relative paths
3. Access `index.html` through a web server (not file:// protocol)
4. For local testing, use:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js (if you have http-server installed)
   npx http-server
   ```

## Troubleshooting

### Model Not Loading
- Ensure you're accessing via HTTP/HTTPS (not file://)
- Check that `extracted_models/Jug_Pulmo_plus.glb` exists
- Verify browser console for any error messages

### QR Code Not Generating
- Check internet connection (requires external library)
- Ensure JavaScript is enabled
- Try refreshing the page

### AR Not Working
- **iOS**: Requires iOS 12+ and Safari
- **Android**: Requires Chrome 67+ and ARCore support
- Ensure HTTPS connection for WebXR features

## Credits

- **Model Viewer**: [Google Model Viewer](https://modelviewer.dev/)
- **QR Code Generation**: [QRCode.js](https://github.com/davidshimjs/qrcodejs)
- **Icons**: [Font Awesome](https://fontawesome.com/)
- **Original Export**: Model Viewer Editor at https://modelviewer.dev/editor/

## License

This project uses the exported content from Model Viewer Editor. Please refer to the original Model Viewer license for usage terms. 