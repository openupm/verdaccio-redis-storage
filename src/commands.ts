import defaultfs from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

import log from 'loglevel';
import { Command } from 'commander';
import { ClientOpts } from 'redis';
import { Logger } from '@verdaccio/types';
import mkdirp from 'mkdirp';
import { IHandyRedis } from 'handy-redis';

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

interface ICommandContext {
  db: Database;
  dir: string;
  logger: Logger;
  redisConfig: ClientOpts;
  redisClient: IHandyRedis;
  includeTarball: boolean;
  scan?: boolean;
}

/**
 * Return parsed command context.
 * @param dir
 * @param cmd
 */
async function getCommandContext(dir: string, cmd: Command): Promise<ICommandContext> {
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
    scan: cmd.scan,
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
async function dumpDB({ db, dir }: ICommandContext): Promise<void> {
  log.info('Dump .verdaccio-db.json...');
  const secret = await db.getSecret();
  const packages = await db.get();
  packages.sort();
  const data = { list: packages, secret };
  const json = JSON.stringify(data);
  const filePath = path.join(dir, VERDACCIO_DB_FILE);
  log.info(`  write ${filePath}`);
  await fs.writeFile(filePath, json, { encoding: 'utf8' });
}

/**
 * Dump packument and tarball to the given directory
 * @param db
 * @param dir
 */
async function dumpPackages({ db, dir, redisClient, includeTarball }: ICommandContext): Promise<void> {
  log.info('Dump packages...');
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
            log.info(`  write ${filePath}`);
            const json = JSON.parse(fileContent);
            fileContent = JSON.stringify(json, null, 2);
            await fs.writeFile(filePath, fileContent);
          } else if (includeTarball) {
            // write tarball
            log.info(`  write ${filePath}`);
            const buf = Buffer.from(fileContent, 'base64');
            await fs.writeFile(filePath, buf);
          }
        } catch (err) {
          log.error(`  failed to write ${filePath}, err: ${err}`);
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
  const commandContext = await getCommandContext(dir, cmd);
  await dumpDB(commandContext);
  await dumpPackages(commandContext);
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
async function restoreDB({ db, dir, scan }: ICommandContext): Promise<string[]> {
  log.info('Restore database from .verdaccio-db.json...');
  // parse dir
  const dbFilePath = path.join(dir, '.verdaccio-db.json');
  log.info(`  path: ${dbFilePath}`);
  const data = await fs.readFile(dbFilePath, { encoding: 'utf8' });
  const json = JSON.parse(data);
  const secret = json.secret;
  const packages = json.list;
  await db.setSecret(secret);
  log.info('  set secret');
  for (const pkgName of packages) {
    log.info(`  add ${pkgName}`);
    await db.add(pkgName);
  }
  if (scan) {
    log.warn('Scan package.json...');
    log.warn('(will move uplink packages to the database)');
    const pkgNames = await scanPackageJson(dir);
    for (const pkgName of pkgNames) {
      log.info(`  add ${pkgName}`);
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
  { db, dir, redisClient, includeTarball }: ICommandContext
): Promise<void> {
  log.info('Restore packages...');
  for (const pkgName of packages) {
    const pkgDir = path.join(dir, pkgName);
    const redisKey = REDIS_KEY.package + pkgName;
    const pkgDirExist = defaultfs.existsSync(pkgDir);
    if (pkgDirExist) {
      log.info(`  ${pkgName}`);
    } else {
      log.error(`  failed to restore ${pkgName}, err: package folder doesn't exist`);
      continue;
    }
    // Restore package.json
    try {
      log.info(`    ${PACKAGE_JSON_FILE}`);
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
      log.error(`  failed to restore ${pkgName}'s ${PACKAGE_JSON_FILE}, err: ${err}`);
    }
    // Restore tarball
    if (includeTarball) {
      let names = await fs.readdir(pkgDir);
      names = names.filter(x => /\.(tgz|tar\.gz|tar)$/i.test(x));
      for (const name of names) {
        const filePath = path.join(pkgDir, name);
        const stats = await fs.lstat(filePath);
        if (stats.isFile()) {
          log.info(`    ${name}`);
          const buf = await fs.readFile(filePath);
          const tarballContext = buf.toString('base64');
          await redisClient.hset(redisKey, name, tarballContext);
        }
      }
    }
  }
}

/**
 * Restore Redis storage from the given directory
 * @param dir
 * @param cmd
 */
export async function restore(dir: string, cmd: Command): Promise<void> {
  const commandContext = await getCommandContext(dir, cmd);
  const packages = await restoreDB(commandContext);
  await restorePackages(packages, commandContext);
}
