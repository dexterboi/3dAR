# 3D Model Gallery Setup Guide

This guide will help you set up a complete 3D model gallery with database functionality, file uploads, and automatic QR code generation for AR viewing.

## 🎯 What You'll Get

- **Upload System**: Drag & drop GLB/GLTF file uploads
- **Database Storage**: Free cloud storage with Supabase
- **Gallery View**: Beautiful grid of all your models
- **QR Codes**: Auto-generated for each model
- **AR Support**: Full mobile AR experience
- **Search & Filter**: Find models easily
- **Model Management**: Edit, delete, and organize models

## 📋 Prerequisites

- A computer with internet connection
- A web browser (Chrome, Firefox, Safari, Edge)
- Basic understanding of file management

## 🚀 Step 1: Set Up Supabase Database

### 1.1 Create Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" and sign up (free tier is perfect)
3. Create a new project:
   - **Project Name**: `3d-model-gallery` (or your choice)
   - **Database Password**: Choose a strong password
   - **Region**: Select closest to your location
   - Wait for setup to complete (2-3 minutes)

### 1.2 Create Database Table

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query** and paste this SQL:

```sql
-- Create models table
CREATE TABLE public.models (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT true
);

-- Create storage bucket for 3D models
INSERT INTO storage.buckets (id, name, public)
VALUES ('3d-models', '3d-models', true);

-- Set up storage policies
CREATE POLICY "Enable read access for all users" ON storage.objects
FOR SELECT USING (bucket_id = '3d-models');

CREATE POLICY "Enable insert for all users" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = '3d-models');

CREATE POLICY "Enable delete for all users" ON storage.objects
FOR DELETE USING (bucket_id = '3d-models');

-- Set up table policies
CREATE POLICY "Enable read access for all users" ON public.models
FOR SELECT USING (is_public = true);

CREATE POLICY "Enable insert for all users" ON public.models
FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON public.models
FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON public.models
FOR DELETE USING (true);
```

3. Click **Run** to execute the query

### 1.3 Get API Keys

