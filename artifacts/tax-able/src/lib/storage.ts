import { Readable } from "stream";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { Client } from "@replit/object-storage";

export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type StoredObject = {
  stream: ReadableStream<Uint8Array>;
  contentLength?: number;
};

export interface StorageDriver {
  putObject(input: PutObjectInput): Promise<void>;
  getObjectStream(key: string): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  objectKey(organisationId: string, documentId: string, filename: string): string;
}

function sanitizeFilename(filename: string): string {
  const fallback = "document";
  const sanitized = filename
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
  return sanitized || fallback;
}

function toWebStream(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;
}

class FileSystemStorageDriver implements StorageDriver {
  private root = path.join(process.cwd(), "uploads");

  objectKey(organisationId: string, documentId: string, filename: string): string {
    return `orgs/${organisationId}/documents/${documentId}/${sanitizeFilename(filename)}`;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    const target = path.join(this.root, input.key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.body);
  }

  async getObjectStream(key: string): Promise<StoredObject> {
    const buffer = await readFile(path.join(this.root, key));
    return {
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(buffer));
          controller.close();
        },
      }),
      contentLength: buffer.byteLength,
    };
  }

  async deleteObject(key: string): Promise<void> {
    await rm(path.join(this.root, key), { force: true });
  }
}

class ReplitObjectStorageDriver implements StorageDriver {
  private client = new Client();

  objectKey(organisationId: string, documentId: string, filename: string): string {
    return `orgs/${organisationId}/documents/${documentId}/${sanitizeFilename(filename)}`;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    await this.client.uploadFromStream(input.key, Readable.from(input.body));
  }

  async getObjectStream(key: string): Promise<StoredObject> {
    const stream = this.client.downloadAsStream(key);
    return { stream: toWebStream(stream) };
  }

  async deleteObject(key: string): Promise<void> {
    const result = await this.client.delete(key);
    if (!result.ok) throw new Error(`Object storage delete failed: ${result.error.message}`);
  }
}

export function getStorageDriver(): StorageDriver {
  if (process.env.STORAGE_DRIVER === "replit") return new ReplitObjectStorageDriver();
  return new FileSystemStorageDriver();
}

export function documentContentType(fileType: string): string {
  return fileType === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
