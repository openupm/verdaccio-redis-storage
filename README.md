# verdaccio-redis-storage

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

Redis is an in-memory database which is not good at dealing with large tarball files. It's highly recommended to use [verdaccio-storage-proxy](https://github.com/openupm/verdaccio-storage-proxy) to decouple the tarball accesses to another storage backend like [verdaccio-aws-s3-storage](https://github.com/verdaccio/monorepo/tree/master/plugins/aws-s3-storage) or [verdaccio-minio](https://github.com/barolab/verdaccio-minio).

## Data structure

| Content      | Redis type | Redis Key           | Hash field   |
|--------------|------------|---------------------|--------------|
| package list | set        | ve:pkgs             | -            |
| secret       | string     | ve:secret           | -            |
| token        | hash       | ve:token:$user      | $tokenKey    |
| package.json | hash       | ve:pkg:$packageName | package.json |
| tarball      | hash       | ve:pkg:$packageName | $fileName    |

Data are stored with prefix `ve:` (`testve:` for test mode). You can optionally add global prefix via `config.prefix`.

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
