/**
 * QUV-Lab — Accès React au compte courant (session.ts).
 * L'opérateur affiché et journalisé vient toujours d'ici, jamais d'une saisie.
 */
import { useEffect, useState } from 'react';
import type { UserProfile } from '../types/auth';
import { getCurrentUser, getOperatorLabel, onCurrentUserChange } from '../services/session';

export function useCurrentUser(): UserProfile | null {
  const [user, setUser] = useState<UserProfile | null>(() => getCurrentUser());
  useEffect(() => onCurrentUserChange(setUser), []);
  return user;
}

/** « Prénom NOM (Rôle) » du compte courant, '' si aucun profil. */
export function useOperatorLabel(): string {
  useCurrentUser();
  return getOperatorLabel();
}
