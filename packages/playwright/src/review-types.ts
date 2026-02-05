export interface DemoMetadata {
  file: string;
  summary: string;
  annotations: Array<{ timestampSeconds: number; text: string }>;
}

export interface ReviewMetadata {
  demos: DemoMetadata[];
}
