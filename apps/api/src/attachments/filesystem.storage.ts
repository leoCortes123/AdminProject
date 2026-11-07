import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import type { StoragePort, StoredObject } from './storage.port';

/**
 * Implementación FS (dev): espejo local de S3 bajo `UPLOADS_DIR`
 * (defecto `apps/api/data/uploads`, ignorado en git). La clave se
 * sanea contra path-traversal (`..`, absolutos, backslashes).
 */
@Injectable()
export class FileSystemStorage implements StoragePort {
  private readonly root: string;

  constructor() {
    const dir = process.env.UPLOADS_DIR ?? resolve(process.cwd(), 'data', 'uploads');
    this.root = resolve(dir);
  }

  private pathFor(key: string): string {
    if (/^[a-zA-Z]:/.test(key) || key.startsWith('/') || key.includes('..') || key.includes('\\')) {
      throw new Error(`storage_key no permitida: ${key}`);
    }
    const full = normalize(join(this.root, key));
    if (!full.startsWith(this.root)) throw new Error(`storage_key fuera de raíz: ${key}`);
    return full;
  }

  async put(key: string, buffer: Buffer): Promise<void> {
    const full = this.pathFor(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, buffer);
  }

  async get(key: string): Promise<StoredObject | null> {
    const full = this.pathFor(key);
    try {
      const buffer = await readFile(full);
      return { buffer, contentType: contentTypeForKey(key) };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}

export function contentTypeForKey(key: string): string {
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.svg')) return 'image/svg+xml';
  if (key.endsWith('.pdf')) return 'application/pdf';
  if (key.endsWith('.md')) return 'text/markdown';
  if (key.endsWith('.csv')) return 'text/csv';
  if (key.endsWith('.json')) return 'application/json';
  if (key.endsWith('.txt') || key.endsWith('.log')) return 'text/plain';
  return 'application/octet-stream';
}
