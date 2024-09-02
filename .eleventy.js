const { EleventyRenderPlugin } = require("@11ty/eleventy");
const bundlerPlugin = require("@11ty/eleventy-plugin-bundle");
const sass = require("sass");
const path = require('node:path');
const HumanReadable = require("human-readable-numbers");
const lightningCSS = require("@11tyrocks/eleventy-plugin-lightningcss");
const now = String(Date.now())

// env variables
require('dotenv').config();

// Create a helpful production flag
const isProduction = process.env.NODE_ENV === 'production';

module.exports = eleventyConfig => { 

    eleventyConfig.addPassthroughCopy({"src/images": "images"});
    eleventyConfig.addPassthroughCopy({"src/scripts": "scripts"});
    eleventyConfig.addPassthroughCopy({'./node_modules/alpinejs/dist/cdn.min.js': './scripts/alpine.js'})
    eleventyConfig.addPassthroughCopy({'./node_modules/@ruffle-rs': './scripts/'})
    eleventyConfig.addPassthroughCopy({"src/files": "./"});
    eleventyConfig.addPassthroughCopy({"src/swf": "./"});
    eleventyConfig.addPassthroughCopy({"src/dns": "./"});
    eleventyConfig.addPassthroughCopy({"src/fonts": "fonts"});
    eleventyConfig.addPassthroughCopy({"src/audio": "mp3"});
    eleventyConfig.addPassthroughCopy({"src/scss/vendor/98": "css"});
    eleventyConfig.addPassthroughCopy({"./node_modules/simple-keyboard/build/css/index.css": "css/simple-keyboard.css"});

    //Tailwind
    eleventyConfig.addWatchTarget('tailwind.config.js')
    eleventyConfig.addWatchTarget('css/tailwind.css')

    //Plugins 
    eleventyConfig.addPlugin(EleventyRenderPlugin);
    eleventyConfig.addPlugin(bundlerPlugin);
    eleventyConfig.addPlugin(lightningCSS);

    //Filters
    eleventyConfig.addFilter("humanReadableNum", function (num) {
      if (num || num === 0) {
        return HumanReadable.toHumanString(num);
      }
      return "";
    });

    //Add another filter that adds 000 before a number so it's always 6 figures
    eleventyConfig.addFilter("addZeroes", function (num) {
      return num.toString().padStart(6, '0');
    });

    //Templates
    eleventyConfig.addTemplateFormats("scss");

    // Creates the extension for use
    eleventyConfig.addExtension('scss', {

      outputFileExtension: 'css',

      compile(content, inputPath) {
        let parsed = path.parse(inputPath)

        if (parsed.name.startsWith('_')) return //Only compile files that don't start with an underscore

        console.log('🔮 compiling scss...', inputPath)

        return (data) => {
          let result = sass.compile(inputPath)
          return result.css
        }
      },

    })

    // Open the browser on launch
  eleventyConfig.setBrowserSyncConfig({
    open: true
  });

  //
  // Shortcodes
  //
  eleventyConfig.addShortcode("year", () => {
      return new Date().getFullYear();
  });

  eleventyConfig.addShortcode('version', function () {
    return now
  });

  return {
    markdownTemplateEngine: 'njk',
    dataTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    dir: {
      input: 'src',
      output: 'docs'
    }
  };


}