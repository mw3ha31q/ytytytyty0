// src/pages/api/video-thumbnail/[...path].js
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const VIDEOS_DIR = '/app/videos';

export async function GET({ params, request }) {
  try {
    // Get user from middleware
    const user = request.user;
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get the path from the dynamic route
    const requestPath = params.path;
    
    // Check if requesting a PNG (existing thumbnail)
    if (requestPath.endsWith('.png') || requestPath.endsWith('.PNG')) {
      const pngPath = path.join(VIDEOS_DIR, requestPath);
      
      if (fs.existsSync(pngPath)) {
        const stream = fs.createReadStream(pngPath);
        return new Response(stream, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }
    
    // For video files, check for existing PNG thumbnail first
    const videoPath = path.join(VIDEOS_DIR, requestPath);
    const videoDir = path.dirname(videoPath);
    const videoName = path.basename(requestPath, path.extname(requestPath));
    
    // Check for existing PNG thumbnail (e.g., HOME.png for home.mp4)
    const pngThumbPath = path.join(videoDir, videoName.toUpperCase() + '.png');
    if (fs.existsSync(pngThumbPath)) {
      const stream = fs.createReadStream(pngThumbPath);
      return new Response(stream, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }
    
    // No existing PNG, generate JPG thumbnail with ffmpeg
    const generatedThumbsDir = path.join(VIDEOS_DIR, 'thumbnails', path.dirname(requestPath));
    const generatedThumbPath = path.join(generatedThumbsDir, path.basename(requestPath) + '.jpg');
    
    // Check if we already generated a thumbnail
    if (!fs.existsSync(generatedThumbPath)) {
      if (!fs.existsSync(videoPath)) {
        return new Response('Video not found', { status: 404 });
      }
      
      // Create thumbnails directory structure
      await fs.promises.mkdir(generatedThumbsDir, { recursive: true });
      
      try {
        // Try to generate thumbnail at 5 seconds
        await execAsync(
          `ffmpeg -i "${videoPath}" -ss 00:00:05 -vframes 1 -vf "scale=640:360" "${generatedThumbPath}" -y`
        );
      } catch (error) {
        // Try at 0 seconds if 5 seconds fails
        try {
          await execAsync(
            `ffmpeg -i "${videoPath}" -ss 00:00:00 -vframes 1 -vf "scale=640:360" "${generatedThumbPath}" -y`
          );
        } catch (ffmpegError) {
          console.error('Failed to generate thumbnail:', ffmpegError);
          return new Response('Failed to generate thumbnail', { status: 500 });
        }
      }
    }
    
    // Stream the generated thumbnail
    if (fs.existsSync(generatedThumbPath)) {
      const stream = fs.createReadStream(generatedThumbPath);
      return new Response(stream, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }
    
    return new Response('Thumbnail not found', { status: 404 });
    
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    return new Response('Server error', { status: 500 });
  }
}