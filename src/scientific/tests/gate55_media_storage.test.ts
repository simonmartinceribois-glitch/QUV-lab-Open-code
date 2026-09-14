/**
 * QUV-Lab — GATE 55 : Tests Media Storage (IndexedDB) — IDB-01 à IDB-12
 *
 * Valide l'architecture nouvelle de séparation média/métadonnées :
 *  - Conversion DataUri → Blob
 *  - CRUD via MediaStoragePort (in-memory backend pour tests sync)
 *  - Hook MediaImageLoader (anti-race, revoke)
 *  - Migration idempotente / reprise / overlay
 *  - Garbage collection (blob orphelin vs référencé)
 *  - sanitizeTrialForExport (sans binaire)
 *  - stableHash déterministe
 */
import {
  isLegacyStorageKey,
  convertDataUriToBlob,
  stableHash,
  createMigratedStorageKey,
  runMediaMigration,
  deleteUnreferencedMedia,
  sanitizeTrialForExport
} from '../../services/mediaMigrationService';
import type { MediaStoragePort } from '../../services/mediaStorageService';
import { MediaImageLoader } from '../../hooks/mediaImageLogic';
import type { Trial, PhotoReference } from '../../types/trial';

type GateTestResult = { id: string; name: string; passed: boolean; expected: string; actual: string };
type GateTestSuite = { summary: { failed: number; total: number; passed: number }; results: GateTestResult[] };

const SVG_KEY =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect fill="red" width="2" height="2"/></svg>';
const JPEG_KEY = 'data:image/jpeg;base64,/9j/4AAQSkZJRg';

function createBaseTrial(id: string): Trial {
  return {
    id,
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    metadata: {
      reference: `TRIAL-${id}`,
      title: 'Gate 55',
      createdBy: 'tester'
    },
    config: {
      standardReference: 'NF EN 927-6',
      activeFamilies: ['COLOR'],
      familyConfigs: {} as any
    },
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
    sizeBytes: 1024,
    capturedAt: '2026-01-01T00:00:00Z',
    capturedBy: 'tester',
    panelId: 'panel-1',
    stageId: 'stage-1',
    ...overrides
  };
}

function inMemoryBackend(): MediaStoragePort & { size: number } {
  const store = new Map<string, { blob: Blob; mimeType: string; createdAt: string }>();
  return {
    get size() { return store.size; },
    async put(file, key, mimeType) {
      const type = mimeType ?? file.type;
      if (!type) throw new Error('MIME manquant');
      store.set(key, { blob: file, mimeType: type, createdAt: new Date().toISOString() });
    },
    async get(key) { const r = store.get(key); return r ? { key, blob: r.blob, mimeType: r.mimeType, createdAt: r.createdAt } : null; },
    async delete(key) { store.delete(key); },
    async has(key) { return store.has(key); },
    async keys() { return [...store.keys()]; }
  };
}

