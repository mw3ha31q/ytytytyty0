// src/pages/api/delete-video.js
import fs from 'fs/promises';
import path from 'path';

const VIDEOS_DIR = '/app/videos';

export async function POST({ request }) {
  try {
    // Get user from middleware
    const user = request.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { filename } = await request.json();
    if (!filename) {
      return new Response(JSON.stringify({ error: 'No filename provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const videoPath = path.join(VIDEOS_DIR, filename);
    const metaPath = path.join(VIDEOS_DIR, filename + '.json');
    const thumbPath = path.join(VIDEOS_DIR, 'thumbnails', filename + '.jpg');
    
    // Security check - prevent directory traversal
    if (!videoPath.startsWith(VIDEOS_DIR)) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete video file
    try {
      await fs.unlink(videoPath);
    } catch (e) {
      console.log('Video file not found:', videoPath);
    }
    
    // Delete metadata
    try {
      await fs.unlink(metaPath);
    } catch (e) {
      console.log('Metadata file not found:', metaPath);
    }
    
    // Delete thumbnail
    try {
      await fs.unlink(thumbPath);
    } catch (e) {
      console.log('Thumbnail file not found:', thumbPath);
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Video deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error deleting video:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}