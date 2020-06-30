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
import { IHandyRedis } from 'handy-redis';

import { RedisConfig } from '../types/index';

import PackageStorage from './PackageStorage';
import { REDIS_KEY, redisCreateClient } from './utils';
import Database from './db';

export default class RedisStorage implements IPluginStorage<RedisConfig> {
  public config: RedisConfig & Config;
  public version?: string;
  public logger: Logger;
  public redisClient: IHandyRedis;
  public db: Database;

  public constructor(config: RedisConfig, options: PluginOptions<RedisConfig>) {
    this.config = config;
    this.logger = options.logger;
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
    this.db
      .search(validateName)
      .then(pkgs => Promise.all(pkgs.map(pkg => this.getStat(pkg, onPackage))))
      .then(() => onEnd(null))
      .catch(err => onEnd(err));
  }

  private async getStat(name: string, onPackage: Callback): Promise<void> {
    const stat = await this.db.getStat(name);
    onPackage(stat);
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
