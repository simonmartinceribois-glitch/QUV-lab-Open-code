/**
 * QUV-Lab — Modèle des profils et des droits (fondation, NON ACTIVÉ).
 *
 * Prépare la future connexion par profil (Prénom + Nom + rôle). Aucun écran
 * ni contrôle ne s'en sert encore : voir docs/specifications/feature-auth-roles.md.
 */

/** Rôles prévus, du moins au plus autorisé. */
export type Role = 'UTILISATEUR' | 'TECHNICIEN' | 'RESPONSABLE';

/**
 * Criticité d'une action (à ne pas confondre avec les niveaux de risque LOW /
 * MEDIUM / HIGH du workflow de développement) :
 *   - READ     : consultation, sans effet sur les données ;
 *   - LOW      : action mineure, réversible ou purement documentaire ;
 *   - STANDARD : saisie et modification courantes, tracées ;
 *   - HIGH     : décision scientifique ou de qualité, effet structurant ou irréversible.
 */
export type Criticity = 'READ' | 'LOW' | 'STANDARD' | 'HIGH';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  role: Role;
  /** Profil désactivé : conservé pour la traçabilité des entrées passées, connexion refusée. */
  active: boolean;
}

/** Onglets d'un essai (identifiants de TrialDetailView ; « PHOTO » = 07 Photothèque). */
export type TrialTabId = '01' | '02' | '03' | '04' | '05' | '06' | 'PHOTO' | '08' | '09';

/** Sections de la barre principale (App.tsx). */
export type AppSectionId = 'TRIALS' | 'UX_TESTS' | 'SCIENTIFIC_TESTS' | 'RULESET';
