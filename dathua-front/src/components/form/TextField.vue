<template>
  <label class="block">
    <span class="block text-xs font-medium text-dathua-text-soft mb-1.5">{{ label }}</span>
    <input
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      :disabled="disabled"
      class="w-full bg-dathua-bg border rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 transition-colors duration-200 focus:outline-none focus:ring-1 disabled:opacity-60 disabled:cursor-not-allowed"
      :class="error
        ? 'border-red-400/60 focus:border-red-400 focus:ring-red-400/50'
        : 'border-dathua-border focus:border-dathua-orange focus:ring-dathua-orange/50'"
      @blur="$emit('blur', $event)"
    />
    <span v-if="error" class="block text-[11px] text-red-400 mt-1.5">{{ error }}</span>
  </label>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  required: { type: Boolean, default: false },
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
defineEmits(['blur'])

const model = defineModel({ type: String, default: '' })
</script>
