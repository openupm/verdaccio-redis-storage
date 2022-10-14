# verdaccio-redis-storage
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

![npm](https://img.shields.io/npm/v/verdaccio-redis-storage) ![NPM](https://img.shields.io/npm/l/verdaccio-redis-storage) ![npm](https://img.shields.io/npm/dm/verdaccio-redis-storage)

A Redis based storage plugin for Verdaccio.

## Usage

Install

```bash
npm install verdaccio-redis-storage
```

Configuration

```yaml
store:
  redis-storage:
    host: 127.0.0.1
    port: 6379
    ...
```

See more in https://github.com/luin/ioredis#connect-to-redis

> **Note**
> Since v0.2.5, verdaccio-redis-storage changed the redis library from node-redis to [ioredis](https://github.com/luin/ioredis).

## Serving tarball

Redis is an in-memory database that is not good at dealing with large tarball files. It's highly recommended to use [verdaccio-storage-proxy](https://github.com/openupm/verdaccio-storage-proxy) to decouple the tarball accesses to another storage backend like [verdaccio-aws-s3-storage](https://github.com/verdaccio/monorepo/tree/master/plugins/aws-s3-storage) or [verdaccio-minio](https://github.com/barolab/verdaccio-minio).

## Data structure

| Content type | Redis type | Redis key           | Hash field   | Note           |
|--------------|------------|---------------------|--------------|----------------|
| package list | set        | ve:pkgs             | -            |                |
| secret       | string     | ve:secret           | -            |                |
| token        | hash       | ve:token:$user      | $tokenKey    |                |
| package.json | hash       | ve:pkg:$packageName | package.json |                |
| tarball      | hash       | ve:pkg:$packageName | $fileName    | base64 encoded |

Data are stored with prefix `ve:` (`testve:` for test mode). You can optionally add global prefix via `config.prefix`.

## Dump and restore

With verdaccio-redis CLI, you can exchange data between redis storage and file system.

> Dump and restore commmands don't support token yet.

Goto the package folder where you installed the plugin, run `./node_modules/verdaccio-redis-storage/bin/verdaccio-redis`.

```sh
$ ./node_modules/verdaccio-redis-storage/bin/verdaccio-redis --help
Usage: verdaccio-redis [options] [command]

verdaccio-redis-storage CLI

Options:
  -V, --version            output the version number
  --config <path>          specify the path of Verdaccio configuration file
  --host <host>            Redis host
  --port <port>            Redis port
  --url <url>              Redis URL string
  --socket <socket>        Redis socket string
  --password <password>    Redis password
  --db <db>                Redis db
  --prefix <prefix>        Redis prefix
  -h, --help               display help for command

Commands:
  dump [options] <dir>     dump Redis storage to dir
  restore [options] <dir>  restore Redis storage from dir
  help [command]           display help for command
```

You can provide the Redis connection by specifying the Verdaccio config path (`--config=...`), or extra options like `--host` and `--port`. By default, it connects to `127.0.0.1:6379`.

### Dump redis storage to file system

Use the dump command to export redis storage to the file system. The exported folder can be used by Verdaccio's default file storage.

```sh
$ ./node_modules/verdaccio-redis-storage/bin/verdaccio-redis dump --help
Usage: verdaccio-redis dump [options] <dir>

dump Redis storage to dir

Options:
  --no-tarball  ignore tarball files
  --dbname      database filename (default: .verdaccio-db.json)
  -h, --help    display help for command
```

Use `--no-tarball` option to ignore export tarball files to the file system. See [serving tarball](#serving-tarball) for details.

Use `--dbname` option to specify a different database filename to write. i.e. for Verdaccio S3 storage, the filename is `verdaccio-s3-db.json`.

### Restore redis storage from file system

Use the restore command to import redis storage from the file system.

```sh
./node_modules/verdaccio-redis-storage/bin/verdaccio-redis restore --help
Usage: verdaccio-redis restore [options] <dir>

restore Redis storage from dir

Options:
  --no-tarball  ignore tarball files
  --dbname      database filename (default: .verdaccio-db.json)
  --scan        scan package.json to fill database
  -h, --help    display help for command
```

Use `--no-tarball` option to ignore import tarball files to the Redis storage. See [serving tarball](#serving-tarball) for details.

Use `--dbname` option to specify a different database filename to read. i.e. for Verdaccio S3 storage, the filename is `verdaccio-s3-db.json`.

Use `--scan` option to scan the `package.json` file of sub-folders to fill the database. A rare usage to convert cached uplink packages to local packages (uplink packages are not stored to database by defaut).

## Development

See the [verdaccio contributing guide](https://github.com/verdaccio/verdaccio/blob/master/CONTRIBUTING.md) for instructions setting up your development environment.
Once you have completed that, use the following npm tasks.

  - `npm run build`

    Build a distributable archive

  - `npm run test`

    Run unit test

For more information about any of these commands run `npm run ${task} -- --help`.

## Reference

- [generator-verdaccio-plugin](https://github.com/verdaccio/generator-verdaccio-plugin), verdaccio plugin generator based in [Yeoman](http://yeoman.io/) aims to help to scaffold plugins development.
- [verdaccio-minio](https://github.com/barolab/verdaccio-minio), a good example of verdaccio storage plugin.

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="http://littlebigfun.com"><img src="https://avatars.githubusercontent.com/u/125390?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Favo Yang</b></sub></a><br /><a href="https://github.com/openupm/verdaccio-redis-storage/commits?author=favoyang" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!