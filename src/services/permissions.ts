/**
 * QUV-Lab — Catalogue des actions et matrice des droits par rôle
 * (fondation, NON ACTIVÉE : aucun écran ni service ne l'applique encore).
 *
 * Règle de développement (docs/agents/WORKFLOW.md) : toute nouvelle action
 * qui modifie un essai DOIT être déclarée ici avec sa criticité et ses codes
 * d'audit. La suite R-AUTH échoue si un code d'audit ou une méthode du store
 * qui modifie un essai n'est pas classé.
 */
import type { AppSectionId, Criticity, Role, TrialTabId, UserProfile } from '../types/auth';

export type ActionId =
  | 'VIEW_RESULTS'
  | 'CREATE_TRIAL'
  | 'IMPORT_TRIAL'
  | 'RESET_DEMO'
  | 'MODIFY_IDENTIFICATION'
  | 'UPDATE_T0_DATE'
  | 'CREATE_BATCH'
  | 'MODIFY_LOTS_SPECIMENS'
  | 'EXCLUDE_PANEL'
  | 'ADAPT_PROTOCOL'
  | 'UPDATE_MEASUREMENT_PLAN'
  | 'TOGGLE_STAGE'
  | 'VALIDATE_STAGE'
  | 'RECORD_ACQUISITION'
  | 'ATTACH_PHOTO'
  | 'DELETE_PHOTO'
  | 'GENERATE_REPORT'
  | 'UPDATE_REPORT_STATUS'
  | 'ADD_REPORT_COMMENT'
  | 'EXPORT_DATA';

export interface ActionDefinition {
  label: string;
  criticity: Criticity;
  /** Méthode(s) de TrialStoreService qui réalisent l'action. */
  storeMethods: string[];
  /** Codes `action` écrits dans le journal de bord par cette action. */
  auditActions: string[];
}

export const ACTION_CATALOG: Record<ActionId, ActionDefinition> = {
  VIEW_RESULTS: { label: 'Consulter les résultats', criticity: 'READ', storeMethods: ['logViewResults'], auditActions: ['VIEW_RESULTS'] },
  ADD_REPORT_COMMENT: { label: 'Commenter un rapport', criticity: 'LOW', storeMethods: ['addReportReviewComment'], auditActions: ['ADD_REPORT_COMMENT'] },
  ATTACH_PHOTO: { label: 'Ajouter / remplacer une photographie', criticity: 'LOW', storeMethods: ['attachPhoto'], auditActions: ['ATTACH_PHOTO', 'REPLACE_PHOTO'] },
  EXPORT_DATA: {
    label: 'Exporter (PDF, CSV, JSON, sauvegarde complète)',
    criticity: 'LOW',
    storeMethods: ['logReportExport'],
    auditActions: ['EXPORT_REPORT', 'EXPORT_RAW_DATA', 'EXPORT_COMPUTED_DATA', 'EXPORT_SCIENTIFIC_DOSSIER', 'EXPORT_FULL_BACKUP']
  },
  CREATE_TRIAL: { label: 'Créer un essai', criticity: 'STANDARD', storeMethods: ['createTrial'], auditActions: ['CREATE_TRIAL', 'CONFIGURE_PROTOCOL'] },
  MODIFY_IDENTIFICATION: { label: "Modifier l'identification", criticity: 'STANDARD', storeMethods: ['updateTrialIdentification'], auditActions: ['MODIFY_IDENTIFICATION'] },
  UPDATE_T0_DATE: {
    label: 'Modifier la date effective du T0 (avant démarrage)',
    criticity: 'STANDARD',
    storeMethods: ['updateT0EffectiveDate'],
    auditActions: ['UPDATE_T0_EFFECTIVE_DATE']
  },
  CREATE_BATCH: { label: 'Ajouter un lot', criticity: 'STANDARD', storeMethods: [], auditActions: ['CREATE_BATCH'] },
  MODIFY_LOTS_SPECIMENS: { label: 'Modifier lots et éprouvettes', criticity: 'STANDARD', storeMethods: ['updateLotsAndSpecimens'], auditActions: ['MODIFY_BATCH', 'MODIFY_PANEL'] },
  RECORD_ACQUISITION: {
    label: 'Saisir des mesures',
    criticity: 'STANDARD',
    storeMethods: ['recordAcquisition'],
    auditActions: ['RECORD_ACQUISITION', 'UPDATE_ACQUISITION', 'LOCK_TRIAL_CONFIGURATION']
  },
  GENERATE_REPORT: { label: 'Générer un rapport', criticity: 'STANDARD', storeMethods: ['generateScientificReportForTrial'], auditActions: ['GENERATE_REPORT', 'REGENERATE_REPORT'] },
  // D-12 : validation d'étape ouverte au Technicien (STANDARD).
  VALIDATE_STAGE: { label: 'Valider une étape', criticity: 'STANDARD', storeMethods: ['validateStage'], auditActions: ['VALIDATE_STAGE'] },
  EXCLUDE_PANEL: { label: 'Exclure une éprouvette', criticity: 'HIGH', storeMethods: ['excludePanel'], auditActions: ['EXCLUDE_PANEL'] },
  ADAPT_PROTOCOL: {
    label: 'Adapter le protocole de mesure',
    criticity: 'HIGH',
    storeMethods: ['adaptProtocolConfig'],
    auditActions: ['MODIFY_MEASUREMENT_CONFIG', 'MODIFY_MEASUREMENT_CONFIGURATION']
  },
  UPDATE_MEASUREMENT_PLAN: { label: 'Modifier le plan de mesure', criticity: 'HIGH', storeMethods: ['updateMeasurementPlan'], auditActions: ['UPDATE_MEASUREMENT_PLAN'] },
  TOGGLE_STAGE: { label: 'Activer / désactiver une étape', criticity: 'HIGH', storeMethods: ['toggleStageStatus'], auditActions: ['DEACTIVATE_STAGE', 'REACTIVATE_STAGE'] },
  DELETE_PHOTO: { label: 'Supprimer une photographie', criticity: 'HIGH', storeMethods: ['deletePhoto'], auditActions: ['DELETE_PHOTO'] },
  UPDATE_REPORT_STATUS: { label: "Changer le statut d'un rapport", criticity: 'HIGH', storeMethods: ['updateReportStatus'], auditActions: ['REVIEW_REPORT', 'APPROVE_REPORT'] },
  IMPORT_TRIAL: { label: 'Importer un essai', criticity: 'HIGH', storeMethods: ['importTrialFromExport'], auditActions: ['IMPORT_TRIAL'] },
  RESET_DEMO: { label: 'Réinitialiser les essais de démonstration', criticity: 'HIGH', storeMethods: ['resetToDemo'], auditActions: [] }
};

