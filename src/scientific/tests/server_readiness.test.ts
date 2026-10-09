/**
 * QUV-Lab — Garde-fous d'architecture pour la cible serveur (R-ARCH, D-13).
 * Voir docs/architecture/SERVER_TARGET.md §3 et §4.
 *
 * Analyse statique du code (commentaires retirés) : elle échoue si une
 * évolution réintroduit une dépendance qui empêcherait la migration.
 * Les dettes connues sont listées explicitement : la liste ne doit que diminuer.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface ServerReadinessTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const SRC = path.resolve(process.cwd(), 'src');

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : files(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** Source sans commentaires (bloc et ligne) ni contenu des chaînes simples, pour éviter les faux positifs. */
function code(file: string): string {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

/** Appels réels d'API navigateur (`window.x`, `new FileReader`…), pas un champ « document » ni un mot dans un texte. */
const BROWSER_API_CALL = /(?<![.\w])(window|document|navigator|localStorage|sessionStorage|indexedDB)\s*\.|\bnew\s+FileReader\b/;
/** Accès au stockage du navigateur (l'import `idb` est conservé : les chaînes simples sont vidées par code()). */
const STORAGE_API_CALL = /(?<![.\w])(localStorage|sessionStorage|indexedDB)\s*\.|\bopenDB\s*[<(]/;

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join('/');

function offenders(dirFiles: string[], pattern: RegExp, allowed: string[] = []): string[] {
  return dirFiles.filter((f) => !allowed.includes(rel(f)) && pattern.test(code(f))).map(rel);
}

export function runServerReadinessTests(): {
  results: ServerReadinessTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ServerReadinessTestResult[] = [];
  const record = (id: string, name: string, passed: boolean, expected: string, actual: string) => {
    results.push({ id, name, passed, expected, actual });
  };
  const all = files(SRC);

  // R-ARCH-01 : moteur scientifique portable (aucune API navigateur).
  {
    const scientific = all.filter((f) => rel(f).startsWith('scientific/'));
    const bad = offenders(scientific, BROWSER_API_CALL);
    record('R-ARCH-01', 'Moteur scientifique (src/scientific) sans API du navigateur : exécutable côté serveur',
      scientific.length > 20 && bad.length === 0, '0 fichier', bad.join(', ') || `0 fichier sur ${scientific.length}`);
  }

  // R-ARCH-02 : l'interface n'écrit pas directement dans un essai (dette A1 autorisée temporairement).
  {
    const components = all.filter((f) => rel(f).startsWith('components/') && !rel(f).endsWith('UXTestsSuite.tsx'));
    const KNOWN_DEBT = ['components/trial-tabs/Tab02LotsPanels.tsx']; // A1 : CREATE_BATCH
    const bad = offenders(components, /globalTrialStore\.saveTrial\s*\(|\.auditTrail\.push\s*\(/, KNOWN_DEBT);
    const debtStillPresent = KNOWN_DEBT.filter((d) => /globalTrialStore\.saveTrial\s*\(|\.auditTrail\.push\s*\(/.test(code(path.join(SRC, d))));
    record('R-ARCH-02', 'Interface : aucune écriture directe (saveTrial / auditTrail.push) hors dette connue A1 — à retirer de la liste une fois résorbée',
      bad.length === 0 && debtStillPresent.length === KNOWN_DEBT.length, `0 nouveau ; dette listée encore présente (${KNOWN_DEBT.length})`,
      `nouveaux=${bad.join(', ') || 'aucun'} ; dette encore présente=${debtStillPresent.length}`);
  }

  // R-ARCH-03 : localStorage / IndexedDB confinés aux services de persistance.
  {
    const PERSISTENCE = ['services/trialStoreService.ts', 'services/mediaStorageService.ts', 'services/mediaMigrationService.ts'];
    const bad = offenders(all.filter((f) => !rel(f).endsWith('UXTestsSuite.tsx')), STORAGE_API_CALL, PERSISTENCE);
    record('R-ARCH-03', 'localStorage / IndexedDB utilisés uniquement par les services de persistance',
      bad.length === 0, '0 fichier hors persistance', bad.join(', ') || '0 fichier');
  }

  // R-ARCH-04 : aucune donnée de mot de passe dans le modèle d'essai ni le profil.
  {
    const modelFiles = ['types/trial.ts', 'types/scientific.ts', 'types/auth.ts'].map((f) => path.join(SRC, f));
    const bad = modelFiles.filter((f) => /\b(password|motDePasse|passwordHash)\b/i.test(code(f))).map(rel);
    record('R-ARCH-04', 'Aucun champ mot de passe dans le modèle d’essai ni dans le profil utilisateur',
      bad.length === 0, '0 champ', bad.join(', ') || '0 champ');
  }

  const passed = results.filter((r) => r.passed).length;
  return { results, summary: { total: results.length, passed, failed: results.length - passed } };
}
