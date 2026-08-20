import { beforeEach, describe, expect, it } from '@jest/globals';
import { blockedRobberSection } from '../ui/sections/blockedRobber';
import { cardFlowSection } from '../ui/sections/cardFlow';
import { cardFlowLedgerSection } from '../ui/sections/cardFlowLedger';
import { devDeckSection } from '../ui/sections/devDeck';
import { diceSection } from '../ui/sections/dice';
import { handsSection } from '../ui/sections/hands';
import { playersSection } from '../ui/sections/players';
import { unknownStealsSection } from '../ui/sections/unknownSteals';
import type {
  SectionAction,
  SectionContext,
  SectionDefinition,
} from '../ui/sections/types';
import { RESOURCE_ORDER } from '../ui/view/types';
import type {
  CardFlowView,
  GameView,
  PlayerView,
  ResourceKey,
  StealView,
} from '../ui/view/types';

function cells(
  known: Partial<Record<ResourceKey, number>> = {},
  probable: Partial<Record<ResourceKey, number>> = {}
) {
  return RESOURCE_ORDER.map(resource => {
    const count = known[resource] ?? 0;
    const probability = probable[resource] ?? 0;
    return {
      resource,
      known: count,
      probability,
      probabilityLabel:
        probability > 0 ? `+${Math.round(probability * 100)}%` : '',
      hasAny: count > 0 || probability > 0,
    };
  });
}

function player(name: string, overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    name,
    color: '#59a8e8',
    knownCards: 0,
    cells: cells(),
    victoryPoints: 0,
    knights: 0,
    settlements: 5,
    cities: 4,
    roads: 15,
    isYou: false,
    ...overrides,
  };
}

function view(overrides: Partial<GameView> = {}): GameView {
  return {
    players: [],
    bank: RESOURCE_ORDER.map(resource => ({ resource, left: 19, total: 19 })),
    steals: [],
    openStealCount: 0,
    blocked: [],
    blockedTotal: 0,
    dice: {
      totalRolls: 0,
      bars: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({
        n,
        count: 0,
        heightPct: 0,
        expectedTopPct: 100,
        expected: 0,
        tone: n === 7 ? ('seven' as const) : ('normal' as const),
      })),
    },
    devDeck: {
      remaining: 25,
      cards: [
        {
          key: 'knights',
          name: 'Knight',
          icon: 'knight.svg',
          left: 14,
          total: 14,
          leftPct: 100,
          caption: '14 unseen',
          untouched: true,
        },
        {
          key: 'monopolies',
          name: 'Monopoly',
          icon: 'mono.svg',
          left: 2,
          total: 2,
          leftPct: 100,
          caption: '2 unseen',
          untouched: true,
        },
        {
          key: 'roadBuilders',
          name: 'Roads',
          icon: 'rb.svg',
          left: 2,
          total: 2,
          leftPct: 100,
          caption: '2 unseen',
          untouched: true,
        },
        {
          key: 'yearOfPlenties',
          name: 'Plenty',
          icon: 'yop.svg',
          left: 2,
          total: 2,
          leftPct: 100,
          caption: '2 unseen',
          untouched: true,
        },
        {
          key: 'victoryPoints',
          name: 'Vic. Pt',
          icon: 'vp.svg',
          left: 5,
          total: 5,
          leftPct: 100,
          caption: '5 unseen',
          untouched: true,
        },
      ],
    },
    cardFlow: [],
    youPlayerName: null,
    hasStarted: true,
    isLoadingHistory: false,
    ...overrides,
  };
}

function flow(
  name: string,
  overrides: Partial<CardFlowView> = {}
): CardFlowView {
  return {
    name,
    color: '#59a8e8',
    got: 0,
    robbed: 0,
    spentAndTraded: 0,
    gained: 0,
    dice: 0,
    robGain: 0,
    devGain: 0,
    tradeGain: 0,
    lost: 0,
    sevens: 0,
    robLoss: 0,
    monoLoss: 0,
    tradeLoss: 0,
    spent: 0,
    hand: 0,
    ...overrides,
  };
}

