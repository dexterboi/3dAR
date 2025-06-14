# 🚀 Deploy to Netlify (Free)

## Quick Deployment Steps:

### Method 1: Drag & Drop (Easiest)
1. Go to [https://netlify.com](https://netlify.com)
2. Sign up for free (use GitHub, Google, or email)
3. On your dashboard, look for "Deploy manually"
4. **Drag your entire project folder** to the deployment area
5. Wait 30 seconds - you'll get a live URL like: `https://amazing-name-123456.netlify.app`

### Method 2: GitHub Integration (Best for updates)
1. Create a GitHub account if you don't have one
2. Upload your project to a GitHub repository
3. Connect Netlify to your GitHub repo
4. Auto-deploy on every update

## 📱 Testing AR After Deployment:

1. **Get your live URL** (e.g., `https://your-site.netlify.app`)
2. **Update config.js** with your live URL:
   ```javascript
   const APP_CONFIG = {
     maxFileSize: 50 * 1024 * 1024,
     allowedFormats: ['.glb', '.gltf'],
     baseUrl: 'https://your-site.netlify.app', // Update this!
     qrCodeSize: 200
   };
   ```
3. **Re-deploy** with updated config
4. **QR codes will now point to your live site**
5. **Scan with mobile** - AR will work!

## 🎯 AR Testing Process:
1. Upload a model to your live gallery
2. QR code generates with live URL
3. Scan QR with phone camera
4. Opens in mobile browser
5. Tap "View in your space" for AR

## ✅ Benefits:
- ✅ **Free forever** (100GB bandwidth/month)
- ✅ **HTTPS by default** (required for AR)
- ✅ **Custom domain** support
- ✅ **Instant deployment**
- ✅ **Global CDN** 