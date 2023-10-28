import { Plugin } from '@vuepress/types';
import { resolve } from 'path';

interface Options {
  ga?: string;
}

const GtagPlugin: Plugin<Options> = (options = {}, ctx) => ({
  name: 'vuepress-ga',
  define () {
    const ga = options.ga
    const GA_ID = ga || false
    return { GA_ID }
  },
  enhanceAppFiles: resolve(__dirname, 'enhanceAppFile.js')
});

export default GtagPlugin;
