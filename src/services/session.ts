/**
 * QUV-Lab — Session utilisateur : SEULE source de l'identité de l'opérateur.
 *
 * Aujourd'hui : profil de session provisoire (sessionProfileStore, saisi une
 * fois par navigateur, sans mot de passe). Demain : compte connecté fourni par
 * le serveur (D-13) — seule l'origine de `currentUser` changera. Les écrans
 * n'utilisent jamais de champ « Opérateur » libre : ils lisent
 * getOperatorLabel() (via le hook useOperatorLabel).
 *
 * Tant que AUTH_ENABLED vaut false, `isAllowed` autorise tout : les droits
 * par rôle ne sont pas encore appliqués.
 */
import type { TrialTabId, UserProfile } from '../types/auth';
import { canPerform, canViewTab, formatOperatorLabel } from './permissions';
import type { ActionId } from './permissions';
import { loadSessionProfile, saveSessionProfile } from './sessionProfileStore';

export const AUTH_ENABLED = false;

type Listener = (user: UserProfile | null) => void;

let currentUser: UserProfile | null = null;
let loaded = false;
const listeners = new Set<Listener>();

function ensureLoaded(): void {
  if (loaded) return;
  loaded = true;
  currentUser = loadSessionProfile();
}

export function getCurrentUser(): UserProfile | null {
  ensureLoaded();
  return currentUser;
}

/**
 * Définit le profil courant. `persist` (défaut true) l'enregistre dans le
 * navigateur ; les tests passent false pour ne rien écrire.
 */
export function setCurrentUser(user: UserProfile | null, persist = true): void {
  loaded = true;
  currentUser = user;
  if (persist) saveSessionProfile(user);
  listeners.forEach((l) => l(user));
}

export function onCurrentUserChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Libellé opérateur du journal (« Prénom NOM (Rôle) »), '' si aucun profil. */
export function getOperatorLabel(): string {
  const user = getCurrentUser();
  return user && user.active ? formatOperatorLabel(user) : '';
}

export function isAllowed(action: ActionId): boolean {
  return !AUTH_ENABLED || canPerform(getCurrentUser(), action);
}

export function isTabVisible(tab: TrialTabId): boolean {
  return !AUTH_ENABLED || canViewTab(getCurrentUser(), tab);
}
