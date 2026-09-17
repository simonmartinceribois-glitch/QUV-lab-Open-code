/**
 * QUV-Lab — Correctif O1/O2 : robustesse remplacement photo & clés média
 *
 * O1 — `attachPhoto` : le paramètre `replaceExisting` (devenu inerte) est
 *      supprimé. Le remplacement automatique non destructif (unicité du cliché
 *      ACTIVE par panelId+stageId, archivage, chaînage, traçabilité) est
 *      conservé et vérifié indépendamment de tout drapeau.
 *
 * O2 — clés média content-addressed `media/sha256/<64hex>` :
 *      déterminisme, idempotence, compatibilité des anciennes clés, détection
 *      et non-écrasement des collisions, reprise, encodages UTF-8 / percent.
 */
import { TrialStoreService } from '../../services/trialStoreService';
import {
  convertDataUriToBlob,
  computeContentAddressedKey,
  createMigratedStorageKey,
  stableHash,
  runMediaMigration,
  MediaCollisionError
} from '../../services/mediaMigrationService';
import type { MediaStoragePort } from '../../services/mediaStorageService';
import type { Trial, PhotoReference, TrialMetadata } from '../../types/trial';

type GateTestResult = { id: string; name: string; passed: boolean; expected: string; actual: string };
type GateTestSuite = { summary: { failed: number; total: number; passed: number }; results: GateTestResult[] };

const JPEG_KEY = 'data:image/jpeg;base64,/9j/4AAQSkZJRg';
const JPEG_KEY_ALT = 'data:image/jpeg;base64,/9j/AAAA/4AAQSkZJRg';
const SVG_XML =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d97706"/><stop offset="100%" stop-color="#78350f"/></linearGradient></defs><rect width="600" height="400" fill="url(#bg)"/><text x="50" y="55" fill="#ffffff">Éprouvette 1 — A1 100%</text></svg>';
const SVG_KEY = `data:image/svg+xml;utf8,${SVG_XML.replace(/#/g, '%23')}`;

class MemoryBackend implements MediaStoragePort {
  public readonly store = new Map<string, { blob: Blob; mimeType: string; createdAt: string }>();
  async put(file: Blob, key: string, mimeType?: string): Promise<void> {
    const type = mimeType ?? file.type;
    if (!type) throw new Error('MIME manquant');
    this.store.set(key, { blob: file, mimeType: type, createdAt: new Date().toISOString() });
  }
  async get(key: string) {
    const r = this.store.get(key);
    return r ? { key, blob: r.blob, mimeType: r.mimeType, createdAt: r.createdAt } : null;
  }
  async delete(key: string) { this.store.delete(key); }
  async has(key: string) { return this.store.has(key); }
  async keys() { return [...this.store.keys()]; }
}

function baseTrial(id: string): Trial {
  return {
    id,
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    metadata: { reference: `O2-${id}`, createdBy: 'test' },
    config: { standardReference: 'NF EN 927-6', activeFamilies: ['COLOR'], familyConfigs: {} as any },
    scheduleConfig: {
      cycleDurationHours: 168,
      maxCycles: 12,
      initialStage: { exposureHours: 0, mandatory: true, label: 'T0' },
      intermediateCycles: Array.from({ length: 11 }, (_, i) => ({ cycleIndex: i + 1, mandatory: true })),
      finalCycle: { cycleIndex: 12, mandatory: true }
    },
    batches: [],
    stages: [],
    mediaReferences: [],
    acquisitions: {},
    reports: [],
    auditTrail: []
  };
}

