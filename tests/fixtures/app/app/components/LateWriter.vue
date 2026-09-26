<script setup lang="ts">
const late = useState<number | undefined>("late")
onUnmounted(() => {
  // Lands after unmount through an already-resolved promise; cleanup must flush it before clearing state.
  void Promise.resolve().then(() => {
    late.value = 1
  })
})
</script>

<template>
  <p>late writer</p>
</template>
