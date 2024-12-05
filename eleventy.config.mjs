// Import environment variables
import dotenv from 'dotenv';
dotenv.config();

// Other dependencies
import sass from 'sass';
import path from 'path';
import HumanReadable from 'human-readable-numbers';

// Import Eleventy plugins
import { EleventyRenderPlugin } from "@11ty/eleventy";
import bundlerPlugin from "@11ty/eleventy-plugin-bundle";

// Capture the current timestamp
const now = String(Date.now());

export default async function(eleventyConfig) {

    // Passthrough Copy Configurations
    const passthroughCopies = {
      "src/images": "images",
      "src/scripts": "scripts",
      "./node_modules/alpinejs/dist/cdn.min.js": "scripts/alpine.js",
      "./node_modules/@ruffle-rs": "scripts/",
      "src/files": "./",
      "src/swf": "./",
      "src/dns": "./",
      "src/fonts": "fonts",
      "src/audio": "mp3",
      "src/scss/vendor/98": "css",
      "./node_modules/simple-keyboard/build/css/index.css": "css/simple-keyboard.css"
    };

    for (const [from, to] of Object.entries(passthroughCopies)) {
      eleventyConfig.addPassthroughCopy({ [from]: to });
    }

    // Tailwind Watch Targets
    eleventyConfig.addWatchTarget('tailwind.config.js');
    eleventyConfig.addWatchTarget('css/tailwind.css');

    // Register Plugins
    eleventyConfig.addPlugin(EleventyRenderPlugin);
    eleventyConfig.addPlugin(bundlerPlugin);

    // Bundles
    eleventyConfig.addBundle("css");

    // Filters
    eleventyConfig.addFilter("humanReadableNum", (num) => {
      return (num || num === 0) ? HumanReadable.toHumanString(num) : "";
    });

    eleventyConfig.addFilter("addZeroes", (num) => {
      return num.toString().padStart(6, '0');
    });

    // Template Formats
    eleventyConfig.addTemplateFormats("scss");

    // SCSS Extension
    eleventyConfig.addExtension('scss', {
      outputFileExtension: 'css',

      compile(content, inputPath) {
        const parsed = path.parse(inputPath);

        // Skip partials
        if (parsed.name.startsWith('_')) return;

        console.log('🔮 Compiling SCSS...', inputPath);

        return () => {
          const result = sass.compile(inputPath);
          return result.css;
        };
      },
    });

    // BrowserSync Configuration
    eleventyConfig.setBrowserSyncConfig({
      open: true
    });

    // Shortcodes
    eleventyConfig.addShortcode("year", () => new Date().getFullYear());

    eleventyConfig.addShortcode('version', () => now);

}

// Eleventy Configuration Object
export const config = {
  dir: {
    input: 'src',
    output: 'docs'
  },
  markdownTemplateEngine: "njk",
  htmlTemplateEngine: "njk",
  dataTemplateEngine: "njk"
};