import axios from "axios";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import dotenv from "dotenv";
import { ChromaClient } from "chromadb";

dotenv.config();

const openai = new OpenAI();

const chromaClient = new ChromaClient({ path: "http://localhost:8000" });
chromaClient.heartbeat();

const WEB_COLLECTION = `WEB_SCRAPED_DATA_COLLECTION-1`;

interface PageContent {
  url: string;
  head: string;
  body: string;
}

const scrapeWebpage = async (url = "") => {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const pageHead = $("head").html();
  const pageBody = $("body").html();

  const internalLinks = new Set();
  const externalLinks = new Set();

  $("a").each((_, el) => {
    const link = $(el).attr("href");

    if (link === "/") return;

    if (typeof link === "string") {
      if (link?.startsWith("http") || link?.startsWith("https")) {
        externalLinks.add(link);
      } else {
        internalLinks.add(link);
      }
    }
  });

  return {
    head: pageHead,
    body: pageBody,
    internalLinks: Array.from(internalLinks),
    externalLinks: Array.from(externalLinks),
  };
};

// vector embedding generation with openai
const generateVectorEmbeddings = async ({ text }: any) => {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });
  return embedding.data[0].embedding;
};

// chromadb collection
const insertIntoDB = async ({ embeddings, url, body = " ", head }: any) => {
  const collection = await chromaClient.getOrCreateCollection({
    name: WEB_COLLECTION,
  });
  await collection.add({
    ids: [url],
    embeddings: [embeddings],
    metadatas: [{ url, body, head }],
  });
};

// ingest function
const ingest = async (url: any) => {
  console.log(`Started ingesting ${url}`);

  const { head, body, internalLinks } = await scrapeWebpage(url);
  const bodyChunks = chunkText(body ?? "", 1000);

  // const headEmbeddings = await generateVectorEmbeddings({ text: head });
  // await insertIntoDB({ embeddings: headEmbeddings, url });

  for (const chunk of body ?? "") {
    const bodyEmbeddings = await generateVectorEmbeddings({ text: chunk });
    await insertIntoDB({ embeddings: bodyEmbeddings, url, head, body: chunk });
  }

  for (const link of internalLinks) {
    const _url = `${url}${link}`;
    await ingest(_url);
  }
  console.log(`Ingested the url`);
};

ingest("https://course.cutm.ac.in/").then(console.log);

// splitting body into chunks
const chunkText = (text: string, chunkSize: number): string[] => {
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks;
};