/** Criticités autorisées par rôle. */
export const ROLE_CRITICITIES: Record<Role, Criticity[]> = {
  UTILISATEUR: ['READ'],
  TECHNICIEN: ['READ', 'LOW', 'STANDARD'],
  RESPONSABLE: ['READ', 'LOW', 'STANDARD', 'HIGH']
};

const ALL_TABS: TrialTabId[] = ['01', '02', '03', '04', '05', '06', 'PHOTO', '08', '09'];
const TABS_01_TO_08: TrialTabId[] = ['01', '02', '03', '04', '05', '06', 'PHOTO', '08'];

/** Onglets visibles par rôle (« visuel de 1 à 8 » : 01 → 08, Photothèque = 07). */
export const ROLE_TABS: Record<Role, TrialTabId[]> = {
  UTILISATEUR: TABS_01_TO_08,
  TECHNICIEN: TABS_01_TO_08,
  RESPONSABLE: ALL_TABS
};

/** Sections de la barre principale visibles par rôle. */
export const ROLE_SECTIONS: Record<Role, AppSectionId[]> = {
  UTILISATEUR: ['TRIALS', 'RULESET'],
  TECHNICIEN: ['TRIALS', 'RULESET'],
  RESPONSABLE: ['TRIALS', 'UX_TESTS', 'SCIENTIFIC_TESTS', 'RULESET']
};

export const ROLE_LABELS: Record<Role, string> = {
  UTILISATEUR: 'Utilisateur',
  TECHNICIEN: 'Technicien',
  RESPONSABLE: 'Responsable'
};

const isActiveProfile = (user: UserProfile | null | undefined): user is UserProfile => !!user && user.active;

export function canPerform(user: UserProfile | null | undefined, action: ActionId): boolean {
  if (!isActiveProfile(user)) return false;
  return ROLE_CRITICITIES[user.role].includes(ACTION_CATALOG[action].criticity);
}

export function canViewTab(user: UserProfile | null | undefined, tab: TrialTabId): boolean {
  return isActiveProfile(user) && ROLE_TABS[user.role].includes(tab);
}

export function canViewSection(user: UserProfile | null | undefined, section: AppSectionId): boolean {
  return isActiveProfile(user) && ROLE_SECTIONS[user.role].includes(section);
}

/**
 * Libellé opérateur écrit dans le journal de bord une fois la connexion en
 * place (remplacera la saisie libre « Opérateur ») : « Prénom NOM (Rôle) ».
 */
export function formatOperatorLabel(user: UserProfile): string {
  return `${user.firstName.trim()} ${user.lastName.trim().toUpperCase()} (${ROLE_LABELS[user.role]})`;
}

/** Action du catalogue correspondant à un code d'audit (null si non classé). */
export function actionForAuditCode(auditCode: string): ActionId | null {
  const entry = (Object.entries(ACTION_CATALOG) as Array<[ActionId, ActionDefinition]>).find(([, def]) =>
    def.auditActions.includes(auditCode)
  );
  return entry ? entry[0] : null;
}

const ROLES: Role[] = ['UTILISATEUR', 'TECHNICIEN', 'RESPONSABLE'];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Règles d'un compte (D-12) : prénom et nom renseignés, adresse e-mail valide
 * et unique parmi les comptes existants (une personne = un compte = un rôle),
 * rôle connu. Retourne la liste des erreurs (vide si valide).
 */
export function validateUserProfile(profile: UserProfile, existing: UserProfile[]): string[] {
  const errors: string[] = [];
  if (!profile.firstName.trim()) errors.push('Prénom obligatoire.');
  if (!profile.lastName.trim()) errors.push('Nom obligatoire.');
  const email = normalizeEmail(profile.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Adresse e-mail invalide.');
  else if (existing.some((u) => u.id !== profile.id && normalizeEmail(u.email) === email)) {
    errors.push('Un compte existe déjà avec cette adresse e-mail (une personne = un compte).');
  }
  if (!ROLES.includes(profile.role)) errors.push('Rôle inconnu.');
  return errors;
}