function steal(overrides: Partial<StealView> = {}): StealView {
  return {
    id: 'steal-1',
    thief: 'Alice',
    thiefColor: '#59a8e8',
    victim: 'Bob',
    victimColor: '#e35b5b',
    time: '6:35:45 PM',
    resolved: false,
    resolvedResource: null,
    canUndo: false,
    candidates: [
      { resource: 'wheat', probability: 0.5, label: 'wheat 50%' },
      { resource: 'ore', probability: 0.5, label: 'ore 50%' },
    ],
    ...overrides,
  };
}

let actions: SectionAction[] = [];
let host: HTMLElement;

function mount(definition: SectionDefinition, initial: GameView) {
  host = document.createElement('div');
  document.body.appendChild(host);
  const ctx: SectionContext = {
    axis: definition.supports[0],
    assetUrl: path => path,
    emit: action => actions.push(action),
  };
  return definition.mount(host, initial, ctx);
}

const text = (selector: string) =>
  host.querySelector(selector)?.textContent?.trim() ?? '';
const all = (selector: string) => Array.from(host.querySelectorAll(selector));

beforeEach(() => {
  document.body.innerHTML = '';
  actions = [];
});

describe('hands section', () => {
  it('shows what is left in the bank', () => {
    const bank = RESOURCE_ORDER.map(resource => ({
      resource,
      left: resource === 'wheat' ? 11 : 19,
      total: 19,
    }));
    mount(handsSection, view({ bank, players: [player('Alice')] }));

    expect(all('.bank-count').map(node => node.textContent)).toEqual([
      '19/19',
      '19/19',
      '19/19',
      '11/19',
      '19/19',
    ]);
  });

  it('renders a row per player with their guaranteed total', () => {
    mount(
      handsSection,
      view({
        players: [
          player('Alice', {
            knownCards: 3,
            cells: cells({ wheat: 2, ore: 1 }),
          }),
          player('Bob', { color: '#e35b5b' }),
        ],
      })
    );

    expect(all('.player-row')).toHaveLength(2);
    expect(text('.player-name')).toBe('Alice');
    expect(text('.player-summary')).toBe('3 known');
    expect(
      (all('.player-row')[1].querySelector('.player-name') as HTMLElement).style
        .color
    ).toBe('rgb(227, 91, 91)');
  });

  it('dims a zero even when the cell is tinted by a probable holding', () => {
    mount(
      handsSection,
      view({
        players: [
          player('Alice', { cells: cells({ wheat: 2 }, { ore: 0.5 }) }),
        ],
      })
    );

    const [tree, , , wheat, ore] = all('.cell');
    expect(wheat.classList.contains('cell--zero')).toBe(false);
    expect(ore.classList.contains('cell--zero')).toBe(true); // zero, but possible
    expect(ore.querySelector('.cell-probability')!.textContent).toBe('+50%');
    expect(tree.classList.contains('cell--zero')).toBe(true);
    expect(tree.querySelector('.cell-probability')!.textContent).toBe('');
  });

  it('patches values in place rather than rebuilding rows', () => {
    const section = mount(
      handsSection,
      view({ players: [player('Alice', { knownCards: 1 })] })
    );
    const row = host.querySelector('.player-row');

    section.update(view({ players: [player('Alice', { knownCards: 4 })] }));

    expect(host.querySelector('.player-row')).toBe(row); // same node
    expect(text('.player-summary')).toBe('4 known');
  });

  it('rebuilds when the seating changes', () => {
    const section = mount(handsSection, view({ players: [player('Alice')] }));
    section.update(view({ players: [player('Alice'), player('Bob')] }));
    expect(all('.player-row')).toHaveLength(2);
  });

  it('says it is waiting before anyone is seated', () => {
    mount(handsSection, view());
    expect(
      (host.querySelector('.section-empty') as HTMLElement).style.display
    ).toBe('');
  });
});

