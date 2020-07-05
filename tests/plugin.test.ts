import { IPackageStorage, ILocalPackageManager, Token } from '@verdaccio/types';
import { HTTP_STATUS, VerdaccioError, getBadRequest, getInternalError } from '@verdaccio/commons-api';

import RedisStorage from '../src/plugin';
import { TEST_REDIS_PREFIX, REDIS_KEY, bufferStreamToBase64String } from '../src/utils';
import StoragePluginManager from '../src/PackageStorage';

import config from './mocks/config';
import logger from './mocks/logger';
import { pkg1 } from './mocks/pkgs';

const TarballBase64 =
  'H4sIAAAAAAAAAytITM5OTE/VL4DQelnF+XkMVAYGBgZmZiYK2MTBwBQoZ2xqZmBoaGZmAGQDGaYm5kCa2g7BBkqLSxKLgE6h1ByIVxTg9BAB1VwKCkp5ibmpSlYKSrmVBdnpSjogobLUouLM/DyQqKGegZ6BElct10C7dRSMglEwCkYB9QAA9VEdpAAIAAA=';
const TarballBuffer = new Buffer(TarballBase64, 'base64');

describe('redis storage unit test', () => {
  let redisStorage: RedisStorage = null;
  beforeEach(() => {
    const defaultConfig = { logger, config: null };
    redisStorage = new RedisStorage(config, defaultConfig);
  });

  afterEach(async () => {
    // Clean and end redis
    const keysToDelete = await redisStorage.redisClient.keys(TEST_REDIS_PREFIX + '*');
    for (const key of keysToDelete) {
      await redisStorage.redisClient.del(key);
    }
    redisStorage.redisClient.redis.end(true);
    jest.clearAllMocks();
  });

  test('should create an instance', () => {
    expect(logger.error).not.toHaveBeenCalled();
    expect(redisStorage).toBeDefined();
  });

  describe('database tests', () => {
    describe('secret tests', () => {
      test('should get secret', async () => {
        const secretKey = await redisStorage.getSecret();
        expect(secretKey).toBeDefined();
        expect(typeof secretKey === 'string').toBeTruthy();
      });

      test('should set secret', async () => {
        const newSecret = redisStorage.config.checkSecretKey('');
        await redisStorage.setSecret(newSecret);
        const fetchedSecretKey = await redisStorage.getSecret();
        expect(newSecret).toBe(fetchedSecretKey);
      });
    });

    describe('packages tests', () => {
      test('should add a package', done => {
        const pkgName = 'test';
        redisStorage.add(pkgName, err => {
          expect(err).toBeNull();
          redisStorage.redisClient.sismember(REDIS_KEY.packages, pkgName).then(val => {
            expect(val).toBe(1);
            done();
          });
        });
      });

      test('should remove a package', done => {
        const pkgName = 'test';
        redisStorage.redisClient.sadd(REDIS_KEY.packages, pkgName).then(() => {
          redisStorage.remove(pkgName, err => {
            expect(err).toBeNull();
            redisStorage.redisClient.sismember(REDIS_KEY.packages, pkgName).then(val => {
              expect(val).toBe(0);
              done();
            });
          });
        });
      });

      test('should get package list', done => {
        const pkgNames = ['test1', 'test2'];
        redisStorage.redisClient.sadd(REDIS_KEY.packages, ...pkgNames).then(saddResult => {
          expect(saddResult).toBe(2);
          redisStorage.get((err, list) => {
            list.sort();
            expect(err).toBeNull();
            expect(list).toEqual(pkgNames);
            done();
          });
        });
      });
    });

    describe('token tests', () => {
      test('should save token', done => {
        const user = 'user-a';
        const token1: Token = {
          user,
          token: 'token1',
          key: 'key1',
          readonly: false,
          created: 0,
        };
        redisStorage
          .saveToken(token1)
          .then(() => {
            redisStorage.redisClient.hget(REDIS_KEY.token + user, token1.key).then(val => {
              expect(val).not.toBeNull();
              done();
            });
          })
          .catch(err => {
            done.fail(`Unexpected error has been emitted: ${err}`);
          });
      });

      test('should read token', done => {
        const user = 'user-a';
        const token1: Token = {
          user,
          token: 'token1',
          key: 'key1',
          readonly: false,
          created: 0,
        };
        redisStorage
          .saveToken(token1)
          .then(() => {
            redisStorage
              .readTokens({ user })
              .then(val => {
                expect(val).not.toBeNull();
                expect(val.length).toBe(1);
                const returnedToken = val[0] as Token;
                expect(returnedToken).toEqual(token1);
                done();
              })
              .catch(err => {
                done.fail(`Unexpected error has been emitted: ${err}`);
              });
          })
          .catch(err => {
            done.fail(`Unexpected error has been emitted: ${err}`);
          });
      });

      test('should delete token', done => {
        const user = 'user-a';
        const token1: Token = {
          user,
          token: 'token1',
          key: 'key1',
          readonly: false,
          created: 0,
        };
        redisStorage
          .saveToken(token1)
          .then(() => {
            redisStorage
              .deleteToken(user, token1.key)
              .then(() => {
                redisStorage
                  .readTokens({ user })
                  .then(val => {
                    expect(val).not.toBeNull();
                    expect(val.length).toBe(0);
                    done();
                  })
                  .catch(err => {
                    done.fail(`Unexpected error has been emitted: ${err}`);
                  });
              })
              .catch(err => {
                done.fail(`Unexpected error has been emitted: ${err}`);
              });
          })
          .catch(err => {
            done.fail(`Unexpected error has been emitted: ${err}`);
          });
      });
    });

    describe('db.stat tests', () => {
      test('should set and get stat', done => {
        const pkgName = pkg1.name;
        redisStorage.db
          .setStat(pkgName)
          .then(() => {
            redisStorage.db
              .getStat(pkgName)
              .then(stat => {
                expect(stat.name).toEqual(pkgName);
                expect(stat.path).toEqual(pkgName);
                expect(stat.time).not.toBe(0);
                expect(stat.time).toBeLessThanOrEqual(new Date().getTime());
                done();
              })
              .catch(err => {
                done.fail(`Unexpected error has been emitted: ${err}`);
              });
          })
          .catch(err => {
            done.fail(`Unexpected error has been emitted: ${err}`);
          });
      });

      describe('search tests', () => {
        test('should get search result if matched', done => {
          redisStorage.db
            .add(pkg1.name)
            .then(() => {
              const storage = redisStorage.getPackageStorage(pkg1.name) as ILocalPackageManager;
              storage.createPackage(pkg1.name, pkg1, err => {
                expect(err).toBeNull();
                redisStorage.search(
                  pkg => {
                    expect(pkg.name).toEqual(pkg1.name);
                  },
                  err => {
                    expect(err).toBeNull();
                    done();
                  },
                  () => true
                );
              });
            })
            .catch(err => {
              done.fail(`Unexpected error has been emitted: ${err}`);
            });
        });

        test('should get empty result if not matched', done => {
          redisStorage.db
            .add(pkg1.name)
            .then(() => {
              const storage = redisStorage.getPackageStorage(pkg1.name) as ILocalPackageManager;
              storage.createPackage(pkg1.name, pkg1, err => {
                expect(err).toBeNull();
                redisStorage.search(
                  () => {
                    done.fail(`Unexpected error has been emitted: ${err}`);
                  },
                  err => {
                    expect(err).toBeNull();
                    done();
                  },
                  () => false
                );
              });
            })
            .catch(err => {
              done.fail(`Unexpected error has been emitted: ${err}`);
            });
        });
      });
    });
  });

  describe('package storage tests', () => {
    let packageStorage: IPackageStorage = null;

    beforeEach(() => {
      packageStorage = redisStorage.getPackageStorage(pkg1.name);
    });

    test('should create then read package', done => {
      const storage = packageStorage as ILocalPackageManager;
      storage.createPackage(pkg1.name, pkg1, err => {
        expect(err).toBeNull();
        storage.readPackage(pkg1.name, (err, pkg) => {
          expect(err).toBeNull();
          expect(pkg).toEqual(pkg1);
          done();
        });
      });
    });

    test('should fail on creating exist package', done => {
      const storage = packageStorage as ILocalPackageManager;
      storage.createPackage(pkg1.name, pkg1, err => {
        expect(err).toBeNull();
        storage.createPackage(pkg1.name, pkg1, err => {
          expect(err.code).toBe(HTTP_STATUS.CONFLICT);
          done();
        });
      });
    });

    test('should save then read package', done => {
      const storage = packageStorage as StoragePluginManager;
      storage.savePackage(pkg1.name, pkg1, err => {
        expect(err).toBeNull();
        storage.readPackage(pkg1.name, (err, pkg) => {
          expect(err).toBeNull();
          expect(pkg).toEqual(pkg1);
          storage.db
            .getStat(pkg1.name)
            .then(stat => {
              expect(stat.name).toEqual(pkg1.name);
              expect(stat.time).not.toBe(0);
              done();
            })
            .catch(err => {
              done.fail(`Unexpected error has been emitted: ${err}`);
            });
        });
      });
    });

    test('should fail on reading non-existent package', done => {
      const storage = packageStorage as ILocalPackageManager;
      storage.readPackage('pkg-not-exist', err => {
        expect(err.code).toBe(HTTP_STATUS.NOT_FOUND);
        done();
      });
    });

    test('should fail on reading bad data package', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = 'pkg-bad-data';
      redisStorage.redisClient.hset(REDIS_KEY.package + pkgName, 'package.json', '{').then(() => {
        storage.readPackage(pkgName, err => {
          expect(err.code).toBe(HTTP_STATUS.BAD_DATA);
          done();
        });
      });
    });

    test('should update package', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = pkg1.name;
      storage.createPackage(pkg1.name, pkg1, err => {
        expect(err).toBeNull();
        const transform = jest.fn();
        const update = jest.fn();
        const write = jest.fn();
        transform.mockImplementation(x => x);
        update.mockImplementation((p, cb) => cb(null, p));
        write.mockImplementation((name, state, cb) => cb(null, name, state));
        storage.updatePackage(pkgName, update, write, transform, err => {
          expect(err).toBeNull();
          expect(transform).toHaveBeenCalled();
          expect(update).toHaveBeenCalled();
          expect(write).toHaveBeenCalled();
          done();
        });
      });
    });

    test('should fail on updating package if update fails', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = pkg1.name;
      storage.createPackage(pkg1.name, pkg1, err => {
        expect(err).toBeNull();
        const transform = jest.fn();
        const update = jest.fn();
        const write = jest.fn();
        transform.mockImplementation(x => x);
        update.mockImplementation((p, cb) => cb(getInternalError(), p));
        write.mockImplementation((name, state, cb) => cb(null, name, state));
        storage.updatePackage(pkgName, update, write, transform, err => {
          expect(err.code).toBe(HTTP_STATUS.INTERNAL_ERROR);
          expect(transform).not.toHaveBeenCalled();
          expect(update).toHaveBeenCalled();
          expect(write).not.toHaveBeenCalled();
          done();
        });
      });
    });

    test('should fail on updating package if not exist', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = pkg1.name;
      const transform = jest.fn();
      const update = jest.fn();
      const write = jest.fn();
      transform.mockImplementation(x => x);
      update.mockImplementation((p, cb) => cb(null, p));
      write.mockImplementation((name, state, cb) => cb(null, name, state));
      storage.updatePackage(pkgName, update, write, transform, err => {
        expect(err.code).toBe(HTTP_STATUS.NOT_FOUND);
        expect(transform).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
        expect(write).not.toHaveBeenCalled();
        done();
      });
    });

    test('should delete package file', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = pkg1.name;
      const fileName = 'test.tgz';
      redisStorage.redisClient.hset(REDIS_KEY.package + pkgName, fileName, TarballBase64).then(() => {
        storage.deletePackage(fileName, err => {
          expect(err).toBeNull();
          redisStorage.redisClient.hget(REDIS_KEY.package + pkgName, fileName).then(data2 => {
            expect(data2).toBeNull();
            done();
          });
        });
      });
    });

    test('should delete not exist package file', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = pkg1.name;
      const fileName = 'test-not-exist.tgz';
      storage.deletePackage(fileName, err => {
        expect(err).toBeNull();
        redisStorage.redisClient.hget(REDIS_KEY.package + pkgName, fileName).then(data => {
          expect(data).toBeNull();
          done();
        });
      });
    });

    test('should remove package', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = pkg1.name;
      const fileName = 'test.tgz';
      redisStorage.redisClient.hset(REDIS_KEY.package + pkgName, fileName, TarballBase64).then(() => {
        storage.removePackage(err => {
          expect(err).toBeNull();
          redisStorage.redisClient.hget(REDIS_KEY.package + pkgName, fileName).then(data2 => {
            expect(data2).toBeNull();
            done();
          });
        });
      });
    });

    test('should write tarball', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = pkg1.name;
      const fileName = 'test.tgz';
      const uploadTarball = storage.writeTarball(fileName);
      uploadTarball.on('success', () => {
        redisStorage.redisClient.hget(REDIS_KEY.package + pkgName, fileName).then(data => {
          expect(data).toEqual(TarballBase64);
          done();
        });
      });
      uploadTarball.on('error', err => {
        done.fail(`Unexpected error has been emitted in write stream: ${err}`);
      });
      // Write to stream
      uploadTarball.emit('content-length', TarballBuffer.length);
      uploadTarball.emit('open');
      uploadTarball.write(TarballBuffer, err => {
        if (!err) {
          uploadTarball.end();
        }
      });
    });

    test('should fail on writing exist tarball', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = pkg1.name;
      const fileName = 'test.tgz';
      redisStorage.redisClient.hset(REDIS_KEY.package + pkgName, fileName, TarballBase64).then(() => {
        const uploadTarball = storage.writeTarball(fileName);
        uploadTarball.on('success', () => {
          done.fail('should not reach here');
        });
        uploadTarball.on('error', (err: VerdaccioError) => {
          expect(err.code).toBe(HTTP_STATUS.CONFLICT);
          done();
        });
        // Write to stream
        uploadTarball.emit('content-length', TarballBuffer.length);
        uploadTarball.emit('open');
        uploadTarball.write(TarballBuffer, err => {
          if (!err) {
            uploadTarball.end();
          }
        });
      });
    });

    test('should fail on writing tarball fails', done => {
      const storage = packageStorage as ILocalPackageManager;
      const fileName = 'test.tgz';
      const uploadTarball = storage.writeTarball(fileName);
      uploadTarball.on('success', () => {
        done.fail('should not reach here');
      });
      uploadTarball.on('error', (err: VerdaccioError) => {
        expect(err.code).toBe(HTTP_STATUS.BAD_REQUEST);
        done();
      });
      // Write to stream
      uploadTarball.emit('content-length', TarballBuffer.length);
      uploadTarball.emit('open');
      uploadTarball.emit('error', getBadRequest('bad request'));
    });

    test('should read tarball', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = pkg1.name;
      const fileName = 'test.tgz';
      redisStorage.redisClient.hset(REDIS_KEY.package + pkgName, fileName, TarballBase64).then(() => {
        const readTarball = storage.readTarball(fileName);
        bufferStreamToBase64String(readTarball).then(data => {
          expect(data).toEqual(TarballBase64);
          done();
        });
      });
    });

    test('should fail on reading non-existent tarball', done => {
      const storage = packageStorage as ILocalPackageManager;
      const fileName = 'test-not-exist.tgz';
      const readTarball = storage.readTarball(fileName);
      bufferStreamToBase64String(readTarball)
        .then(() => {
          done.fail('should not reach here');
        })
        .catch(err => {
          expect(err.code).toBe(HTTP_STATUS.NOT_FOUND);
          done();
        });
    });

    test('should fail on reading aborted tarball', done => {
      const storage = packageStorage as ILocalPackageManager;
      const pkgName = pkg1.name;
      const fileName = 'test.tgz';
      redisStorage.redisClient.hset(REDIS_KEY.package + pkgName, fileName, TarballBase64).then(() => {
        const readTarball = storage.readTarball(fileName);
        readTarball.abort();
        bufferStreamToBase64String(readTarball)
          .then(() => {
            done.fail('should not reach here');
          })
          .catch(err => {
            expect(err.code).toBe(HTTP_STATUS.BAD_REQUEST);
            done();
          });
      });
    });
  });
});
