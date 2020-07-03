import { Config } from '@verdaccio/types';
import { ClientOpts } from 'redis';

// See https://github.com/NodeRedis/node-redis#options-object-properties
export interface RedisConfig extends Config, ClientOpts {}

export type CommandCallback = () => Promise<void>;
