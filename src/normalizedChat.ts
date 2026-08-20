import type { LoggedMessage } from './messageLogger.js';
import type { PlayerColorName } from './playerColors.js';

export type GameChatEntryKind =
  | 'player-chat'
  | 'trade-offer'
  | 'game-event'
  | 'system'
  | 'separator';

export interface KnownChatPlayer {
  name: string;
  color: number | null;
  colorName: PlayerColorName;
}

export interface ChatColorMention {
  colorName: PlayerColorName;
  playerName: string;
  playerColor: number;
}

export interface GameChatEntry {
  /** Colonist's chronological chat/feed index. */
  index: number;
  kind: GameChatEntryKind;
  speakerName: string | null;
  speakerColor: number | null;
  speakerColorName: PlayerColorName | null;
  /** Active players addressed by color words such as "Black" or "Red". */
  colorMentions: ChatColorMention[];
  /** Original textContent, which omits resource/dice images. */
  text: string;
  /** Model-friendly text with image alt text inserted, e.g. "[Grain]". */
  richText: string;
  /** richText with the leading speaker name/colon removed. */
  message: string;
  iconAlts: string[];
  loggedAt: string;
}

const TRADE_PATTERN =
  /\b(wants to give|proposed counter offer|gave .+ got|traded with|accepted .+ offer)\b/i;
const GAME_EVENT_PATTERN =
  /\b(placed|built|rolled|got|received|bought|used|played|stole|discarded|moved robber|has disconnected|has reconnected|is inactive|took from bank|won the game)\b/i;

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    '#039': "'",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code: string) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const radix = code[1]?.toLowerCase() === 'x' ? 16 : 10;
    const digits = radix === 16 ? code.slice(2) : code.slice(1);
    const value = Number.parseInt(digits, radix);
    return Number.isFinite(value) ? String.fromCodePoint(value) : entity;
  });
}

function extractRichText(
  html: string,
  fallbackText: string
): {
  richText: string;
  iconAlts: string[];
} {
  const iconAlts: string[] = [];
  const withIcons = html.replace(
    /<img\b[^>]*\balt=(?:"([^"]*)"|'([^']*)')[^>]*>/gi,
    (
      _match,
      doubleQuoted: string | undefined,
      singleQuoted: string | undefined
    ) => {
      const alt = decodeHtmlEntities(doubleQuoted ?? singleQuoted ?? '').trim();
      if (/^(player avatar|bot)$/i.test(alt)) return ' ';
      if (alt) iconAlts.push(alt);
      return alt ? ` [${alt}] ` : ' ';
    }
  );
  const richText = decodeHtmlEntities(
    withIcons
      .replace(/<hr\b[^>]*>/gi, ' ')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();

  return { richText: richText || fallbackText, iconAlts };
}

function findSpeaker(
  richText: string,
  players: KnownChatPlayer[]
): KnownChatPlayer | null {
  return (
    [...players]
      .filter(player => player.name)
      .sort((a, b) => b.name.length - a.name.length)
      .find(
        player =>
          richText === player.name ||
          richText.startsWith(`${player.name} `) ||
          richText.startsWith(`${player.name}:`) ||
          richText.startsWith(`${player.name} -`)
      ) ?? null
  );
}

function classifyMessage(
  message: LoggedMessage,
  speaker: KnownChatPlayer | null,
  richText: string
): GameChatEntryKind {
  if (!message.text && /<hr\b/i.test(message.html)) return 'separator';
  if (speaker && TRADE_PATTERN.test(richText)) return 'trade-offer';
  if (speaker && GAME_EVENT_PATTERN.test(richText)) return 'game-event';
  if (speaker) return 'player-chat';
  return 'system';
}

function findColorMentions(
  richText: string,
  players: KnownChatPlayer[]
): ChatColorMention[] {
  const mentions: ChatColorMention[] = [];
  for (const player of players) {
    if (player.color === null || player.colorName === 'unknown') continue;
    const pattern = new RegExp(`\\b${player.colorName}\\b`, 'i');
    if (
      pattern.test(richText) &&
      !mentions.some(mention => mention.playerColor === player.color)
    ) {
      mentions.push({
        colorName: player.colorName,
        playerName: player.name,
        playerColor: player.color,
      });
    }
  }
  return mentions;
}

/** Normalize the complete Colonist feed without discarding its original rows. */
export function normalizeChatLog(
  messages: LoggedMessage[],
  players: KnownChatPlayer[]
): GameChatEntry[] {
  return [...messages]
    .sort((a, b) => a.index - b.index)
    .map(message => {
      const { richText, iconAlts } = extractRichText(
        message.html,
        message.text
      );
      const speaker = findSpeaker(richText, players);
      const speakerless = speaker
        ? richText
            .slice(speaker.name.length)
            .replace(/^\s*(?::|-)\s*/, '')
            .trim()
        : richText;
      return {
        index: message.index,
        kind: classifyMessage(message, speaker, richText),
        speakerName: speaker?.name ?? null,
        speakerColor: speaker?.color ?? null,
        speakerColorName: speaker?.colorName ?? null,
        colorMentions: findColorMentions(richText, players),
        text: message.text,
        richText,
        message: speakerless,
        iconAlts,
        loggedAt: message.loggedAt,
      };
    });
}
