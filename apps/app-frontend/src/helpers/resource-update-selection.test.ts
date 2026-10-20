import assert from 'node:assert/strict'
import test from 'node:test'

import type { ContentItem } from '@modrinth/ui'

import type { InstallJobSnapshot } from './install.ts'
import {
    confirmedContentGroupKey,
    duplicateGroupUpdateEntries,
    queueResourceEntryChanges,
    type ResourceEntryReview,
    reviewResourceEntryChanges,
} from './resource-update-selection.ts'
import type { ResourceOperationPlan } from './resources.ts'

function item(entry: string, overrides: Partial<ContentItem> = {}): ContentItem {
    return {
        id: entry,
        instanceEntryId: entry,
        instanceResourceId: 'confirmed',
        project_type: 'mod',
        file_path: `mods/${entry}.jar`,
        instanceMaterializationState: 'present',
        resourceUpdate: { project: { source: 'modrinth', projectId: 'project' }, releaseId: 'new' },
        ...overrides,
    } as ContentItem
}

test('installed mod changes queue only the selected entries with dependency resolution disabled', async () => {
    for (const release of [
        null,
        { project: { source: 'modrinth', projectId: 'project' }, releaseId: 'fixed' },
    ]) {
        const tracked: string[] = []
        const result = await queueResourceEntryChanges(
            { instanceId: 'instance', entryIds: ['a', 'b', 'a'], release },
            async (...args) => {
                assert.deepEqual(args, [
                    'instance',
                    release ? 'switchVersion' : 'update',
                    ['a', 'b'],
                    release,
                    false,
                    undefined,
                    undefined,
                    false,
                ])
                return {
                    id: 'plan',
                    revision: 3,
                    actions: [{}],
                    issues: [],
                } as unknown as ResourceOperationPlan
            },
            async (id, revision) => {
                assert.equal(id, 'plan')
                assert.equal(revision, 3)
                return { job_id: 'direct' } as InstallJobSnapshot
            },
            (job) => tracked.push(job.job_id),
        )
        assert.equal(result, true)
        assert.deepEqual(tracked, ['direct'])
    }
})

test('direct changes do not queue empty or blocked plans', async () => {
    for (const blocked of [false, true]) {
        let queued = false
        const action = queueResourceEntryChanges(
            { instanceId: 'instance', entryIds: ['a'], release: null },
            async () =>
                ({
                    id: 'plan',
                    revision: 1,
                    actions: [],
                    issues: blocked ? [{ blocking: true, message: 'incompatible' }] : [],
                }) as unknown as ResourceOperationPlan,
            async () => {
                queued = true
                return {} as InstallJobSnapshot
            },
            () => assert.fail('must not track'),
        )
        if (blocked) await assert.rejects(action, /incompatible/)
        else assert.equal(await action, false)
        assert.equal(queued, false)
    }
})

test('duplicate group update includes every actual updatable entry across sources and versions', () => {
    const anchor = item('a')
    const copies = [
        anchor,
        item('b', { origin_provider: 'curseforge' }),
        item('b'),
        item('c', { resourceUpdate: null }),
        item('missing', { instanceMaterializationState: 'missing' }),
        item('other', { instanceResourceId: 'another' }),
    ]
    assert.deepEqual(duplicateGroupUpdateEntries(copies, anchor), ['a', 'b'])
    assert.equal(
        confirmedContentGroupKey(item('unverified', { instanceResourceId: undefined })),
        null,
    )
})

test('world scopes and content types stay independent', () => {
    const a = item('a', { project_type: 'datapack', file_path: 'saves/one/datapacks/a.zip' })
    const b = item('b', { project_type: 'datapack', file_path: 'saves/two/datapacks/b.zip' })
    const c = item('c', {
        project_type: 'datapack',
        file_path: 'saves/one/datapacks/c.zip.disabled',
    })
    assert.deepEqual(duplicateGroupUpdateEntries([a, b, c, item('mod')], a), ['a', 'c'])
    assert.equal(confirmedContentGroupKey(item('invalid', { project_type: 'datapack' })), null)
})

test('single, selected, all and duplicate updates retain exact entries and dependency preferences for review', async () => {
    for (const entryIds of [
        ['single'],
        ['a', 'b'],
        ['a', 'b', 'c'],
        ['copy-a', 'copy-b', 'copy-a'],
    ]) {
        for (const installDependencies of [false, true]) {
            let reviewed: ResourceEntryReview | undefined
            const tracked: string[] = []
            const result = await reviewResourceEntryChanges(
                {
                    instanceId: 'instance',
                    instanceName: 'Example',
                    entryIds,
                    release: null,
                    installDependencies,
                },
                async (input) => {
                    reviewed = input
                    assert.deepEqual(tracked, [])
                    return { job_id: 'reviewed' } as InstallJobSnapshot
                },
                (job) => {
                    tracked.push(job.job_id)
                },
            )
            assert.equal(result, true)
            assert.deepEqual(reviewed?.entryIds, [...new Set(entryIds)])
            assert.equal(reviewed?.installDependencies, installDependencies)
            assert.equal(reviewed?.intent, 'update')
            assert.deepEqual(tracked, ['reviewed'])
        }
    }
})

test('cancelled and failed previews do not track a job or alter selected entries', async () => {
    const input = {
        instanceId: 'instance',
        instanceName: 'Example',
        entryIds: ['entry'],
        release: null,
        installDependencies: false,
    }
    let tracked = false
    const track = () => {
        tracked = true
    }
    assert.equal(await reviewResourceEntryChanges(input, async () => null, track), false)
    await assert.rejects(
        reviewResourceEntryChanges(
            input,
            async () => {
                throw new Error('source unavailable')
            },
            track,
        ),
    )
    assert.equal(tracked, false)
    assert.deepEqual(input.entryIds, ['entry'])
})
