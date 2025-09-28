import multer from 'multer';
import { uploadVideo } from '../../lib/youtube.js';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 128 * 1024 * 1024 // 128MB limit
  }
});

const uploadMiddleware = promisify(upload.single('video'));

export async function POST({ request }) {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const account = formData.get('account');
    const title = formData.get('title');
    const description = formData.get('description');
    const tags = formData.get('tags');
    const privacy = formData.get('privacy');
    const videoFile = formData.get('video');
    
    if (!account || !title || !videoFile) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Save uploaded file temporarily
    const tempPath = `/tmp/${Date.now()}_${videoFile.name}`;
    const buffer = await videoFile.arrayBuffer();
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    
    try {
      // Upload to YouTube
      const result = await uploadVideo(account, {
        title,
        description,
        tags,
        privacy
      }, tempPath);

      const timestamps = formData.get('timestamps');

      if (timestamps) {
        videoData.description += '\n\n' + timestamps;
      }

      
      // Clean up temp file
      fs.unlinkSync(tempPath);
      
      return new Response(JSON.stringify({
        success: true,
        videoId: result.id,
        message: 'Video uploaded successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (uploadError) {
      // Clean up temp file on error
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw uploadError;
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Upload failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}