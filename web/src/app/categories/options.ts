/* Plain module, deliberately not the 'use server' one.

   A 'use server' file may only export async functions. Exporting these arrays
   from actions.ts passed the build and then failed at runtime with
   "m.map is not a function", because what reached the client was not an array
   at all. Constants shared with a client component live here. */

export const TINTS = [
  'green', 'orange', 'blue', 'purple', 'pink', 'cyan', 'rust', 'indigo',
] as const;

/** The glyphs a household may choose from — a broad set rather than every
 *  icon in Tabler, because a picker of five thousand is not a choice. */
export const ICONS = [
  'house2', 'cart', 'cutlery', 'car', 'bulb', 'bag', 'child', 'health',
  'phone', 'gift', 'plane', 'fuel', 'book', 'coffee', 'scissors', 'tools',
  'pet', 'gym', 'music', 'wifi', 'shield', 'charity', 'salary', 'invest', 'tag',
] as const;
