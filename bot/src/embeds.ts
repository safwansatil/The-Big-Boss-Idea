import { EmbedBuilder, type ColorResolvable } from 'discord.js';

export const COLORS = {
  good: '#2ecc71',
  alert: '#e74c3c',
  neutral: '#1abc9c',
} as const;
export type ColorKey = keyof typeof COLORS;

export function createEmbed(
  title: string,
  description: string,
  color: ColorResolvable = COLORS.neutral,
  thumbnail?: string,
) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setColor(color);

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  return embed;
}
