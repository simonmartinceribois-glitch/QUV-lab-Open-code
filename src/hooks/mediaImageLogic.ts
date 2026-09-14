/**
 * QUV-Lab — Logique pure de résolution média → Object URL.
 *
 * Découplée de React et du DOM afin d'être testable en environnement Node.
 * Garantit :
 *  - protection contre les résultats obsolètes (race : get(A) terminant après get(B))
 *  - symétrie createObjectURL / revokeObjectURL à chaque changement / reset
 *  - états : loading | loaded | missing | error
 */
import type { MediaRecord } from '../services/mediaStorageService';

export type MediaImageStatus = 'loading' | 'loaded' | 'missing' | 'error';

export interface MediaImageState {
  status: MediaImageStatus;
  url?: string;
}

export interface MediaImageLoaderDeps {
  get: (key: string) => Promise<MediaRecord | null>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
}

export const STALE_RESULT_KEY = '__quv_media_stale__';

export class MediaImageLoader {
  private readonly deps: MediaImageLoaderDeps;
  private currentUrl: string | null = null;
  private generation = 0;

  constructor(deps: MediaImageLoaderDeps) {
    this.deps = deps;
  }

  public async resolve(storageKey: string): Promise<MediaImageState> {
    const gen = ++this.generation;

    if (!storageKey) {
      this.revokeCurrent();
      return { status: 'missing' };
    }

    let record: MediaRecord | null = null;
    try {
      record = await this.deps.get(storageKey);
    } catch {
      if (gen === this.generation) {
        this.revokeCurrent();
        return { status: 'error' };
      }
      return { status: 'loading' };
    }

    // Résultat obsolète : une requête plus récente a remplacé celle-ci.
    if (gen !== this.generation) {
      return { status: 'loading', url: STALE_RESULT_KEY };
    }

    if (!record) {
      this.revokeCurrent();
      this.currentUrl = null;
      return { status: 'missing' };
    }

    // Symétrie stricte : révoquer l'URL précédente avant d'en créer une nouvelle.
    this.revokeCurrent();
    const url = this.deps.createObjectURL(record.blob);
    this.currentUrl = url;

    if (gen !== this.generation) {
      // Une résolution plus récente est intervenue pendant la création de l'URL.
      this.deps.revokeObjectURL(url);
      this.currentUrl = null;
      return { status: 'loading', url: STALE_RESULT_KEY };
    }

    return { status: 'loaded', url };
  }

  /**
   * Invalide toute requête en vol et révoque l'URL courante.
   * Utilisé lors d'un changement de storageKey ou d'un démontage.
   */
  public reset(): void {
    this.generation++;
    this.revokeCurrent();
  }

  private revokeCurrent(): void {
    if (this.currentUrl) {
      this.deps.revokeObjectURL(this.currentUrl);
      this.currentUrl = null;
    }
  }
}