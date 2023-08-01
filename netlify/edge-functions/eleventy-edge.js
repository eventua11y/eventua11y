import {
  EleventyEdge,
  precompiledAppData,
} from "./_generated/eleventy-edge-app.js";

export default async (request, context) => {
  try {
    let edge = new EleventyEdge("edge", {
      request,
      context,
      precompiled: precompiledAppData,

      // default is [], add more keys to opt-in e.g. ["appearance", "username"]
      cookies: [],
    });

    const locale = request.headers["accept-language"] || "en-GB";
    const { timezone } = context.geo;
    const date = new Date();
    const localDateNow = date.toLocaleDateString(locale, {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    edge.config((eleventyConfig) => {
      // Add some custom Edge-specific configuration
      // e.g. Fancier json output
      // eleventyConfig.addFilter("json", obj => JSON.stringify(obj, null, 2));
      eleventyConfig.addShortcode("today", () => localDateNow);
    });

    return await edge.handleResponse();
  } catch (e) {
    console.log("ERROR", { e });
    return context.next(e);
  }
};
