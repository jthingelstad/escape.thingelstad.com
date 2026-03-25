const htmlmin = require("html-minifier-terser");
const MarkdownIt = require("markdown-it");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { roomSlug, slugify } = require("./lib/catalog");

function featuredEntityUrl(type, entity) {
  return `/${type}/${encodeURIComponent(entity.slug)}/`;
}

function roomsFilterUrl(type, entity) {
  return `/rooms/?${encodeURIComponent(type)}=${encodeURIComponent(entity.slug)}`;
}

module.exports = function(eleventyConfig) {
  const assetHashes = {};
  const richText = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true
  });

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

  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

  eleventyConfig.addFilter("roomSlug", (room) => {
    if (!room) return "";
    if (room.slug) return room.slug;
    if (!room.id || !room.game) return "";
    return roomSlug(room.id, room.game);
  });

  eleventyConfig.addFilter("roomPath", (room) => {
    const slug = room?.slug || (room?.id && room?.game ? roomSlug(room.id, room.game) : "");
    return slug ? `/room/${slug}/` : "/";
  });

  eleventyConfig.addFilter("formatDate", (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  });

  eleventyConfig.addFilter("formatLocation", (loc) => {
    if (!loc) return "";
    const parts = [];
    if (loc.city) parts.push(loc.city);
    if (loc.region) parts.push(loc.region);
    if (loc.country) parts.push(loc.country);
    return parts.join(", ");
  });

  eleventyConfig.addFilter("formatTimeLeft", (val) => {
    if (val == null) return "";
    const abs = Math.abs(val);
    const mins = Math.floor(abs);
    const secs = Math.round((abs - mins) * 60);
    const suffix = val < 0 ? "over" : "left";
    return `${mins}m ${secs}s ${suffix}`;
  });

  eleventyConfig.addFilter("formatRating", (value) => {
    if (value == null || value === "") return "";
    const num = Number(value);
    if (Number.isNaN(num)) return "";
    return Number.isInteger(num) ? String(num) : num.toFixed(1);
  });

  eleventyConfig.addFilter("slugify", (value) => slugify(value));

  eleventyConfig.addFilter("entityUrl", (entity, type) => {
    if (!entity || !type) return "/rooms/";
    if (type === "theme" || type === "award") return roomsFilterUrl(type, entity);
    if (type === "list") return featuredEntityUrl(type, entity);
    return entity.featured ? featuredEntityUrl(type, entity) : roomsFilterUrl(type, entity);
  });

  eleventyConfig.addFilter("entityFilterUrl", (entity, type) => {
    if (!entity || !type) return "/rooms/";
    return roomsFilterUrl(type, entity);
  });

  eleventyConfig.addFilter("entityChipClass", (entity, type) => {
    const classes = [`entity-chip`, `entity-chip-${type}`];
    if (entity?.featured) classes.push("entity-chip-featured");
    return classes.join(" ");
  });

  eleventyConfig.addFilter("queryValue", (value) => encodeURIComponent(value || ""));

  eleventyConfig.addFilter("richText", (value) => {
    if (value == null || value === "") return "";
    return richText.render(String(value).trim());
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
