import { Plugin } from '@vuepress/types';
import { convert } from 'html-to-text'

interface Options {
  defaultImgPath?: string;
}

const ogPlugin: Plugin<Options> = (options = {}, ctx) => ({
  name: 'vuepress-opengraph',
  extendPageData($page) {
    if ($page.frontmatter) {
      const { title, img } = $page.frontmatter;
      const defaultImgPath = options.defaultImgPath || '';

      const excerpt = $page.excerpt ? convert($page.excerpt) : ""
      const description = $page.frontmatter.description || excerpt || ctx.getSiteData().description

      const existingMeta = $page.frontmatter.meta as Record<string, any> || [];
      const newMeta = [
        { name: 'og:title', content: title },
        { name: 'og:description', content: description },
        { name: 'og:image', content: img || defaultImgPath },
      ];
      $page.frontmatter.meta = existingMeta.concat(newMeta);
    }
  },
});

export default ogPlugin;
