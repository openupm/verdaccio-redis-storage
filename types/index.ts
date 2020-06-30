import { Config } from '@verdaccio/types';
import { ClientOpts } from 'redis';

export interface RedisConfig extends Config {
  // See https://github.com/NodeRedis/node-redis#options-object-properties
  redis_options: ClientOpts;
}
