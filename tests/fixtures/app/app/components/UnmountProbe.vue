<script setup lang="ts">
// Holds a resource until unmount; tests observe the release through a window event.
const timer = setInterval(() => {}, 60_000)
onUnmounted(() => {
  clearInterval(timer)
  window.dispatchEvent(new CustomEvent("unmount-probe:released"))
})
</script>

<template>
  <p>mounted</p>
</template>
