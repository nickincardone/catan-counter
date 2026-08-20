import { describe, expect, it } from '@jest/globals';
import { normalizeChatLog } from '../normalizedChat';
import type { LoggedMessage } from '../messageLogger';

function row(index: number, text: string, html: string): LoggedMessage {
  return {
    index,
    text,
    html: `<div data-index="${index}">${html}</div>`,
    loggedAt: `2026-08-17T20:00:0${index}.000Z`,
  };
}

describe('normalizeChatLog', () => {
  it('keeps conversational chat and model-readable trade resources', () => {
    const entries = normalizeChatLog(
      [
        row(
          2,
          'Alpha wants to give for',
          '<img alt="Player avatar"><span>Alpha</span> wants to give <img alt="Ore"> for <img alt="Grain">'
        ),
        row(
          1,
          'Alpha: Black, ore for no block?',
          '<span>Alpha</span>: Black, ore for no block?'
        ),
      ],
      [
        { name: 'Alpha', color: 1, colorName: 'red' },
        { name: 'Beta', color: 9, colorName: 'black' },
      ]
    );

    expect(entries).toEqual([
      expect.objectContaining({
        index: 1,
        kind: 'player-chat',
        speakerName: 'Alpha',
        speakerColor: 1,
        speakerColorName: 'red',
        message: 'Black, ore for no block?',
        colorMentions: [
          { colorName: 'black', playerName: 'Beta', playerColor: 9 },
        ],
      }),
      expect.objectContaining({
        index: 2,
        kind: 'trade-offer',
        richText: 'Alpha wants to give [Ore] for [Grain]',
        message: 'wants to give [Ore] for [Grain]',
        iconAlts: ['Ore', 'Grain'],
      }),
    ]);
  });

  it('labels non-player feed rows and separators without discarding them', () => {
    const entries = normalizeChatLog(
      [
        row(3, '', '<span><hr></span>'),
        row(
          4,
          'Dice rolled',
          'Dice rolled <img alt="dice_4"> <img alt="dice_3">'
        ),
      ],
      []
    );

    expect(entries[0]).toMatchObject({ kind: 'separator', message: '' });
    expect(entries[1]).toMatchObject({
      kind: 'system',
      richText: 'Dice rolled [dice_4] [dice_3]',
      iconAlts: ['dice_4', 'dice_3'],
    });
  });
});
