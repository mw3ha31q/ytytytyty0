// src/pages/api/upload.js
import { uploadVideo } from '../../lib/youtube.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const VIDEOS_DIR = '/app/videos';

export async function POST({ request }) {
  try {
    // Get user from middleware
    const user = request.user;
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const account = formData.get('account');
    const title = formData.get('title');
    const description = formData.get('description');
    const tags = formData.get('tags');
    const privacy = formData.get('privacy');
    const timestamps = formData.get('timestamps');
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
    
    // Convert video file to buffer
    const buffer = await videoFile.arrayBuffer();
    const videoBuffer = Buffer.from(buffer);
    
    // Create safe filename
    const timestamp = Date.now();
    const originalName = videoFile.name || 'video.mp4';
    const safeFilename = `${timestamp}_${originalName.replace(/[^a-z0-9.-]/gi, '_')}`;
    
    // Save video locally first
    await fs.mkdir(VIDEOS_DIR, { recursive: true });
    const videoPath = path.join(VIDEOS_DIR, safeFilename);
    await fs.writeFile(videoPath, videoBuffer);
    
    // Prepare description with timestamps if provided
    let fullDescription = description || '';
    if (timestamps) {
      fullDescription += '\n\n' + timestamps;
    }
    
    // Save metadata
    const metadata = {
      title: title,
      description: description,
      tags: tags,
      privacy: privacy,
      uploadedBy: user.username,
      uploadedAt: new Date().toISOString(),
      youtubeId: null,
      account: account,
      originalFilename: originalName,
      status: 'pending_youtube'
    };
    
    await fs.writeFile(
      path.join(VIDEOS_DIR, safeFilename + '.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    try {
      // Upload to YouTube
      const result = await uploadVideo(account, {
        title,
        description: fullDescription,
        tags,
        privacy
      }, videoPath);
      
      // Update metadata with YouTube ID
      metadata.youtubeId = result.id;
      metadata.status = 'uploaded';
      metadata.youtubeUrl = `https://youtube.com/watch?v=${result.id}`;
      
      await fs.writeFile(
        path.join(VIDEOS_DIR, safeFilename + '.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      return new Response(JSON.stringify({
        success: true,
        videoId: result.id,
        localFile: safeFilename,
        message: 'Video uploaded successfully to YouTube and saved locally'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (uploadError) {
      console.error('YouTube upload error:', uploadError);
      
      // Update metadata to show YouTube upload failed
      metadata.status = 'youtube_failed';
      metadata.error = uploadError.message;
      
      await fs.writeFile(
        path.join(VIDEOS_DIR, safeFilename + '.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      // Still return success since we saved locally
      return new Response(JSON.stringify({
        success: true,
        localFile: safeFilename,
        message: 'Video saved locally but YouTube upload failed',
        warning: uploadError.message
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
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