describe('unknown steals section', () => {
  it('names both players and lists every candidate', () => {
    mount(unknownStealsSection, view({ steals: [steal()], openStealCount: 1 }));

    expect(text('.steal-who')).toBe('Alice stole from Bob');
    expect(text('.steal-time')).toBe('6:35:45 PM');
    expect(all('.chip').map(chip => chip.textContent!.trim())).toEqual([
      'wheat 50%',
      'ore 50%',
    ]);
    expect(text('.section-label')).toBe('Unknown steals · 1');
  });

  it('emits the resolution when a chip is clicked', () => {
    mount(unknownStealsSection, view({ steals: [steal()], openStealCount: 1 }));
    (all('.chip')[1] as HTMLElement).click();

    expect(actions).toEqual([
      { type: 'resolve-steal', id: 'steal-1', resource: 'ore' },
    ]);
  });

  it('shows a resolved steal as confirmed, with an undo', () => {
    mount(
      unknownStealsSection,
      view({
        steals: [
          steal({
            resolved: true,
            resolvedResource: 'ore',
            canUndo: true,
            candidates: [
              { resource: 'ore', probability: 1, label: 'ore · confirmed' },
            ],
          }),
        ],
        openStealCount: 0,
      })
    );

    expect(host.querySelector('.steal--resolved')).toBeTruthy();
    expect(text('.chip--confirmed')).toBe('ore · confirmed');
    expect((all('.chip')[0] as HTMLButtonElement).disabled).toBe(true);

    (host.querySelector('[data-undo-id]') as HTMLElement).click();
    expect(actions).toEqual([{ type: 'undo-steal', id: 'steal-1' }]);
  });

  it('offers no undo for a resolution the tracker made itself', () => {
    mount(
      unknownStealsSection,
      view({
        steals: [
          steal({ resolved: true, resolvedResource: 'ore', canUndo: false }),
        ],
      })
    );
    expect(host.querySelector('[data-undo-id]')).toBeNull();
  });

  it('does not double-fire after a re-render', () => {
    const section = mount(
      unknownStealsSection,
      view({ steals: [steal()], openStealCount: 1 })
    );
    section.update(view({ steals: [steal()], openStealCount: 1 }));
    section.update(view({ steals: [steal()], openStealCount: 1 }));

    (all('.chip')[0] as HTMLElement).click();
    expect(actions).toHaveLength(1);
  });

  it('stops listening once destroyed', () => {
    const section = mount(
      unknownStealsSection,
      view({ steals: [steal()], openStealCount: 1 })
    );
    const chip = all('.chip')[0] as HTMLElement;
    section.destroy();
    chip.click();
    expect(actions).toHaveLength(0);
  });
});

describe('blocked by robber section', () => {
  it('lists each blocked number and totals what was denied', () => {
    mount(
      blockedRobberSection,
      view({
        blocked: [
          { diceNumber: 5, resource: 'tree', count: 3 },
          { diceNumber: 8, resource: 'wheat', count: 1 },
        ],
        blockedTotal: 4,
      })
    );

    expect(all('.blocked-number').map(n => n.textContent)).toEqual(['5', '8']);
    expect(all('.blocked-count').map(n => n.textContent)).toEqual(['×3', '×1']);
    expect(text('.section-hint')).toBe('4 denied');
  });

  it('says so when the robber has cost nobody anything', () => {
    mount(blockedRobberSection, view());
    expect(all('.blocked-row')).toHaveLength(0);
    expect(
      (host.querySelector('.section-empty') as HTMLElement).style.display
    ).toBe('');
  });
});

