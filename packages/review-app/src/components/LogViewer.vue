<script setup lang="ts">
import { computed } from "vue";
import type { LogLine } from "../types";

const props = defineProps<{
  content: string;
}>();

const lines = computed<LogLine[]>(() => {
  const rawLines = props.content.split("\n").filter((l) => l.trim());
  return rawLines.map((raw, idx) => {
    const line: LogLine = {
      lineNumber: idx + 1,
      raw,
    };

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        line.timestamp = parsed.timestamp;
        line.level = parsed.level;
        line.message = parsed.message;

        if (parsed.demon__highlight !== undefined) {
          line.highlight =
            typeof parsed.demon__highlight === "string"
              ? parsed.demon__highlight
              : Boolean(parsed.demon__highlight);
        }
      }
    } catch {
      // Not valid JSON, keep raw line
    }

    return line;
  });
});

function getLevelColor(level?: string): string {
  switch (level?.toLowerCase()) {
    case "error":
      return "error";
    case "warn":
    case "warning":
      return "warning";
    case "info":
      return "info";
    case "debug":
      return "grey";
    default:
      return "grey-darken-1";
  }
}
</script>

<template>
  <div class="log-viewer" data-testid="log-viewer">
    <div class="log-content">
      <div
        v-for="line in lines"
        :key="line.lineNumber"
        class="log-line"
        :class="{
          'log-line--highlighted': line.highlight,
        }"
      >
        <span class="line-number">{{ line.lineNumber }}</span>
        <v-chip
          v-if="line.level"
          :color="getLevelColor(line.level)"
          size="x-small"
          density="compact"
          class="level-chip"
        >
          {{ line.level.toUpperCase() }}
        </v-chip>
        <span v-if="line.timestamp" class="timestamp">{{ line.timestamp }}</span>
        <span class="message">{{ line.message ?? line.raw }}</span>
        <div
          v-if="typeof line.highlight === 'string'"
          class="commentary"
        >
          <v-icon size="x-small" class="mr-1">mdi-comment-outline</v-icon>
          {{ line.highlight }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.log-viewer {
  width: 100%;
  max-height: 100%;
  overflow: auto;
  background: #0d1117;
  border-radius: 4px;
  font-family: "Fira Code", "Consolas", "Monaco", monospace;
  font-size: 13px;
}

.log-content {
  padding: 12px;
}

.log-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 2px;
  border-left: 3px solid transparent;
}

.log-line--highlighted {
  background: rgba(255, 213, 79, 0.1);
  border-left-color: #ffd54f;
}

.line-number {
  color: #6e7681;
  min-width: 32px;
  text-align: right;
  user-select: none;
}

.level-chip {
  font-size: 10px;
  font-weight: 600;
}

.timestamp {
  color: #7d8590;
  font-size: 12px;
}

.message {
  color: #e6edf3;
  flex: 1;
  word-break: break-word;
}

.commentary {
  width: 100%;
  margin-top: 4px;
  margin-left: 40px;
  padding: 8px 12px;
  background: rgba(56, 139, 253, 0.1);
  border-left: 2px solid #388bfd;
  border-radius: 2px;
  color: #79c0ff;
  font-size: 12px;
  font-style: italic;
}
</style>
