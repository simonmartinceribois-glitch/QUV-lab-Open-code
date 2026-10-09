/**
 * QUV-Lab — Persistance du profil de session PROVISOIRE (avant la connexion serveur).
 *
 * En attendant l'authentification serveur (D-13), le profil (Prénom, Nom,
 * e-mail, rôle — jamais de mot de passe) est saisi une fois par navigateur.
 * Ce fichier disparaîtra avec la connexion serveur : seul session.ts changera
 * de source, les écrans lisant déjà « le compte connecté ».
 */
import type { Role, UserProfile } from '../types/auth';

const KEY = 'quv_lab_session_profile_v1';
const ROLES: Role[] = ['UTILISATEUR', 'TECHNICIEN', 'RESPONSABLE'];

function isProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['email'] === 'string' &&
    typeof v['firstName'] === 'string' &&
    typeof v['lastName'] === 'string' &&
    ROLES.includes(v['role'] as Role) &&
    typeof v['active'] === 'boolean'
  );
}

export function loadSessionProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSessionProfile(profile: UserProfile | null): void {
  try {
    if (profile) localStorage.setItem(KEY, JSON.stringify(profile));
    else localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible : le profil reste valable pour la session en cours.
  }
}
