/**
 * QUV-Lab — PhotoStorageImage
 *
 * Affichage centralisé d'une photographie stockée en IndexedDB.
 * N'accepte JAMAIS de Data URI en source : la résolution passe systématiquement
 * par mediaStorage (Blob → Object URL) via useIndexedDBImage.
 *
 * États gérés : chargement (placeholder gris), média introuvable (placeholder),
 * erreur de lecture (placeholder).
 */
import { ImageOff, Loader2, Image } from 'lucide-react';
import { useIndexedDBImage } from '../../hooks/useIndexedDBImage';

interface Props {
  storageKey: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}

export function PhotoStorageImage({ storageKey, alt, className = '', imgClassName = '' }: Props) {
  const { status, url } = useIndexedDBImage(storageKey);

  if (status === 'loaded' && url) {
    return <img src={url} alt={alt} className={imgClassName || className} referrerPolicy="no-referrer" />;
  }

  const base = className || 'w-full h-full object-cover';
  const content =
    status === 'error' ? (
      <>
        <ImageOff className="w-6 h-6 text-rose-500" />
        <span className="text-[10px] text-rose-700 font-medium">Lecture impossible</span>
      </>
    ) : status === 'missing' ? (
      <>
        <Image className="w-6 h-6 text-slate-400" />
        <span className="text-[10px] text-slate-400 font-medium">Aucune image</span>
      </>
    ) : (
      <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
    );

  return (
    <div
      className={`${base} flex flex-col items-center justify-center gap-1 bg-slate-100`}
      aria-label={alt}
    >
      {content}
    </div>
  );
}