describe('dice section', () => {
  const rolled = () =>
    view({
      dice: {
        totalRolls: 12,
        bars: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({
          n,
          count: n === 6 ? 8 : n === 7 ? 4 : 0,
          heightPct: n === 6 ? 100 : n === 7 ? 50 : 0,
          expectedTopPct: n === 6 ? 80 : 20,
          expected: n === 6 ? 1.7 : 2,
          tone:
            n === 7
              ? ('seven' as const)
              : n === 6
                ? ('hot' as const)
                : ('normal' as const),
        })),
      },
    });

  it('draws a column per total with counts and an axis', () => {
    mount(diceSection, rolled());
    expect(all('.dice-column')).toHaveLength(11);
    expect(all('.dice-axis span').map(n => n.textContent)).toEqual([
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
    ]);
    expect(text('.section-label')).toBe('Dice · 12 rolls');
  });

  it('scales bars and marks sevens and hot numbers apart', () => {
    mount(diceSection, rolled());
    const columns = all('.dice-column');
    const six = columns[4];
    const seven = columns[5];

    expect((six.querySelector('.dice-bar') as HTMLElement).style.height).toBe(
      '100%'
    );
    expect(six.classList.contains('dice-column--hot')).toBe(true);
    expect(seven.classList.contains('dice-column--seven')).toBe(true);
  });

  it('hides the expected-rate tick on a number nobody has rolled', () => {
    mount(diceSection, rolled());
    const columns = all('.dice-column');
    expect(
      (columns[0].querySelector('.dice-tick') as HTMLElement).style.display
    ).toBe('none');
    expect(
      (columns[4].querySelector('.dice-tick') as HTMLElement).style.display
    ).toBe('');
  });

  it('reuses its columns across updates', () => {
    const section = mount(diceSection, view());
    const first = host.querySelector('.dice-column');
    section.update(rolled());
    expect(host.querySelector('.dice-column')).toBe(first);
  });
});

describe('dev deck section', () => {
  it('shows unplayed over total, with the attribution caption', () => {
    const base = view();
    const cards = base.devDeck.cards.map(card =>
      card.key === 'knights'
        ? {
            ...card,
            left: 12,
            leftPct: (12 / 14) * 100,
            caption: '2 played',
            untouched: false,
          }
        : card
    );
    mount(devDeckSection, view({ devDeck: { remaining: 23, cards } }));

    expect(text('.section-label')).toBe('Dev deck · 23 left');
    expect(all('.dev-ratio').map(n => n.textContent)).toEqual([
      '12/14',
      '2/2',
      '2/2',
      '2/2',
      '5/5',
    ]);
    expect(all('.dev-caption')[0].textContent).toBe('2 played');
    expect(all('.dev-tile')[0].classList.contains('dev-tile--untouched')).toBe(
      false
    );
    expect(all('.dev-tile')[4].classList.contains('dev-tile--untouched')).toBe(
      true
    );
  });

  it('sizes each bar by how much of the type is unplayed', () => {
    mount(devDeckSection, view());
    expect(
      all('.dev-fill').map(node => (node as HTMLElement).style.width)
    ).toEqual(['100%', '100%', '100%', '100%', '100%']);
  });
});

describe('card flow section', () => {
  const busy = () =>
    view({
      cardFlow: [
        flow('Alice', {
          got: 34,
          devGain: 5,
          robbed: 4,
          sevens: 6,
          spentAndTraded: 22,
          hand: 7,
        }),
        flow('Bob', {
          got: 29,
          devGain: 0,
          robbed: 2,
          sevens: 0,
          spentAndTraded: 18,
          hand: 9,
        }),
      ],
    });

  it('shows a row per player under the six columns', () => {
    mount(cardFlowSection, busy());

    expect(all('.flow-head').map(n => n.textContent)).toEqual([
      'GOT',
      'DEV',
      'ROBD',
      '7s',
      'SPENT',
      'HAND',
    ]);
    expect(all('.flow-name').map(n => n.textContent)).toEqual(['Alice', 'Bob']);
    expect(text('.section-hint')).toBe('whole game');
  });

  it('renders a row that reads as arithmetic that checks out', () => {
    mount(cardFlowSection, busy());
    const values = all('.flow-cell')
      .slice(0, 6)
      .map(n => Number(n.textContent));

    expect(values).toEqual([34, 5, 4, 6, 22, 7]);
    const [got, dev, robbed, sevens, spent, hand] = values;
    expect(got + dev - robbed - sevens - spent).toBe(hand);
  });

  it('dims a column that never happened', () => {
    mount(cardFlowSection, busy());
    // Bob's DEV and 7s are zero; his GOT is not.
    const bobCells = all('.flow-cell').slice(6, 12);
    expect(bobCells[0].classList.contains('flow-cell--none')).toBe(false);
    expect(bobCells[1].classList.contains('flow-cell--none')).toBe(true);
    expect(bobCells[3].classList.contains('flow-cell--none')).toBe(true);
  });

  it('explains the three columns whose meaning is not obvious', () => {
    mount(cardFlowSection, busy());
    const note = text('.section-note');
    expect(note).toContain('GOT');
    expect(note).toContain('ROBD');
    expect(note).toContain('SPENT');
  });

  it('says so before anything has moved', () => {
    mount(cardFlowSection, view());
    expect(
      (host.querySelector('.section-empty') as HTMLElement).style.display
    ).toBe('');
  });

  it('reuses its rows across updates', () => {
    const section = mount(cardFlowSection, busy());
    const first = host.querySelector('.flow-name');
    section.update(busy());
    expect(host.querySelector('.flow-name')).toBe(first);
  });
});

