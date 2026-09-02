import { getClient, MODEL } from './assistant';

export type ImageBlock = {
	type: 'image';
	source: { type: 'base64'; media_type: string; data: string };
};

const DESCRIBE_SYSTEM = `
    You describe photographs of industrial biomass boiler spare parts so they can be
    matched against a parts catalogue by text similarity.

    Write ONE line, under 40 words, in catalogue vocabulary rather than prose.
    Name the component type, material, mounting or connection style, and any
    distinguishing feature. Include any part number, marking or stamped text you can
    read, verbatim.

    If the photo is too unclear, too dark, or shows no identifiable component,
    reply with exactly: UNCLEAR

    Do not guess a part number that is not legible in the image. Do not add
    commentary, punctuation-heavy formatting, or a preamble.
`.trim();

export async function describePartImage(
	images: ImageBlock[],
	caption?: string
): Promise<string | null> {
	if (!images.length) return null;

	const image = images[0];

	const content: any[] = [
		{ type: 'image', source: image.source },
		{
			type: 'text',
			text: caption?.trim()
				? `Customer's note: ${caption.trim()}\n\nDescribe the component in the photo.`
				: 'Describe the component in the photo.'
		}
	];

	try {
		const res = await getClient().messages.create({
			model: MODEL,
			max_tokens: 150,
			system: DESCRIBE_SYSTEM,
			messages: [{ role: 'user', content }]
		});

		const text = res.content
			.map((b: any) => (b.type === 'text' ? b.text : ''))
			.filter(Boolean)
			.join(' ')
			.trim();

		if (!text || /^unclear\b/i.test(text)) return null;
		return text.slice(0, 500);
	} catch (e) {
		console.error('describePartImage failed:', e);
		return null;
	}
}

export function extractImages(content: unknown): ImageBlock[] {
	if (!Array.isArray(content)) return [];
	return content.filter(
		(b: any) => b?.type === 'image' && b?.source?.type === 'base64' && b.source.data
	) as ImageBlock[];
}
