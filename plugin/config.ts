import { z } from 'zod';

export type ConfigInit = z.infer<typeof zConfigInit>;

export const zConfigInit = z.object({
  modules: z.record(z.string(), z.string()).optional(),
});

export class Config {
  private readonly modules = new Map([
    ['react', 'react'],
    ['react-useless', 'react-useless'],
    ...Object.entries(this.init.modules ?? {})
  ]);

  private readonly moduleKeys = new Map(
    Array.from(this.modules).map(e => e.reverse() as typeof e)
  );

  constructor(private readonly init: ConfigInit = {}) {
  }

  getModuleName(moduleKey: string) {
    return this.modules.get(moduleKey) ?? moduleKey;
  }

  getModuleKey(moduleName: string) {
    return this.moduleKeys.get(moduleName);
  }
}
