export type ArgumentType =
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'enum'
    | 'coordinates'
    | 'entity-selector'
    | 'item'
    | 'block'
    | 'nbt'
    | 'message'
    | 'time'
    | 'gamemode'
    | 'difficulty'
    | 'biome'
    | 'particle'
    | 'sound'
    | 'effect'
    | 'enchantment'
    | 'attribute'
    | 'slot'
    | 'objective'
    | 'team'
    | 'advancement'   // ← 新增
    | 'gamerule'      // ← 新增

export type NbtKind = 'item' | 'entity' | 'generic'

export interface ArgumentPreset {
    labelKey: string
    value: string | number | boolean
    descriptionKey?: string
}

export interface CommandArgument {
    name: string
    displayNameKey: string
    type: ArgumentType
    required: boolean
    descriptionKey: string
    enumValues?: string[]
    defaultValue?: string | number | boolean
    selector?: boolean
    placeholder?: string
    supportsNbtEditor?: boolean
    nbtKind?: NbtKind
    presets?: ArgumentPreset[]
}

export interface ExecuteChainSubcommand {
    id: string
    labelKey: string
    descriptionKey: string
    template: string
    arguments: CommandArgument[]
}

export interface ExecuteChainCategory {
    id: string
    labelKey: string
    subcommands: ExecuteChainSubcommand[]
}

export interface CommandDefinition {
    id: string
    name: string
    descriptionKey: string
    category: CommandCategory
    permissionLevel: 0 | 1 | 2 | 3 | 4
    arguments: CommandArgument[]
    aliases?: string[]
    sinceVersion?: string
    removedVersion?: string
    isChainCommand?: boolean
    chainCategories?: ExecuteChainCategory[]
}

export type CommandCategory =
    | 'player'
    | 'world'
    | 'entity'
    | 'block'
    | 'item'
    | 'communication'
    | 'server'
    | 'data'
    | 'misc'

export interface BaseDataFile {
    version: string
    generatedAt: string
    commands: CommandDefinition[]
}

export interface PatchDataFile {
    version: string
    base: string
    generatedAt: string
    added?: CommandDefinition[]
    removed?: string[]
    patched?: Record<string, Partial<CommandDefinition>>
}

export type CommandDataFile = BaseDataFile | PatchDataFile

export interface VersionManifest {
    versions: VersionEntry[]
    defaultVersion: string
}

export interface VersionEntry {
    id: string
    label: string
    dataFile: string
}
