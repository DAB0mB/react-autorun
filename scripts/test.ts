import { execa } from 'execa';
import { resolve } from 'path';

async function test() {
  await execa('npm', ['run', 'test'], {
    cwd: resolve('runtime'),
    stdio: 'inherit',
  });
  await execa('npm', ['run', 'test'], {
    cwd: resolve('plugin/babel'),
    stdio: 'inherit',
  });
  await execa('npm', ['run', 'test'], {
    cwd: resolve('plugin/swc'),
    stdio: 'inherit',
  });
}

void test();
