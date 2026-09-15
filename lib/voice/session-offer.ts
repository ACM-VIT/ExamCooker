import { z } from "zod";

export const VoiceSessionOfferSchema = z
  .object({
    // SDP is a wire format: its terminating CRLF must reach OpenAI unchanged.
    // Check for blank input without transforming the browser's offer.
    sdp: z.string().min(1).max(65_536).refine((value) => value.trim().length > 0),
  })
  .strict();
