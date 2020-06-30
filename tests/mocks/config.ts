import { RedisConfig } from '../../types';

const config: RedisConfig = {
  user_agent: 'string',
  server_id: 1234,
  secret: '1234',
  self_path: './nowhere',
  security: {
    web: {
      sign: {},
      verify: {},
    },
    api: {
      legacy: true,
    },
  },
  uplinks: {},
  packages: {
    test: {
      storage: '',
      publish: [''],
      proxy: [''],
      access: [''],
    },
  },
  web: {
    enable: true,
    title: 'string',
    logo: 'string',
  },
  logs: [],
  auth: {},
  notifications: {
    method: '',
    packagePattern: /a/,
    packagePatternFlags: '',
    headers: {},
    endpoint: '',
    content: '',
  },
  checkSecretKey: () => '1234',
  getMatchedPackagesSpec: jest.fn(),
  hasProxyTo: () => false,
  redis_options: {},
};

export default config;
