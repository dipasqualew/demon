import { computed } from "vue";
import type { ReviewAppData } from "../types";
import { mockData } from "../mock-data";

declare global {
  interface Window {
    __REVIEW_DATA__?: ReviewAppData | string;
  }
}

function parseReviewData(): ReviewAppData {
  const rawData = window.__REVIEW_DATA__;

  // If no data or data starts with placeholder markers, use mock data
  if (!rawData || (typeof rawData === "string" && (rawData.startsWith("__") || rawData.startsWith("{{"))) ) {
    return mockData;
  }

  if (typeof rawData === "string") {
    try {
      return JSON.parse(rawData) as ReviewAppData;
    } catch {
      console.warn("Failed to parse __REVIEW_DATA__, using mock data");
      return mockData;
    }
  }

  return rawData;
}

const reviewData = parseReviewData();

export function useReviewData() {
  const data = computed(() => reviewData);
  const metadata = computed(() => reviewData.metadata);
  const title = computed(() => reviewData.title);
  const videos = computed(() => reviewData.videos);
  const hasReview = computed(() => !!reviewData.metadata.review);
  const review = computed(() => reviewData.metadata.review);
  const demos = computed(() => reviewData.metadata.demos);

  return {
    data,
    metadata,
    title,
    videos,
    hasReview,
    review,
    demos,
  };
}
