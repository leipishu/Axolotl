import type { ContentItem } from '@modrinth/ui'
import { confirmedContentGroupKey } from '@modrinth/ui'

import type { InstallJobSnapshot } from './install'
import type { ResourceOperationPlan, SourceReleaseRef } from './resources'

export { confirmedContentGroupKey } from '@modrinth/ui'

export interface ResourceEntryReview {
    instanceId: string
    instanceName: string
    entryIds: string[]
    intent: 'switchVersion' | 'update'
    release: SourceReleaseRef | null
    installDependencies: boolean
}

export async function reviewResourceEntryChanges(
    input: Omit<ResourceEntryReview, 'intent'>,
    show: (input: ResourceEntryReview) => Promise<InstallJobSnapshot | null>,
    track: (job: InstallJobSnapshot) => void,
): Promise<boolean> {
    const entryIds = [...new Set(input.entryIds)]
    if (!entryIds.length) return false
    const job = await show({
        ...input,
        entryIds,
        intent: input.release ? 'switchVersion' : 'update',
    })
    if (!job) return false
    track(job)
    return true
}

export async function queueResourceEntryChanges(
    input: Pick<ResourceEntryReview, 'instanceId' | 'entryIds' | 'release'>,
    prepare: (
        instanceId: string,
        intent: 'update' | 'switchVersion',
        entryIds: string[],
        release: SourceReleaseRef | null,
        installDependencies: boolean,
        signal: undefined,
        onProgress: undefined,
        resolveDependencies: boolean,
    ) => Promise<ResourceOperationPlan>,
    queue: (planId: string, revision: number) => Promise<InstallJobSnapshot>,
    track: (job: InstallJobSnapshot) => void,
): Promise<boolean> {
    const entryIds = [...new Set(input.entryIds)]
    if (!entryIds.length) return false
    const plan = await prepare(
        input.instanceId,
        input.release ? 'switchVersion' : 'update',
        entryIds,
        input.release,
        false,
        undefined,
        undefined,
        false,
    )
    const blocking = plan.issues.find((issue) => issue.blocking)
    if (blocking) throw new Error(blocking.message)
    if (!plan.actions.length) return false
    const job = await queue(plan.id, plan.revision)
    track(job)
    return true
}

export function duplicateGroupUpdateEntries(items: ContentItem[], anchor: ContentItem): string[] {
    const group = confirmedContentGroupKey(anchor)
    if (!group) return []
    return [
        ...new Set(
            items
                .filter(
                    (item) =>
                        confirmedContentGroupKey(item) === group &&
                        item.instanceMaterializationState === 'present' &&
                        item.instanceCapabilities?.canUpdate !== false &&
                        ((item.resourceUpdate !== null && item.resourceUpdate !== undefined) ||
                            (item.update !== null && item.update !== undefined)),
                )
                .flatMap((item) => (item.instanceEntryId ? [item.instanceEntryId] : [])),
        ),
    ]
}
