import fs from 'fs';
import path from 'path';

import log from 'loglevel';
import { Command } from 'commander';
import { ClientOpts } from 'redis';
import { Logger } from '@verdaccio/types';
import mkdirp from 'mkdirp';
import { IHandyRedis } from 'handy-redis';

import PackageStorage, { PKG_FILE_NAME } from './PackageStorage';
import { parseConfigFile, redisCreateClient, REDIS_KEY } from './utils';
import Database from './db';

const VERDACCIO_DB_FILE = '.verdaccio-db.json';

log.setDefaultLevel('info');

/**
 * Parse redis config from command options
 * @param cmd
 */
function parseRedisConfig(cmd: Command): ClientOpts {
  if (cmd.parent.config) {
    const config = parseConfigFile(cmd.parent.config);
    log.info(`Load configuration at ${cmd.parent.config}`);
    if (config.store) {
      if (config.store['redis-storage']) {
        // parse store.redis-storage
        return config.store['redis-storage'];
      } else if (
        // parse store.storage-proxy.backends.redis-storage
        config.store['storage-proxy'] &&
        config.store['storage-proxy']['backends'] &&
        config.store['storage-proxy']['backends']['redis-storage']
      ) {
        return config.store['storage-proxy']['backends']['redis-storage'];
      }
    }
    // return empty config
    return {};
  } else {
    return {
      host: cmd.parent.host,
      port: cmd.parent.port ? parseInt(cmd.parent.port) : undefined,
      path: cmd.parent.socket,
      url: cmd.parent.url,
      db: cmd.parent.db,
      password: cmd.parent.password,
      prefix: cmd.parent.prefix,
    };
  }
}

/**
 * Return a muted logger
 */
function getMutedLogger(): Logger {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const mute = (): void => {};
  const wrapper: Logger = {
    warn: mute,
    error: mute,
    info: mute,
    debug: mute,
    child: mute,
    http: mute,
    trace: mute,
  };
  return wrapper;
}

interface CommandContext {
  db: Database;
  dir: string;
  logger: Logger;
  redisConfig: ClientOpts;
  redisClient: IHandyRedis;
  includeTarball: boolean;
}

/**
 * Dump database to the given directory
 * @param db
 * @param dir
 */
async function dumpDB({ db, dir }: CommandContext): Promise<void> {
  log.info('Dump .verdaccio-db.json...');
  const secret = await db.getSecret();
  const packages = await db.get();
  const data = { list: packages, secret };
  const json = JSON.stringify(data);
  const filePath = path.join(dir, VERDACCIO_DB_FILE);
  log.info(`  write ${filePath}`);
  fs.writeFileSync(filePath, json);
}

/**
 * Dump packument and tarball to the given directory
 * @param db
 * @param dir
 */
async function dumpPackages({ db, dir, redisClient, includeTarball }: CommandContext): Promise<void> {
  log.info('Dump packages...');
  const packages = await db.get();
  for (const pkgName of packages) {
    // Create folder
    const pkgDir = path.join(dir, pkgName);
    mkdirp.sync(pkgDir);
    // Dump files
    const pkgContents = await redisClient.hgetall(REDIS_KEY.package + pkgName);
    for (const fileName of Object.keys(pkgContents)) {
      if (fileName != 'stat') {
        const filePath = path.join(pkgDir, fileName);
        let fileContent = pkgContents[fileName];
        try {
          if (fileName == PKG_FILE_NAME) {
            // format package.json with 2 spaces indent
            log.info(`  write ${filePath}`);
            const json = JSON.parse(fileContent);
            fileContent = JSON.stringify(json, null, 2);
            await fs.writeFileSync(filePath, fileContent);
          } else if (includeTarball) {
            // write tarball
            log.info(`  write ${filePath}`);
            const buf = Buffer.from(fileContent, 'base64');
            await fs.writeFileSync(filePath, buf);
          }
        } catch (err) {
          log.error(`failed to write ${filePath}, err: ${err}`);
        }
      }
    }
  }
}

/**
 * Dump Redis storage to the given directory
 * @param dir
 * @param cmd
 */
export async function dump(dir: string, cmd: Command): Promise<void> {
  // parse Redis config
  const mutedLogger = getMutedLogger();
  const redisConfig = parseRedisConfig(cmd);
  const redisClient = redisCreateClient(redisConfig, mutedLogger);
  const db = new Database(redisClient, mutedLogger);
  const commandContext = {
    db,
    dir,
    logger: mutedLogger,
    redisConfig,
    redisClient,
    includeTarball: cmd.tarball,
  };
  // parse dir
  const absDir = path.resolve(dir || '.');
  const stats = fs.lstatSync(absDir);
  if (!stats) {
    throw new Error(`${dir} does not exist`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`${dir} is not a directory`);
  }
  // dump
  await dumpDB(commandContext);
  await dumpPackages(commandContext);
}
