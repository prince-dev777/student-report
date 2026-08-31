import { v2 as cloudinary } from 'cloudinary';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

// Configure Cloudinary from environment variables
export function initCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'oh1uu2ap';
  const apiKey = process.env.CLOUDINARY_API_KEY || '582756462519588';
  const apiSecret = process.env.CLOUDINARY_API_SECRET || 'isOqU56bSg41ctfEqqH2Cz9Z_bM';

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });

  return { cloudName, apiKey };
}

initCloudinary();

export async function uploadStudentPhoto(photoData, studentIdentifier = '') {
  if (!photoData || typeof photoData !== 'string') {
    return null;
  }

  // If already a Cloudinary or remote URL, return as is
  if (photoData.startsWith('http://') || photoData.startsWith('https://')) {
    return photoData;
  }

  try {
    const publicId = studentIdentifier 
      ? `stu_${studentIdentifier}_${Date.now()}`
      : `stu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    logInfo('CLOUDINARY', `Uploading student photo to Cloudinary [${publicId}]...`);
    const uploadRes = await cloudinary.uploader.upload(photoData, {
      folder: 'careerxone_students',
      public_id: publicId,
      overwrite: true,
      transformation: [
        { width: 500, height: 500, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
      ]
    });

    logInfo('CLOUDINARY', `✅ Student photo uploaded: ${uploadRes.secure_url}`);
    return uploadRes.secure_url;
  } catch (err) {
    logWarn('CLOUDINARY', `Failed to upload photo to Cloudinary: ${err.message}. Retaining original data.`);
    return photoData;
  }
}

export async function uploadInstituteLogo(logoData) {
  if (!logoData || typeof logoData !== 'string') return null;
  if (logoData.startsWith('http://') || logoData.startsWith('https://')) return logoData;

  try {
    const uploadRes = await cloudinary.uploader.upload(logoData, {
      folder: 'careerxone_logos',
      public_id: `logo_${Date.now()}`,
      overwrite: true
    });
    return uploadRes.secure_url;
  } catch (err) {
    logWarn('CLOUDINARY', `Failed to upload logo: ${err.message}`);
    return logoData;
  }
}

export async function uploadOMRScan(imageInput, identifier = '') {
  if (!imageInput || typeof imageInput !== 'string') return null;
  if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
    return { url: imageInput, publicId: null };
  }

  try {
    initCloudinary();
    let fileToUpload = imageInput;

    if (!imageInput.startsWith('data:image')) {
      const rel = imageInput.replace(/^\/+/, '');
      const candidates = [
        path.join(process.cwd(), 'server', rel),
        path.join(process.cwd(), rel),
        path.join(__dirname, '..', '..', rel),
        path.join(__dirname, '..', rel),
        path.join(__dirname, '..', 'uploads', 'omr', path.basename(rel))
      ];
      const found = candidates.find(p => fs.existsSync(p));
      if (!found) {
        logWarn('CLOUDINARY', `Local OMR file not found on disk: ${imageInput}`);
        return null;
      }
      fileToUpload = found;
    }

    const publicId = identifier ? `omr_${identifier}_${Date.now()}` : `omr_${Date.now()}`;
    const uploadRes = await cloudinary.uploader.upload(fileToUpload, {
      folder: 'student_report_omr',
      public_id: publicId,
      overwrite: true,
      format: 'jpg'
    });

    logInfo('CLOUDINARY', `✅ Uploaded OMR to Cloudinary: ${uploadRes.secure_url}`);
    return {
      url: uploadRes.secure_url,
      publicId: uploadRes.public_id
    };
  } catch (err) {
    logWarn('CLOUDINARY', `Failed to upload OMR to Cloudinary: ${err.message}`);
    return null;
  }
}
