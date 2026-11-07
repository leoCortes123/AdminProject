/**
 * Puerto de almacenamiento de adjuntos (03 §4.7 / D-014): ningún módulo
 * escribe en disco directamente. En dev, filesystem (`data/uploads`);
 * en prod, S3/MinIO con el mismo contrato (`put/get/delete`).
 */
export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface StoredObject {
  buffer: Buffer;
  contentType: string;
}

export interface StoragePort {
  put(key: string, buffer: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}
