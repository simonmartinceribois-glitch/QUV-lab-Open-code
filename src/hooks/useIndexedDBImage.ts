/**
 * QUV-Lab — Hook useIndexedDBImage
 *
 * Récupère un média (Blob) depuis IndexedDB via MediaStorageService,
 * expose une Object URL consommable par React, gère :
 *   loading / loaded / missing / error
 *   changement de storageKey
 *   démontage (revocation de l'Object URL)
 * et protège contre les races conditions (résultats obsolètes).
 */
import { useEffect, useRef, useState } from 'react';
import { mediaStorage } from '../services/mediaStorageService';
import { MediaImageLoader, STALE_RESULT_KEY, type MediaImageState } from './mediaImageLogic';

export function useIndexedDBImage(storageKey: string | null): MediaImageState {
  const initialRef = useRef<MediaImageLoader | null>(null);
  if (initialRef.current === null) {
    initialRef.current = new MediaImageLoader({
      get: (key) => mediaStorage.get(key),
      createObjectURL: (blob) => URL.createObjectURL(blob),
      revokeObjectURL: (url) => URL.revokeObjectURL(url)
    });
  }

  const [state, setState] = useState<MediaImageState>({ status: 'loading' });

  useEffect(() => {
    const loader = initialRef.current!;
    if (!storageKey) {
      setState({ status: 'missing' });
      loader.reset();
      return;
    }

    // Toute requête antérieure devient obsolète (moins une nouvelle résolution).
    loader.reset();

    let cancelled = false;
    loader.resolve(storageKey).then((next) => {
      if (!cancelled && next.url !== STALE_RESULT_KEY) {
        setState(next);
      }
    });

    return () => {
      cancelled = true;
      loader.reset();
    };
  }, [storageKey]);

  return state;
}