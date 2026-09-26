<script setup lang="ts">
import { useElementVisibility } from "@vueuse/core"

const target = useTemplateRef<HTMLElement>("target")
const visible = useElementVisibility(target)
</script>

<template>
  <div ref="target">{{ visible ? "visible" : "hidden" }}</div>
</template>
