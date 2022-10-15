#!/usr/bin/env node

import log from 'loglevel';
import { program, Command } from 'commander';
import version from 'project-version';

import { CommandCallback } from '../types';

import { dump, restore } from './commands';

const runCommand = async function(callback: CommandCallback): Promise<void> {
  try {
    await callback();
    process.exit(0);
  } catch (err) {
    if (err instanceof Error) {
      log.error('Error: ' + err.message);
    } else {
      log.error('Error: ' + String(err));
    }
    process.exit(1);
  }
};

program
  .version(version)
  .description('verdaccio-redis-storage CLI')
  .option('--config <path>', 'specify the path of Verdaccio configuration file')
  .option('--host <host>', 'Redis host')
  .option('--port <port>', 'Redis port')
  .option('--url <url>', 'Redis protocol URL. i.e. redis://user:pass@127.0.0.1:6380/2')
  .option('--socket <socket>', 'Socket path. i.e. /tmp/redis.sock')
  .option('--password <password>', 'Redis password')
  .option('--db <db>', 'Redis db')
  .option('--prefix <prefix>', 'Redis prefix');

program
  .command('dump <dir>')
  .description('dump Redis storage to dir')
  .option('--no-tarball', 'ignore tarball files')
  .option('--dbname', 'database filename (default: .verdaccio-db.json)')
  .action(async function (dir: string, cmd: Command) {
    const opts = program.opts();
    await runCommand(async () => {
      await dump(dir, opts);
    });
  });

program
  .command('restore <dir>')
  .description('restore Redis storage from dir')
  .option('--no-tarball', 'ignore tarball files')
  .option('--dbname', 'database filename (default: .verdaccio-db.json)')
  .option('--scan', 'scan package.json to fill database')
  .action(async function (dir: string, cmd: Command) {
    await runCommand(async () => {
      await restore(dir, cmd);
    });
  });

// prompt for invalid command
program.on('command:*', function() {
  log.error(`invalid command: ${program.args.join(' ')}
see --help for a list of available commands`);
  process.exit(1);
});

program.parse(process.argv);

// print help if no command is given
if (!program.args.length) program.help();
