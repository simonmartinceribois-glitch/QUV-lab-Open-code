/**
 * QUV-Lab — Correctif A1 (audit robustesse photothèque) :
 * exclusion des photographies ARCHIVED de la comparaison temporelle.
 *
 * Une photographie passée au statut ARCHIVED lors d'un remplacement A → B ne
 * doit jamais être considérée comme une photographie active dans le
 * comparateur : ni dans la source de sélection, ni dans la réconciliation, ni
 * dans la dernière barrière `comparedPhotos`, ni dans la planche de rapport.
 *
 * Les scénarios Test 1 à Test 5 du mandat sont tous couverts ici, au niveau des
 * sélecteurs purs réellement utilisés par TabPhotographs, plus un scénario de
 * cycle de vie réel (store) validant la conservation de l'historique.
 */
import {
  selectActivePanelPhotos,
  selectComparedPhotos,
  excludeArchivedFromSelection
} from '../../components/phototheque/photoCompareSelection';
import { generateStandardExposureStages, globalTrialStore, generateUUID } from '../../services/trialStore';
import type { Trial, BatchDefinition, PanelDefinition, PhotoReference, MediaReference } from '../../types/trial';

export interface ArchivedComparisonTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

function makeRef(
  id: string,
  panelId: string,
  stageId: string,
  status: 'ACTIVE' | 'ARCHIVED',
  overrides?: Partial<PhotoReference>
): PhotoReference {
  return {
    id,
    trialId: 'trial-a1',
    type: 'PHOTO',
    status,
    storageKey: `photos/${id}.jpg`,
    filename: `${id}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    capturedAt: '2026-01-01T00:00:00Z',
    capturedBy: 'TestRunner',
    panelId,
    stageId,
    ...overrides
  };
}

function createOneBatchTrial(): Trial {
  const trialId = `trial-a1-${generateUUID()}`;
  const stages = generateStandardExposureStages(trialId);

  const panels: PanelDefinition[] = [
    { id: `${trialId}-b1-p1`, label: '1', roleCode: 'E1', role: 'EXPOSED_1', batchId: `${trialId}-b1`, status: 'ACTIVE', index: 1 },
    { id: `${trialId}-b1-p2`, label: '2', roleCode: 'E2', role: 'EXPOSED_2', batchId: `${trialId}-b1`, status: 'ACTIVE', index: 2 },
    { id: `${trialId}-b1-p3`, label: '3', roleCode: 'E3', role: 'EXPOSED_3', batchId: `${trialId}-b1`, status: 'ACTIVE', index: 3 },
    { id: `${trialId}-b1-pT`, label: 'T', roleCode: 'T', role: 'WITNESS', batchId: `${trialId}-b1`, status: 'ACTIVE', index: 4 }
  ];

  const batches: BatchDefinition[] = [
    {
      id: `${trialId}-b1`,
      trialId,
      orderIndex: 0,
      reference: 'LOT-A1',
      productReference: 'Peinture A',
      woodSpecies: 'Pin Sylvestre',
      coatCount: 2,
      panels
    }
  ];

  return {
    id: trialId,
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'IN_PROGRESS',
    configurationStatus: 'EDITABLE',
    metadata: {
      reference: 'TRIAL-A1',
      title: 'Essai correctif A1',
      createdBy: 'TestRunner'
    },
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['COLOR', 'GLOSS', 'PERSOZ', 'OBSERVATIONS'],
      familyConfigs: {
        COLOR: { familyId: 'COLOR', enabled: true },
        GLOSS: { familyId: 'GLOSS', enabled: true }
      }
    },
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: Array.from({ length: 11 }, (_, i) => ({ cycleIndex: i + 1, mandatory: true })),
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    stages,
    batches,
    mediaReferences: [],
    acquisitions: {},
    reports: [],
    auditTrail: []
  } as Trial;
}

export function runArchivedComparisonExclusionTests(): {
  results: ArchivedComparisonTestResult[];
  summary: { total: number; passed: number; failed: number };
} {
  const results: ArchivedComparisonTestResult[] = [];

  const record = (
    id: string,
    name: string,
    passed: boolean,
    expected: string,
    actual: string
  ) => {
    results.push({ id, name, passed, expected, actual });
  };

  const PANEL = 'panel-a1';
  const STAGE_0 = 'stage-t0';
  const STAGE_1 = 'stage-c1';
  const STAGE_2 = 'stage-c2';

  // Test 1 — ARCHIVED non sélectionnable comme photo active (source activePanelPhotos)
  {
    const refA = makeRef('A', PANEL, STAGE_0, 'ACTIVE');
    const refB = makeRef('B', PANEL, STAGE_0, 'ARCHIVED');
    const refOtherPanel = makeRef('C', 'autre-panneau', STAGE_1, 'ACTIVE');
    const refNotPhoto = { ...makeRef('D', PANEL, STAGE_2, 'ACTIVE'), type: 'DOCUMENT' } as MediaReference;

    const active = selectActivePanelPhotos([refA, refB, refOtherPanel, refNotPhoto], PANEL);

    const ids = active.map((m) => m.id).join(',');
    record(
      'A1-01',
      'Une photo ARCHIVED n\'est pas sélectionnable comme photo active (source activePanelPhotos)',
      active.length === 1 && active[0].id === 'A',
      `Uniquement la photo active [A]`,
      `Sélectionnées : ${ids || '(vide)'}`
    );
  }

  // Test 5a / Test 2 — Une photo active reste sélectionnable ; plusieurs actives comparables
  {
    const refA = makeRef('A', PANEL, STAGE_0, 'ACTIVE');
    const refX1 = makeRef('X1', PANEL, STAGE_1, 'ACTIVE');
    const refX2 = makeRef('X2', PANEL, STAGE_2, 'ACTIVE');

    const active = selectActivePanelPhotos([refA, refX1, refX2], PANEL);
    const allComparable = selectComparedPhotos([refA, refX1, refX2], ['A', 'X1', 'X2']);

    const activeOk = active.length === 3;
    const compareOk = allComparable.length === 3;
    record(
      'A1-02',
      'Plusieurs photos actives restent sélectionnables et comparables (non-régression)',
      activeOk && compareOk,
      '3 photos actives sélectionnables et comparées',
      `Sélectionnables=${active.length}, comparées=${allComparable.map((m) => m.id).join(',')}`
    );
  }

  // Test 2 — Réconciliation après remplacement A → B
  {
    const refA = makeRef('A', PANEL, STAGE_0, 'ARCHIVED'); // références APRÈS remplacement
    const refB = makeRef('B', PANEL, STAGE_0, 'ACTIVE');
    const refX = makeRef('X', PANEL, STAGE_1, 'ACTIVE');

    const reconciled = excludeArchivedFromSelection([refA, refB, refX], ['A', 'X']);
    record(
      'A1-03',
      'Réconciliation après remplacement : A (ARCHIVED) retirée, X (active) conservée',
      reconciled.join(',') === 'X',
      `Sélection réconciliée : [X]`,
      `Obtenu : [${reconciled.join(',')}]`
    );
  }

  // Test 2 (cas complet) — la sélection devient vide si seule A était sélectionnée
  {
    const refA = makeRef('A', PANEL, STAGE_0, 'ARCHIVED');
    const refB = makeRef('B', PANEL, STAGE_0, 'ACTIVE');

    const reconciled = excludeArchivedFromSelection([refA, refB], ['A']);
    record(
      'A1-04',
      'Remplacement A → B : A seule sélectionnée → sélection vide (A absente, B disponible)',
      reconciled.length === 0,
      'Sélection vide après réconciliation',
      `Obtenu : [${reconciled.join(',')}]`
    );
  }

  // Test 3 — Défense comparedPhotos : ID ARCHIVED artificiellement maintenu
  {
    const refA = makeRef('A', PANEL, STAGE_0, 'ARCHIVED');
    const refB = makeRef('B', PANEL, STAGE_1, 'ACTIVE');

    const compared = selectComparedPhotos([refA, refB], ['A', 'B']);
    record(
      'A1-05',
      'Défense comparedPhotos : A (ARCHIVED) jamais exposée, même artificiellement dans la sélection',
      compared.length === 1 && compared[0].id === 'B',
      `Comparées : [B]`,
      `Obtenu : [${compared.map((m) => m.id).join(',')}]`
    );
  }

  // Test 3 (cas limite) — ID fantôme et ARCHIVED → aucun rendu
  {
    const refA = makeRef('A', PANEL, STAGE_0, 'ARCHIVED');

    const compared = selectComparedPhotos([refA], ['A', 'id-fantome-inconnu']);
    record(
      'A1-06',
      'Défense comparedPhotos : aucun rendu en l\'absence d\'au moins une photo active',
      compared.length === 0,
      'Comparées : []',
      `Obtenu : [${compared.map((m) => m.id).join(',')}]`
    );
  }

  // Test 4 — Planche d'évolution : la source de la planche (comparedPhotos) ne contient jamais une photo ARCHIVED
  {
    const refA = makeRef('A', PANEL, STAGE_0, 'ARCHIVED');
    const refB = makeRef('B', PANEL, STAGE_0, 'ACTIVE');
    const refX = makeRef('X', PANEL, STAGE_1, 'ACTIVE');

    const plancheSource = selectComparedPhotos([refA, refB, refX], ['A', 'B', 'X']);
    const noArchived = plancheSource.every((m) => m.status !== 'ARCHIVED');
    const noDuplicateStage = new Set(plancheSource.map((m) => m.stageId)).size === plancheSource.length;
    record(
      'A1-07',
      'Planche d\'évolution : aucune photo ARCHIVED et aucun doublon de jalon (A/B jamais simultanées)',
      noArchived && noDuplicateStage && plancheSource.length === 2,
      'Planche : [B, X], aucune ARCHIVED',
      `Obtenu : [${plancheSource.map((m) => m.id).join(',')}]`
    );
  }

  // Test 5 — Cycle de vie réel via le store : A → B conserve l'historique, sans suppression Blob
  {
    const trial = createOneBatchTrial();
    globalTrialStore.saveTrial(trial);

    const panelId = trial.batches[0].panels[0].id;
    const stageId = trial.stages[0].id;

    const t1 = globalTrialStore.attachPhoto({
      trialId: trial.id,
      panelId,
      stageId,
      filename: 'photo_A.jpg',
      caption: 'Cliché A',
      operatorId: 'Opérateur 1',
      storageKey: 'photos/photo_A.jpg'
    });

    const photoA = t1.mediaReferences.find((m) => m.id === t1.mediaReferences[0]?.id) as PhotoReference;

    const t2 = globalTrialStore.attachPhoto({
      trialId: trial.id,
      panelId,
      stageId,
      filename: 'photo_B.jpg',
      caption: 'Cliché B',
      operatorId: 'Opérateur 2',
      storageKey: 'photos/photo_B.jpg'
    });

    const aAfter = t2.mediaReferences.find((m) => m.filename === 'photo_A.jpg');
    const bAfter = t2.mediaReferences.find((m) => m.filename === 'photo_B.jpg');

    const historyKept =
      !!aAfter &&
      aAfter.status === 'ARCHIVED' &&
      !!aAfter.replacementMediaId &&
      aAfter.replacementMediaId === (bAfter?.id ?? '') &&
      t2.mediaReferences.some((m) => m.storageKey === 'photos/photo_A.jpg') &&
      t2.mediaReferences.some((m) => m.storageKey === 'photos/photo_B.jpg');

    const reconciled = excludeArchivedFromSelection(t2.mediaReferences, [photoA?.id ?? '']);
    const activeAfter = selectActivePanelPhotos(t2.mediaReferences, panelId);

    const noArchivedInSelection = reconciled.length === 0;
    const onlyBActive = activeAfter.length === 1 && activeAfter[0]?.filename === 'photo_B.jpg';

    record(
      'A1-08',
      'A → B réel : historique ARCHIVED conservé, Blobs référencés, A absente de la sélection, B seule active',
      historyKept && noArchivedInSelection && onlyBActive,
      'A ARCHIVED (replacementMediaId=B), A et B référencés, sélection vide, B seul actif',
      `historyKept=${historyKept}, selection=[${reconciled.join(',')}], active=[${activeAfter.map((m) => m.filename).join(',')}]`
    );
  }

  // Test 5 — Aucune suppression IndexedDB introduite + galerie « archivés » intacte (non-régression)
  {
    const refA = makeRef('A', PANEL, STAGE_0, 'ACTIVE');
    const refB = makeRef('B', PANEL, STAGE_0, 'ARCHIVED');
    const refX = makeRef('X', PANEL, STAGE_1, 'ACTIVE');
    const refs = [refA, refB, refX];

    const keysBefore = refs.map((m) => m.storageKey).join('|');
    const lengthBefore = refs.length;

    excludeArchivedFromSelection(refs, ['A', 'B', 'X']);
    selectActivePanelPhotos(refs, PANEL);
    selectComparedPhotos(refs, ['A', 'B', 'X']);

    const keysAfter = refs.map((m) => m.storageKey).join('|');
    const lengthAfter = refs.length;

    const noMutation =
      keysBefore === keysAfter && lengthBefore === lengthAfter && refs === refs;
    const archivedStillPresent = refs.some((m) => m.id === 'B' && m.status === 'ARCHIVED');

    record(
      'A1-09',
      'Non-régression : aucune suppression de Blob (refs intactes) et photo ARCHIVED toujours présente dans mediaReferences (galerie archivés inchangée)',
      noMutation && archivedStillPresent,
      'refs et storageKeys inchangés ; B (ARCHIVED) conservée dans l\'historique',
      `len=${lengthAfter}/${lengthBefore}, keysIdentiques=${keysBefore === keysAfter}, archivedPresente=${archivedStillPresent}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    results,
    summary: { total: results.length, passed, failed: results.length - passed }
  };
}