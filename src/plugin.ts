import {
  Logger,
  Callback,
  IPluginStorage,
  PluginOptions,
  IPackageStorage,
  TokenFilter,
  Token,
  Config,
  onEndSearchPackage,
  onSearchPackage,
  onValidatePackage,
} from '@verdaccio/types';
import Redis from "ioredis";

import { RedisConfig } from '../types/index';

import PackageStorage from './PackageStorage';
import { REDIS_KEY, redisCreateClient } from './utils';
import Database from './db';

export default class RedisStorage implements IPluginStorage<RedisConfig> {
  public config: RedisConfig & Config;
  public version?: string;
  public logger: Logger;
  public redisClient: Redis;
  public db: Database;

  public constructor(config: RedisConfig, options: PluginOptions<RedisConfig>, redisClient?: Redis) {
    this.config = config;
    this.logger = options.logger;
    if (redisClient !== undefined)
      this.redisClient = redisClient;
    else
      this.redisClient = redisCreateClient(this.config, this.logger);
    this.db = new Database(this.redisClient, this.logger);
  }

  public async getSecret(): Promise<string> {
    return this.db.getSecret();
  }

  public async setSecret(secret: string): Promise<any> {
    return await this.redisClient.set(REDIS_KEY.secret, secret);
  }

  /**
   * Add a new element.
   * @param {*} name
   * @return {Error|*}
   */
  public add(name: string, callback: Callback): void {
    this.db
      .add(name)
      .then(() => callback(null))
      .catch(err => callback(err));
  }

  /**
   * Perform a search in your registry
   * @param onPackage
   * @param onEnd
   * @param validateName
   */
  public search(onPackage: onSearchPackage, onEnd: onEndSearchPackage, validateName: onValidatePackage): void {
    this.logger.trace({}, '[verdaccio/redis] RedisStorage.search');
    this.db
      .search(validateName)
      .then(pkgs => Promise.all(pkgs.map(pkg => this.getStat(pkg, onPackage))))
      .then(() => {
        // this.logger.trace({}, '[verdaccio/redis] RedisStorage.search onEnd');
        onEnd(null);
      })
      .catch(err => {
        // this.logger.trace({ err }, '[verdaccio/redis] RedisStorage.search onEnd with error: @{err}');
        onEnd(err);
      });
  }

  /**
   * Get the stat object to feed onSearchPackage callback. A stat object is an index-like object with less memory and bandwidth cost.
   * @param name
   * @param onPackage
   */
  private async getStat(name: string, onPackage: onSearchPackage): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stat: any = await this.db.getStat(name);
    // this.logger.trace({ name, stat }, '[verdaccio/redis] RedisStorage.getStat @{name} result: @{stat}');
    return new Promise((resolve, reject) => {
      onPackage(stat, err => {
        // this.logger.error({ err }, '[verdaccio/redis] RedisStorage.getStat onPackage callback @{err}');
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Remove an element from the database.
   * @param {*} name
   * @return {Error|*}
   */
  public remove(name: string, callback: Callback): void {
    this.db
      .remove(name)
      .then(() => callback(null))
      .catch(err => callback(err));
  }

  /**
   * Return all database elements.
   * @return {Array}
   */
  public get(callback: Callback): void {
    this.db
      .get()
      .then(packages => callback(null, packages))
      .catch(err => callback(err));
  }

  /**
   * Create an instance of the `PackageStorage`
   * @param packageName
   */
  public getPackageStorage(packageName: string): IPackageStorage {
    return new PackageStorage(this.config, packageName, this.logger, this.redisClient, this.db);
  }

  /**
   * All methods for npm token support
   * more info here https://github.com/verdaccio/verdaccio/pull/1427
   */

  public saveToken(token: Token): Promise<void> {
    return this.db.saveToken(token);
  }

  public deleteToken(user: string, tokenKey: string): Promise<void> {
    return this.db.deleteToken(user, tokenKey);
  }

  public readTokens(filter: TokenFilter): Promise<Token[]> {
    return this.db.readTokens(filter);
  }
}
