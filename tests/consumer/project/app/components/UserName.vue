<script setup lang="ts">
const user = useUser()
const route = useRoute()
</script>

<template>
  <p>{{ user?.name ?? "anonymous" }} at {{ route.path }}</p>
</template>
