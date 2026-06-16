import multer from 'multer';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { StatusCodes } from 'http-status-codes';
import { ResponseError } from '@/error/response.error';

const allowedExt = ['.jpg', '.jpeg', '.png', '.gif'];

export const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExt.includes(ext)) {
      cb(new ResponseError(StatusCodes.BAD_REQUEST, 'Only jpg, jpeg, png, and gif files are allowed.'));
      return;
    }
    cb(null, true);
  },
});

export const uploadProductImages = async (files: Express.Multer.File[]) => {
  if (!files.length) return [];
  ensureCloudinary();
  return Promise.all(files.map(uploadProductImage));
};

const ensureCloudinary = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new ResponseError(500, 'Cloudinary is not configured.');
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
};

const uploadProductImage = (file: Express.Multer.File) => {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'freshmart/products' },
      (error, result) => (error || !result ? reject(error) : resolve(result.secure_url)),
    );
    stream.end(file.buffer);
  });
};
