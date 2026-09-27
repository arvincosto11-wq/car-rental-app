import { useEffect, useState } from 'react';
import api from '../api';

// Short-lived links to documents that are nobody else's business.
//
// They are asked for by whose they are, not by URL, so the server decides
// what a person may look at rather than signing whatever it is handed.
// Links last minutes, so one copied out of a browser's network tab is
// useless by the time anybody else tries it.
//
// Returns an empty object until they arrive, so a caller can fall back to
// whatever it already holds and nothing blinks out while this loads.
function useSignedFiles(endpoint) {
  const [files, setFiles] = useState({});

  useEffect(() => {
    if (!endpoint) {
      setFiles({});
      return undefined;
    }
    let live = true;
    api.get(endpoint)
      .then((res) => { if (live) setFiles(res.data || {}); })
      .catch(() => { if (live) setFiles({}); });
    return () => { live = false; };
  }, [endpoint]);

  return files;
}

// Somebody's identity documents: passport, national ID, driving licence.
export default function useDocumentPhotos(userId) {
  return useSignedFiles(userId ? `/users/${userId}/documents` : '');
}

// A vehicle's ownership papers, the OR and CR. Keyed by the consignment
// rather than the owner, because that is what the server checks against.
export function useConsignmentPapers(consignmentId) {
  return useSignedFiles(consignmentId ? `/consignments/${consignmentId}/papers` : '');
}
