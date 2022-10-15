import fs from 'fs';
import path from 'path';
import os from 'os';

import rimraf from 'rimraf';
import { compareSync } from 'dir-compare';

import Redis from "ioredis-mock";
import RedisStorage from '../src/plugin';
import { TEST_REDIS_PREFIX } from '../src/utils';
import { restoreWithContext, ICommandContext, dumpWithContext } from '../src/commands';

import config from './mocks/config';
import { logger, rootLogger } from './mocks/logger';

describe('redis storage CLI test', () => {
  const restoreDir = path.resolve(__dirname, './fixtures/example-fs');
  let dumpDir: string;
  let redisStorage: RedisStorage;

  beforeEach(done => {
    // Create redis storage
    const defaultConfig = { logger, config };
    const redisClient = new Redis(config);
    redisStorage = new RedisStorage(config, defaultConfig, redisClient);
    // Create dump dir
    const tempDirPrefix = path.join(os.tmpdir(), 'verdaccio-redis-storage-');
    fs.mkdtemp(tempDirPrefix, (err, folder) => {
      if (err) {
        throw err;
      }
      dumpDir = folder;
      done();
    });
  });

  afterEach(async () => {
    // Clean redis
    const keysToDelete = await redisStorage.redisClient.keys(TEST_REDIS_PREFIX + '*');
    for (const key of keysToDelete) {
      await redisStorage.redisClient.del(key);
    }
    redisStorage.redisClient.quit();
    // Clean dump path
    if (dumpDir !== null) {
      rimraf.sync(dumpDir);
    }
    // Clean mocks
    jest.clearAllMocks();
  });
  test('should restore from fs', async () => {
    const restoreContext: ICommandContext = {
      db: redisStorage.db,
      dir: restoreDir,
      logger: rootLogger,
      redisClient: redisStorage.redisClient,
      includeTarball: true,
      scan: true,
      dbName: '.verdaccio-db.json',
    };
    await restoreWithContext(restoreContext);
    const packages = await redisStorage.db.get();
    packages.sort();
    expect(packages).toEqual(['@myorg/mypkg', '@myorg/mypkg2', 'mypkg', 'mypkg2']);
  });
  test('should dump to fs', async () => {
    const restoreContext: ICommandContext = {
      db: redisStorage.db,
      dir: restoreDir,
      logger: rootLogger,
      redisClient: redisStorage.redisClient,
      includeTarball: true,
      scan: true,
      dbName: '.verdaccio-db.json',
    };
    await restoreWithContext(restoreContext);
    const dumpContext: ICommandContext = {
      db: redisStorage.db,
      dir: dumpDir,
      logger: rootLogger,
      redisClient: redisStorage.redisClient,
      includeTarball: true,
      scan: true,
      dbName: '.verdaccio-db.json',
    };
    await dumpWithContext(dumpContext);
    const result = compareSync(restoreDir, dumpDir, {});
    if (!result.same && result.diffSet) {
      result.diffSet.forEach(dif =>
        console.log(
          'Difference - name1: %s, type1: %s, name2: %s, type2: %s, state: %s',
          dif.name1,
          dif.type1,
          dif.name2,
          dif.type2,
          dif.state
        )
      );
    }
    expect(result.same).toBeTruthy();
  });
});
