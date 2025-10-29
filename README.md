# friend-blind-test

## Preview tracks

TO play the songs for the blind test, I have 2 solutions:

### Spotify IFrame API

I can use the Spotify IFrame API by loading it the first time, and then for each song, load the URI in the iframe, and play the song, using the embed controller. It adds some delay since it has to get the track metadata (cover, colors, etc.), and the actual preview. And I have to hide it to not reveal the answer (and not allow to use the controls). Though the iframe node is still available in the document, so if someone wants to cheat, they can. AND I have to make sure the iframe doesn't get the user cookies, otherwise a Spotify user won't have the preview and it will mess up everything. But otherwise, it works.

### Scrapping the Spotify preview url

Based on the [spotify-preview-finder](https://github.com/lakshay007/spot) package, it should be possible to actually retrieve the preview URL from the track page, and simply use it however I want. For that, it needs to load the page, and grab a specific meta tag (`og:audio`) which contains the preview URL. The page could be loaded server side, which would have several benefits :

1. It would actually load only the initial HTML, not all the CSS and JS, and there won't be any rendering.
2. It can be fetched upfront, meaning there's no delay when starting a new song.
3. They can all be fetched in one-go, while generating the songs for the blind-test.
4. Using this method, the preview image is also available, which could be useful in the future (e.g. showing past songs).

However, the package has some flaws:

1. The way it searches for songs is solely based on the song name. Since I have access to any song metadata (the id, but also directly the page url), I should be able to bypass this step.
2. It's suboptimal when looking for the preview url, as it scans all the elements on the page. Using the appropriate selector (`meta[property="og:audio]), it should more efficient (though it may save like 5ms, since anyway, it's at the top of the document, there's not a lot of elements to go through).
3. Not written in typescript nor exposing type definitions

## Get tracks by genre

Only artists have genres associated to them. Thus, before starting a blind test, players are asked to type some artists they listen to, to extract their genres. Some artists don't have any, and some genres aren't specific enough (like "french rap"). Using the genres, I can search for tracks, artists and albums. I also extract the years of activity of an artist to try to match the player's taste as best as possible (though for artists who stopped, but reeditions of their albums are still released, that still counts in the year of activities).

The search endpoint allow for some filters, but it's very flacky:

- A year filter can be used to get results from that year (track, album, artist). A range can also be passed instead, which works on tracks, but not on albums nor artists.
- A genre filter can be used as well, but the results aren't always accurate. For example, when searching for `genre:"french rap new wave"` or `genre:"french rap" genre:"new wave"`, it doesn't return any artist, even though there are artists with these genres. Though, when I search for `genre:"classic rock psychedelic rock"`, I do get correct results.
- When not using a filter, it does return result that were not returned before, but the accuracy is still flawed. For example, when searing for `french rap new wave`, it does return artists with the genre `french rap`, but they may not have `new wave`. Also, it may return artist with `french` or `rap` in their name, but no genre related to the search.

## TODO

- [ ] Scoring
  - [ ] Less points for songs related to a user's genre
  - [ ] Points by speed
- [ ] Include genres unrelated to users' choices
- [ ] Min 1 artist
- [ ] Difficulty settings (changes popularity threshold)
- [ ] Prettier
- [ ] Update tanstack router config and repo structure
- [ ] Update code with deprecation notes (ts-router, eslint)
- [ ] Debuggin tools
  - [ ] Pause
  - [ ] Skip
  - [ ] Debugging logger
