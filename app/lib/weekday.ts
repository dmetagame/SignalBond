import type { Signal } from "./types";

export type WeekdayBucket = {
  index: number;
  label: string;
  count: number;
};

const LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function computeWeekdayActivity(signals: Signal[]): {
  buckets: WeekdayBucket[];
  peakIndex: number;
  peakCount: number;
} {
  const counts = new Array(7).fill(0);
  for (const signal of signals) {
    const day = new Date(signal.createdAt).getUTCDay();
    counts[day] += 1;
  }
  const peakCount = Math.max(...counts);
  const peakIndex = counts.indexOf(peakCount);

  return {
    buckets: counts.map((count, index) => ({
      index,
      label: LABELS[index],
      count,
    })),
    peakIndex,
    peakCount,
  };
}
