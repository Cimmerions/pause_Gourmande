import { getAppSettings } from "./settings";

export const DEFAULT_LOYALTY_THRESHOLD = 500;
export const DEFAULT_LOYALTY_REWARD = "-10%";
export const LOYALTY_THRESHOLD = DEFAULT_LOYALTY_THRESHOLD;

export async function getLoyaltySettings() {
  const settings = await getAppSettings();

  return {
    threshold:
      settings?.loyalty_threshold ?? DEFAULT_LOYALTY_THRESHOLD,

    reward:
      settings?.loyalty_reward ?? DEFAULT_LOYALTY_REWARD,
  };
}

export function capLoyaltyPoints(
  currentPoints: number,
  earnedPoints: number,
  threshold: number = DEFAULT_LOYALTY_THRESHOLD
) {
  return Math.min(
    threshold,
    Math.max(0, currentPoints) + Math.max(0, earnedPoints)
  );
}