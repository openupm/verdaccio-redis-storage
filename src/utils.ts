import fs from 'fs';
import path from 'path';

import { Logger } from '@verdaccio/types';
import { createClient, ClientOpts } from 'redis';
import { createHandyClient, IHandyRedis } from 'handy-redis';
import { VerdaccioError, getInternalError } from '@verdaccio/commons-api';
import YAML from 'js-yaml';

export function redisCreateClient(config: ClientOpts, logger: Logger): IHandyRedis {
  const client = createClient(config);

  client.on('connect', function() {
    logger.info({}, '[verdaccio/redis] connected to redis server');
  });

  client.on('reconnecting', function(context) {
    const delay = context.delay;
    const attempt = context.attempt;
    logger.info({ delay, attempt }, '[verdaccio/redis] reconnecting in @{delay}ms, attempt #@{attempt}');
  });

  client.on('end', function() {
    logger.info({}, '[verdaccio/redis] redis connection end');
  });

  client.on('error', function(err) {
    logger.error({ err }, '[verdaccio/redis] redis error @{err}');
  });

  const handyClient = createHandyClient(client);
  return handyClient;
}

export const REDIS_PREFIX = 've:';
export const TEST_REDIS_PREFIX = 'testve:';

function prefix(key: string): string {
  const prefix = process.env.NODE_ENV === 'test' ? TEST_REDIS_PREFIX : REDIS_PREFIX;
  return prefix + key;
}

export const REDIS_KEY = {
  secret: prefix('secret'),
  packages: prefix('pkgs'),
  package: prefix('pkg:'),
  token: prefix('token:'),
};

export const REDIS_FIELD = {
  stat: 'stat',
};

/**
 * Wrap an generic error to a verdaccio error
 *
 * @param error
 */
export function wrapError(err: Error): VerdaccioError {
  if ('code' in err) {
    return err;
  }
  return getInternalError(err.message);
}

/**
 * Load verdaccio config file
 * @param configPath
 */
export function parseConfigFile(configPath: string): any {
  try {
    const absPath = path.resolve(configPath);
    if (/\.ya?ml$/i.test(absPath)) {
      return YAML.safeLoad(fs.readFileSync(absPath, 'utf8'));
    }
    return require(absPath);
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      e.message = 'failed to load verdaccio configuration file.';
    }
    throw new Error(e);
  }
}
