import { Config } from '@verdaccio/types';
import { RedisOptions } from 'ioredis';

// See https://github.com/NodeRedis/node-redis#options-object-properties
export interface RedisConfig extends Config, RedisOptions {}

export type CommandCallback = () => Promise<void>;

export interface PackageStat {
  name: string;
  path: string;
  time: number;
}
