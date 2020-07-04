import { Logger, Token, TokenFilter } from '@verdaccio/types';
import { IHandyRedis } from 'handy-redis';

import { PackageStat } from '../types';

import { REDIS_KEY, wrapError, REDIS_FIELD } from './utils';

/**
 * Database of Verdaccio. It's actually pretty simple as it only contains a secret
 * and a list of packages stored in Verdaccio.
 */
export default class Database {
  private redisClient: IHandyRedis;
  private logger: Logger;

  public constructor(redisClient: IHandyRedis, logger: Logger) {
    this.redisClient = redisClient;
    this.logger = logger;
  }

  /**
   * Get the secret from the database
   */
  public async getSecret(): Promise<string> {
    try {
      this.logger.debug({}, '[verdaccio/redis] getSecret');
      const secret = await this.redisClient.get(REDIS_KEY.secret);
      return secret || '';
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Update the secret in the database
   *
   * @param secret
   */
  public async setSecret(secret: string): Promise<void> {
    try {
      this.logger.debug({}, '[verdaccio/redis] setSecret');
      await this.redisClient.set(REDIS_KEY.secret, secret);
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Search for packages based on the validation function
   *
   * @param validate
   */
  public async search(validate: (name: string) => boolean): Promise<string[]> {
    try {
      this.logger.debug({ name }, '[verdaccio/redis] db.search for @{name}');
      const packages = await this.get();
      const result = packages.filter(validate);
      return result;
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Get stat object for package name
   *
   * @param name
   */
  public async getStat(name: string): Promise<PackageStat> {
    try {
      this.logger.debug({ name }, '[verdaccio/redis] db.getStat for @{name}');
      const result = await this.redisClient.hget(REDIS_KEY.package + name, REDIS_FIELD.stat);
      if (result === null) {
        return {
          name,
          time: 0,
          path: name,
        };
      }
      const stat = JSON.parse(result) as PackageStat;
      stat.name = name;
      return stat;
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Set stat object for package name
   *
   * @param name
   */
  public async setStat(name: string): Promise<void> {
    try {
      this.logger.debug({ name }, '[verdaccio/redis] db.setStat for @{name}');
      const stat: PackageStat = {
        name,
        path: name,
        time: new Date().getTime(),
      };
      const data = JSON.stringify(stat);
      await this.redisClient.hset(REDIS_KEY.package + name, REDIS_FIELD.stat, data);
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Get all the packages in the database
   */
  public async get(): Promise<string[]> {
    try {
      this.logger.debug({}, '[verdaccio/redis] get');
      const result: string[] = await this.redisClient.smembers(REDIS_KEY.packages);
      return result;
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Add the given package to the database
   *
   * @param name
   */
  public async add(name: string): Promise<void> {
    try {
      this.logger.debug({ name }, '[verdaccio/redis] add @{name}');
      await this.redisClient.sadd(REDIS_KEY.packages, name);
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Remove the given package from the database
   *
   * @param name
   */
  public async remove(name: string): Promise<void> {
    try {
      this.logger.debug({ name }, '[verdaccio/redis] remove @{name}');
      await this.redisClient.srem(REDIS_KEY.packages, name);
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Save token to the database
   *
   * @param name
   */
  public async saveToken(token: Token): Promise<void> {
    try {
      const tokenId = `${token.user}:${token.key}`;
      this.logger.debug({ tokenId }, '[verdaccio/redis] saveToken @{tokenId}');
      const key = REDIS_KEY.token + token.user;
      const data = JSON.stringify(token);
      await this.redisClient.hset(key, token.key, data);
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Delete token from the database
   *
   * @param name
   */
  public async deleteToken(user: string, tokenKey: string): Promise<void> {
    try {
      const tokenId = `${user}:${tokenKey}`;
      this.logger.debug({ tokenId }, '[verdaccio/redis] deleteToken @{tokenId}');
      const key = REDIS_KEY.token + user;
      await this.redisClient.hdel(key, tokenKey);
    } catch (err) {
      throw wrapError(err);
    }
  }

  /**
   * Read tokens from the database
   *
   * @param name
   */
  public async readTokens(filter: TokenFilter): Promise<Token[]> {
    try {
      const user = filter.user;
      this.logger.debug({ user }, '[verdaccio/redis] readTokens for @{user}');
      const key = REDIS_KEY.token + user;
      const result = await this.redisClient.hgetall(key);
      if (result === null) {
        return [];
      }
      return Object.values(result).map(x => {
        return JSON.parse(x as string);
      });
    } catch (err) {
      throw wrapError(err);
    }
  }
}
