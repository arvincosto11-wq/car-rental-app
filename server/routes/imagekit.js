import express from 'express';
import ImageKit from 'imagekit';
import dotenv from 'dotenv';
import { protect, adminOnly } from '../middleware/auth.js';

dotenv.config();

const router = express.Router();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

router.get('/auth', protect, adminOnly, (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.json({
    ...result,
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
});

// Public auth endpoint for use during registration, before the user has an account.
// Only used for uploading the Valid ID photo on the signup form.
router.get('/public-auth', (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.json({
    ...result,
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
});

export default router;