/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as answers from "../answers.js";
import type * as artists from "../artists.js";
import type * as debug from "../debug.js";
import type * as lastFm from "../lastFm.js";
import type * as lastFmApi from "../lastFmApi.js";
import type * as lobbies from "../lobbies.js";
import type * as players from "../players.js";
import type * as presence from "../presence.js";
import type * as score from "../score.js";
import type * as spotify from "../spotify.js";
import type * as tracks from "../tracks.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  answers: typeof answers;
  artists: typeof artists;
  debug: typeof debug;
  lastFm: typeof lastFm;
  lastFmApi: typeof lastFmApi;
  lobbies: typeof lobbies;
  players: typeof players;
  presence: typeof presence;
  score: typeof score;
  spotify: typeof spotify;
  tracks: typeof tracks;
  utils: typeof utils;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
