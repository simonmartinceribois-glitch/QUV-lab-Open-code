/**
 * QUV-Lab — Règles de sélection de la comparaison photographique temporelle.
 *
 * Correctif A1 (audit robustesse photothèque) : une photographie `ARCHIVED`
 * (issue d'un remplacement A → B) ne doit JAMAIS être considérée comme une
 * photographie active dans le comparateur. Ces sélecteurs purs centralisent la
 * règle de statut afin que le composant TabPhotographs et les tests utilisent
 * exactement la même logique.
 */
import type { MediaReference } from '../../types/trial';

/**
 * Photographies actives (PHOTO non ARCHIVED) d'un échantillon.
 * Source de sélection du comparateur : une photo ARCHIVED n'est jamais
 * proposée comme photographie active sélectionnable.
 */
export function selectActivePanelPhotos(
  refs: MediaReference[],
  panelId: string
): MediaReference[] {
  return refs.filter(
    (m) => m.type === 'PHOTO' && m.panelId === panelId && m.status !== 'ARCHIVED'
  );
}

/**
 * Photographies effectivement comparées, depuis la sélection d'IDs.
 * Dernière barrière avant rendu : une sélection obsolète ne peut jamais
 * exposer une photographie ARCHIVED à la grille ni à la planche de rapport.
 */
export function selectComparedPhotos(
  refs: MediaReference[],
  selectedIds: string[]
): MediaReference[] {
  return refs.filter(
    (m) => selectedIds.includes(m.id) && m.type === 'PHOTO' && m.status !== 'ARCHIVED'
  );
}

/**
 * Réconciliation de la sélection après un remplacement A → B :
 * retire de la sélection tout ID dont la photographie n'est plus active
 * (ARCHIVED ou absente), en conservant les photographies actives choisies.
 */
export function excludeArchivedFromSelection(
  refs: MediaReference[],
  selectedIds: string[]
): string[] {
  const activeIds = new Set<string>();
  for (const m of refs) {
    if (m.type === 'PHOTO' && m.status !== 'ARCHIVED') {
      activeIds.add(m.id);
    }
  }
  return selectedIds.filter((id) => activeIds.has(id));
}