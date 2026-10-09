/**
 * QUV-Lab — Session utilisateur (point d'accroche, NON ACTIVÉ).
 *
 * Tant que AUTH_ENABLED vaut false, `isAllowed` autorise tout : le
 * comportement actuel de l'application est strictement inchangé. La phase 1
 * (docs/specifications/feature-auth-roles.md) remplira `currentUser` à la
 * connexion et branchera `isAllowed` sur les boutons et les méthodes du store.
 */
import type { TrialTabId, UserProfile } from '../types/auth';
import { canPerform, canViewTab } from './permissions';
import type { ActionId } from './permissions';

export const AUTH_ENABLED = false;

let currentUser: UserProfile | null = null;

export function getCurrentUser(): UserProfile | null {
  return currentUser;
}

/** Réservé à la phase 1 (écran de connexion) et aux tests. */
export function setCurrentUser(user: UserProfile | null): void {
  currentUser = user;
}

export function isAllowed(action: ActionId): boolean {
  return !AUTH_ENABLED || canPerform(currentUser, action);
}

export function isTabVisible(tab: TrialTabId): boolean {
  return !AUTH_ENABLED || canViewTab(currentUser, tab);
}
