// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_CONFIG = {
  url: 'https://mptsouahmwtxbjziettr.supabase.co', // Replace with your Supabase project URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wdHNvdWFobXd0eGJqemlldHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MDcyMTMsImV4cCI6MjA2NTQ4MzIxM30.tiIU1HfVlOKGPdRupmNtgnSVGzfu9rAncqo_CaXr5OY', // Replace with your Supabase anon key
  bucket: '3d-models' // Storage bucket name for GLB files
};

// Application Configuration
const APP_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB max file size
  allowedFormats: ['.glb', '.gltf'],
  baseUrl: window.location.origin,
  qrCodeSize: 200
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUPABASE_CONFIG, APP_CONFIG };
} else {
  window.SUPABASE_CONFIG = SUPABASE_CONFIG;
  window.APP_CONFIG = APP_CONFIG;
} 