// src/pages/api/video-file/[...path].js
import fs from 'fs';
import path from 'path';

const VIDEOS_DIR = '/app/videos';

export async function GET({ params, request }) {
  try {
    // Get user from middleware
    const user = request.user;
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get the filename from the dynamic route
    const filename = params.path;
    const filePath = path.join(VIDEOS_DIR, filename);
    
    // Security check - prevent directory traversal
    if (!filePath.startsWith(VIDEOS_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return new Response('Not found', { status: 404 });
    }
    
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = request.headers.get('range');
    
    // Support video streaming with range requests (for video seeking)
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      
      return new Response(stream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize.toString(),
          'Content-Type': 'video/mp4',
        }
      });
    } else {
      // Stream entire file
      const stream = fs.createReadStream(filePath);
      return new Response(stream, {
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
        }
      });
    }
  } catch (error) {
    console.error('Error streaming video:', error);
    return new Response('Server error', { status: 500 });
  }
}