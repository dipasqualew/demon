import { ref, computed, watch, type Ref } from "vue";
import type { DemoMetadata } from "../types";

export function useVideoPlayer(
  videoRef: Ref<HTMLVideoElement | null>,
  currentDemo: Ref<DemoMetadata | undefined>
) {
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const isSeeking = ref(false);

  const progress = computed(() => {
    if (!duration.value) return 0;
    return (currentTime.value / duration.value) * 100;
  });

  const currentStepIndex = computed(() => {
    if (!currentDemo.value) return -1;
    const steps = currentDemo.value.steps;
    let activeIdx = -1;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].timestampSeconds <= currentTime.value) {
        activeIdx = i;
      }
    }
    return activeIdx;
  });

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  const formattedCurrentTime = computed(() => formatTime(currentTime.value));
  const formattedDuration = computed(() => formatTime(duration.value));

  function togglePlay() {
    const video = videoRef.value;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }

  function seekTo(seconds: number) {
    const video = videoRef.value;
    if (!video) return;
    video.currentTime = seconds;
  }

  function seekToPercent(percent: number) {
    const video = videoRef.value;
    if (!video || !duration.value) return;
    video.currentTime = (percent / 100) * duration.value;
  }

  function onTimeUpdate() {
    const video = videoRef.value;
    if (!video || isSeeking.value) return;
    currentTime.value = video.currentTime;
  }

  function onLoadedMetadata() {
    const video = videoRef.value;
    if (!video) return;
    duration.value = video.duration;
    currentTime.value = 0;
  }

  function onPlay() {
    isPlaying.value = true;
  }

  function onPause() {
    isPlaying.value = false;
  }

  function onEnded() {
    isPlaying.value = false;
  }

  function startSeeking() {
    isSeeking.value = true;
  }

  function endSeeking() {
    isSeeking.value = false;
  }

  watch(videoRef, (video, oldVideo) => {
    if (oldVideo) {
      oldVideo.removeEventListener("timeupdate", onTimeUpdate);
      oldVideo.removeEventListener("loadedmetadata", onLoadedMetadata);
      oldVideo.removeEventListener("play", onPlay);
      oldVideo.removeEventListener("pause", onPause);
      oldVideo.removeEventListener("ended", onEnded);
    }

    if (video) {
      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.addEventListener("play", onPlay);
      video.addEventListener("pause", onPause);
      video.addEventListener("ended", onEnded);

      if (video.readyState >= 1) {
        duration.value = video.duration;
      }
    }
  });

  return {
    isPlaying,
    currentTime,
    duration,
    progress,
    currentStepIndex,
    formattedCurrentTime,
    formattedDuration,
    togglePlay,
    seekTo,
    seekToPercent,
    startSeeking,
    endSeeking,
  };
}
