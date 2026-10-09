/**
 * QUV-Lab — Fondation des profils et des droits (R-AUTH), NON ACTIVÉE.
 *
 * Vérifie la matrice rôles → actions / onglets, et sert de garde-fou :
 * toute action d'audit écrite dans le code et toute méthode du store qui
 * modifie un essai doivent être classées dans ACTION_CATALOG.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ACTION_CATALOG,
  actionForAuditCode,
  canPerform,
  canViewSection,
  canViewTab,
  formatOperatorLabel,
  validateUserProfile
} from '../../services/permissions';
import type { ActionId } from '../../services/permissions';
import { AUTH_ENABLED, isAllowed, isTabVisible, setCurrentUser } from '../../services/session';
import type { Role, TrialTabId, UserProfile } from '../../types/auth';

export interface AuthFoundationTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const user = (role: Role, active = true): UserProfile => ({ id: `u-${role}`, email: `${role.toLowerCase()}@labo.test`, firstName: 'Simon', lastName: 'Martin', role, active });
const ACTIONS = Object.keys(ACTION_CATALOG) as ActionId[];
const byCriticity = (...levels: string[]) => ACTIONS.filter((a) => levels.includes(ACTION_CATALOG[a].criticity));

/** Méthodes publiques du store sans effet sur un essai (lecture, abonnement, persistance bas niveau). */
const NON_MUTATING_STORE_METHODS = [
  'migrateTrialTerminology',
  'getStorageLoadIssue',
  'onStorageError',
  'isPersistenceHealthy',
  'getTrials',
  'getTrial',
  'getAllTrials',
  // Persistance bas niveau : à rendre non publique en phase 1 (cf. spec, dette CREATE_BATCH).
  'saveTrial'
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** Codes `action` écrits dans le journal (action: 'X', action = 'X', ternaires compris). */
function auditCodesInSource(srcRoot: string): string[] {
  const codes = new Set<string>();
  for (const file of sourceFiles(srcRoot)) {
    if (/permissions\.ts$|UXTestsSuite\.tsx$/.test(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/\baction\s*[:=]\s*(.*)$/);
      if (!m) continue;
      // Valeur de `action` seulement : jusqu'à la première virgule (entityType exclu), ternaire
      // compris, opérandes de comparaison (`kind === 'BATCH'`) retirés.
      const value = m[1].split(',')[0].replace(/[!=]==\s*'[^']*'/g, '');
      for (const q of value.matchAll(/'([A-Z][A-Z0-9_]{2,})'/g)) codes.add(q[1]);
    }
  }
  return Array.from(codes).sort();
}

function publicStoreMethods(storeFile: string): string[] {
  const src = fs.readFileSync(storeFile, 'utf8');
  return Array.from(src.matchAll(/^ {2}public\s+(?!static)([a-zA-Z0-9_]+)\s*\(/gm)).map((m) => m[1]);
}

export function runAuthRolesFoundationTests(): {
  results: AuthFoundationTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: AuthFoundationTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };

  // R-AUTH-01 : Utilisateur → consultation uniquement.
  {
    const u = user('UTILISATEUR');
    const allowed = ACTIONS.filter((a) => canPerform(u, a));
    record('R-AUTH-01', 'Utilisateur : aucune action autorisée hormis la consultation (READ)',
      allowed.join(',') === byCriticity('READ').join(','), byCriticity('READ').join(','), allowed.join(',') || 'aucune');
  }

  // R-AUTH-02 : Technicien → LOW + STANDARD, jamais HIGH.
  {
    const u = user('TECHNICIEN');
    const allowed = ACTIONS.filter((a) => canPerform(u, a));
    const highAllowed = byCriticity('HIGH').filter((a) => canPerform(u, a));
    record('R-AUTH-02', 'Technicien : READ, LOW et STANDARD autorisés ; aucune action HIGH',
      allowed.join(',') === byCriticity('READ', 'LOW', 'STANDARD').join(',') && highAllowed.length === 0,
      'READ+LOW+STANDARD, 0 HIGH', `HIGH autorisées : ${highAllowed.join(',') || 'aucune'}`);
  }

  // R-AUTH-03 : Responsable → tout ; profil désactivé ou absent → rien.
  {
    const all = ACTIONS.every((a) => canPerform(user('RESPONSABLE'), a));
    const none = ACTIONS.every((a) => !canPerform(user('RESPONSABLE', false), a) && !canPerform(null, a));
    record('R-AUTH-03', 'Responsable : toutes les actions ; profil désactivé ou absent : aucune',
      all && none, 'tout / rien', `responsable=${all}, inactif/absent=${none}`);
  }

  // R-AUTH-04 : onglets — Utilisateur et Technicien 01 → 08, Responsable tout (dont 09).
  {
    const tabs: TrialTabId[] = ['01', '02', '03', '04', '05', '06', 'PHOTO', '08', '09'];
    const visible = (r: Role) => tabs.filter((t) => canViewTab(user(r), t)).join(',');
    const ok =
      visible('UTILISATEUR') === '01,02,03,04,05,06,PHOTO,08' &&
      visible('TECHNICIEN') === '01,02,03,04,05,06,PHOTO,08' &&
      visible('RESPONSABLE') === tabs.join(',') &&
      !canViewSection(user('TECHNICIEN'), 'UX_TESTS') && canViewSection(user('RESPONSABLE'), 'SCIENTIFIC_TESTS');
    record('R-AUTH-04', 'Onglets : 01 → 08 pour Utilisateur et Technicien, 01 → 09 pour Responsable ; suites de tests réservées au Responsable',
      ok, '01→08 / 01→08 / 01→09', `${visible('UTILISATEUR')} / ${visible('TECHNICIEN')} / ${visible('RESPONSABLE')}`);
  }

  // R-AUTH-05 : garde-fou — tout code d'audit écrit dans le code est classé.
  {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const codes = auditCodesInSource(srcRoot);
    const unclassified = codes.filter((c) => actionForAuditCode(c) === null);
    record('R-AUTH-05', 'Garde-fou : chaque code d’action du journal présent dans le code est classé dans ACTION_CATALOG',
      codes.length >= 20 && unclassified.length === 0, '0 code non classé', `${codes.length} codes, non classés : ${unclassified.join(',') || 'aucun'}`);
  }

  // R-AUTH-06 : garde-fou — toute méthode publique du store qui modifie un essai est classée.
  {
    const methods = publicStoreMethods(path.resolve(process.cwd(), 'src/services/trialStoreService.ts'));
    const classified = new Set(ACTIONS.flatMap((a) => ACTION_CATALOG[a].storeMethods));
    const unclassified = methods.filter((m) => !NON_MUTATING_STORE_METHODS.includes(m) && !classified.has(m));
    const stale = Array.from(classified).filter((m) => !methods.includes(m));
    record('R-AUTH-06', 'Garde-fou : chaque méthode publique du store qui modifie un essai est classée (et aucune méthode classée n’a disparu)',
      methods.length > 10 && unclassified.length === 0 && stale.length === 0, '0 non classée, 0 obsolète',
      `non classées : ${unclassified.join(',') || 'aucune'} ; obsolètes : ${stale.join(',') || 'aucune'}`);
  }

  // R-AUTH-07 : fondation inactive → comportement actuel inchangé.
  {
    setCurrentUser(user('UTILISATEUR'));
    const unchanged = !AUTH_ENABLED && ACTIONS.every((a) => isAllowed(a)) && isTabVisible('09');
    setCurrentUser(null);
    record('R-AUTH-07', 'AUTH_ENABLED = false : toutes les actions et tous les onglets restent accessibles (aucun changement de comportement)',
      unchanged, 'tout autorisé', `AUTH_ENABLED=${AUTH_ENABLED}, toutAutorisé=${unchanged}`);
  }

  // R-AUTH-08 : libellé opérateur standardisé.
  {
    const label = formatOperatorLabel({ id: 'x', email: 's.martin@labo.test', firstName: ' Simon ', lastName: 'Martin ', role: 'TECHNICIEN', active: true });
    record('R-AUTH-08', 'Libellé opérateur du journal : « Prénom NOM (Rôle) »',
      label === 'Simon MARTIN (Technicien)', 'Simon MARTIN (Technicien)', label);
  }

  // R-AUTH-09 : D-12 — valider une étape est STANDARD (Technicien autorisé, Utilisateur non).
  {
    const ok = ACTION_CATALOG.VALIDATE_STAGE.criticity === 'STANDARD' &&
      canPerform(user('TECHNICIEN'), 'VALIDATE_STAGE') && !canPerform(user('UTILISATEUR'), 'VALIDATE_STAGE');
    record('R-AUTH-09', 'D-12 : « Valider une étape » en STANDARD — autorisé au Technicien, refusé à l’Utilisateur',
      ok, 'STANDARD, technicien oui, utilisateur non', `criticité=${ACTION_CATALOG.VALIDATE_STAGE.criticity}`);
  }

  // R-AUTH-10 : D-12 — un compte par personne (e-mail unique, insensible à la casse), champs obligatoires.
  {
    const existing: UserProfile[] = [{ id: 'a', email: 'S.Martin@Labo.test', firstName: 'Simon', lastName: 'Martin', role: 'TECHNICIEN', active: true }];
    const duplicate = validateUserProfile({ id: 'b', email: ' s.martin@labo.test ', firstName: 'Simon', lastName: 'Martin', role: 'RESPONSABLE', active: true }, existing);
    const invalid = validateUserProfile({ id: 'c', email: 'pas-un-mail', firstName: '', lastName: 'X', role: 'UTILISATEUR', active: true }, existing);
    const sameAccount = validateUserProfile({ ...existing[0], role: 'RESPONSABLE' }, existing);
    const valid = validateUserProfile({ id: 'd', email: 'a.dupont@labo.test', firstName: 'Anne', lastName: 'Dupont', role: 'UTILISATEUR', active: true }, existing);
    const ok = duplicate.length === 1 && invalid.length === 2 && sameAccount.length === 0 && valid.length === 0;
    record('R-AUTH-10', 'D-12 : e-mail unique (même personne = un seul compte, un seul rôle), e-mail valide, prénom et nom obligatoires',
      ok, 'doublon refusé, 2 erreurs, changement de rôle du même compte accepté, compte valide',
      `doublon=${duplicate.length}, invalide=${invalid.length}, mêmeCompte=${sameAccount.length}, valide=${valid.length}`);
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
