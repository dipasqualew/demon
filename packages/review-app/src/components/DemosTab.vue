<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useReviewData } from "../composables/useReviewData";
import { useVideoPlayer } from "../composables/useVideoPlayer";
import VideoPlayer from "./VideoPlayer.vue";
import DemoList from "./DemoList.vue";
import StepsList from "./StepsList.vue";

const { demos, videos } = useReviewData();

const activeIndex = ref(0);
const currentDemo = computed(() => demos.value[activeIndex.value]);

const videoRef = ref<HTMLVideoElement | null>(null);
const { currentStepIndex, seekTo } = useVideoPlayer(videoRef, currentDemo);

const videoSrc = computed(() => {
  const demo = currentDemo.value;
  if (!demo) return "";

  const base64Video = videos.value[demo.file];
  if (base64Video) {
    return base64Video;
  }

  return demo.file;
});

function selectDemo(index: number) {
  activeIndex.value = index;
}

function handleSeek(timestampSeconds: number) {
  seekTo(timestampSeconds);
  videoRef.value?.play();
}

watch(currentDemo, () => {
  if (videoRef.value) {
    videoRef.value.load();
  }
});
</script>

<template>
  <div class="demos-tab" id="tab-demos" data-testid="demos-tab">
    <div class="review-layout">
      <div class="video-panel">
        <VideoPlayer
          v-if="currentDemo"
          :src="videoSrc"
          :demo="currentDemo"
        />
      </div>
      <div class="side-panel pa-4">
        <DemoList
          :demos="demos"
          :active-index="activeIndex"
          @select="selectDemo"
        />

        <div class="mt-4">
          <h2 class="text-primary text-subtitle-1 font-weight-bold mb-2">
            Summary
          </h2>
          <p class="text-grey-lighten-1 text-body-2" id="summary-text">
            {{ currentDemo?.summary }}
          </p>
        </div>

        <div class="mt-4" v-if="currentDemo">
          <StepsList
            :steps="currentDemo.steps"
            :active-step-index="currentStepIndex"
            @seek="handleSeek"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demos-tab {
  padding: 1rem 0;
}

.review-layout {
  display: flex;
  height: 600px;
}

.video-panel {
  flex: 4;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f0f23;
}

.side-panel {
  flex: 1;
  min-width: 260px;
  max-width: 360px;
  overflow-y: auto;
  background: #16213e;
  border-left: 1px solid #0f3460;
}
</style>
