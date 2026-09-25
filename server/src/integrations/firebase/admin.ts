import { env, integrationFlags } from '../../config/env.js';
import { AppError } from '../../core/errors.js';
import { firebaseRest } from './rest.js';

export const firebasePaths = {
  payments: 'payments',
  wallet: 'wallet',
  artifactsJson: 'artifacts/json',
  artifactsTxt: 'artifacts/txt',
  artifactsApk: 'artifacts/apk',
};

export const firebaseApp = {
  configured() {
    return integrationFlags().firebase;
  },
  requireConfigured() {
    if (!this.configured()) {
      throw new AppError(503, 'FIREBASE_NOT_CONFIGURED', 'Firebase storage is unavailable until the project keys are set on the server.');
    }
  },
  projectId() {
    return env.firebaseProjectId;
  },
  async writeJson(objectPath: string, data: unknown) {
    this.requireConfigured();
    const payload = JSON.stringify(data);
    const stored = await firebaseRest.writeObject(`${firebasePaths.artifactsJson}/${objectPath}`, Buffer.from(payload), 'application/json');
    await firebaseRest.writeDocument('artifacts_json', objectPath.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80), {
      path: objectPath,
      json: payload,
      updatedAt: new Date().toISOString(),
    });
    return stored;
  },
  async writeText(objectPath: string, data: string) {
    this.requireConfigured();
    return firebaseRest.writeObject(`${firebasePaths.artifactsTxt}/${objectPath}`, Buffer.from(data), 'text/plain; charset=utf-8');
  },
  async writeBinary(objectPath: string, bytes: Buffer) {
    this.requireConfigured();
    return firebaseRest.writeObject(`${firebasePaths.artifactsApk}/${objectPath}`, bytes, 'application/octet-stream');
  },
  async writePayment(id: string, data: Record<string, unknown>) {
    this.requireConfigured();
    return firebaseRest.writeDocument(firebasePaths.payments, id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },
  async ping() {
    this.requireConfigured();
    return firebaseRest.writeDocument('eiop_meta', 'ping', {
      ok: 'true',
      projectId: env.firebaseProjectId,
      at: new Date().toISOString(),
    });
  },
};
