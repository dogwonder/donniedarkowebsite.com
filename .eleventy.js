const { EleventyRenderPlugin } = require("@11ty/eleventy");
const bundlerPlugin = require("@11ty/eleventy-plugin-bundle");
const sass = require("sass");
const path = require('node:path');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer')
const tailwindcss = require('tailwindcss')
const lightningCSS = require("@11tyrocks/eleventy-plugin-lightningcss");
const now = String(Date.now())

// Create a helpful production flag
const isProduction = process.env.NODE_ENV === 'production';

module.exports = eleventyConfig => { 

    eleventyConfig.addPassthroughCopy({"src/images": "images"});
    eleventyConfig.addPassthroughCopy({"src/scripts": "scripts"});
    eleventyConfig.addPassthroughCopy({'./node_modules/alpinejs/dist/cdn.min.js': './scripts/alpine.js'})
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

      // outputFileExtension: 'css',
      // compile: async (inputContent, inputPath) => {
      //   let parsed = path.parse(inputPath)
      //   if (parsed.name.startsWith('_')) return //Only compile files that don't start with an underscore

      //   return async () => {
      //     let output = await postcss([
      //       tailwindcss,
      //       autoprefixer
      //     ]).process(inputContent, { from: inputPath, parser: require('postcss-scss') });

      //     return output.css;
      //   }
      // }

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