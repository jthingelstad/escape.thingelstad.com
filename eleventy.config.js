const htmlmin = require("html-minifier-terser");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

module.exports = function(eleventyConfig) {
  const isBestTag = (tag) => tag === "best" || tag === "Favorite Things";
  const isTerpecaTag = (tag) => tag === "TERPECA" || tag.startsWith("terpeca-");
  const isTripTag = (tag) => /^[A-Za-z][A-Za-z ]+\d{4}$/.test(tag) || /^[a-z]+-\d{4}$/.test(tag);

  // Cache-busting: compute content hash for static assets
  const assetHashes = {};
  eleventyConfig.addFilter("cacheBust", (url) => {
    if (assetHashes[url]) return `${url}?v=${assetHashes[url]}`;
    const filePath = path.join(__dirname, "src", url);
    try {
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
      assetHashes[url] = hash;
      return `${url}?v=${hash}`;
    } catch {
      return url;
    }
  });

  // HTML minification in production
  eleventyConfig.addTransform("htmlmin", async function(content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      return await htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true
      });
    }
    return content;
  });

  // Passthrough copy — static assets
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

  // --- Nunjucks Filters ---

  // Generate room URL slug: "86-loose-sleuth"
  eleventyConfig.addFilter("roomSlug", (room) => {
    if (!room || !room.id || !room.game) return '';
    const slug = room.game
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${room.id}-${slug}`;
  });

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
    if (isBestTag(tag)) return 'best';
    if (isTerpecaTag(tag)) return 'terpeca';
    if (tag === 'online') return 'online';
    if (isTripTag(tag)) return 'trip';
    return 'default';
  });

  // Format timeLeft (minutes remaining) to "Xm Ys left" or "Xm Ys over"
  eleventyConfig.addFilter("formatTimeLeft", (val) => {
    if (val == null) return '';
    const abs = Math.abs(val);
    const mins = Math.floor(abs);
    const secs = Math.round((abs - mins) * 60);
    const suffix = val < 0 ? 'over' : 'left';
    return `${mins}m ${secs}s ${suffix}`;
  });

  // Format tag for display label
  eleventyConfig.addFilter("formatTagLabel", (tag) => {
    if (tag === 'best') return '\u2605 Best';
    if (tag === 'Favorite Things') return '\u2605 Favorite Things';
    if (tag === 'TERPECA') return 'TERPECA';
    if (tag.startsWith('terpeca-')) return 'TERPECA ' + tag.split('-')[1];
    if (tag === 'online') return 'Online';
    if (/^[A-Za-z][A-Za-z ]+\d{4}$/.test(tag)) return tag;
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
