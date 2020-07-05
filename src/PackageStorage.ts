import { Readable } from 'stream';

import {
  Logger,
  ILocalPackageManager,
  StorageUpdateCallback,
  PackageTransformer,
  StorageWriteCallback,
  CallbackAction,
  Package,
  ReadPackageCallback,
} from '@verdaccio/types';
import { UploadTarball, ReadTarball } from '@verdaccio/streams';
import { getNotFound, getConflict, getBadData, getBadRequest } from '@verdaccio/commons-api';
import { IHandyRedis } from 'handy-redis';
import { ClientOpts } from 'redis';

import { REDIS_KEY, wrapError, bufferStreamToBase64String } from './utils';
import Database from './db';

export const PKG_FILE_NAME = 'package.json';

export default class StoragePluginManager implements ILocalPackageManager {
  public logger: Logger;
  public packageName: string;
  public config: ClientOpts;
  public redisClient: IHandyRedis;
  public db: Database;

  public constructor(config: ClientOpts, packageName: string, logger: Logger, redisClient: IHandyRedis, db: Database) {
    this.logger = logger;
    this.packageName = packageName;
    this.config = config;
    this.redisClient = redisClient;
    this.db = db;
  }

  /**
   * Handle a metadata update and
   * @param pkgName
   * @param updateHandler
   * @param onWrite
   * @param transformPackage
   * @param callback
   */
  public updatePackage(
    pkgName: string,
    updateHandler: StorageUpdateCallback,
    onWrite: StorageWriteCallback,
    transformPackage: PackageTransformer,
    callback: CallbackAction
  ): void {
    this.logger.debug({ pkgName }, '[verdaccio/redis] createPackage @{pkgName}');
    const key = REDIS_KEY.package + pkgName;
    this.redisClient
      .hget(key, PKG_FILE_NAME)
      .then(data => {
        // Check existence
        if (data === null) {
          callback(getNotFound(`package ${pkgName}'s package.json not found`));
          return;
        }
        // Parse JSON
        let parsed: Package | null = null;
        try {
          parsed = JSON.parse(data as string) as Package;
        } catch (err) {
          callback(getBadData(`package ${pkgName}'s package.json is not a valid JSON`));
          return;
        }
        const pkg = parsed as Package;
        // Update package
        updateHandler(pkg, err => {
          if (err) {
            callback(wrapError(err));
            return;
          }
          const next = transformPackage(pkg);
          onWrite(pkgName, next, callback);
        });
      })
      .catch(err => callback(wrapError(err)));
  }

  /**
   * Delete a specific file (tarball or package.json)
   * @param fileName
   * @param callback
   */
  public deletePackage(fileName: string, callback: CallbackAction): void {
    this.deletePackageAsync(fileName)
      .then(() => callback(null))
      .catch(err => callback(err));
  }

