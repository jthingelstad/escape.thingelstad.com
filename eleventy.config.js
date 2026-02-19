module.exports = function(eleventyConfig) {

  // Passthrough copy — static assets
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy({ "src/_data/rooms.json": "data/rooms.json" });
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });
  eleventyConfig.addPassthroughCopy({ "src/sitemap.xml": "sitemap.xml" });

  // --- Nunjucks Filters ---

  // Format ISO date string to "August 2, 2025"
  eleventyConfig.addFilter("formatDate", (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  // Format location object to "City, Region, Country"
  eleventyConfig.addFilter("formatLocation", (loc) => {
    if (!loc) return '';
    const parts = [];
    if (loc.city) parts.push(loc.city);
    if (loc.region) parts.push(loc.region);
    if (loc.country) parts.push(loc.country);
    return parts.join(', ');
  });

  // Classify tag for CSS class
  eleventyConfig.addFilter("classifyTag", (tag) => {
    if (tag === 'best') return 'best';
    if (tag.startsWith('terpeca-')) return 'terpeca';
    if (tag === 'online') return 'online';
    if (/^[a-z]+-\d{4}$/.test(tag)) return 'trip';
    return 'default';
  });

  // Format tag for display label
  eleventyConfig.addFilter("formatTagLabel", (tag) => {
    if (tag === 'best') return '\u2605 Best';
    if (tag.startsWith('terpeca-')) return 'TERPECA ' + tag.split('-')[1];
    if (tag === 'online') return 'Online';
    if (/^[a-z]+-\d{4}$/.test(tag)) {
      const parts = tag.split('-');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + ' ' + parts[1];
    }
    return tag;
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
