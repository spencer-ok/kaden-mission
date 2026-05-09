module.exports = function(eleventyConfig) {
  // In dev mode, skip heavy image/video dirs for fast rebuilds
  if (process.env.FAST) {
    eleventyConfig.addPassthroughCopy("src/assets/css");
    eleventyConfig.addPassthroughCopy("src/assets/audio");
  } else {
    eleventyConfig.addPassthroughCopy("src/assets");
  }

  eleventyConfig.addFilter("emailMetaJson", function(inventory) {
    var meta = {};
    inventory.forEach(function(i) {
      if (i.source === 'emails') meta["/assets/images/emails/" + i.modal] = { c: i.caption || '', d: i.rawDescription || '' };
    });
    return JSON.stringify(meta);
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
