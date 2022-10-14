import defaultfs from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

import log, { RootLogger } from 'loglevel';
import { Command, OptionValues } from 'commander';
import { RedisOptions } from 'ioredis';
import { Logger } from '@verdaccio/types';
import mkdirp from 'mkdirp';
import Redis from "ioredis";

import {
  parseConfigFile,
  redisCreateClient,
  REDIS_KEY,
  REDIS_FIELD,
  PACKAGE_JSON_FILE,
  VERDACCIO_DB_FILE,
} from './utils';
import Database from './db';

log.setDefaultLevel('info');

export interface ICommandContext {
  db: Database;
  dir: string;
  logger: RootLogger;
  redisClient: Redis;
  includeTarball: boolean;
  dbName: string;
  scan?: boolean;
}

/**
 * Parse redis config from command options
 * @param cmd
 */
function parseRedisConfig(opts: OptionValues): string | RedisOptions {
  if (opts.config) {
    const config = parseConfigFile(opts.config);
    log.info(`Load configuration at ${opts.config}`);
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
    if (opts.socket) return opts.socket;
    if (opts.url) return opts.url;
    else return {
      host: opts.host,
      port: opts.port ? parseInt(opts.port) : undefined,
      db: opts.db,
      password: opts.password,
      keyPrefix: opts.prefix
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

/**
 * Return parsed command context.
 * @param dir
 * @param cmd
 */
async function getCommandContext(dir: string, opts: OptionValues): Promise<ICommandContext> {
  // parse Redis config
  const mutedLogger = getMutedLogger();
  const redisConfig = parseRedisConfig(opts);
  const redisClient = redisCreateClient(redisConfig, mutedLogger);
  const db = new Database(redisClient, mutedLogger);
  const commandContext = {
    db,
    dir,
    logger: log,
    redisClient,
    includeTarball: opts.tarball,
    scan: opts.scan,
    dbName: opts.dbname || VERDACCIO_DB_FILE,
  };
  // parse dir
  const absDir = path.resolve(dir || '.');
  const stats = await fs.lstat(absDir);
  if (!stats) {
    throw new Error(`${dir} does not exist`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`${dir} is not a directory`);
  }
  return commandContext;
}

/**
 * Dump database to the given directory
 * @param db
 * @param dir
 */
async function dumpDB({ db, dbName, dir, logger }: ICommandContext): Promise<void> {
  logger.info('Dump database...');
  const secret = await db.getSecret();
  const packages = await db.get();
  packages.sort();
  const data = { list: packages, secret };
  const json = JSON.stringify(data);
  const filePath = path.join(dir, dbName);
  logger.info(`  write ${filePath}`);
  await fs.writeFile(filePath, json, { encoding: 'utf8' });
}

/**
 * Dump packument and tarball to the given directory
 * @param db
 * @param dir
 */
async function dumpPackages({ db, dir, redisClient, includeTarball, logger }: ICommandContext): Promise<void> {
  logger.info('Dump packages...');
  const packages = await db.get();
  for (const pkgName of packages) {
    // Create folder
    const pkgDir = path.join(dir, pkgName);
    mkdirp.sync(pkgDir);
    // Dump files
    const pkgContents = await redisClient.hgetall(REDIS_KEY.package + pkgName);
    for (const fileName of Object.keys(pkgContents)) {
      if (fileName != REDIS_FIELD.stat) {
        const filePath = path.join(pkgDir, fileName);
        let fileContent = pkgContents[fileName];
        try {
          if (fileName == PACKAGE_JSON_FILE) {
            // format package.json with 2 spaces indent
            logger.info(`  write ${filePath}`);
            const json = JSON.parse(fileContent);
            fileContent = JSON.stringify(json, null, 2);
            await fs.writeFile(filePath, fileContent);
          } else if (includeTarball) {
            // write tarball
            logger.info(`  write ${filePath}`);
            const buf = Buffer.from(fileContent, 'base64');
            await fs.writeFile(filePath, buf);
          }
        } catch (err) {
          logger.error(`  failed to write ${filePath}, err: ${err}`);
        }
      }
    }
  }
}

export async function dumpWithContext(commandContext: ICommandContext): Promise<void> {
  await dumpDB(commandContext);
  await dumpPackages(commandContext);
}

/**
 * Dump Redis storage to the given directory
 * @param dir
 * @param cmd
 */
export async function dump(dir: string, opts: OptionValues): Promise<void> {
  const commandContext = await getCommandContext(dir, opts);
  await dumpWithContext(commandContext);
}

/**
 * Scan dir and return found package names
 * @param dir
 * @param org
 */
async function scanPackageJson(dir, org?: string): Promise<string[]> {
  const pkgNames: string[] = [];
  const names = await fs.readdir(dir);
  for (const name of names) {
    const filePath = path.join(dir, name);
    const stats = await fs.lstat(filePath);
    if (stats.isDirectory()) {
      const dirPath = filePath;
      if (name.startsWith('@')) {
        const items = await scanPackageJson(dirPath, name);
        for (const item of items) {
          pkgNames.push(item);
        }
      } else {
        const packageJsonPath = path.join(dirPath, PACKAGE_JSON_FILE);
        const stats = await fs.lstat(packageJsonPath);
        if (stats.isFile()) {
          const pkgName = org ? `${org}/${name}` : name;
          pkgNames.push(pkgName);
        }
      }
    }
  }
  pkgNames.sort();
  return pkgNames;
}

/**
 * Restore database from the given directory
 * @param db
 * @param dir
 */
async function restoreDB({ db, dbName, dir, scan, logger }: ICommandContext): Promise<string[]> {
  logger.info('Restore database...');
  // parse dir
  const dbFilePath = path.join(dir, dbName);
  logger.info(`  path: ${dbFilePath}`);
  const data = await fs.readFile(dbFilePath, { encoding: 'utf8' });
  const json = JSON.parse(data);
  const secret = json.secret;
  const packages = json.list;
  await db.setSecret(secret);
  logger.info('  set secret');
  for (const pkgName of packages) {
    logger.info(`  add ${pkgName}`);
    await db.add(pkgName);
  }
  if (scan) {
    logger.warn('Scan package.json...');
    logger.warn('(will move uplink packages to the database)');
    const pkgNames = await scanPackageJson(dir);
    for (const pkgName of pkgNames) {
      logger.info(`  add ${pkgName}`);
      packages.push(pkgName);
      await db.add(pkgName);
    }
  }
  return packages;
}

/**
 * Restore packument and tarball from the given directory
 * @param db
 * @param dir
 */
async function restorePackages(
  packages: string[],
  { db, dir, redisClient, includeTarball, logger }: ICommandContext
): Promise<void> {
  logger.info('Restore packages...');
  for (const pkgName of packages) {
    const pkgDir = path.join(dir, pkgName);
    const redisKey = REDIS_KEY.package + pkgName;
    const pkgDirExist = defaultfs.existsSync(pkgDir);
    if (pkgDirExist) {
      logger.info(`  ${pkgName}`);
    } else {
      logger.error(`  failed to restore ${pkgName}, err: package folder doesn't exist`);
      continue;
    }
    // Restore package.json
    try {
      logger.info(`    ${PACKAGE_JSON_FILE}`);
      const packageJsonPath = path.join(pkgDir, PACKAGE_JSON_FILE);
      const packageJsonContent = await fs.readFile(packageJsonPath, { encoding: 'utf8' });
      const packageJson = JSON.parse(packageJsonContent);
      await redisClient.hset(redisKey, PACKAGE_JSON_FILE, JSON.stringify(packageJson));
      let date = new Date();
      if (packageJson.time && packageJson.time.modified) {
        date = new Date(packageJson.time.modified);
      }
      await db.setStat(pkgName, date);
    } catch (err) {
      logger.error(`  failed to restore ${pkgName}'s ${PACKAGE_JSON_FILE}, err: ${err}`);
    }
    // Restore tarball
    if (includeTarball) {
      let names = await fs.readdir(pkgDir);
      names = names.filter(x => /\.(tgz|tar\.gz|tar)$/i.test(x));
      for (const name of names) {
        const filePath = path.join(pkgDir, name);
        const stats = await fs.lstat(filePath);
        if (stats.isFile()) {
          logger.info(`    ${name}`);
          const buf = await fs.readFile(filePath);
          const tarballContext = buf.toString('base64');
          await redisClient.hset(redisKey, name, tarballContext);
        }
      }
    }
  }
}

export async function restoreWithContext(commandContext: ICommandContext): Promise<void> {
  const packages = await restoreDB(commandContext);
  await restorePackages(packages, commandContext);
}

/**
 * Restore Redis storage from the given directory
 * @param dir
 * @param cmd
 */
export async function restore(dir: string, opts: OptionValues): Promise<void> {
  const commandContext = await getCommandContext(dir, opts);
  await restoreWithContext(commandContext);
}
