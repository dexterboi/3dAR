// Database Service for 3D Models
class ModelDatabase {
  constructor() {
    this.supabase = null;
    this.initialized = false;
  }

  // Initialize Supabase client
  async init() {
    if (this.initialized) return true;
    
    try {
      // Check for Supabase client - try different ways it might be loaded
      let supabaseClient = null;
      
      if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase;
      } else if (typeof supabase !== 'undefined') {
        supabaseClient = supabase;
      } else if (typeof window.Supabase !== 'undefined') {
        supabaseClient = window.Supabase;
      }
      
      if (!supabaseClient) {
        console.error('Supabase client not loaded - make sure the script is included');
        return false;
      }
      
      this.supabase = supabaseClient.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.anonKey
      );
      
      this.initialized = true;
      console.log('Database initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return false;
    }
  }

  // Upload GLB file to Supabase Storage
  async uploadModel(file, metadata) {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `models/${fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(SUPABASE_CONFIG.bucket)
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL for the uploaded file
      const { data: urlData } = this.supabase.storage
        .from(SUPABASE_CONFIG.bucket)
        .getPublicUrl(filePath);

      // Insert model metadata into database
      const modelData = {
        title: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
        description: metadata.description || '',
        file_name: fileName,
        file_path: filePath,
        file_url: urlData.publicUrl,
        file_size: file.size,
        upload_date: new Date().toISOString(),
        tags: metadata.tags || [],
        height: metadata.height || null,
        height_unit: metadata.height_unit || null,
        is_public: metadata.isPublic !== false
      };

      const { data: insertData, error: insertError } = await this.supabase
        .from('models')
        .insert([modelData])
        .select();

      if (insertError) {
        // Clean up uploaded file if database insert fails
        await this.supabase.storage
          .from(SUPABASE_CONFIG.bucket)
          .remove([filePath]);
        throw insertError;
      }

      return insertData[0];
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  // Get all models from database
  async getAllModels() {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from('models')
        .select('*')
        .eq('is_public', true)
        .order('upload_date', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      throw error;
    }
  }

  // Get single model by ID
  async getModelById(id) {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from('models')
        .select('*')
        .eq('id', id)
        .eq('is_public', true)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch model:', error);
      throw error;
    }
  }

  // Alias for getModelById (for compatibility)
  async getModel(id) {
    return this.getModelById(id);
  }

  // Update model metadata
  async updateModel(id, updates) {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from('models')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) {
        throw error;
      }

      return data[0];
    } catch (error) {
      console.error('Failed to update model:', error);
      throw error;
    }
  }

  // Delete model and associated file
  async deleteModel(id) {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    try {
      // First get the model to get file path
      const model = await this.getModelById(id);
      
      // Delete from database
      const { error: deleteError } = await this.supabase
        .from('models')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Delete file from storage
      if (model.file_path) {
        await this.supabase.storage
          .from(SUPABASE_CONFIG.bucket)
          .remove([model.file_path]);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete model:', error);
      throw error;
    }
  }

  // Search models
  async searchModels(query) {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from('models')
        .select('*')
        .eq('is_public', true)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .order('upload_date', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  // Get models by tag
  async getModelsByTag(tag) {
    if (!this.initialized) {
      throw new Error('Database not initialized');
    }

    try {
      const { data, error } = await this.supabase
        .from('models')
        .select('*')
        .eq('is_public', true)
        .contains('tags', [tag])
        .order('upload_date', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch models by tag:', error);
      throw error;
    }
  }
}

// Create global instance
const modelDB = new ModelDatabase();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModelDatabase;
} else {
  window.ModelDatabase = ModelDatabase;
  window.modelDB = modelDB;
} 