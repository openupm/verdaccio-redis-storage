import fs from 'fs';
import path from 'path';

import log from 'loglevel';
import { Command } from 'commander';
import { ClientOpts } from 'redis';
import { Logger } from '@verdaccio/types';

import { parseConfigFile, redisCreateClient } from './utils';
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
 * Dump Redis storage to given directory
 * @param dir
 * @param cmd
 */
export async function dump(dir: string, cmd: Command): Promise<void> {
  // parse Redis config
  const mutedLogger = getMutedLogger();
  const redisConfig = parseRedisConfig(cmd);
  const redisClient = redisCreateClient(redisConfig, mutedLogger);
  const db = new Database(redisClient, mutedLogger);
  // parse dir
  const absDir = path.resolve(dir || '.');
  const stats = fs.lstatSync(absDir);
  if (!stats) {
    throw new Error(`${dir} does not exist`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`${dir} is not a directory`);
  }
  // dump packages
  const pkgs = await db.get();
  console.log(pkgs);
  // dump package.json and tarballs
  return Promise.resolve();
}
