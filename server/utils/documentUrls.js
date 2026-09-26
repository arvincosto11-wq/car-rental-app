import ImageKit from 'imagekit';
import dotenv from 'dotenv';

dotenv.config();

// Signing for identity documents only — passports, national IDs, licences.
// Car photographs and avatars stay as they are: they are meant to be seen,
// and signing them would only add expiry to things that should never expire.
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Long enough to open a client's record, look at the photograph and type a
// date off it. Short enough that a link copied out of a browser's network
// tab is useless by the time anybody else tries it.
export const DOCUMENT_URL_MINUTES = 15;

export function signedDocumentUrl(url) {
  if (!url) return '';
  try {
    return imagekit.url({
      src: url,
      signed: true,
      expireSeconds: DOCUMENT_URL_MINUTES * 60,
    });
  } catch (err) {
    // A signing failure must not blank the screen somebody is trying to
    // verify an identity on. The original link still works today, because
    // the files are still public; once they are not, this returns something
    // that visibly fails to load rather than something that silently
    // shows the wrong thing.
    console.error('Could not sign a document URL:', err.message);
    return url;
  }
}
