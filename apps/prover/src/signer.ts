import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { JsonRpcProvider, Wallet } from 'ethers';
import type { ProverConfig } from './config';

async function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error('Encrypted keystore password requires an interactive terminal');
  }

  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const readline = createInterface({
    input: process.stdin,
    output: mutedOutput,
    terminal: true,
  });

  process.stdout.write(prompt);
  try {
    return await readline.question('');
  } finally {
    readline.close();
    process.stdout.write('\n');
  }
}

export async function createDestinationSigner(config: ProverConfig, provider: JsonRpcProvider) {
  if (config.CC3_PRIVATE_KEY) {
    return new Wallet(config.CC3_PRIVATE_KEY, provider);
  }
  if (!config.cc3KeystorePath) {
    throw new Error('No CC3 signer is configured');
  }

  const encryptedKeystore = await readFile(config.cc3KeystorePath, 'utf8');
  let password = await readHidden('Enter CC3 Foundry keystore password: ');
  try {
    const wallet = await Wallet.fromEncryptedJson(encryptedKeystore, password);
    return wallet.connect(provider);
  } catch {
    throw new Error('Unable to decrypt the configured CC3 keystore');
  } finally {
    password = '';
  }
}
