// Deployment Preparation Script
// Run this after you get your live URL

function updateConfigForDeployment(liveUrl) {
  console.log('🚀 Updating config for deployment...');
  console.log('Live URL:', liveUrl);
  
  // This is what you need to update in config.js:
  const newConfig = `
// Supabase Configuration
const SUPABASE_CONFIG = {
  url: 'https://mptsouahmwtxbjziettr.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wdHNvdWFobXd0eGJqemlldHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MDcyMTMsImV4cCI6MjA2NTQ4MzIxM30.tiIU1HfVlOKGPdRupmNtgnSVGzfu9rAncqo_CaXr5OY',
  bucket: '3d-models'
};

// Application Configuration
const APP_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB max file size
  allowedFormats: ['.glb', '.gltf'],
  baseUrl: '${liveUrl}', // 🔥 UPDATED FOR DEPLOYMENT
  qrCodeSize: 200
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUPABASE_CONFIG, APP_CONFIG };
} else {
  window.SUPABASE_CONFIG = SUPABASE_CONFIG;
  window.APP_CONFIG = APP_CONFIG;
}`;

  console.log('📝 Copy this updated config.js content:');
  console.log('=' .repeat(50));
  console.log(newConfig);
  console.log('=' .repeat(50));
  console.log('✅ After updating config.js, re-deploy your site!');
}

// Example usage:
// updateConfigForDeployment('https://your-site.netlify.app');

console.log('🎯 Deployment Preparation Guide:');
console.log('1. Deploy your site to Netlify/Vercel/GitHub Pages');
console.log('2. Get your live URL');
console.log('3. Run: updateConfigForDeployment("https://your-live-url.com")');
console.log('4. Update config.js with the output');
console.log('5. Re-deploy');
console.log('6. Test AR with QR codes! 📱');

// Export for use
if (typeof module !== 'undefined') {
  module.exports = { updateConfigForDeployment };
} 