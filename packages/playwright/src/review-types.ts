export interface DemoMetadata {
  file: string;
  summary: string;
  steps: Array<{ timestampSeconds: number; text: string }>;
}

export interface ReviewMetadata {
  demos: DemoMetadata[];
}
