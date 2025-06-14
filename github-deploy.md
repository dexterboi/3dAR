# 🐙 Deploy to GitHub Pages (Free)

## Steps:

1. **Create GitHub account** at [https://github.com](https://github.com)
2. **Create new repository**:
   - Name: `3d-model-gallery` (or your choice)
   - Make it **Public**
   - Check "Add a README file"
3. **Upload your files**:
   - Click "uploading an existing file"
   - Drag all your project files
   - Commit changes
4. **Enable GitHub Pages**:
   - Go to repository Settings
   - Scroll to "Pages" section
   - Source: "Deploy from a branch"
   - Branch: "main"
   - Save
5. **Get your URL**: `https://yourusername.github.io/3d-model-gallery`

## Update Config:
```javascript
const APP_CONFIG = {
  maxFileSize: 50 * 1024 * 1024,
  allowedFormats: ['.glb', '.gltf'],
  baseUrl: 'https://yourusername.github.io/3d-model-gallery',
  qrCodeSize: 200
};
```

## ✅ Benefits:
- ✅ **Completely free**
- ✅ **Version control**
- ✅ **Easy updates**
- ✅ **HTTPS included** 