describe('card flow ledger section', () => {
  const ledger = () =>
    view({
      cardFlow: [
        flow('Alice', {
          gained: 44,
          dice: 41,
          robGain: 2,
          devGain: 0,
          tradeGain: 1,
          lost: 37,
          sevens: 0,
          robLoss: 4,
          monoLoss: 1,
          tradeLoss: 2,
          spent: 30,
          hand: 7,
        }),
      ],
    });

  it('splits the totals into a gained band and a lost band', () => {
    mount(cardFlowLedgerSection, ledger());

    const bands = all('.ledger-band').map(n => n.textContent);
    expect(bands).toEqual(['GAINED', 'LOST']);
    expect(all('.ledger-head').map(n => n.textContent)).toEqual([
      'ALL',
      'DICE',
      'ROB',
      'DEV',
      'TRDE',
      'ALL',
      '7s',
      'ROB',
      'MONO',
      'TRDE',
      'SPENT',
      'HAND',
    ]);
  });

  it('balances: everything gained less everything lost is the hand', () => {
    mount(cardFlowLedgerSection, ledger());

    const gained = Number(text('.ledger-total--gain'));
    const lost = Number(text('.ledger-total--loss'));
    const hand = Number(text('.ledger-hand'));
    expect(gained - lost).toBe(hand);

    // And each band's parts add up to its own total.
    const parts = all('.ledger-part').map(n => Number(n.textContent));
    expect(parts.slice(0, 4).reduce((a, b) => a + b, 0)).toBe(gained);
    expect(parts.slice(4).reduce((a, b) => a + b, 0)).toBe(lost);
  });

  it('is too wide for a rail and says so', () => {
    expect(cardFlowLedgerSection.supports).toEqual(['horizontal']);
  });
});

describe('players section', () => {
  it('shows victory points, knights and pieces left', () => {
    mount(
      playersSection,
      view({
        players: [
          player('Alice', {
            victoryPoints: 4,
            knights: 2,
            settlements: 3,
            cities: 2,
            roads: 11,
          }),
        ],
      })
    );

    expect(text('.players-name')).toBe('Alice');
    expect(text('.players-vp')).toBe('4 vp');
    // Separate spans, laid out with a gap — assert them individually rather
    // than on the run-together textContent.
    expect(all('.players-stat').map(node => node.textContent)).toEqual([
      '2 knights',
      '3 set',
      '2 cit',
      '11 rd',
    ]);
  });
});

describe('every section', () => {
  const sections: SectionDefinition[] = [
    handsSection,
    unknownStealsSection,
    cardFlowSection,
    cardFlowLedgerSection,
    blockedRobberSection,
    diceSection,
    devDeckSection,
    playersSection,
  ];

  it('renders an empty game without throwing', () => {
    for (const definition of sections) {
      expect(() => {
        const instance = mount(definition, view());
        instance.update(view());
        instance.destroy();
      }).not.toThrow();
    }
  });

  it('leaves its host empty when destroyed', () => {
    for (const definition of sections) {
      const instance = mount(definition, view({ players: [player('Alice')] }));
      instance.destroy();
      expect(host.childNodes).toHaveLength(0);
    }
  });

  it('declares the shapes it can be read in and carries its own styles', () => {
    for (const definition of sections) {
      expect(definition.supports.length).toBeGreaterThan(0);
      expect(definition.styles).toBeTruthy();
    }
  });
});
