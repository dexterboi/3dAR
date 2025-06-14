# ⚡ Deploy to Vercel (Free)

## Steps:

1. **Go to** [https://vercel.com](https://vercel.com)
2. **Sign up** with GitHub, GitLab, or Bitbucket
3. **Import project**:
   - Click "New Project"
   - Upload your project folder or connect GitHub repo
4. **Deploy**: Click "Deploy" - done in 30 seconds!
5. **Get URL**: `https://your-project.vercel.app`

## Update Config:
```javascript
const APP_CONFIG = {
  maxFileSize: 50 * 1024 * 1024,
  allowedFormats: ['.glb', '.gltf'],
  baseUrl: 'https://your-project.vercel.app',
  qrCodeSize: 200
};
```

## ✅ Benefits:
- ✅ **Lightning fast**
- ✅ **Global edge network**
- ✅ **Automatic HTTPS**
- ✅ **Easy custom domains** 