  private async deletePackageAsync(fileName: string): Promise<void> {
    try {
      const pkgName = this.packageName;
      this.logger.debug({ pkgName, fileName }, '[verdaccio/redis] deletePackage @{pkgName}/@{fileName}');
      const key = REDIS_KEY.package + pkgName;
      await this.redisClient.hdel(key, fileName);
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Delete a package (folder, path)
   * This happens after all versions ar tarballs have been removed.
   * @param callback
   */
  public removePackage(callback: CallbackAction): void {
    this.removePackageAsync()
      .then(() => callback(null))
      .catch(err => callback(err));
  }

  private async removePackageAsync(): Promise<void> {
    try {
      const pkgName = this.packageName;
      this.logger.debug({ pkgName }, '[verdaccio/redis] removePackage @{pkgName}');
      const key = REDIS_KEY.package + pkgName;
      await this.redisClient.del(key);
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Publish a new package (version).
   * @param pkgName
   * @param pkg
   * @param callback
   */
  public createPackage(pkgName: string, pkg: Package, callback: CallbackAction): void {
    this.createPackageAsync(pkgName, pkg)
      .then(() => callback(null))
      .catch(err => callback(err));
  }

  private async createPackageAsync(pkgName: string, pkg: Package): Promise<void> {
    try {
      this.logger.debug({ pkgName }, '[verdaccio/redis] createPackage @{pkgName}');
      const key = REDIS_KEY.package + pkgName;
      // Check exist package
      const data = await this.redisClient.hget(key, PKG_FILE_NAME);
      if (data !== null) {
        throw getConflict(`package ${pkgName} already exist`);
      }
      await this.savePackageAsync(pkgName, pkg);
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Perform write an object to the storage.
   * Similar to updatePackage but without middleware handlers
   * @param pkgName package name
   * @param pkg package metadata
   * @param callback
   */
  public savePackage(pkgName: string, pkg: Package, callback: CallbackAction): void {
    this.savePackageAsync(pkgName, pkg)
      .then(() => callback(null))
      .catch(err => callback(err));
  }

  private async savePackageAsync(pkgName: string, pkg: Package): Promise<void> {
    try {
      this.logger.debug({ pkgName }, '[verdaccio/redis] savePackage @{pkgName}');
      const key = REDIS_KEY.package + pkgName;
      const data = JSON.stringify(pkg);
      await this.redisClient.hset(key, PKG_FILE_NAME, data);
      await this.db.setStat(pkgName);
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Read a package from storage
   * @param pkgName package name
   * @param callback
   */
  public readPackage(pkgName: string, callback: ReadPackageCallback): void {
    this.readPackageAsync(pkgName)
      .then(pkg => callback(null, pkg))
      .catch(err => callback(err));
  }

  public async readPackageAsync(pkgName: string): Promise<Package> {
    try {
      this.logger.debug({ pkgName }, '[verdaccio/redis] readPackage @{pkgName}');
      const key = REDIS_KEY.package + pkgName;
      const data = await this.redisClient.hget(key, PKG_FILE_NAME);
      if (data === null) {
        throw getNotFound(`package ${pkgName}'s package.json not found`);
      }
      try {
        const pkg = JSON.parse(data) as Package;
        return pkg;
      } catch (err) {
        throw getBadData(`package ${pkgName}'s package.json is not a valid JSON`);
      }
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Create writtable stream (write a tarball)
   * @param fileName
   */
  public writeTarball(fileName: string): UploadTarball {
    const pkgName = this.packageName;
    this.logger.debug({ pkgName, fileName }, '[verdaccio/redis] writeTarball @{pkgName}/@{fileName}');
    const uploadTarball = new UploadTarball({});
    const key = REDIS_KEY.package + pkgName;
    this.redisClient
      .hget(key, fileName)
      .then(value => {
        if (value === null || value === '') {
          bufferStreamToBase64String(uploadTarball)
            .then(data => {
              this.redisClient
                .hset(key, fileName, data)
                .then(() => {
                  uploadTarball.emit('success');
                })
                .catch(err => {
                  uploadTarball.emit('error', wrapError(err));
                });
            })
            .catch(err => {
              uploadTarball.emit('error', wrapError(err));
            });
        } else {
          uploadTarball.emit('error', getConflict(`tarball ${pkgName}/${fileName} already exist`));
        }
      })
      .catch(err => {
        uploadTarball.emit('error', wrapError(err));
      });

    return uploadTarball;
  }

  /**
   * Create a readable stream (read a from a tarball)
   * @param fileName
   */
  public readTarball(fileName: string): ReadTarball {
    const pkgName = this.packageName;
    this.logger.debug({ pkgName, fileName }, '[verdaccio/redis] readTarball @{pkgName}/@{fileName}');
    const readTarball: ReadTarball = new ReadTarball({});
    const key = REDIS_KEY.package + pkgName;
    this.redisClient
      .hget(key, fileName)
      .then(data => {
        if (data === null) {
          readTarball.emit('error', getNotFound(`tarball ${pkgName}/${fileName} not found`));
          return;
        }
        const buf = Buffer.from(data, 'base64');
        const readable = Readable.from([buf]);
        readTarball.emit('content-length', buf.length);
        readTarball.emit('open');
        readable.pipe(readTarball);
        readable.on('error', err => {
          readTarball.emit('error', wrapError(err));
        });
        readTarball.abort = function(): void {
          readable.destroy(getBadRequest(`tarball ${pkgName}/${fileName} read has been aborted`));
        };
      })
      .catch(err => {
        readTarball.emit('error', wrapError(err));
      });
    return readTarball;
  }
}
