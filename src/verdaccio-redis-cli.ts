#!/usr/bin/env node

import log from 'loglevel';
import program, { Command } from 'commander';
import version from 'project-version';

import { CommandCallback } from '../types';

import { dump } from './commands';

const runCommand = async function(callback: CommandCallback): Promise<void> {
  try {
    await callback();
    process.exit(0);
  } catch (err) {
    log.error('Error: ' + err.message);
    process.exit(1);
  }
};

program
  .version(version)
  .description('verdaccio-redis-storage CLI')
  .option('--config <path>', 'specify the path of Verdaccio configuration file')
  .option('--host <host>', 'Redis host')
  .option('--port <port>', 'Redis port')
  .option('--url <url>', 'Redis URL string')
  .option('--socket <socket>', 'Redis socket string')
  .option('--password <password>', 'Redis password')
  .option('--db <db>', 'Redis db')
  .option('--prefix <prefix>', 'Redis prefix');

program
  .command('dump [dir]')
  .description('dump Redis storage to dir')
  .action(async function(dir: string, cmd: Command) {
    await runCommand(async () => {
      await dump(dir, cmd);
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
