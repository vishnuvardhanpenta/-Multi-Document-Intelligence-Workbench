declare module 'pdf-parse' {
  export default function parsePdf(data: Buffer): Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
}
