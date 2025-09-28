// src/pages/api/upload.js
import { uploadVideo } from '../../lib/youtube.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

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

    if (user.role === 'uploader') {;
      const compressedFile = formData.get('file');
      const timestamps = formData.get('timestamps') || '';
      
      if (!compressedFile) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No file provided'
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check file extension
      const fileName = compressedFile.name.toLowerCase();
      if (!fileName.match(/\.(rar|zip|7z)$/)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Only RAR, ZIP, or 7Z files allowed'
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Save compressed file temporarily
      const safeFileName = fileName.replace(/[^a-z0-9.-]/gi, '_');
      const tempPath = `/tmp/uploads/${Date.now()}_${safeFileName}`;
      const buffer = await compressedFile.arrayBuffer();
      await fs.writeFile(tempPath, Buffer.from(buffer));
      
      // Create a unique extraction folder
      const extractionFolder = path.join(VIDEOS_DIR, `extract_${Date.now()}`);
      await fs.mkdir(extractionFolder, { recursive: true });
      
      try {
        // Extract to temporary folder first
        if (fileName.endsWith('.zip')) {
          await execAsync(`unzip -o "${tempPath}" -d "${extractionFolder}"`);
        } else if (fileName.endsWith('.rar')) {
          await execAsync(`unrar-free -x "${tempPath}" "${extractionFolder}"`);
        } else if (fileName.endsWith('.7z')) {
          await execAsync(`7z x "${tempPath}" -o"${extractionFolder}" -y`);
        }
        
        // Find the root folder inside extraction
        const entries = await fs.readdir(extractionFolder);
        
        // Assuming single root folder in compressed file
        if (entries.length === 1) {
          const rootFolder = path.join(extractionFolder, entries[0]);
          const stat = await fs.stat(rootFolder);
          
          if (stat.isDirectory()) {
            // Move contents to final location
            const finalPath = path.join(VIDEOS_DIR, entries[0]);
            await execAsync(`mv "${rootFolder}" "${finalPath}"`);
            
            // Create sections.txt in each subfolder that contains mp4 files
            const subfolders = await fs.readdir(finalPath);
            for (const subfolder of subfolders) {
              const subfolderPath = path.join(finalPath, subfolder);
              const subfolderStat = await fs.stat(subfolderPath);
              
              if (subfolderStat.isDirectory()) {
                // Check if folder contains mp4 files
                const files = await fs.readdir(subfolderPath);
                const hasMp4 = files.some(file => file.toLowerCase().endsWith('.mp4'));
                
                if (hasMp4 && timestamps) {
                  // Create sections.txt file
                  const sectionsPath = path.join(subfolderPath, 'sections.txt');
                  await fs.writeFile(sectionsPath, timestamps, 'utf8');
                }
              }
            }
            
            // Clean up extraction folder
            await execAsync(`rm -rf "${extractionFolder}"`);
          }
        }
        
        // Clean up temp file
        await fs.unlink(tempPath);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Files extracted and sections.txt created successfully'
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (extractError) {
        // Clean up on error
        await fs.unlink(tempPath).catch(() => {});
        await execAsync(`rm -rf "${extractionFolder}"`).catch(() => {});
        throw extractError;
      }
    }
    
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