import { callGoogle } from "./providers/google";
import type { ChatRequest, ChatResponse, ProviderId } from "./types";

// Hardcoded for MVP. Selector lands when a second provider arrives.
export const DEFAULT_PROVIDER: ProviderId = "google";
export const DEFAULT_MODEL = "gemini-2.5-flash";

export async function chat(
  provider: ProviderId,
  apiKey: string,
  model: string,
  req: ChatRequest,
): Promise<ChatResponse> {
  switch (provider) {
    case "google":
      return callGoogle(apiKey, model, req);
  }
}
