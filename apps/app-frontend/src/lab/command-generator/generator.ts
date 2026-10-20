import { findCommand } from './commands/registry.ts'
import type { CommandArgument } from './commands/types.ts'

function formatArgument(arg: CommandArgument, value: string | number | boolean): string {
    if (arg.type === 'boolean') {
        return String(value)
    }
    if (arg.type === 'message') {
        return `"${String(value).replace(/"/g, '\\"')}"`
    }
    return String(value)
}

export function buildCommand(
    commandId: string,
    values: Record<string, string | number | boolean>,
): string {
    const def = findCommand(commandId)
    if (!def) {
        throw new Error(`Unknown command: ${commandId}`)
    }

    const parts: string[] = [`/${def.id}`]

    for (const arg of def.arguments) {
        const value = values[arg.name]

        if (value === undefined || value === '' || value === null) {
            if (arg.required) {
                throw new Error(
                    `Required argument "${arg.name}" is missing for command "${commandId}"`,
                )
            }
            continue
        }

        if (arg.type === 'boolean') {
            if (value === true || value === 'true') {
                parts.push(arg.name)
            }
            continue
        }

        parts.push(formatArgument(arg, value))
    }

    return parts.join(' ')
}

export function validateCommand(
    commandId: string,
    values: Record<string, string | number | boolean>,
): string[] {
    const errors: string[] = []
    const def = findCommand(commandId)
    if (!def) return [`指令 "${commandId}" 不存在`]

    for (const arg of def.arguments) {
        const value = values[arg.name]

        if (arg.required && (value === undefined || value === '' || value === null)) {
            // 修复：原本使用不存在的 arg.displayName 会输出 undefined；
            // 现使用 arg.displayNameKey 作为 i18n key，调用方可自行翻译。
            errors.push(`参数 "${arg.displayNameKey}" 为必填项`)
            continue
        }

        if (value === undefined || value === '') continue

        if (arg.type === 'enum' && arg.enumValues && !arg.enumValues.includes(String(value))) {
            errors.push(`参数 "${arg.displayNameKey}" 的值 "${value}" 不在允许范围内`)
        }

        if ((arg.type === 'number' || arg.type === 'integer') && isNaN(Number(value))) {
            errors.push(`参数 "${arg.displayNameKey}" 必须为数字`)
        }

        if (arg.type === 'integer' && !Number.isInteger(Number(value))) {
            errors.push(`参数 "${arg.displayNameKey}" 必须为整数`)
        }
    }

    return errors
}

export function getDefaultValues(commandId: string): Record<string, string | number | boolean> {
    const def = findCommand(commandId)
    if (!def) return {}

    const defaults: Record<string, string | number | boolean> = {}
    for (const arg of def.arguments) {
        if (arg.defaultValue !== undefined) {
            defaults[arg.name] = arg.defaultValue
        }
    }
    return defaults
}
