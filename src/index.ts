import axios from "axios";
import * as cheerio from "cheerio";

const scrapeWebpage = async (url = "") => {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const pageHead = $("head").html();
  const pageBody = $("body").html();

  const internalLinks: string[] = [];
  const externalLinks: string[] = [];

  $("a").each((_, el) => {
    const link = $(el).attr("href");

    if (link === "/") return;

    if (typeof link === "string") {
      if (link?.startsWith("http") || link?.startsWith("https")) {
        externalLinks.push(link);
      } else {
        internalLinks.push(link);
      }
    }
  });

  return { head: pageHead, body: pageBody, internalLinks, externalLinks };
};

scrapeWebpage("https://course.cutm.ac.in/").then(console.log);