export async function runGate55MediaStorageTests(): Promise<GateTestSuite> {
  const res: GateTestResult[] = [];

  // IDB-01 : Conversion DataUri → Blob roundtrip
  {
    const { blob, mimeType } = convertDataUriToBlob(JPEG_KEY);
    const pass = mimeType === 'image/jpeg' && blob instanceof Blob && blob.type === 'image/jpeg' && blob.size > 0;
    res.push({ id: 'IDB-01', name: 'ConvertDataUriToBlob: Blob correct, mimeType, taille > 0', passed: pass, expected: 'mimeType=image/jpeg, size>0', actual: `mimeType=${mimeType}, size=${blob.size}` });
  }

  // IDB-02 : CRUD via MediaStoragePort
  {
    const b = inMemoryBackend();
    const testBlob = new Blob(['hello'], { type: 'text/plain' });
    await b.put(testBlob, 'k1', 'text/plain');
    const has1 = await b.has('k1');
    const rec = await b.get('k1');
    await b.delete('k1');
    const has2 = await b.has('k1');
    const pass = has1 && rec?.key === 'k1' && rec.mimeType === 'text/plain' && !has2;
    res.push({ id: 'IDB-02', name: 'CRUD in-memory: put→has→get→delete', passed: pass, expected: 'has=true, get.key=k1, has après delete=false', actual: `has=${has1}, get=${rec?.key}, has après delete=${has2}` });
  }

  // IDB-03 : MediaImageLoader anti-race
  {
    const slowStore = new Map<string, Blob>();
    slowStore.set('slow', new Blob(['S'], { type: 'text/plain' }));
    slowStore.set('fast', new Blob(['F'], { type: 'text/plain' }));
    const revoked: string[] = [];
    const loader = new MediaImageLoader({
      get: async (k) => {
        if (k === 'slow') await new Promise((r) => setTimeout(r, 50));
        const blob = slowStore.get(k);
        return blob ? { key: k, blob, mimeType: 'text/plain', createdAt: '' } : null;
      },
      createObjectURL: (blob) => `blob:${Date.now()}-${Math.random()}`,
      revokeObjectURL: (url) => { revoked.push(url); }
    });
    const [slow, fast] = await Promise.all([loader.resolve('slow'), loader.resolve('fast')]);
    // slow doit être obsolète (ignoré), fast doit être chargé.
    // Aucune URL révoquée car aucune URL n'existait avant (première résolution).
    const pass = slow.status === 'loading' && fast.status === 'loaded' && revoked.length === 0 && fast.url !== undefined;
    res.push({ id: 'IDB-03', name: 'MediaImageLoader: slow ignoré, fast chargé, première résolution sans révocation', passed: pass, expected: 'slow=loading, fast=loaded, revoked=0', actual: `slow=${slow.status}, fast=${fast.status}, revoked=${revoked.length}` });
    loader.reset();
  }

  // IDB-04 : Migration idempotente
  {
    const b = inMemoryBackend();
    const t = createBaseTrial('idb04');
    t.mediaReferences.push(makeRef('r1', t.id, JPEG_KEY));
    t.mediaReferences.push(makeRef('r2', t.id, SVG_KEY));
    let saved = 0;
    const s1 = await runMediaMigration({ backend: b, trials: [t], saveTrial: () => { saved++; } });
    const size1 = b.size;
    const k1 = t.mediaReferences[0].storageKey;
    const k2 = t.mediaReferences[1].storageKey;
    const s2 = await runMediaMigration({ backend: b, trials: [t], saveTrial: () => { saved++; } });
    const pass = s1.migrated === 2 && s1.errors === 0 && s1.remainingLegacy === 0 && s2.migrated === 0 && s2.errors === 0 && s2.remainingLegacy === 0 && b.size === 2 && k1.startsWith('media/') && k2.startsWith('media/') && k1 !== k2;
    res.push({ id: 'IDB-04', name: 'Migration idempotente: run1=2 migrés, run2=0 migrés (déjà fait), 2 blobs', passed: pass, expected: 's1.migrated=2, s2.migrated=0, size=2', actual: `s1=${s1.migrated}/${s1.errors}, s2=${s2.migrated}/${s2.errors}, size=${b.size}, k1=${k1}, k2=${k2}` });
  }

  // IDB-05 : Garbage collection
  {
    const b = inMemoryBackend();
    await b.put(new Blob(['ref']), 'media/ref', 'text/plain');
    await b.put(new Blob(['orphan']), 'media/orphan', 'text/plain');
    const t = createBaseTrial('idb05');
    t.mediaReferences.push(makeRef('r', t.id, 'media/ref'));
    const orphans = await deleteUnreferencedMedia(b, [t]);
    const pass = orphans.length === 1 && orphans[0] === 'media/orphan' && (await b.has('media/ref')) && !(await b.has('media/orphan'));
    res.push({ id: 'IDB-05', name: 'GC: orphelin supprimé, référencé préservé', passed: pass, expected: 'orphans=["media/orphan"]', actual: `orphans=${JSON.stringify(orphans)}` });
  }

  // IDB-06 : stableHash déterministe
  {
    const h1 = stableHash(JPEG_KEY);
    const h2 = stableHash(JPEG_KEY);
    const h3 = stableHash(SVG_KEY);
    const pass = h1 === h2 && h1.length === 16 && h1 !== h3 && /^[0-9a-f]{16}$/.test(h1);
    res.push({ id: 'IDB-06', name: 'stableHash: déterministe, 16 hex, uniques', passed: pass, expected: 'h1===h2, len=16, h1!==h3', actual: `h1=${h1}, h3=${h3}` });
  }

  // IDB-07 : Détection legacy vs clé logique
  {
    const pass = isLegacyStorageKey(JPEG_KEY) && isLegacyStorageKey(SVG_KEY) && !isLegacyStorageKey('media/abc') && !isLegacyStorageKey('photos/test.jpg');
    res.push({ id: 'IDB-07', name: 'isLegacyStorageKey: data:=true, media/:=false', passed: pass, expected: 'jpeg=true, svg=true, media=false, photos=false', actual: `${isLegacyStorageKey(JPEG_KEY)}, ${isLegacyStorageKey(SVG_KEY)}, ${isLegacyStorageKey('media/abc')}, ${isLegacyStorageKey('photos/test.jpg')}` });
  }

  // IDB-08 : put sans MIME lève une erreur
  {
    let threw = false;
    try {
      await inMemoryBackend().put(new Blob([]), 'k', undefined);
    } catch { threw = true; }
    res.push({ id: 'IDB-08', name: 'put sans MIME lève erreur', passed: threw, expected: 'exception', actual: threw ? 'OK' : 'aucune exception' });
  }

  // IDB-09 : overlay (ref archivée + active = même clé, 1 blob)
  {
    const b = inMemoryBackend();
    const t = createBaseTrial('idb09');
    t.mediaReferences.push(makeRef('a', t.id, JPEG_KEY));
    t.mediaReferences.push(makeRef('b', t.id, JPEG_KEY, { status: 'ARCHIVED' }));
    await runMediaMigration({ backend: b, trials: [t], saveTrial: () => {} });
    const ka = t.mediaReferences[0].storageKey;
    const kb = t.mediaReferences[1].storageKey;
    const pass = ka === kb && ka.startsWith('media/') && b.size === 1;
    res.push({ id: 'IDB-09', name: 'Overlay: refs actif/archivé = même clé, 1 seul blob', passed: pass, expected: 'ka===kb, size=1', actual: `ka=${ka}, kb=${kb}, size=${b.size}` });
  }

  // IDB-10 : Migration interrompue reprend
  {
    const b = inMemoryBackend();
    let fail = false;
    const failBackend: MediaStoragePort = {
      async put(file, key, mimeType) {
        if (fail && key.includes(stableHash(JPEG_KEY))) throw new Error('fail');
        return b.put(file, key, mimeType);
      },
      async get(k) { return b.get(k); },
      async delete(k) { return b.delete(k); },
      async has(k) { return b.has(k); },
      async keys() { return b.keys(); }
    };
    const t = createBaseTrial('idb10');
    t.mediaReferences.push(makeRef('r1', t.id, JPEG_KEY));
    t.mediaReferences.push(makeRef('r2', t.id, SVG_KEY));

    fail = true;
    const s1 = await runMediaMigration({ backend: failBackend, trials: [t], saveTrial: () => {} });
    const r1k = t.mediaReferences[0].storageKey;
    const r2k = t.mediaReferences[1].storageKey;

    fail = false;
    const s2 = await runMediaMigration({ backend: failBackend, trials: [t], saveTrial: () => {} });
    const pass = s1.errors === 1 && r1k === JPEG_KEY && r2k.startsWith('media/') && s2.migrated === 1 && b.size === 2;
    res.push({ id: 'IDB-10', name: 'Migration reprise: échec→legacy, reprise→migré', passed: pass, expected: 's1.errors=1, r1=legacy, s2.migrated=1, size=2', actual: `s1=${s1.errors}, r1=${r1k}, r2=${r2k}, s2=${s2.migrated}, size=${b.size}` });
  }

  // IDB-11 : Référence partagée cross-trial = même blob
  {
    const b = inMemoryBackend();
    const t1 = createBaseTrial('idb11a');
    const t2 = createBaseTrial('idb11b');
    t1.mediaReferences.push(makeRef('r1', t1.id, JPEG_KEY));
    t2.mediaReferences.push(makeRef('r2', t2.id, JPEG_KEY));
    await runMediaMigration({ backend: b, trials: [t1, t2], saveTrial: () => {} });
    const pass = t1.mediaReferences[0].storageKey === t2.mediaReferences[0].storageKey && b.size === 1;
    res.push({ id: 'IDB-11', name: 'Cross-trial: même legacy → même clé, 1 seul blob', passed: pass, expected: 'k1===k2, size=1', actual: `k1=${t1.mediaReferences[0].storageKey}, k2=${t2.mediaReferences[0].storageKey}, size=${b.size}` });
  }

  // IDB-12 : sanitizeTrialForExport
  {
    const t = createBaseTrial('idb12');
    t.mediaReferences.push(makeRef('r1', t.id, JPEG_KEY));
    t.mediaReferences.push(makeRef('r2', t.id, 'media/abc.jpg'));
    const s = sanitizeTrialForExport(t);
    const r1 = s.mediaReferences.find((r) => r.id === 'r1');
    const r2 = s.mediaReferences.find((r) => r.id === 'r2');
    const orig = t.mediaReferences[0].storageKey;
    const pass = r1?.storageKey.startsWith('media/') === true && r2?.storageKey === 'media/abc.jpg' && orig === JPEG_KEY;
    res.push({ id: 'IDB-12', name: 'sanitizeTrialForExport: legacy→clé, original intact', passed: pass, expected: 'r1=media/..., r2=media/abc.jpg, original=JPEG_KEY', actual: `r1=${r1?.storageKey}, r2=${r2?.storageKey}, orig=${orig}` });
  }

  const failed = res.filter((r) => !r.passed).length;
  return { summary: { failed, total: res.length, passed: res.length - failed }, results: res };
}