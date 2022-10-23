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
    this.createIndex();
  }

  public async createIndex() {
    try {
      await this.redisClient.call("FT.CREATE", "ve-pkg-stat-idx", "ON", "HASH", "PREFIX", "1", "ve:pkg:", "SCHEMA", "stat", "TEXT");
      const result: any = await this.redisClient.call('FT.INFO', 've-pkg-stat-idx');
      this.logger.debug({ indexName: result[1] }, "index @{indexName} is ready");
    } catch (error) {
    }
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
      .then(() => {
        onEnd(null);
      })
      .catch(err => {
        onEnd(err);
      });
  }

  /**
   * Search api implementation for verdaccio-redis-search-patch and verdaccio@6
   * @param query
   */
  public async searchV1(query): Promise<any> {
    this.logger.debug({ query }, "searchV1 query: @{query}");
    // Redis-search treats hyphen as separator, refs https://forum.redis.com/t/query-with-dash-is-treated-as-negation/119
    const text = (query.text || "").replace(/-/g, ' ').trim();
    if (!text) return [];
    // const offset = query.from || 0;
    // const num = query.size || 250;
    try {
      const result: any = await this.redisClient.call("FT.SEARCH", "ve-pkg-stat-idx", text, "return", "1", "stat");
      // const result: any = await this.redisClient.call("FT.SEARCH", "ve-pkg-stat-idx", text, "return", "1", "stat", "LIMIT", String(offset), String(num));
      const searchResult: any = [];
      if (result.length <= 1) return [];
      for (let i = 2; i < result.length; i += 2) {
        const stat = JSON.parse(result[i][1]);
        searchResult.push({
          package: {
            name: stat.name,
            path: stat.path,
            time: Number(stat.time)
          },
          score: {
            final: 0,
            detail: {
              quality: 0,
              popularity: 0,
              maintenance: 0,
            }
          },
        });
      }
      this.logger.debug({ searchResult }, "searchResult: @{searchResult}");
      return searchResult;
    } catch (error) {
      this.logger.error(error, "searchV1 error: @{error}");
      return [];
    }
  }

  /**
   * Get the stat object to feed onSearchPackage callback. A stat object is an index-like object with less memory and bandwidth cost.
   * @param name
   * @param onPackage
   */
  private async getStat(name: string, onPackage: onSearchPackage): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stat: any = await this.db.getStat(name);
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
