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

// There was a /public-auth here, with no `protect` on it, and it is gone.
//
// It existed so the signup form could upload a Valid ID photo before the
// person had an account — which is why it could not require one. That flow
// no longer exists: identity documents are presented in person now, and we
// hold no copies of any of them.
//
// What it left behind was an endpoint that handed anybody who asked a
// signed token for uploading into our ImageKit account, with nothing at all
// calling it. Its two siblings below both require a login. Found by
// listing the routes nothing calls.
//
// Auth endpoint for any logged-in user (client or consignor) uploading their own
// images — e.g. a consignor adding another vehicle's photos, or a client updating
// their profile ID photo. Not admin-restricted, just requires being logged in.
router.get('/user-auth', protect, (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.json({
    ...result,
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  });
});

export default router;