import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { StoragePort, StoredObject } from './storage.port';
import { contentTypeForKey } from './filesystem.storage';

/**
 * Implementación S3/MinIO (prod): mismo contrato que FS, sin tocar disco.
 * Config por env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`,
 * `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. `S3_FORCE_PATH_STYLE=1`
 * para MinIO/self-host (por defecto, true si hay endpoint custom).
 */
@Injectable()
export class S3Storage implements StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    this.bucket = process.env.S3_BUCKET ?? 'devcycle-attachments';
    this.client = new S3Client({
      region: process.env.S3_REGION ?? 'us-east-1',
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1' || Boolean(endpoint),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'devcycle',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'devcycle',
      },
    });
  }

  async put(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ContentLength: buffer.length,
      }),
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) return null;
      const buffer = Buffer.from(await response.Body.transformToByteArray());
      return { buffer, contentType: contentTypeForKey(key) };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
