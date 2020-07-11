# verdaccio-redis-storage

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

See more in https://github.com/NodeRedis/node-redis#options-object-properties.

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
  -h, --help    display help for command
```

Use `--no-tarball` to ignore export tarball files to the file system. See [serving tarball](#serving-tarball) for details.

### Restore redis storage from file system

Use the restore command to import redis storage from the file system.

```sh
./node_modules/verdaccio-redis-storage/bin/verdaccio-redis restore --help
Usage: verdaccio-redis restore [options] <dir>

restore Redis storage from dir

Options:
  --no-tarball  ignore tarball files
  --scan        scan package.json to fill database
  -h, --help    display help for command
```

Use `--no-tarball` to ignore import tarball files to the Redis storage. See [serving tarball](#serving-tarball) for details.

Use `--scan` option to scan package.json of the given directory to fill the Redis database. This is only useful when you want to convert all uplink packages as local packages, which is a rare usage.

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
