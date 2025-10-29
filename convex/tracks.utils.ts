import { Track } from "@spotify/web-api-ts-sdk";
import { load } from "cheerio";
import { Input, ALL_FORMATS, BlobSource } from "mediabunny";
import { ofetch } from "ofetch";

export async function getTrackPreviewDuration(previewUrl: string) {
  console.log(previewUrl);
  const blob = await ofetch(previewUrl, { responseType: "blob" });

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(blob),
  });

  const format = await input.getFormat();
  console.log(format);

  return await input.computeDuration();
}

// inspired by https://github.com/lakshay007/spot
export async function getPreviewUrl(track: Track) {
  const html = await ofetch(track.external_urls.spotify, {
    responseType: "text",
  });
  const $ = load(html);

  return $('meta[property="og:audio"]').attr("content");
}

const FEATURING_REGEX = /\(*(?:feat\.|ft\.|featuring) [\w\s]+\)*$/i;
export function removeFeaturings(trackName: string) {
  // search doesn't care about capturing groups
  const featIndex = trackName.search(FEATURING_REGEX);

  // some titles starts with featuring (weird but hey who am I to judge)
  if (featIndex <= 0) return trackName;

  return trackName.substring(0, featIndex).trim();
}

export function randomNumber(minInclusive: number, maxExclusive: number) {
  const minCeiled = Math.ceil(minInclusive);
  const maxFloored = Math.floor(maxExclusive);
  return Math.floor(Math.random() * (maxFloored - minCeiled)) + minCeiled;
}

export function pickRandomIndices(maxExclusive: number, length: number) {
  const indices: number[] = [];
  // should be a param?
  const allowDuplicates = maxExclusive <= length;

  while (indices.length < length) {
    const randomIndex = randomNumber(0, maxExclusive);
    if (allowDuplicates || !indices.includes(randomIndex)) {
      indices.push(randomIndex);
    }
  }

  return indices;
}
