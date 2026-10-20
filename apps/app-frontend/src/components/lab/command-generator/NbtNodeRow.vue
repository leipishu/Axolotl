<template>
    <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2" :style="{ paddingLeft: `${depth * 16}px` }">
            <input
                class="w-28 rounded border border-solid border-surface-4 bg-surface-2 px-2 py-1 text-xs"
                :value="node.name"
                @input="$emit('update', node.id, 'name', ($event.target as HTMLInputElement).value)"
            />
            <select
                class="rounded border border-solid border-surface-4 bg-surface-2 px-1 py-1 text-xs"
                :value="node.type"
                @change="
                    $emit('update', node.id, 'type', ($event.target as HTMLSelectElement).value)
                "
            >
                <option value="string">字符串</option>
                <option value="int">整数</option>
                <option value="short">短整</option>
                <option value="byte">字节</option>
                <option value="float">浮点</option>
                <option value="double">双精度</option>
                <option value="compound">复合</option>
                <option value="list">列表</option>
            </select>
            <input
                v-if="node.type !== 'compound' && node.type !== 'list'"
                class="flex-1 rounded border border-solid border-surface-4 bg-surface-2 px-2 py-1 text-xs"
                :value="String(node.value)"
                @input="
                    $emit('update', node.id, 'value', ($event.target as HTMLInputElement).value)
                "
            />
            <span v-else class="flex-1 text-xs text-secondary"
                >{{ node.children?.length ?? 0 }} 个子项</span
            >
            <button
                v-if="node.type === 'compound' || node.type === 'list'"
                class="rounded px-1 text-xs text-brand hover:bg-surface-3"
                @click="$emit('add-child', node.id)"
            >
                +
            </button>
            <button
                class="rounded px-1 text-xs text-red-500 hover:bg-surface-3"
                @click="$emit('remove', node.id)"
            >
                ×
            </button>
        </div>
        <NbtNodeRow
            v-for="child in node.children"
            :key="child.id"
            :node="child"
            :depth="depth + 1"
            @update="(id, f, v) => $emit('update', id, f, v)"
            @remove="(id) => $emit('remove', id)"
            @add-child="(id) => $emit('add-child', id)"
        />
    </div>
</template>

<script setup lang="ts">
import type { NbtTagNode } from '../../../lab/command-generator/nbt-tree'

defineProps<{
    node: NbtTagNode
    depth: number
}>()

defineEmits<{
    update: [id: string, field: string, value: string]
    remove: [id: string]
    'add-child': [id: string]
}>()
</script>
