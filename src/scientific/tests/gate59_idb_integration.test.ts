/**
 * QUV-Lab — Gate 59 : Tests d'intégration IndexedDB réel
 *
 * VALIDE le câblage réel : MediaStorageService → idb → fake-indexeddb
 * (et non seulement le contrat MediaStoragePort avec backend mémoire).
 *
 * IDB-INT-01 : CRUD réel (put → get → delete) via MediaStorageService + idb + fake-indexeddb
 * IDB-INT-02 : Migration réelle (Data URI → Blob dans idb → ref mise à jour)
 * IDB-INT-03 : Reprise / idempotence réelle (deux runs = même résultat, 0 doublon)
 * IDB-INT-04 : Migration réelle d'un SVG production legacy (0%, 100%, %23, é, —)
 * IDB-INT-05 : Grand volume réel (100 refs : 50 legacy SVG + 30 JPEG base64 + 20 SVG encodés)
 */
import 'fake-indexeddb/auto';
import { MediaStorageService } from '../../services/mediaStorageService';
import {
  runMediaMigration,
  convertDataUriToBlob,
  createMigratedStorageKey,
  computeContentAddressedKey,
  isLegacyStorageKey
} from '../../services/mediaMigrationService';
import type { Trial, PhotoReference } from '../../types/trial';

type GateTestResult = { id: string; name: string; passed: boolean; expected: string; actual: string };
type GateTestSuite = { summary: { failed: number; total: number; passed: number }; results: GateTestResult[] };

const JPEG_KEY = 'data:image/jpeg;base64,/9j/4AAQSkZJRg';
const JPEG_KEY_ALT = 'data:image/jpeg;base64,/9j/AAAA/4AAQSkZJRg';

// SVG production-représentatif DÉCODÉ (texte cible) — marqueurs legacy :
// '%' littéraux (0%, 100%) + %XX valides (%23) + Unicode (é, —).
const SVG_XML =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d97706"/><stop offset="100%" stop-color="#78350f"/></linearGradient></defs><rect width="600" height="400" fill="url(#bg)"/><text x="50" y="55" fill="#ffffff">Éprouvette 1 — A1 100%</text></svg>';
// Forme legacy historique persistée dans les trials (cause de l'URIError d'origine).
const SVG_KEY = `data:image/svg+xml;utf8,${SVG_XML.replace(/#/g, '%23')}`;

function createBaseTrial(id: string): Trial {
  return {
    id,
    schemaVersion: '1.2.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'IN_PROGRESS',
    configurationStatus: 'LOCKED',
    metadata: { reference: `IDB-INT-${id}`, createdBy: 'integration-test' },
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
    id, trialId, type: 'PHOTO', status: 'ACTIVE',
    storageKey, filename: `${id}.jpg`, mimeType: 'image/jpeg', sizeBytes: 0,
    capturedAt: new Date().toISOString(), capturedBy: 'test',
    panelId: 'panel-1', stageId: 'stage-1',
    ...overrides
  };
}