1. Go to **Settings** → **API**
2. Copy these values (you'll need them):
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **Project API Key (anon public)** (long string starting with `eyJ...`)

## 🔧 Step 2: Configure Your Website

### 2.1 Update Configuration

1. Open the `config.js` file in your project
2. Replace the placeholder values:

```javascript
const SUPABASE_CONFIG = {
  url: 'https://your-project-ref.supabase.co', // Replace with your Project URL
  anonKey: 'your-anon-key-here', // Replace with your API Key
  bucket: '3d-models' // Keep this as is
};
```

### 2.2 Test Your Setup

1. Open a terminal/command prompt in your project folder
2. Start a local server:

**Using Python:**
```bash
python -m http.server 8000
```

**Using Node.js (if you have it):**
```bash
npx http-server -p 8000
```

**Using PHP (if you have it):**
```bash
php -S localhost:8000
```

3. Open your browser and go to: `http://localhost:8000/gallery.html`

## 📁 Step 3: File Structure

Your project should have these files:

```
your-project/
├── config.js              # Database configuration
├── database.js            # Database operations
├── gallery.html           # Main gallery page
├── gallery.js             # Gallery functionality
├── gallery-styles.css     # Gallery styles
├── viewer.html            # Individual model viewer
├── viewer.js              # Viewer functionality
├── styles.css             # Main styles
├── script.js              # Original model viewer script
├── index.html             # Single model viewer (original)
├── extracted_models/      # Your original model files
│   ├── Jug_Pulmo_plus.glb
│   ├── poster.webp
│   ├── ar_hand_prompt.png
│   └── ar_icon.png
├── README.md              # Original documentation
└── SETUP_GUIDE.md         # This file
```

## 🎮 Step 4: How to Use

### 4.1 Upload Your First Model

1. Go to `http://localhost:8000/gallery.html`
2. Drag your GLB file to the upload area or click "Browse Files"
3. Fill in the model details:
   - **Title**: Give your model a name
   - **Description**: Describe what it is
   - **Tags**: Add keywords (comma-separated)
4. Click "Upload Model"

### 4.2 View and Share Models

1. **Gallery View**: See all your models in a grid
2. **QR Codes**: Each model has its own QR code for mobile AR
3. **Individual Pages**: Click "View" to see model details
4. **AR Experience**: Scan QR with mobile or click "AR" button

### 4.3 Mobile AR Experience

1. **Scan QR Code**: Use your phone's camera
2. **Open Link**: Opens the model page on mobile
3. **Tap "View in your space"**: Starts AR mode
4. **Point Camera**: Place the model in your environment

## 🌐 Step 5: Deploy to Production

### Option A: Netlify (Recommended - Free)

1. Go to [https://netlify.com](https://netlify.com)
2. Sign up/sign in
3. Drag your project folder to Netlify
4. Your site will be live with a URL like: `https://amazing-name-123456.netlify.app`

### Option B: Vercel (Free)

1. Go to [https://vercel.com](https://vercel.com)
2. Import your project from GitHub or upload directly
3. Deploy with one click

### Option C: GitHub Pages (Free)

1. Create a GitHub repository
2. Upload your files
3. Enable GitHub Pages in repository settings
4. Your site will be at: `https://yourusername.github.io/repository-name`

## 🔧 Advanced Configuration

### Custom Domain

After deploying, you can:
1. Purchase a domain name
2. Point it to your deployment
3. Update the `baseUrl` in `config.js`

### File Size Limits

Default limits in `config.js`:
```javascript
const APP_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedFormats: ['.glb', '.gltf'],
  baseUrl: window.location.origin,
  qrCodeSize: 200
};
```

### Supabase Storage Limits

**Free Tier:**
- 500MB storage
- 2GB bandwidth per month
- Unlimited requests

**Pro Tier ($25/month):**
- 8GB storage
- 100GB bandwidth
- Unlimited requests

## 🛠️ Troubleshooting

### Models Not Loading
1. Check browser console for errors (F12)
2. Verify Supabase configuration in `config.js`
3. Ensure you're accessing via HTTP/HTTPS (not file://)

### Upload Failures
1. Check file size (under 50MB)
2. Verify file format (GLB or GLTF)
3. Check Supabase storage policies

### QR Codes Not Generating
1. Ensure internet connection
2. Check browser console for errors
3. Verify QRCode.js is loading

### AR Not Working
- **iOS**: Requires iOS 12+ and Safari
- **Android**: Requires Chrome 67+ with ARCore
- **Desktop**: Shows QR code for mobile access

## 📱 Browser Compatibility

### Desktop
- ✅ Chrome 67+
- ✅ Firefox 70+
- ✅ Safari 12.1+
- ✅ Edge 79+

### Mobile AR
- ✅ **iOS**: Safari 12+ (Quick Look AR)
- ✅ **Android**: Chrome 67+ (Scene Viewer)
- ✅ **WebXR**: Chrome 79+, Edge 79+

## 🔄 Adding Your Existing Model

To add your current `Jug_Pulmo_plus.glb` to the database:

1. Go to the gallery page
2. Upload the model through the interface
3. Or manually insert into database via Supabase dashboard

## 📧 Support

If you encounter issues:

1. **Check the browser console** (F12 → Console)
2. **Verify Supabase setup** (dashboard → SQL Editor → run a simple query)
3. **Test with a small GLB file** first
4. **Check file permissions** if running locally

## 🚀 Next Steps

Once everything is working:

1. **Upload more models**: Build your 3D library
2. **Share QR codes**: Print them or share digitally
3. **Customize styling**: Modify CSS for your brand
4. **Add authentication**: For private galleries (advanced)
5. **Add analytics**: Track usage (advanced)

## 📊 Database Schema

Your `models` table structure:

```sql
Column Name    | Type      | Description
---------------|-----------|---------------------------
id             | UUID      | Unique identifier
title          | TEXT      | Model name
description    | TEXT      | Model description
file_name      | TEXT      | Actual filename
file_path      | TEXT      | Storage path
file_url       | TEXT      | Public access URL
file_size      | BIGINT    | File size in bytes
upload_date    | TIMESTAMP | When uploaded
tags           | TEXT[]    | Search tags
is_public      | BOOLEAN   | Visibility setting
```

## 🎉 Congratulations!

You now have a complete 3D model gallery with:
- ✅ File uploads
- ✅ Database storage
- ✅ QR code generation
- ✅ AR functionality
- ✅ Search and filtering
- ✅ Mobile optimization

Enjoy sharing your 3D models in AR! 🥽 