function makeRef(id: string, trialId: string, storageKey: string, overrides?: Partial<PhotoReference>): PhotoReference {
  return {
    id,
    trialId,
    type: 'PHOTO',
    status: 'ACTIVE',
    storageKey,
    filename: `${id}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 0,
    capturedAt: new Date().toISOString(),
    capturedBy: 'test',
    panelId: 'panel-1',
    stageId: 'stage-1',
    ...overrides
  };
}

export async function runO1O2PhotoMediaTests(): Promise<GateTestSuite> {
  const res: GateTestResult[] = [];

  // ==========================================================================
  // O1 — attachPhoto: remplacement automatique, sans `replaceExisting`
  // ==========================================================================
  {
    const store = TrialStoreService.createIsolatedStore();
    const trial = store.createTrial({
      metadata: { reference: 'O1-TRIAL', title: 'O1', createdBy: 'Opérateur O1' } as TrialMetadata,
      batches: [{ reference: 'LOT-O1', coatingSystem: 'Acrylique', woodSpecies: 'Pin' }],
      activeFamilies: ['COLOR']
    });
    const panelId = trial.batches[0].panels[0].id;
    const stageId = trial.stages[0].id;
    const attach = (filename: string, operatorId: string) =>
      store.attachPhoto({ trialId: trial.id, panelId, stageId, filename, operatorId });

    type State = { active: PhotoReference[]; archived: PhotoReference[] };

    // O1-01 : premier cliché ACTIVE unique
    const t = attach('o1_01_first.jpg', 'Opérateur O1');
    const s1 = snapshot(t, panelId, stageId);
    res.push({
      id: 'O1-01',
      name: 'attachPhoto: premier cliché ACTIVE unique par (panelId, stageId)',
      passed: s1.active.length === 1 && s1.archived.length === 0,
      expected: '1 ACTIVE, 0 ARCHIVED',
      actual: `active=${s1.active.length}, archived=${s1.archived.length}`
    });

    // O1-02 : second cliché (aucun drapeau) → archivage non destructif + traçabilité
    const t2 = attach('o1_02_second.jpg', 'Opérateur O1');
    const s2 = snapshot(t2, panelId, stageId);
    const old = s2.archived[0];
    const fresh = s2.active[0];
    const o1_02 =
      s2.active.length === 1 &&
      s2.archived.length === 1 &&
      !!old &&
      old.status === 'ARCHIVED' &&
      typeof old.replacedAt === 'string' &&
      old.replacedBy === 'Opérateur O1' &&
      old.replacementMediaId === fresh.id &&
      fresh.replacementMediaId === old.id;
    res.push({
      id: 'O1-02',
      name: 'attachPhoto: remplacement automatique non destructif (replacedAt/replacedBy/chaînage)',
      passed: o1_02,
      expected: 'ancien ARCHIVED + replacedAt + replacedBy + chaînage bidirectionnel',
      actual: `archived=${s2.archived.length}, active=${s2.active.length}, oldStatus=${old?.status}, replacedAt=${typeof old?.replacedAt}, chain=${old?.replacementMediaId === fresh?.id && fresh?.replacementMediaId === old?.id}`
    });

    // O1-03 : unicité ACTIVE (au plus 1) sur l'ensemble des références
    const allPanel = t2.mediaReferences.filter((m) => m.type === 'PHOTO' && m.panelId === panelId && m.stageId === stageId);
    const activeAll = allPanel.filter((m) => m.status !== 'ARCHIVED');
    res.push({
      id: 'O1-03',
      name: 'attachPhoto: unicité stricte du cliché ACTIVE (panelId + stageId)',
      passed: activeAll.length === 1 && allPanel.length >= 2,
      expected: 'exactement 1 ACTIVE parmi les références',
      actual: `total=${allPanel.length}, active=${activeAll.length}`
    });

    // O1-04 : chaîne A → B → C (historique préservé, seul le dernier est ACTIVE)
    const t3 = attach('o1_04_third.jpg', 'Opérateur O2');
    const s3 = snapshot(t3, panelId, stageId);
    const chainOk = s3.active.length === 1 && s3.archived.length === 2 && s3.active[0].replacementMediaId === s3.archived[1]?.id;
    res.push({
      id: 'O1-04',
      name: 'attachPhoto: chaîne A→B→C, historique conservé, un seul ACTIVE',
      passed: chainOk,
      expected: '1 ACTIVE (C) + 2 ARCHIVED (A,B) chaînés',
      actual: `active=${s3.active.length}, archived=${s3.archived.length}, C.replaced=${s3.active[0]?.replacementMediaId}`
    });

    // O1-05 : traçabilité REPLACE_PHOTO dans l'auditTrail (2 remplacements)
    const replaceEvents = t3.auditTrail.filter((e) => e.action === 'REPLACE_PHOTO');
    res.push({
      id: 'O1-05',
      name: 'attachPhoto: 2 événements REPLACE_PHOTO tracés, comportement indépendant de tout drapeau',
      passed: replaceEvents.length === 2 && replaceEvents.every((e) => e.trialId === trial.id),
      expected: '2 événements REPLACE_PHOTO',
      actual: `replaceEvents=${replaceEvents.length}`
    });
  }

  // ==========================================================================
  // O2 — clés content-addressed SHA-256
  // ==========================================================================

  // O2-01 : déterminisme de la clé content-addressed
  {
    const { blob } = convertDataUriToBlob(JPEG_KEY);
    const k1 = await computeContentAddressedKey(blob);
    const k2 = await computeContentAddressedKey(blob);
    const pass =
      k1 !== null &&
      k1 === k2 &&
      /^media\/sha256\/[0-9a-f]{64}$/.test(k1);
    res.push({
      id: 'O2-01',
      name: 'computeContentAddressedKey: SHA-256 déterministe, media/sha256/<64hex>',
      passed: pass,
      expected: 'k1===k2, format media/sha256/<64hex>',
      actual: `k1=${k1}`
    });
  }

  // O2-02 : contenus différents → clés différentes
  {
    const a = await computeContentAddressedKey(convertDataUriToBlob(JPEG_KEY).blob);
    const b = await computeContentAddressedKey(convertDataUriToBlob(JPEG_KEY_ALT).blob);
    const pass = a !== null && b !== null && a !== b;
    res.push({
      id: 'O2-02',
      name: 'computeContentAddressedKey: contenus différents → clés différentes',
      passed: pass,
      expected: 'kA !== kB',
      actual: `kA=${a}, kB=${b}`
    });
  }

  // O2-03 : ancienne clé `media/<16hex>` toujours valide et jamais recalculée
  {
    const backend = new MemoryBackend();
    const legacyMigratedKey = `media/${stableHash(JPEG_KEY)}`;
    await backend.put(new Blob(['deja-migre'], { type: 'image/jpeg' }), legacyMigratedKey, 'image/jpeg');
    const trial = baseTrial('o2-03');
    trial.mediaReferences.push(makeRef('r1', trial.id, legacyMigratedKey));
    const s = await runMediaMigration({ backend, trials: [trial], saveTrial: () => {} });
    const keyAfter = trial.mediaReferences[0].storageKey;
    const stillThere = await backend.get(legacyMigratedKey);
    const pass = s.examined === 0 && s.migrated === 0 && keyAfter === legacyMigratedKey && stillThere !== null;
    res.push({
      id: 'O2-03',
      name: 'Compatibilité: clé media/<16hex> ancienne non recalculée, blob préservé',
      passed: pass,
      expected: 'examined=0, clé inchangée, blob présent',
      actual: `examined=${s.examined}, key=${keyAfter}, blob=${stillThere !== null}`
    });
  }

  // O2-04 : nouvelle migration legacy → media/sha256/<64hex>, contenu exact
  {
    const backend = new MemoryBackend();
    const trial = baseTrial('o2-04');
    trial.mediaReferences.push(makeRef('r1', trial.id, JPEG_KEY));
    const s = await runMediaMigration({ backend, trials: [trial], saveTrial: () => {} });
    const key = trial.mediaReferences[0].storageKey;
    const rec = await backend.get(key);
    const text = rec ? await rec.blob.text() : '';
    const expectedText = await convertDataUriToBlob(JPEG_KEY).blob.text();
    const pass = s.migrated === 1 && s.errors === 0 && key.startsWith('media/sha256/') && text === expectedText;
    res.push({
      id: 'O2-04',
      name: 'Migration: legacy → media/sha256/<64hex>, blob content-addressed exact',
      passed: pass,
      expected: 'migrated=1, clé media/sha256/, contenu identique',
      actual: `migrated=${s.migrated}, key=${key}, content=${text === expectedText}`
    });
  }

  // O2-05 : idempotence (second run: 0 migration, 1 blob)
  {
    const backend = new MemoryBackend();
    const trial = baseTrial('o2-05');
    trial.mediaReferences.push(makeRef('r1', trial.id, JPEG_KEY));
    const s1 = await runMediaMigration({ backend, trials: [trial], saveTrial: () => {} });
    const size1 = backend.store.size;
    const s2 = await runMediaMigration({ backend, trials: [trial], saveTrial: () => {} });
    const pass = s1.migrated === 1 && s2.migrated === 0 && s2.errors === 0 && backend.store.size === size1 && size1 === 1;
    res.push({
      id: 'O2-05',
      name: 'Idempotence: second run = 0 migration, aucun doublon',
      passed: pass,
      expected: 'run1=1, run2=0, size=1',
      actual: `run1=${s1.migrated}, run2=${s2.migrated}, size=${backend.store.size}`
    });
  }

  // O2-06 : collision détectée (clé pré-existante à contenu différent) — erreur explicite
  {
    const backend = new MemoryBackend();
    const jpegBlob = convertDataUriToBlob(JPEG_KEY).blob;
    const collisionKey = (await computeContentAddressedKey(jpegBlob)) ?? createMigratedStorageKey(JPEG_KEY);
    await backend.put(new Blob(['intrus-contenu-different'], { type: 'image/jpeg' }), collisionKey, 'image/jpeg');
    const trial = baseTrial('o2-06');
    trial.mediaReferences.push(makeRef('r1', trial.id, JPEG_KEY));
    const s = await runMediaMigration({ backend, trials: [trial], saveTrial: () => {} });
    const pass =
      s.migrated === 0 &&
      s.errors === 1 &&
      s.collisions.length === 1 &&
      s.failedKeys.length === 1 &&
      trial.mediaReferences[0].storageKey === JPEG_KEY;
    res.push({
      id: 'O2-06',
      name: 'Collision: contenu différent sous la même clé → erreur explicite, réf legacy conservée',
      passed: pass,
      expected: 'migrated=0, errors=1, collisions=1, réf legacy',
      actual: `migrated=${s.migrated}, errors=${s.errors}, collisions=${s.collisions.length}, ref=${trial.mediaReferences[0].storageKey === JPEG_KEY ? 'legacy' : 'modifiée'}`
    });
  }

  // O2-07 : aucun écrasement silencieux du contenu pré-existant
  {
    const backend = new MemoryBackend();
    const jpegBlob = convertDataUriToBlob(JPEG_KEY).blob;
    const collisionKey = (await computeContentAddressedKey(jpegBlob)) ?? createMigratedStorageKey(JPEG_KEY);
    await backend.put(new Blob(['intrus-contenu-different'], { type: 'image/jpeg' }), collisionKey, 'image/jpeg');
    const trial = baseTrial('o2-07');
    trial.mediaReferences.push(makeRef('r1', trial.id, JPEG_KEY));
    await runMediaMigration({ backend, trials: [trial], saveTrial: () => {} });
    const rec = await backend.get(collisionKey);
    const text = rec ? await rec.blob.text() : '';
    const pass = text === 'intrus-contenu-different' && rec?.mimeType === 'image/jpeg';
    res.push({
      id: 'O2-07',
      name: 'Collision: le contenu pré-existant n\'est jamais écrasé',
      passed: pass,
      expected: 'contenu pré-existant intact',
      actual: `content=${text}`
    });
  }

  // O2-08 : reprise — échec d'écriture isolé, réf legacy conservée, puis succès
  {
    const backend = new MemoryBackend();
    const jpegBlob = convertDataUriToBlob(JPEG_KEY).blob;
    const targetKey = (await computeContentAddressedKey(jpegBlob)) ?? createMigratedStorageKey(JPEG_KEY);
    let fail = true;
    const flaky: MediaStoragePort = {
      async put(file, key, mimeType) {
        if (fail && key === targetKey) throw new Error('panne simulée');
        return backend.put(file, key, mimeType);
      },
      async get(k) { return backend.get(k); },
      async delete(k) { return backend.delete(k); },
      async has(k) { return backend.has(k); },
      async keys() { return backend.keys(); }
    };
    const trial = baseTrial('o2-08');
    trial.mediaReferences.push(makeRef('r1', trial.id, JPEG_KEY));
    const s1 = await runMediaMigration({ backend: flaky, trials: [trial], saveTrial: () => {} });
    const refAfterFail = trial.mediaReferences[0].storageKey;
    fail = false;
    const s2 = await runMediaMigration({ backend: flaky, trials: [trial], saveTrial: () => {} });
    const pass =
      s1.errors === 1 && refAfterFail === JPEG_KEY &&
      s2.migrated === 1 && s2.errors === 0 &&
      trial.mediaReferences[0].storageKey.startsWith('media/') &&
      backend.store.size === 1;
    res.push({
      id: 'O2-08',
      name: 'Reprise: échec→legacy conservé, retry→migré (état cohérent)',
      passed: pass,
      expected: 's1.errors=1, réf legacy, s2.migré=1, size=1',
      actual: `s1.errors=${s1.errors}, refFail=${refAfterFail === JPEG_KEY ? 'legacy' : 'modifiée'}, s2.migrated=${s2.migrated}, size=${backend.store.size}`
    });
  }

  // O2-09 : SVG production UTF-8 (0%, 100%, %23, é, —)
  {
    const backend = new MemoryBackend();
    const trial = baseTrial('o2-09');
    trial.mediaReferences.push(makeRef('r1', trial.id, SVG_KEY));
    const s = await runMediaMigration({ backend, trials: [trial], saveTrial: () => {} });
    const key = trial.mediaReferences[0].storageKey;
    const rec = await backend.get(key);
    const text = rec ? await rec.blob.text() : '';
    const pass = s.migrated === 1 && s.errors === 0 && key.startsWith('media/sha256/') && rec?.mimeType === 'image/svg+xml' && text === SVG_XML;
    res.push({
      id: 'O2-09',
      name: 'SVG production: contenu UTF-8 exact, mime image/svg+xml, clé SHA-256',
      passed: pass,
      expected: 'migrated=1, mime svg, texte==SVG_XML',
      actual: `migrated=${s.migrated}, mime=${rec?.mimeType}, content=${text === SVG_XML}`
    });
  }

  // O2-10 : décodage percent-encodé (%20, %23, %25, %C3%A9) content-addressed
  {
    const backend = new MemoryBackend();
    const uri = 'data:image/svg+xml;utf8,a%20b%23c%25d%C3%A9';
    const trial = baseTrial('o2-10');
    trial.mediaReferences.push(makeRef('r1', trial.id, uri));
    const s = await runMediaMigration({ backend, trials: [trial], saveTrial: () => {} });
    const key = trial.mediaReferences[0].storageKey;
    const rec = await backend.get(key);
    const text = rec ? await rec.blob.text() : '';
    const pass = s.migrated === 1 && s.errors === 0 && key.startsWith('media/sha256/') && text === 'a b#c%dé';
    res.push({
      id: 'O2-10',
      name: 'Percent-encoding: %XX décodés avant empreinte, clé SHA-256',
      passed: pass,
      expected: 'migrated=1, texte "a b#c%dé"',
      actual: `migrated=${s.migrated}, content=${text}`
    });
  }

  // O2-11 : repli déterministe legacy hors contexte sécurisé (crypto.subtle absent)
  {
    const backend = new MemoryBackend();
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    let restored = false;
    try {
      Object.defineProperty(globalThis, 'crypto', {
        value: { ...(globalThis.crypto as object), subtle: undefined },
        configurable: true,
        writable: true
      });
      const trial = baseTrial('o2-11');
      trial.mediaReferences.push(makeRef('r1', trial.id, JPEG_KEY));
      const s = await runMediaMigration({ backend, trials: [trial], saveTrial: () => {} });
      const key = trial.mediaReferences[0].storageKey;
      const pass = s.migrated === 1 && s.errors === 0 && key === createMigratedStorageKey(JPEG_KEY) && backend.store.size === 1;
      res.push({
        id: 'O2-11',
        name: 'Repli hors contexte sécurisé: clé déterministe legacy, migration non interrompue',
        passed: pass,
        expected: `migrated=1, key=${createMigratedStorageKey(JPEG_KEY)}`,
        actual: `migrated=${s.migrated}, errors=${s.errors}, key=${key}`
      });
    } catch (err: any) {
      res.push({
        id: 'O2-11',
        name: 'Repli hors contexte sécurisé',
        passed: false,
        expected: 'stub crypto.subtle puis migration',
        actual: `exception: ${err?.message}`
      });
    } finally {
      if (original) {
        Object.defineProperty(globalThis, 'crypto', original);
        restored = true;
      }
    }
    void restored;
  }

  const failed = res.filter((r) => !r.passed).length;
  return { summary: { failed, total: res.length, passed: res.length - failed }, results: res };
}

function snapshot(trial: Trial, panelId: string, stageId: string): { active: PhotoReference[]; archived: PhotoReference[] } {
  const scoped = trial.mediaReferences.filter(
    (m): m is PhotoReference => m.type === 'PHOTO' && m.panelId === panelId && m.stageId === stageId
  );
  return {
    active: scoped.filter((m) => m.status !== 'ARCHIVED'),
    archived: scoped.filter((m) => m.status === 'ARCHIVED')
  };
}
