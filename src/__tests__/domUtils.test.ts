import { describe, it, expect, afterEach } from '@jest/globals';
import {
  parseCounterOfferResources,
  findChatContainer,
  getPlayerCardCounts,
} from '../domUtils';
import { createElementFromHTML } from './testUtils';

describe('dom utils', () => {
  describe('counter offer', () => {
    it('should parse the counter offer correctly', () => {
      const chatHTML = `
            <div class="O8TLknGehHkVfT5IRcHW" style="opacity: 1;"><div class="k26ZLqas5rMgu8g4jBGm tkyRocbV__TF7koap6TP yelUykqbNk4EnP5CDyR9"><img class="JNCoQelYM6It4m72cNuo" src="/dist/images/icon_player_loggedin.svg?rev=81f805a5767c2735edbc"></div><span><span style="font-weight:600;word-break:break-all;color:#62B95D">Arop</span> proposed counter offer to <span style="font-weight:600;word-break:break-all;color:#E27174">sadpanda10</span>, offering <img src="/dist/images/card_brick.svg?rev=4beb37891c6c77ebb485" alt="brick" height="20" width="14.25" class="lobby-chat-text-icon">  for <img src="/dist/images/card_grain.svg?rev=b72852bcde4c00a5f809" alt="grain" height="20" width="14.25" class="lobby-chat-text-icon"><img src="/dist/images/card_grain.svg?rev=b72852bcde4c00a5f809" alt="grain" height="20" width="14.25" class="lobby-chat-text-icon"> </span></div>
            `;
      const chatElement = createElementFromHTML(chatHTML);
      const resources = parseCounterOfferResources(chatElement);

      expect(resources).toEqual({
        brick: 1,
      });
    });
  });

  describe('findChatContainer', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    // Regression test for the "overlay disappears after a page refresh" bug.
    // Colonist renders the chat as a virtual scroller that only keeps the most
    // recent ~15 message rows in the DOM. The "Learn how to play in the rulebook"
    // welcome message (the only element carrying a[href="#open-rulebook"]) sits at
    // the top of the log, so once the game progresses it scrolls out of the
    // rendered DOM. After a mid-game refresh it is no longer present, so a
    // container lookup that depends on that anchor finds nothing and the overlay
    // never attaches. The container must instead be found via the data-index rows.
    it('finds the chat container after a mid-game refresh (no rulebook anchor present)', () => {
      document.body.innerHTML = `
        <div class="virtualScroller-lSkdkGJi">
          <div data-index="42" class="scrollItemContainer-WXX2rkzf">
            <div class="feedMessage-O8TLknGe">
              <span><span style="font-weight:600">Mathe</span> built a road</span>
            </div>
          </div>
          <div data-index="43" class="scrollItemContainer-WXX2rkzf">
            <div class="feedMessage-O8TLknGe">
              <span><span style="font-weight:600">Botzow</span> rolled</span>
            </div>
          </div>
        </div>`;

      const scroller = document.querySelector('.virtualScroller-lSkdkGJi');
      // The container is the parent of the message rows, so content.ts can iterate
      // its children and observe it for newly added rows.
      expect(findChatContainer()).toBe(scroller);
    });

    // The same lookup must keep working at game start, when the welcome message
    // (with the rulebook anchor) is still rendered as the first row.
    it('finds the chat container at game start (welcome message still rendered)', () => {
      document.body.innerHTML = `
        <div class="virtualScroller-lSkdkGJi">
          <div data-index="0" class="scrollItemContainer-WXX2rkzf">
            <div class="feedMessage-O8TLknGe">
              <span>Happy settling! Learn how to play in the
                <a href="#open-rulebook">rulebook</a>.</span>
            </div>
          </div>
          <div data-index="1" class="scrollItemContainer-WXX2rkzf">
            <div class="feedMessage-O8TLknGe">
              <span><span style="font-weight:600">Mathe</span> rolled</span>
            </div>
          </div>
        </div>`;

      const scroller = document.querySelector('.virtualScroller-lSkdkGJi');
      expect(findChatContainer()).toBe(scroller);
    });

    it('returns null when there is no chat on the page', () => {
      document.body.innerHTML = '<div><p>no chat here</p></div>';
      expect(findChatContainer()).toBeNull();
    });
  });

  describe('getPlayerCardCounts', () => {
    afterEach(() => {
      document.body.innerHTML = '';
    });

    // Mirrors colonist's [data-player-information-container]: one [data-player-color]
    // block per player, each with the player name, a [data-resource-card] count and
    // a [data-development-card] count.
    const PANEL = `
      <div data-player-information-container="true">
        <div data-player-color="4">
          <div>Botzow</div><span>4</span>
          <div data-resource-card><img><div>7</div></div>
          <div data-development-card><img><div>0</div></div>
        </div>
        <div data-player-color="2">
          <div>Mathe</div><span>3</span>
          <div data-resource-card><img><div>4</div></div>
          <div data-development-card><img><div>1</div></div>
        </div>
        <div data-player-color="1">
          <div>Camilo#6469</div><span>7 (8)</span>
          <div data-resource-card><img><div>7</div></div>
          <div data-development-card><img><div>3</div></div>
        </div>
      </div>`;

    it('reads resource-card counts per player from the player-information panel', () => {
      document.body.innerHTML = PANEL;
      expect(
        getPlayerCardCounts(['Botzow', 'Mathe', 'Camilo#6469'])
      ).toEqual({ Botzow: 7, Mathe: 4, 'Camilo#6469': 7 });
    });

    it('only returns counts for the requested players', () => {
      document.body.innerHTML = PANEL;
      expect(getPlayerCardCounts(['Mathe'])).toEqual({ Mathe: 4 });
    });

    it('returns an empty object when the panel is not present', () => {
      document.body.innerHTML = '<div>no panel</div>';
      expect(getPlayerCardCounts(['Mathe'])).toEqual({});
    });
  });
});
