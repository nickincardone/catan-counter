import { describe, it, expect } from '@jest/globals';
import { parseCounterOfferResources } from '../domUtils';
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
});
