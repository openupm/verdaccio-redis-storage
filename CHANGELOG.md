## [1.1.1](https://github.com/openupm/verdaccio-redis-storage/compare/1.1.0...1.1.1) (2022-10-16)


### Bug Fixes

* require node v14 ([695a0fd](https://github.com/openupm/verdaccio-redis-storage/commit/695a0fd1ff02850c74fd97f039f1414cb994cd4e))

# [1.1.0](https://github.com/openupm/verdaccio-redis-storage/compare/1.0.3...1.1.0) (2022-10-16)


### Bug Fixes

* update ci to node v14 ([b8766e4](https://github.com/openupm/verdaccio-redis-storage/commit/b8766e460377fe7ca0fe19ef51ecded4fd2b4db0))


### Features

* require node v14 ([348c7fb](https://github.com/openupm/verdaccio-redis-storage/commit/348c7fb5eb8c1d228f28436561329788a3cff2d7))

## [1.0.3](https://github.com/openupm/verdaccio-redis-storage/compare/1.0.2...1.0.3) (2022-10-16)


### Bug Fixes

* set enableOfflineQueue off when the first redis connection is ready ([2c9934c](https://github.com/openupm/verdaccio-redis-storage/commit/2c9934c59315f78071c5b4fd0750fb9d0e9d28b6))

## [1.0.2](https://github.com/openupm/verdaccio-redis-storage/compare/1.0.1...1.0.2) (2022-10-15)


### Bug Fixes

* use mock-ioredis for testing ([7946e1d](https://github.com/openupm/verdaccio-redis-storage/commit/7946e1d22edc08b2c147cc6828568c44b7f40882))

## [1.0.1](https://github.com/openupm/verdaccio-redis-storage/compare/1.0.0...1.0.1) (2022-10-15)


### Bug Fixes

* **ci:** add package-lock.json to semantic-release/git assets ([a89cfa5](https://github.com/openupm/verdaccio-redis-storage/commit/a89cfa598ce9703651c58b7418322dfc2d3d2390))

# [1.0.0](https://github.com/openupm/verdaccio-redis-storage/compare/0.2.4...1.0.0) (2022-10-15)


### Code Refactoring

* replace node-redis with ioredis ([ae05793](https://github.com/openupm/verdaccio-redis-storage/commit/ae0579304b4f09c7a2762aebffd9d1089ae49fb9))


### BREAKING CHANGES

* ioredis connection options are slightly different from node-redis

## [0.2.4](https://github.com/openupm/verdaccio-redis-storage/compare/0.2.3...0.2.4) (2020-07-27)


### Bug Fixes

* **cli:** add option to specify database filename ([8c1c861](https://github.com/openupm/verdaccio-redis-storage/commit/8c1c861169680f1ca26d1d3efc506acfa62f5852))

## [0.2.3](https://github.com/openupm/verdaccio-redis-storage/compare/0.2.2...0.2.3) (2020-07-26)


### Bug Fixes

* broken tests ([adde00d](https://github.com/openupm/verdaccio-redis-storage/commit/adde00d177d90f06e507424c3af15dffab0fc546))
* search api ([541e653](https://github.com/openupm/verdaccio-redis-storage/commit/541e6534ccac7611650d679d9354efda604c0130))

## [0.2.2](https://github.com/openupm/verdaccio-redis-storage/compare/0.2.1...0.2.2) (2020-07-26)


### Bug Fixes

* **ci:** build before bundle ([df5a569](https://github.com/openupm/verdaccio-redis-storage/commit/df5a569c2f77fb5c2d3bf0a6c16a31000b9b2966))

## [0.2.1](https://github.com/openupm/verdaccio-redis-storage/compare/0.2.0...0.2.1) (2020-07-26)


### Bug Fixes

* lib folder is ignored in the package dist ([02187b9](https://github.com/openupm/verdaccio-redis-storage/commit/02187b9a3f6543e0550532c2aa96dca94ca39b8d))

# [0.2.0](https://github.com/openupm/verdaccio-redis-storage/compare/0.1.1...0.2.0) (2020-07-11)


### Features

* cli restore command ([3aa8874](https://github.com/openupm/verdaccio-redis-storage/commit/3aa8874873a8481e0b17ede4b4714c56829fdb91))

## [0.1.1](https://github.com/openupm/verdaccio-redis-storage/compare/0.1.0...0.1.1) (2020-07-09)


### Bug Fixes

* make dir parameter required for dump command ([4f83b14](https://github.com/openupm/verdaccio-redis-storage/commit/4f83b1484ca6d5fd24e76a2c34009883163bea7f))

# [0.1.0](https://github.com/openupm/verdaccio-redis-storage/compare/0.0.4...0.1.0) (2020-07-05)


### Bug Fixes

* package stats stores to wrong Redis key ([024efbc](https://github.com/openupm/verdaccio-redis-storage/commit/024efbc5cd325c42f69621300761335273c25cd9))
* tarball test ([a0db8cf](https://github.com/openupm/verdaccio-redis-storage/commit/a0db8cfdc727f050d49ccabbbd2b4df06d37208d))
* wrong tarball file encoding ([e12220e](https://github.com/openupm/verdaccio-redis-storage/commit/e12220e76c9446cbfae1727e6706f1d334b9f16b))


### Features

* cli dump command ([7e7d9a2](https://github.com/openupm/verdaccio-redis-storage/commit/7e7d9a2db637a8f603f57571f6f57612d16e8da6))
* cli to exchange redis data with file system ([22b3f21](https://github.com/openupm/verdaccio-redis-storage/commit/22b3f21f82d37a63ebe184895c202f03973ef758))

## [0.0.4](https://github.com/openupm/verdaccio-redis-storage/compare/0.0.3...0.0.4) (2020-07-04)


### Bug Fixes

* package stats stores to wrong Redis key ([0600848](https://github.com/openupm/verdaccio-redis-storage/commit/06008480e1194f272bf4b9805e16bf626ff4edb7))

## [0.0.3](https://github.com/openupm/verdaccio-redis-storage/compare/0.0.2...0.0.3) (2020-07-03)


### Bug Fixes

* config redis directly without redis_options key ([a377549](https://github.com/openupm/verdaccio-redis-storage/commit/a37754987b1e0c8ce257ede606075dc987fef45c))

## [0.0.2](https://github.com/openupm/verdaccio-redis-storage/compare/0.0.1...0.0.2) (2020-07-01)


### Bug Fixes

* enable auto-release script ([918b2e3](https://github.com/openupm/verdaccio-redis-storage/commit/918b2e39c8f5415aa6d8802b61df7c525e256c7a))
* repository URL ([215af16](https://github.com/openupm/verdaccio-redis-storage/commit/215af169d60fd894106f3ae6e7c085c87bb9eb12))
