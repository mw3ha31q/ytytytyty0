// src/pages/api/list-videos.js
import fs from 'fs/promises';
import path from 'path';

const VIDEOS_DIR = '/app/videos';

export async function GET({ request }) {
  try {
    // Get user from middleware
    const user = request.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await fs.mkdir(VIDEOS_DIR, { recursive: true });
    
    const videos = [];
    
    // Read main video directory (e.g., face4_vid, face5_vid)
    const categories = await fs.readdir(VIDEOS_DIR, { withFileTypes: true });
    
    for (const category of categories) {
      if (!category.isDirectory()) continue;
      if (category.name === 'thumbnails') continue; // Skip thumbnails folder
      
      const categoryPath = path.join(VIDEOS_DIR, category.name);
      
      // Read subdirectories (e.g., HOME, HOPE, HUNT)
      const subfolders = await fs.readdir(categoryPath, { withFileTypes: true });
      
      for (const subfolder of subfolders) {
        if (!subfolder.isDirectory()) continue;
        
        const subfolderPath = path.join(categoryPath, subfolder.name);
        
        // Read video files in subfolder
        const files = await fs.readdir(subfolderPath, { withFileTypes: true });
        
        for (const file of files) {
          if (!file.isFile()) continue;
          if (!file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) continue;
          
          const filePath = path.join(subfolderPath, file.name);
          const stats = await fs.stat(filePath);
          
          // Relative path from videos directory
          const relativePath = path.join(category.name, subfolder.name, file.name);
          
          // Check for existing PNG thumbnail
          const pngThumbName = file.name.replace(/\.[^.]+$/, '.png').toUpperCase();
          const pngThumbPath = path.join(subfolderPath, pngThumbName);
          let hasExistingThumb = false;
          
          try {
            await fs.stat(pngThumbPath);
            hasExistingThumb = true;
          } catch {}
          
          // Try to read metadata file if exists
          const metaPath = filePath + '.json';
          let metadata = {};
          try {
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            metadata = JSON.parse(metaContent);
          } catch (e) {}
          
          videos.push({
            filename: relativePath,
            title: metadata.title || subfolder.name,
            category: category.name,
            folder: subfolder.name,
            size: stats.size,
            uploadedAt: metadata.uploadedAt || stats.mtime.toISOString(),
            hasExistingThumb: hasExistingThumb,
            existingThumbPath: hasExistingThumb ? path.join(category.name, subfolder.name, pngThumbName) : null,
            ...metadata
          });
        }
      }
    }
    
    // Sort by upload date, newest first
    videos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    
    return new Response(JSON.stringify({ 
      success: true,
      videos 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error listing videos:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}