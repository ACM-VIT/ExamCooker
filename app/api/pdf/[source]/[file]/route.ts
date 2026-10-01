import { servePublicPdf } from "@/lib/pdf/public-delivery";

export async function GET(request: Request, context: {
  params: Promise<{ source: string; file: string }>;
}) {
  const { source, file } = await context.params;
  return servePublicPdf(source, file, request.signal);
}