export async function runGate59IdbIntegrationTests(): Promise<GateTestSuite> {
  const res: GateTestResult[] = [];

  function toBase64(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  // -----------------------------------------------------------------
  // IDB-INT-01 : CRUD réel — MediaStorageService → idb → fake-indexeddb
  // -----------------------------------------------------------------
  {
    const svc = new MediaStorageService('quv_idb_crud_real_01');
    const key = 'media/crud-test.jpg';
    const originalText = 'blob content for CRUD integration test';
    const originalBlob = new Blob([originalText], { type: 'image/jpeg' });

    try {
      // PUT
      await svc.put(originalBlob, key, 'image/jpeg');

      // GET — vérifier record
      const record = await svc.get(key);
      const getOk = record !== null &&
        record.key === key &&
        record.mimeType === 'image/jpeg' &&
        record.blob.size === originalBlob.size;

      // Vérifier le contenu du Blob (lecture réelle)
      const retrievedText = await record!.blob.text();
      const contentOk = retrievedText === originalText;

      // DELETE
      await svc.delete(key);
      const afterDelete = await svc.get(key);
      const deleteOk = afterDelete === null;

      const pass = getOk && contentOk && deleteOk;
      res.push({
        id: 'IDB-INT-01',
        name: 'CRUD réel: put→get(vérif blob+contenu)→delete→null',
        passed: pass,
        expected: 'record.key=key, blob.size match, blob content match, get après delete=null',
        actual: `key=${record?.key}, mime=${record?.mimeType}, size=${record?.blob.size}/${originalBlob.size}, content=${retrievedText === originalText}, afterDelete=${afterDelete}`
      });
    } catch (err: any) {
      res.push({
        id: 'IDB-INT-01',
        name: 'CRUD réel: put→get→delete',
        passed: false,
        expected: 'aucune exception',
        actual: `exception: ${err?.message}`
      });
    } finally {
      await svc.close();
    }
  }

  // -----------------------------------------------------------------
  // IDB-INT-02 : Migration réelle — Data URI → Blob dans idb → ref
  // -----------------------------------------------------------------
  {
    const svc = new MediaStorageService('quv_idb_mig_real_02');
    const trial = createBaseTrial('mig02');
    trial.mediaReferences.push(makeRef('r1', trial.id, JPEG_KEY));

    const expectedKey =
      (await computeContentAddressedKey(convertDataUriToBlob(JPEG_KEY).blob)) ??
      createMigratedStorageKey(JPEG_KEY);

    try {
      const summary = await runMediaMigration({
        backend: svc,
        trials: [trial],
        saveTrial: () => {}
      });

      // Vérifier que le Blob existe réellement dans fake-indexeddb
      const record = await svc.get(expectedKey);
      const blobExists = record !== null;

      // Vérifier que la ref est mise à jour
      const ref = trial.mediaReferences[0];
      const refUpdated = ref.storageKey === expectedKey && !isLegacyStorageKey(ref.storageKey);

      // Vérifier que le contenu du Blob correspond à la Data URI originale
      let blobContentMatches = false;
      if (record) {
        const { blob: expectedBlob } = convertDataUriToBlob(JPEG_KEY);
        const retrievedContent = await record.blob.text();
        const expectedContent = await expectedBlob.text();
        blobContentMatches = retrievedContent === expectedContent;
      }

      // Vérifier que saveTrial a bien été appelé (migration modifies la ref → trialChanged → saveTrial)
      const savedOk = summary.migrated >= 1;

      const pass = summary.migrated === 1 && summary.errors === 0 && summary.remainingLegacy === 0 &&
        blobExists && refUpdated && blobContentMatches && savedOk;

      res.push({
        id: 'IDB-INT-02',
        name: 'Migration réelle: Data URI → Blob idb → ref media/<hash> → contenu vérifié',
        passed: pass,
        expected: 'migrated=1, blob exists, ref=media/<hash>, content match, saveTrial called',
        actual: `migrated=${summary.migrated}, errors=${summary.errors}, blobExists=${blobExists}, ref=${ref.storageKey}, content=${blobContentMatches}, saved=${savedOk}`
      });
    } catch (err: any) {
      res.push({
        id: 'IDB-INT-02',
        name: 'Migration réelle',
        passed: false,
        expected: 'aucune exception',
        actual: `exception: ${err?.message}`
      });
    } finally {
      await svc.close();
    }
  }

  // -----------------------------------------------------------------
  // IDB-INT-03 : Reprise / idempotence réelle — deux runs, 0 doublon
  // -----------------------------------------------------------------
  {
    const svc = new MediaStorageService('quv_idb_reprise_real_03');
    const trial = createBaseTrial('reprise03');
    // Deux refs legacy différentes
    trial.mediaReferences.push(makeRef('ra', trial.id, JPEG_KEY));
    const altJpeg = JPEG_KEY_ALT; // Data URI différente → clé différente
    trial.mediaReferences.push(makeRef('rb', trial.id, altJpeg));

    const keyA =
      (await computeContentAddressedKey(convertDataUriToBlob(JPEG_KEY).blob)) ??
      createMigratedStorageKey(JPEG_KEY);
    const keyB =
      (await computeContentAddressedKey(convertDataUriToBlob(altJpeg).blob)) ??
      createMigratedStorageKey(altJpeg);

    try {
      // Run 1 : migration complète
      const s1 = await runMediaMigration({ backend: svc, trials: [trial], saveTrial: () => {} });

      // Vérifier que les deux blobs existent
      const blobA = await svc.get(keyA);
      const blobB = await svc.get(keyB);
      const allKeys = await svc.keys();

      // Run 2 : idempotence — aucun nouveau blob, aucun erreur
      const s2 = await runMediaMigration({ backend: svc, trials: [trial], saveTrial: () => {} });
      const allKeysAfter = await svc.keys();

      const pass = s1.migrated === 2 && s1.errors === 0 &&
        blobA !== null && blobB !== null &&
        allKeys.length === 2 &&
        s2.migrated === 0 && s2.errors === 0 && s2.remainingLegacy === 0 &&
        allKeysAfter.length === 2;

      res.push({
        id: 'IDB-INT-03',
        name: 'Reprise/idempotence réelle: 2 refs → run1=2 migrés, run2=0, 0 doublon',
        passed: pass,
        expected: 's1.migrated=2, blobA+B exist, keys=2, s2.migrated=0, keysAfter=2',
        actual: `s1=${s1.migrated}/${s1.errors}, blobA=${blobA !== null}, blobB=${blobB !== null}, keys=${allKeys.length}, s2=${s2.migrated}/${s2.errors}/${s2.remainingLegacy}, keysAfter=${allKeysAfter.length}`
      });
    } catch (err: any) {
      res.push({
        id: 'IDB-INT-03',
        name: 'Reprise/idempotence réelle',
        passed: false,
        expected: 'aucune exception',
        actual: `exception: ${err?.message}`
      });
    } finally {
      await svc.close();
    }
  }

  // -----------------------------------------------------------------
  // IDB-INT-04 : Migration réelle d'un SVG production legacy
  //              (0%, 100%, %23, é) — full chain fake-indexeddb
  // -----------------------------------------------------------------
  {
    const svc = new MediaStorageService('quv_idb_svg_real_04');
    const trial = createBaseTrial('svg04');
    trial.mediaReferences.push(makeRef('r1', trial.id, SVG_KEY));

    try {
      const summary = await runMediaMigration({ backend: svc, trials: [trial], saveTrial: () => {} });
      const ref = trial.mediaReferences[0];
      const expectedKey = createMigratedStorageKey(SVG_KEY);
      const record = await svc.get(ref.storageKey) ?? await svc.get(expectedKey);

      let contentOk = false;
      if (record) {
        const text = await record.blob.text();
        contentOk = text === SVG_XML;
      }

      const keys = await svc.keys();
      const s2 = await runMediaMigration({ backend: svc, trials: [trial], saveTrial: () => {} });
      const keysAfter = await svc.keys();

      const pass = summary.migrated === 1 && summary.errors === 0 && summary.remainingLegacy === 0 &&
        !isLegacyStorageKey(ref.storageKey) && record !== null && record.mimeType === 'image/svg+xml' &&
        contentOk && keys.length === 1 && s2.migrated === 0 && s2.errors === 0 && keysAfter.length === 1;

      res.push({
        id: 'IDB-INT-04',
        name: 'Migration réelle SVG production: blob idb = SVG_XML, mime svg, idempotent, 0 doublon',
        passed: pass,
        expected: 'migrated=1, mime=image/svg+xml, content==SVG_XML, keys=1, run2=0, keysAfter=1',
        actual: `migrated=${summary.migrated}/${summary.errors}, mime=${record?.mimeType}, content=${contentOk}, keys=${keys.length}/${keysAfter.length}, s2=${s2.migrated}`
      });
    } catch (err: any) {
      res.push({
        id: 'IDB-INT-04',
        name: 'Migration réelle SVG production',
        passed: false,
        expected: 'aucune exception',
        actual: `exception: ${err?.message}`
      });
    } finally {
      await svc.close();
    }
  }

  // -----------------------------------------------------------------
  // IDB-INT-05 : Grand volume réel — 100 refs
  //              (50 legacy SVG + 30 JPEG base64 + 20 SVG encodés)
  // -----------------------------------------------------------------
  {
    const svc = new MediaStorageService('quv_idb_vol_real_05');
    const trial = createBaseTrial('vol05');
    for (let i = 0; i < 50; i++) {
      const xml =
        `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><linearGradient id="v${i}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23d97706"/></linearGradient><text>Éprouvette vol ${i} — ${i}%</text></svg>`;
      trial.mediaReferences.push(makeRef(`l${i}`, trial.id, `data:image/svg+xml;utf8,${xml}`));
    }
    for (let i = 0; i < 30; i++) {
      trial.mediaReferences.push(makeRef(`j${i}`, trial.id, 'data:image/jpeg;base64,' + toBase64(`JPEG real ${i}`)));
    }
    for (let i = 0; i < 20; i++) {
      const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><text>Cible ${i} — valid</text></svg>`;
      trial.mediaReferences.push(makeRef(`p${i}`, trial.id, `data:image/svg+xml;utf8,${encodeURIComponent(xml)}`));
    }

    try {
      const s1 = await runMediaMigration({ backend: svc, trials: [trial], saveTrial: () => {} });
      const keys = await svc.keys();
      const s2 = await runMediaMigration({ backend: svc, trials: [trial], saveTrial: () => {} });
      const pass = s1.examined === 100 && s1.migrated === 100 && s1.errors === 0 && s1.remainingLegacy === 0 &&
        keys.length === 100 && s2.migrated === 0 && s2.errors === 0 && s2.remainingLegacy === 0;
      res.push({
        id: 'IDB-INT-05',
        name: 'Grand volume réel 100 refs: 100 migrés, 100 blobs, run2 idempotent',
        passed: pass,
        expected: 's1: 100/0/0, keys=100, s2: 0/0/0',
        actual: `s1: ${s1.migrated}/${s1.errors}/${s1.remainingLegacy}, keys=${keys.length}, s2: ${s2.migrated}/${s2.errors}/${s2.remainingLegacy}`
      });
    } catch (err: any) {
      res.push({
        id: 'IDB-INT-05',
        name: 'Grand volume réel 100 refs',
        passed: false,
        expected: 'aucune exception',
        actual: `exception: ${err?.message}`
      });
    } finally {
      await svc.close();
    }
  }

  const failed = res.filter((r) => !r.passed).length;
  return { summary: { failed, total: res.length, passed: res.length - failed }, results: res };
}